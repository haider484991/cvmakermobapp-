/**
 * Self-updating model registry.
 *
 * Problem this solves: OpenRouter deprecates model IDs without warning.
 * We were burned twice (grok-4.1-fast → 404, gemini-2.0-flash-001 → "No
 * endpoints found") and each time it cost a code change + store release.
 *
 * Model selection now works in three layers:
 *
 *   1. PREFERRED chains below — hand-ordered by quality-per-dollar
 *      (checked against live pricing 2026-08-16). At runtime they are
 *      validated against OpenRouter's live catalog (GET /api/v1/models,
 *      unauthenticated); entries that no longer exist are dropped.
 *   2. If every preferred entry is gone, a replacement chain is
 *      auto-discovered from the live catalog: right input modality,
 *      JSON-mode support, sane price, major lab.
 *   3. Callers also send the whole chain via OpenRouter's `models`
 *      fallback array, so a deprecation that happens between catalog
 *      refreshes still falls through server-side.
 *
 * The catalog is cached in AsyncStorage for 24h and refreshed in the
 * background at app start (initModelRegistry). Every layer degrades
 * gracefully: no network + no cache still yields the hardcoded chain.
 */

import { createAIError } from '@/lib/openrouter';

export type AICapability = 'parse' | 'text-quality' | 'text-fast';

/** Compact per-model facts extracted from the catalog (prices are $/M tokens). */
export interface CatalogModel {
  id: string;
  inPrice: number;
  outPrice: number;
  ctx: number;
  vision: boolean;
  json: boolean;
}

/**
 * Preference chains, best value first. Live pricing when last reviewed:
 *   gemini-2.5-flash       $0.30 in / $2.50 out  — proven on our resume parses
 *   gpt-5-mini             $0.25 in / $2.00 out  — strong cross-provider backup
 *   gemini-2.5-flash-lite  $0.10 in / $0.40 out
 *   gpt-5-nano             $0.05 in / $0.40 out
 *   deepseek-v4-flash      $0.06 in / $0.13 out  (text only)
 *   qwen3.7-flash          $0.03 in / $0.13 out
 * (For comparison, the old hardcoded x-ai/grok-4.3 is $1.25 in / $2.50 out.)
 */
const PREFERRED: Record<AICapability, string[]> = {
  // Vision + JSON + long output. Quality first: the import parse is the
  // killer feature and even the priciest entry costs well under a cent per
  // resume, so we don't lead with the cheapest model here.
  parse: [
    'google/gemini-2.5-flash',
    'openai/gpt-5-mini',
    'google/gemini-2.5-flash-lite',
    'openai/gpt-5-nano',
  ],
  // Score, tailor, narrative-to-resume, summaries, cover letters.
  'text-quality': [
    'google/gemini-2.5-flash',
    'openai/gpt-5-mini',
    'google/gemini-2.5-flash-lite',
    'deepseek/deepseek-v4-flash',
  ],
  // Bullets, skills, single-line rewrites — high volume, cheap and fast.
  'text-fast': [
    'google/gemini-2.5-flash-lite',
    'openai/gpt-5-nano',
    'deepseek/deepseek-v4-flash',
    'qwen/qwen3.7-flash',
  ],
};

/** Env overrides win over everything — a future breakage stays a config change. */
const ENV_OVERRIDES: Record<AICapability, string | undefined> = {
  parse: process.env.EXPO_PUBLIC_PARSE_MODEL,
  'text-quality': process.env.EXPO_PUBLIC_TEXT_QUALITY_MODEL,
  'text-fast': process.env.EXPO_PUBLIC_TEXT_FAST_MODEL,
};

const CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_KEY = 'openrouter_catalog_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh daily
const MAX_CHAIN = 4;

/** Discovery guardrails: majors only, must not be free-tier or batch variants. */
const DISCOVERY_PROVIDERS =
  /^(google|openai|anthropic|x-ai|qwen|deepseek|mistralai|meta-llama)\//;
const DISCOVERY_MAX_OUT_PRICE = 6; // $/M
const DISCOVERY_MAX_IN_PRICE = 2; // $/M
const DISCOVERY_MIN_CTX = 60_000;

/**
 * AsyncStorage is loaded lazily so this module also runs under plain node
 * (tests, smoke scripts) where the native module isn't available.
 */
interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
let kvStore: KVStore | null | undefined;
function getKVStore(): KVStore | null {
  if (kvStore === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      kvStore = require('@react-native-async-storage/async-storage').default as KVStore;
    } catch {
      kvStore = null;
    }
  }
  return kvStore ?? null;
}

interface CatalogSnapshot {
  fetchedAt: number;
  models: CatalogModel[];
}

let memory: CatalogSnapshot | null = null;
let inflight: Promise<void> | null = null;

function compactModel(raw: any): CatalogModel | null {
  if (!raw?.id || !raw.pricing) return null;
  const inputs: string[] = raw.architecture?.input_modalities ?? [];
  const params: string[] = raw.supported_parameters ?? [];
  return {
    id: String(raw.id),
    inPrice: parseFloat(raw.pricing.prompt ?? '0') * 1e6,
    outPrice: parseFloat(raw.pricing.completion ?? '0') * 1e6,
    ctx: Number(raw.context_length ?? 0),
    vision: inputs.includes('image'),
    json: params.includes('response_format') || params.includes('structured_outputs'),
  };
}

async function loadPersisted(): Promise<void> {
  if (memory) return;
  const store = getKVStore();
  if (!store) return;
  try {
    const raw = await store.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CatalogSnapshot;
    if (Array.isArray(parsed?.models) && parsed.models.length > 0) {
      memory = parsed; // a stale catalog still beats no catalog
    }
  } catch {
    // corrupt cache — ignore, we'll refetch
  }
}

async function fetchCatalog(): Promise<void> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const body = await res.json();
  const models = (body?.data ?? [])
    .map(compactModel)
    .filter((m: CatalogModel | null): m is CatalogModel => m !== null);
  if (models.length === 0) throw new Error('catalog fetch returned no models');
  memory = { fetchedAt: Date.now(), models };
  const store = getKVStore();
  if (store) {
    store.setItem(CACHE_KEY, JSON.stringify(memory)).catch(() => {});
  }
}

/**
 * Make sure we have the freshest catalog we can get without ever throwing:
 * persisted cache → network refresh if stale → whatever we have (or null).
 */
async function ensureCatalog(): Promise<void> {
  await loadPersisted();
  const fresh = memory && Date.now() - memory.fetchedAt < CACHE_TTL_MS;
  if (fresh) return;
  if (!inflight) {
    inflight = fetchCatalog()
      .catch(() => {}) // offline / API down — keep stale memory or null
      .finally(() => {
        inflight = null;
      });
  }
  await inflight;
}

function discoverChain(capability: AICapability, catalog: CatalogModel[]): string[] {
  return catalog
    .filter(
      (m) =>
        DISCOVERY_PROVIDERS.test(m.id) &&
        !m.id.includes(':') && // skip :free/:batch/:nitro/:thinking variants
        m.json &&
        m.ctx >= DISCOVERY_MIN_CTX &&
        m.outPrice > 0 &&
        m.outPrice <= DISCOVERY_MAX_OUT_PRICE &&
        m.inPrice <= DISCOVERY_MAX_IN_PRICE &&
        (capability !== 'parse' || m.vision)
    )
    // Most expensive under the cap ≈ most capable affordable model. This is
    // an emergency heuristic only — it runs when every preferred model died.
    .sort((a, b) => b.outPrice - a.outPrice)
    .slice(0, MAX_CHAIN)
    .map((m) => m.id);
}

/**
 * Resolve the model chain for a capability: env override first, then the
 * preferred models that still exist, then auto-discovery, then (offline,
 * no cache) the raw preferred list. Never throws, never returns empty.
 */
export async function resolveModelChain(capability: AICapability): Promise<string[]> {
  await ensureCatalog();

  const override = ENV_OVERRIDES[capability];
  const preferred = PREFERRED[capability];

  let chain: string[];
  if (!memory) {
    chain = [...preferred];
  } else {
    const live = new Set(memory.models.map((m) => m.id));
    chain = preferred.filter((id) => live.has(id));
    if (chain.length === 0) {
      chain = discoverChain(capability, memory.models);
    }
    if (chain.length === 0) {
      chain = [...preferred]; // catalog looks broken — trust our defaults
    }
  }

  // An explicit override is kept even if the catalog doesn't list it (the
  // operator may know better) — but the validated chain rides behind it.
  if (override) {
    chain = [override, ...chain.filter((id) => id !== override)];
  }

  return chain.slice(0, MAX_CHAIN);
}

/**
 * Warm the catalog in the background. Call once at app start; failures are
 * silent because every consumer degrades to the hardcoded chains anyway.
 */
export function initModelRegistry(): void {
  ensureCatalog().catch(() => {});
}

/** Exposed for the unlikely "everything failed" path and for diagnostics. */
export async function getCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  await ensureCatalog();
  return memory;
}

/** Guard used by callers that must not run without any model at all. */
export function assertChain(chain: string[]): void {
  if (!chain.length) {
    throw createAIError('MODEL_UNAVAILABLE', 'No AI model is currently available.');
  }
}
