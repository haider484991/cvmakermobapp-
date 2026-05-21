/**
 * Translate src/i18n/locales/en.json into every other supported locale.
 *
 * Strategy:
 *   - Walks the en.json tree, preserving the exact key structure.
 *   - For each target language, sends the whole JSON to Grok-4.3 with a
 *     system prompt that locks the structure and forbids translating
 *     interpolation placeholders ({{var}}) or the brand name.
 *   - Validates JSON shape (same keys) before writing.
 *
 * Why one big request per language instead of per-string?
 *   - Cheaper (~1 prompt + 1 completion vs hundreds)
 *   - Maintains tone consistency across the whole UI
 *   - Grok-4.3 is plenty capable at structured JSON
 *
 * Usage:
 *   node scripts/translate-strings.mjs                  # translate all missing locales
 *   node scripts/translate-strings.mjs --force          # re-translate even if files exist
 *   node scripts/translate-strings.mjs --only=fr,de     # only these locales
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

// Read API key from .env (the simple way — node doesn't auto-load .env)
const envText = readFileSync(path.join(ROOT, '.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const KEY = env.EXPO_PUBLIC_OPENROUTER_API_KEY;
if (!KEY) {
  console.error('Missing EXPO_PUBLIC_OPENROUTER_API_KEY in .env');
  process.exit(1);
}

/**
 * Locales to translate into. Each entry is the file name (and key code used
 * by react-i18next) plus the full language name shown to Grok.
 */
const TARGETS = [
  { code: 'pt-BR', name: 'Brazilian Portuguese' },
  { code: 'hi', name: 'Hindi (Devanagari script)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'ar', name: 'Modern Standard Arabic (Arabic script, right-to-left)' },
  { code: 'fr', name: 'French (France)' },
  { code: 'de', name: 'German (Germany)' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh-CN', name: 'Simplified Chinese (mainland China)' },
];

// CLI parse
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;

if (!existsSync(EN_PATH)) {
  console.error(`Source file not found: ${EN_PATH}`);
  process.exit(1);
}
const enRaw = readFileSync(EN_PATH, 'utf8');
const enJson = JSON.parse(enRaw);

function collectKeys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...collectKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}
const enKeys = new Set(collectKeys(enJson));

const SYSTEM_PROMPT = `You are an expert mobile app localizer. Your job is to translate a JSON file containing UI strings for FreeResume AI, a mobile resume / CV builder app for job seekers.

CRITICAL RULES — non-negotiable:
1. Output ONLY valid JSON. No prose, no markdown fences, no explanation.
2. Preserve the EXACT JSON structure: same keys, same nesting, same types.
3. Never translate placeholders inside double curly braces — keep "{{count}}", "{{name}}", "{{current}}", "{{total}}", "{{free}}", "{{premium}}", "{{value}}", "{{date}}" untouched.
4. Never translate the brand name "FreeResume AI" — keep it as-is.
5. Never translate the literal words "PDF", "ATS", "AI", "LinkedIn", "Word", "Letter", "A4" — these are universally understood technical terms in resume contexts.
6. Match the target language's natural app marketing tone (confident, friendly, professional — not literal word-for-word).
7. Honor character constraints implicit in the source — UI buttons should stay short.
8. For pluralization keys like "subtitle_plural", produce a natural plural form in the target language.
9. Preserve special characters like "•", "·", "—", "✨", "🎨" exactly.

Output the translated JSON object only.`;

async function translate(targetCode, targetName) {
  console.log(`[translate] ${targetCode} (${targetName})...`);
  const userPrompt = `Translate this UI JSON from English into ${targetName}. Return ONLY the translated JSON object.\n\n${enRaw}`;

  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      'HTTP-Referer': 'https://freeresumeai.app',
      'X-Title': 'FreeResume AI Translator',
    },
    body: JSON.stringify({
      model: 'x-ai/grok-4.3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 6000,
    }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`HTTP ${r.status}: ${err?.error?.message || 'unknown'}`);
  }
  const data = await r.json();
  let content = data?.choices?.[0]?.message?.content?.trim() || '';

  // Strip markdown fences if model wrapped them despite instructions
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON from model: ${e.message}\nFirst 500 chars:\n${content.slice(0, 500)}`);
  }

  const outKeys = new Set(collectKeys(parsed));
  const missing = [...enKeys].filter((k) => !outKeys.has(k));
  const extra = [...outKeys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    console.warn(`  ⚠ key drift — missing: ${missing.length}, extra: ${extra.length}`);
    if (missing.length) console.warn(`    missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  }

  const dt = Date.now() - t0;
  const tokens = data?.usage?.total_tokens || 0;
  const cost = data?.usage?.cost || 0;
  const outPath = path.join(LOCALES_DIR, `${targetCode}.json`);
  writeFileSync(outPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  console.log(`  ✓ ${outPath}  (${dt}ms, ${tokens} tok, $${cost.toFixed(4)})`);
}

async function main() {
  if (!existsSync(LOCALES_DIR)) mkdirSync(LOCALES_DIR, { recursive: true });

  const work = TARGETS.filter((t) => {
    if (only && !only.includes(t.code)) return false;
    if (!force) {
      const p = path.join(LOCALES_DIR, `${t.code}.json`);
      if (existsSync(p)) {
        console.log(`[translate] ${t.code} already exists, skipping (use --force to overwrite)`);
        return false;
      }
    }
    return true;
  });

  if (work.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let totalCost = 0;
  for (const t of work) {
    try {
      await translate(t.code, t.name);
    } catch (err) {
      console.error(`[translate] ${t.code} FAILED: ${err.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
