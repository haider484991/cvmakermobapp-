/**
 * Did v1.10.1 actually move the needle? Aggregate metrics hide it because
 * most devices are still on old versions. This isolates the v1.10.1 cohort
 * and compares it against everything before it, on the metrics that matter:
 * export rate, purchase completion, and the new tailor/cover-letter funnels.
 *
 * Run: node scripts/version-cohort.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  try {
    const txt = readFileSync('.env', 'utf8');
    for (const l of txt.split(/\r?\n/)) {
      const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) { console.error('env load failed:', e.message); }
}
loadEnv();
const sb = createClient(
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function fetchAll() {
  const rows = []; let from = 0;
  for (;;) {
    const { data, error } = await sb.from('analytics_events')
      .select('device_id,event_name,app_version,properties,occurred_at')
      .order('occurred_at', { ascending: true }).range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    rows.push(...data);
    if (data.length < 1000) break; from += 1000;
  }
  return rows;
}

const all = await fetchAll();

// ---- Timeline: events per day, last 14 days ----
const byDay = {};
for (const r of all) { const d = r.occurred_at.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }
const days = Object.keys(byDay).sort();
console.log('\n=== EVENTS PER DAY (last 14) ===');
for (const d of days.slice(-14)) console.log(`  ${d}  ${String(byDay[d]).padStart(4)}  ${'▏'.repeat(Math.min(60, Math.round(byDay[d] / 3)))}`);

// ---- Version adoption (distinct devices ever on each version) ----
const verDev = {};
for (const r of all) { const v = r.app_version || '?'; (verDev[v] = verDev[v] || new Set()).add(r.device_id); }
console.log('\n=== DISTINCT DEVICES PER APP VERSION (all-time) ===');
for (const [v, s] of Object.entries(verDev).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  console.log(`  v${v.padEnd(9)} ${String(s.size).padStart(4)} devices`);
}

// ---- Cohort comparison: v1.10.x vs everything older ----
const isNew = (v) => v === '1.10.0' || v === '1.10.1';
function cohortStats(filterFn, label) {
  const rows = all.filter((r) => filterFn(r.app_version || ''));
  const dev = (ev) => new Set(rows.filter((r) => r.event_name === ev).map((r) => r.device_id)).size;
  const cnt = (ev) => rows.filter((r) => r.event_name === ev).length;
  const opened = dev('app_opened') || new Set(rows.map((r) => r.device_id)).size;
  const created = dev('resume_created');
  const exported = dev('resume_export_succeeded');
  const purchased = dev('purchase_completed');
  console.log(`\n=== COHORT: ${label} ===`);
  console.log(`  devices seen:        ${new Set(rows.map((r) => r.device_id)).size}`);
  console.log(`  created a resume:    ${created}`);
  console.log(`  exported a PDF:      ${exported}  (${created ? Math.round((exported / created) * 100) : 0}% of creators)`);
  console.log(`  export events total: ${cnt('resume_export_succeeded')}  [saved vs shared below]`);
  // export method split
  const methods = {};
  for (const r of rows.filter((r) => r.event_name === 'resume_export_succeeded')) {
    const m = (r.properties || {}).method || '(unknown)'; methods[m] = (methods[m] || 0) + 1;
  }
  if (Object.keys(methods).length) console.log(`    methods: ${JSON.stringify(methods)}`);
  console.log(`  saw paywall:         ${dev('paywall_shown')}`);
  console.log(`  purchase_initiated:  ${dev('purchase_initiated')} devices`);
  console.log(`  purchase_completed:  ${purchased}`);
  console.log(`  tailor_opened/analyzed/applied: ${cnt('tailor_opened')}/${cnt('tailor_analyzed')}/${cnt('tailor_applied')}`);
  console.log(`  cover_letter open/gen:          ${cnt('cover_letter_opened')}/${cnt('cover_letter_generated')}`);
}

cohortStats((v) => isNew(v), 'v1.10.x (the fixes)');
cohortStats((v) => v && !isNew(v) && v !== '?', 'older versions (baseline)');

// ---- Last 7 days, any version ----
const cutoff = new Date(Date.parse(all[all.length - 1].occurred_at) - 7 * 86400_000).toISOString();
const recent = all.filter((r) => r.occurred_at >= cutoff);
console.log(`\n=== LAST 7 DAYS OF DATA (since ${cutoff.slice(0, 10)}) ===`);
console.log(`  events: ${recent.length} | devices: ${new Set(recent.map((r) => r.device_id)).size}`);
const recentVers = {};
for (const r of recent) { const v = r.app_version || '?'; (recentVers[v] = recentVers[v] || new Set()).add(r.device_id); }
console.log('  devices by version:', Object.entries(recentVers).map(([v, s]) => `v${v}=${s.size}`).join(' · '));
const rc = (ev) => recent.filter((r) => r.event_name === ev).length;
console.log(`  resume_created=${rc('resume_created')} export_succeeded=${rc('resume_export_succeeded')} purchase_completed=${rc('purchase_completed')} paywall_shown=${rc('paywall_shown')}`);
console.log('');
