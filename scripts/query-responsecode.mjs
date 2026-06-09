/**
 * Pull the v1.9.4+ paywall fetch-error diagnostics: the BillingClient
 * responseCode + debugMessage + device region/currency. This is the
 * definitive signal for why product queries fail.
 *
 *   responseCode 3 = BILLING_UNAVAILABLE (Play version/account/country)
 *   responseCode 4 = ITEM_UNAVAILABLE   (product not available to account)
 *   responseCode 5 = DEVELOPER_ERROR    (app/package/signing/config)
 *   responseCode 6 = ERROR              (generic/transient)
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const EVENTS = [
  'paywall_fetch_subs_threw',
  'paywall_fetch_onetime_threw',
  'paywall_offerings_failed',
  'purchase_failed',
  'purchases_init_success',
  'purchases_init_failed',
  'purchases_init_timeout',
  'purchases_init_module_shape',
  'paywall_offerings_loaded',
];

const { data, error } = await sb
  .from('analytics_events')
  .select('*')
  .in('event_name', EVENTS)
  .order('id', { ascending: false })
  .limit(60);

if (error) { console.error(error.message); process.exit(1); }

console.log(`\nPulled ${data.length} events. Most recent first:\n`);
for (const r of data) {
  const v = r.app_version || '?';
  const dev = (r.device_id || '').slice(0, 8);
  const p = r.properties || {};
  const region = p._region || '?';
  const currency = p._currency || '?';
  const extra =
    r.event_name.includes('threw') || r.event_name === 'purchase_failed'
      ? ` code=${p.code} responseCode=${p.responseCode ?? '?'} debug="${(p.debugMessage || '').slice(0, 60)}"`
      : r.event_name === 'paywall_offerings_loaded'
        ? ` count=${p.count} subs=${p.raw_sub_count} 1t=${p.raw_onetime_count}`
        : r.event_name === 'purchases_init_module_shape'
          ? ` initConn=${p.has_initConnection} fetch=${p.has_fetchProducts}`
          : '';
  console.log(`[v${v} ${dev} ${region}/${currency}] ${r.event_name}${extra}`);
}

// Summary of responseCodes seen on v1.9.x
console.log('\n=== responseCode tally (v1.9.x fetch failures) ===');
const tally = {};
for (const r of data) {
  if (!(r.app_version || '').startsWith('1.9')) continue;
  if (!r.event_name.includes('threw')) continue;
  const rc = r.properties?.responseCode ?? 'undefined';
  tally[rc] = (tally[rc] || 0) + 1;
}
console.log(JSON.stringify(tally, null, 2));
console.log('\n=== regions seen (v1.9.x) ===');
const regions = {};
for (const r of data) {
  if (!(r.app_version || '').startsWith('1.9')) continue;
  const reg = r.properties?._region;
  if (reg) regions[reg] = (regions[reg] || 0) + 1;
}
console.log(JSON.stringify(regions, null, 2));
