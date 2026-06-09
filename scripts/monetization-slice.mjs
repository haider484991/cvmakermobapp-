/**
 * Monetization deep-slice: what happens at the moment of payment?
 *  - paywall_shown by trigger (what brings people to the wall)
 *  - purchase_initiated → completed/failed by product + version
 *  - template popularity (what do users actually want)
 *  - AI feature usage (is AI the draw?)
 *
 * Run: node scripts/monetization-slice.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) { console.error('env load failed:', e.message); }
}
loadEnv();

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Missing Supabase env'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function fetchAll(sinceIso) {
  const rows = []; let from = 0; const page = 1000;
  for (;;) {
    const { data, error } = await sb.from('analytics_events')
      .select('device_id,event_name,app_version,properties,occurred_at')
      .gte('occurred_at', sinceIso).order('occurred_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) { console.error(error.message); process.exit(1); }
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

const DAYS = 60; // wider window for sparse purchase events
const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
const rows = await fetchAll(since);
console.log(`\n${rows.length} events, last ${DAYS} days\n`);

const tally = (names, keyFn) => {
  const out = {};
  for (const r of rows) {
    if (!names.includes(r.event_name)) continue;
    const k = keyFn(r) ?? '(none)';
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
};

console.log('=== PAYWALL SHOWN — by trigger ===');
for (const [k, n] of tally(['paywall_shown'], (r) => r.properties?.trigger)) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log('\n=== PURCHASE INITIATED — by product ===');
for (const [k, n] of tally(['purchase_initiated'], (r) => r.properties?.product_id ?? r.properties?.productId ?? r.properties?.plan)) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log('\n=== PURCHASE OUTCOMES ===');
for (const ev of ['purchase_initiated', 'purchase_completed', 'purchase_failed', 'purchase_restored']) {
  const n = rows.filter((r) => r.event_name === ev).length;
  const dev = new Set(rows.filter((r) => r.event_name === ev).map((r) => r.device_id)).size;
  console.log(`  ${ev.padEnd(20)} ${String(n).padStart(4)} events from ${dev} devices`);
}

console.log('\n=== PURCHASE FAILED — reasons ===');
for (const [k, n] of tally(['purchase_failed'], (r) => JSON.stringify(r.properties)?.slice(0, 110))) console.log(`  ${String(n).padStart(3)}  ${k}`);

console.log('\n=== TEMPLATE SELECTED — top 12 ===');
for (const [k, n] of tally(['template_selected'], (r) => r.properties?.template_id).slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log('\n=== AI USAGE ===');
for (const ev of ['ai_wizard_opened', 'ai_wizard_generate_started', 'ai_wizard_apply', 'ai_score_requested', 'ai_summary_generated', 'ai_bullets_enhanced', 'ai_skills_suggested', 'resume_import_started', 'resume_import_succeeded']) {
  const n = rows.filter((r) => r.event_name === ev).length;
  if (n) console.log(`  ${ev.padEnd(28)} ${String(n).padStart(4)}`);
}

console.log('\n=== PAYWALL DISMISSED vs SHOWN (per device) ===');
const shownDev = new Set(rows.filter((r) => r.event_name === 'paywall_shown').map((r) => r.device_id)).size;
const dismDev = new Set(rows.filter((r) => r.event_name === 'paywall_dismissed').map((r) => r.device_id)).size;
const initDev = new Set(rows.filter((r) => r.event_name === 'purchase_initiated').map((r) => r.device_id)).size;
console.log(`  devices that saw paywall:   ${shownDev}`);
console.log(`  devices that dismissed:     ${dismDev}`);
console.log(`  devices that tapped a plan: ${initDev}`);
console.log('');
