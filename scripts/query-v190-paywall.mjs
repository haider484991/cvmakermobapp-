/**
 * Pull every v1.9.0 paywall diagnostic event — the whole point of the
 * v1.9.0 instrumentation. Shows which init branch dies.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const DIAG_EVENTS = [
  'purchases_loadiap_failed',
  'purchases_init_skipped',
  'purchases_init_module_shape',
  'purchases_init_connect_start',
  'purchases_init_connect_done',
  'purchases_init_timeout',
  'purchases_init_failed',
  'purchases_init_success',
  'paywall_fetch_subs_threw',
  'paywall_fetch_onetime_threw',
  'paywall_fetch_without_init',
  'paywall_init_await_failed',
  'paywall_offerings_loaded',
  'paywall_offerings_failed',
  'purchase_failed',
];

// Pull all events from v1.9.0 builds, most recent first.
const { data, error } = await sb
  .from('analytics_events')
  .select('*')
  .in('event_name', DIAG_EVENTS)
  .order('id', { ascending: false })
  .limit(60);

if (error) { console.error(error.message); process.exit(1); }

console.log(`\nPulled ${data.length} diagnostic events (all versions):\n`);

// Group by version
const byVersion = {};
for (const r of data) {
  const v = r.app_version || '?';
  byVersion[v] = byVersion[v] || [];
  byVersion[v].push(r);
}

for (const [version, rows] of Object.entries(byVersion)) {
  console.log(`\n━━━ v${version} (${rows.length} events) ━━━`);
  for (const r of rows.slice(0, 25)) {
    const dev = (r.device_id || '').slice(0, 8);
    console.log(`  ${r.event_name}  dev=${dev}`);
    if (r.properties && Object.keys(r.properties).length) {
      console.log(`     ${JSON.stringify(r.properties)}`);
    }
  }
}

// Highlight: did v1.9.0 fire ANY of the new init-branch events?
const v190 = data.filter((r) => (r.app_version || '').startsWith('1.9'));
console.log(`\n\n=== v1.9.x SUMMARY ===`);
console.log(`Total v1.9.x diagnostic events: ${v190.length}`);
const eventCounts = {};
for (const r of v190) {
  eventCounts[r.event_name] = (eventCounts[r.event_name] || 0) + 1;
}
for (const [name, count] of Object.entries(eventCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${count}`);
}
