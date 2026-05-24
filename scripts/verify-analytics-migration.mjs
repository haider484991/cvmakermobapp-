/**
 * One-shot: verify the analytics_events table was created.
 * Inserts a test row using the anon key. If RLS lets the insert through,
 * the table exists and the policy works.
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_KEY;
if (!URL_ || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env');
  process.exit(1);
}

const endpoint = `${URL_}/rest/v1/analytics_events`;
const r = await fetch(endpoint, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  },
  body: JSON.stringify({
    device_id: 'migration-verify-' + Date.now(),
    event_name: 'migration_verified',
    app_version: '1.8.0',
    platform: 'android',
    properties: { source: 'verify_script', ts: new Date().toISOString() },
  }),
});

console.log(`HTTP ${r.status} ${r.statusText}`);
if (r.ok) {
  console.log('✅ Migration applied — table exists, insert policy works.');
  console.log('   You can now run: node scripts/analytics-kpis.mjs');
} else {
  const text = await r.text();
  console.log('Response body:', text.slice(0, 500));
  console.log('\nLikely causes:');
  console.log('  - Migration SQL ran but failed silently — check Supabase Studio SQL Editor for errors');
  console.log('  - Table name typo — should be exactly "analytics_events"');
  console.log('  - Wrong Supabase project — verify URL in .env matches the project you ran SQL in');
}
