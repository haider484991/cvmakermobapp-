/**
 * Activation funnel + retention from analytics_events.
 *
 * Answers "where are we losing users?" with three lenses:
 *   1. Funnel  — distinct devices that reached each step (open → create → export → pay)
 *   2. Retention — of devices first seen N days ago, how many came back a later day
 *   3. Version split — funnel by app_version (did a release regress activation?)
 *
 * Run: node scripts/funnel-retention.mjs
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env (parsed manually).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// --- tiny .env parser (avoid adding dotenv as a dep) ---
function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8'); // run from repo root
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) { console.error('env load failed:', e.message); }
}
loadEnv();

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Pull every event in the window (paginated — Supabase caps at 1000/req).
async function fetchAll(sinceIso) {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb
      .from('analytics_events')
      .select('device_id,event_name,app_version,platform,occurred_at')
      .gte('occurred_at', sinceIso)
      .order('occurred_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) { console.error('query error:', error.message); process.exit(1); }
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

const DAYS = 30;
const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
const rows = await fetchAll(since);
console.log(`\nPulled ${rows.length} events from the last ${DAYS} days (since ${since.slice(0,10)}).\n`);

if (rows.length === 0) {
  console.log('No events. Either analytics just shipped, or events are not reaching Supabase.');
  process.exit(0);
}

// ---- 1. FUNNEL (distinct devices per step) ----
const devicesWith = (name) => new Set(rows.filter(r => r.event_name === name).map(r => r.device_id));
const allDevices = new Set(rows.map(r => r.device_id));

const FUNNEL = [
  ['app_opened',               'Opened the app'],
  ['onboarding_completed',     'Finished onboarding'],
  ['resume_created',           'Created a resume'],
  ['resume_edited',            'Edited a resume'],
  ['resume_previewed',         'Previewed a resume'],
  ['resume_export_succeeded',  'Exported a PDF'],
  ['paywall_shown',            'Saw the paywall'],
  ['purchase_completed',       'Purchased'],
];

const openCount = devicesWith('app_opened').size || allDevices.size;
console.log('=== ACTIVATION FUNNEL (distinct devices, last 30d) ===');
console.log(`Total distinct devices seen: ${allDevices.size}\n`);
let prev = openCount;
for (const [ev, label] of FUNNEL) {
  const n = devicesWith(ev).size;
  const pctOfOpen = openCount ? ((n / openCount) * 100).toFixed(1) : '0.0';
  const stepDrop = prev > 0 ? (((prev - n) / prev) * 100).toFixed(0) : '0';
  const bar = '█'.repeat(Math.round((n / Math.max(openCount,1)) * 30)).padEnd(30, '·');
  console.log(`${bar} ${String(n).padStart(5)}  ${pctOfOpen.padStart(5)}%  ${label}  ${prev>n?`(−${stepDrop}% vs prev)`:''}`);
  prev = n;
}

// ---- 2. RETENTION (return on a later calendar day) ----
const day = (iso) => iso.slice(0, 10);
const firstSeen = new Map();   // device -> first day
const daysActive = new Map();  // device -> Set(days)
for (const r of rows) {
  const d = day(r.occurred_at);
  if (!firstSeen.has(r.device_id) || d < firstSeen.get(r.device_id)) firstSeen.set(r.device_id, d);
  if (!daysActive.has(r.device_id)) daysActive.set(r.device_id, new Set());
  daysActive.get(r.device_id).add(d);
}
let returned = 0, oneAndDone = 0;
for (const [dev, days] of daysActive) { if (days.size > 1) returned++; else oneAndDone++; }
console.log('\n=== RETENTION (last 30d) ===');
console.log(`Devices active on 2+ distinct days: ${returned} / ${allDevices.size} (${((returned/allDevices.size)*100).toFixed(1)}%)`);
console.log(`One-and-done (opened once, never returned): ${oneAndDone} (${((oneAndDone/allDevices.size)*100).toFixed(1)}%)`);

// ---- 3. VERSION SPLIT (activation = created a resume / opened) ----
console.log('\n=== ACTIVATION BY APP VERSION (created / opened) ===');
const byVer = {};
for (const r of rows) {
  const v = r.app_version || '?';
  byVer[v] ??= { open: new Set(), created: new Set() };
  if (r.event_name === 'app_opened') byVer[v].open.add(r.device_id);
  if (r.event_name === 'resume_created') byVer[v].created.add(r.device_id);
}
for (const v of Object.keys(byVer).sort()) {
  const o = byVer[v].open.size, c = byVer[v].created.size;
  const rate = o ? ((c/o)*100).toFixed(0) : '–';
  console.log(`  v${v.padEnd(8)} opened=${String(o).padStart(4)}  created=${String(c).padStart(4)}  activation=${rate}%`);
}

// ---- 4. TOP EVENTS (sanity: what's actually firing) ----
console.log('\n=== EVENT VOLUME (last 30d) ===');
const counts = {};
for (const r of rows) counts[r.event_name] = (counts[r.event_name] || 0) + 1;
for (const [ev, n] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${ev}`);
}
console.log('');
