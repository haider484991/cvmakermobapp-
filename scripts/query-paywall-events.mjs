/**
 * Pull the most recent paywall_offerings_loaded + paywall_offerings_failed
 * + purchases_init_failed events with full properties so we can see what
 * fetchProducts is actually returning on real devices.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const events = [
  'paywall_offerings_loaded',
  'paywall_offerings_failed',
  'purchases_init_failed',
  'purchases_init_success',
  'purchase_failed',
];

for (const name of events) {
  console.log(`\n=== ${name} (most recent 5) ===`);
  const { data, error } = await sb
    .from('analytics_events')
    .select('*')
    .eq('event_name', name)
    .order('id', { ascending: false })
    .limit(5);
  if (error) { console.error(' ', error.message); continue; }
  if (!data?.length) { console.log('  (no events)'); continue; }
  for (const r of data) {
    const dev = (r.device_id || '').slice(0, 8);
    const ts = r.ts || r.timestamp || r.inserted_at || r.event_time || '?';
    console.log(`  [${ts}] v${r.app_version} dev=${dev}`);
    console.log(`    ${JSON.stringify(r.properties)}`);
  }
}
