/**
 * Analytics KPI CLI — prints headline numbers from your terminal.
 *
 * Reads from the Supabase `analytics_events` table via the service-role
 * key (so it bypasses RLS and can do aggregations). Outputs a dashboard
 * view you can run any time:
 *
 *   node scripts/analytics-kpis.mjs           # 7-day window (default)
 *   node scripts/analytics-kpis.mjs --days=30 # 30-day window
 *   node scripts/analytics-kpis.mjs --live    # last 1 hour only
 *
 * SECURITY: This needs the Supabase SERVICE_ROLE_KEY (not anon). It must
 * never go into the mobile app. Set it locally in .env as
 * SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>. The script reads
 * directly from .env; it's gitignored.
 */

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');

// Parse .env without dotenv dependency
if (!statSync(ENV_PATH, { throwIfNoEntry: false })) {
  console.error('Missing .env at', ENV_PATH);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL =
  env.EXPO_PUBLIC_SUPABASE_URL ||
  env.SUPABASE_URL;
const KEY =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  // Fall back to anon for read-only health check (RLS blocks reads anyway,
  // so most queries will return empty; user should add SERVICE_ROLE_KEY).
  env.EXPO_PUBLIC_SUPABASE_KEY;

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('Add this to .env:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<get from Supabase project Settings > API>');
  process.exit(1);
}

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : ['', null];
  }),
);
const days = args.live ? 1 / 24 : parseInt(args.days || '7', 10);
const intervalSql = args.live ? '1 hour' : `${days} days`;
const label = args.live ? 'last 1 hour' : `last ${days} days`;

const isServiceRole = (env.SUPABASE_SERVICE_ROLE_KEY?.length || 0) > 0;
if (!isServiceRole) {
  console.warn(
    '\n⚠️  Using anon key. RLS will block reads, so most numbers will be 0.',
  );
  console.warn(
    '   Add SUPABASE_SERVICE_ROLE_KEY to .env to see real numbers.\n',
  );
}

async function query(sql) {
  // Supabase doesn't expose raw SQL via REST — we use the PostgREST rpc()
  // endpoint with a generic SQL function. If the user doesn't have such a
  // function set up, we fall back to PostgREST table queries.
  const r = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (r.status === 404) return null; // rpc not configured
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

/**
 * PostgREST table query (no SQL needed, just filters). Returns count or rows.
 */
async function pq({ select = '*', filters = {}, count = false, head = false, limit }) {
  const params = new URLSearchParams();
  params.set('select', select);
  for (const [k, v] of Object.entries(filters)) params.set(k, v);
  if (limit) params.set('limit', String(limit));

  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
  };
  if (count) headers['Prefer'] = 'count=exact';
  if (head) headers['Prefer'] = (headers['Prefer'] || '') + ',count=exact';

  const url = `${URL}/rest/v1/analytics_events?${params.toString()}`;
  const r = await fetch(url, {
    method: head ? 'HEAD' : 'GET',
    headers,
  });
  if (!r.ok) {
    const t = head ? '' : await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const contentRange = r.headers.get('content-range');
  const total = contentRange ? parseInt(contentRange.split('/')[1], 10) : null;
  if (head) return { count: total };
  const body = await r.json();
  return { rows: body, count: total };
}

function band(t) {
  console.log(`\n${'━'.repeat(64)}\n${t}\n${'━'.repeat(64)}`);
}

async function totalEvents() {
  const { count } = await pq({ select: 'id', head: true });
  console.log(`  Total events ever:           ${count?.toLocaleString() ?? '?'}`);
}

async function eventsInWindow() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { count } = await pq({
    select: 'id',
    filters: { occurred_at: `gte.${since}` },
    head: true,
  });
  console.log(`  Events ${label.padEnd(20)} ${count?.toLocaleString() ?? '?'}`);
}

async function uniqueDevices() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  // PostgREST can't do distinct count directly; fetch device_ids and count locally.
  const { rows } = await pq({
    select: 'device_id',
    filters: { occurred_at: `gte.${since}` },
    limit: 50000,
  });
  const distinct = new Set(rows.map((r) => r.device_id));
  console.log(`  Unique devices ${label.padEnd(12)} ${distinct.size.toLocaleString()}`);
}

async function topEvents() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { rows } = await pq({
    select: 'event_name',
    filters: { occurred_at: `gte.${since}` },
    limit: 50000,
  });
  const counts = new Map();
  for (const r of rows) counts.set(r.event_name, (counts.get(r.event_name) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [name, n] of sorted) {
    console.log(`    ${name.padEnd(36)} ${String(n).padStart(7)}`);
  }
}

async function recentSamples() {
  const { rows } = await pq({
    select: 'occurred_at,event_name,properties,app_version,platform',
    filters: { order: 'occurred_at.desc' },
    limit: 6,
  });
  if (rows.length === 0) {
    console.log('  (no events visible — RLS or empty table)');
    return;
  }
  for (const r of rows) {
    const when = r.occurred_at?.slice(0, 19).replace('T', ' ');
    const propStr = JSON.stringify(r.properties || {}).slice(0, 80);
    console.log(`    [${when}] ${r.event_name.padEnd(28)} v${r.app_version || '?'}  ${propStr}`);
  }
}

async function exportSuccessRate() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const filter = { occurred_at: `gte.${since}` };
  const ok = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.resume_export_succeeded' },
    head: true,
  });
  const fail = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.resume_export_failed' },
    head: true,
  });
  const total = (ok.count || 0) + (fail.count || 0);
  const pct = total > 0 ? (((ok.count || 0) / total) * 100).toFixed(1) : '?';
  console.log(
    `  PDF exports ${label.padEnd(15)} ${(ok.count || 0).toLocaleString().padStart(6)} succeeded  ${(fail.count || 0).toLocaleString().padStart(4)} failed   ${pct}% success`,
  );
}

async function aiScoreStats() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const filter = { occurred_at: `gte.${since}` };
  const req = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.ai_score_requested' },
    head: true,
  });
  const done = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.ai_score_completed' },
    head: true,
  });
  const failed = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.ai_score_failed' },
    head: true,
  });
  console.log(`  AI scores ${label.padEnd(17)} ${(req.count || 0).toLocaleString().padStart(6)} requested  ${(done.count || 0).toLocaleString().padStart(4)} done  ${(failed.count || 0).toLocaleString().padStart(4)} failed`);
}

async function reviewFunnel() {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const filter = { occurred_at: `gte.${since}` };
  const shown = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.review_prompt_shown' },
    head: true,
  });
  const accepted = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.review_prompt_accepted' },
    head: true,
  });
  const declined = await pq({
    select: 'id',
    filters: { ...filter, event_name: 'eq.review_prompt_declined' },
    head: true,
  });
  const loveRate =
    shown.count > 0 ? (((accepted.count || 0) / shown.count) * 100).toFixed(0) : '?';
  console.log(`  Review prompts ${label.padEnd(12)} ${(shown.count || 0).toLocaleString().padStart(4)} shown  ${(accepted.count || 0).toLocaleString().padStart(3)} loved  ${(declined.count || 0).toLocaleString().padStart(3)} declined   ${loveRate}% love rate`);
}

(async function main() {
  console.log(`\nFreeResume AI — Analytics KPIs (${label})`);
  console.log(`Generated: ${new Date().toISOString()}`);

  band('OVERVIEW');
  try {
    await totalEvents();
    await eventsInWindow();
    await uniqueDevices();
  } catch (err) {
    console.error('  ERROR:', err.message);
    console.error('  Common cause: SUPABASE_SERVICE_ROLE_KEY missing or migration not applied yet.');
    process.exit(1);
  }

  band(`TOP EVENTS (${label})`);
  await topEvents();

  band('CORE METRICS');
  await exportSuccessRate();
  await aiScoreStats();
  await reviewFunnel();

  band('LAST 6 EVENTS (recency check)');
  await recentSamples();

  console.log(`\nFor full SQL queries (retention, funnels, etc.) see:`);
  console.log(`  docs/analytics/queries.sql`);
  console.log(`Run them in Supabase Studio → SQL Editor.\n`);
})();
