/**
 * Compare device metadata for paywall-WORKING vs paywall-FAILING devices.
 * Goal: find what's different (country, locale, OS, model) about the
 * devices where products load vs where they don't.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// First: dump the table columns so we know what metadata exists.
const { data: sample } = await sb.from('analytics_events').select('*').limit(1);
if (sample?.[0]) {
  console.log('=== Columns in analytics_events ===');
  console.log(Object.keys(sample[0]).join(', '));
  console.log();
}

// Working devices (loaded count:3 real products) vs failing (count:0).
const WORKING = ['mq0r6pev', 'mpxman55'];
const FAILING = ['mq0sl7ul', 'mpk3kuso', 'mq0sgzdc'];

async function dumpDevice(devId, label) {
  // Pull a spread of events for this device to surface any geo/locale fields.
  const { data } = await sb
    .from('analytics_events')
    .select('*')
    .ilike('device_id', `${devId}%`)
    .order('id', { ascending: false })
    .limit(8);
  console.log(`\n━━━ ${label}: ${devId} (${data?.length || 0} events) ━━━`);
  if (!data?.length) { console.log('  (no events)'); return; }
  // Print any column that looks geo/device-related, plus a sample of props.
  const r = data[0];
  const interesting = {};
  for (const [k, v] of Object.entries(r)) {
    if (/country|locale|region|lang|device|platform|os|model|brand|timezone|currency/i.test(k)) {
      interesting[k] = v;
    }
  }
  console.log('  device/geo columns:', JSON.stringify(interesting));
  // Merge any geo-ish keys from properties across events
  const propKeys = {};
  for (const ev of data) {
    if (ev.properties && typeof ev.properties === 'object') {
      for (const [k, v] of Object.entries(ev.properties)) {
        if (/country|locale|region|lang|device|platform|os|model|brand|timezone|currency/i.test(k)) {
          propKeys[k] = v;
        }
      }
    }
  }
  if (Object.keys(propKeys).length) console.log('  geo-ish props:', JSON.stringify(propKeys));
  console.log('  app_versions:', [...new Set(data.map((e) => e.app_version))].join(', '));
}

console.log('\n######## WORKING DEVICES (products loaded) ########');
for (const d of WORKING) await dumpDevice(d, 'WORKS');

console.log('\n\n######## FAILING DEVICES (no products) ########');
for (const d of FAILING) await dumpDevice(d, 'FAILS');
