/**
 * How far does each device actually get? Buckets every device by the deepest
 * thing it did, so we can answer "how many just didn't use the app?".
 *
 * Run: node scripts/engagement-depth.mjs
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
      .select('device_id,event_name,occurred_at')
      .gte('occurred_at', sinceIso).order('occurred_at', { ascending: true })
      .range(from, from + page - 1);
    if (error) { console.error(error.message); process.exit(1); }
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

const since = new Date(Date.now() - 30 * 86400_000).toISOString();
const rows = await fetchAll(since);

// Build per-device event sets + counts.
const dev = new Map(); // id -> {events:Set, count, days:Set}
for (const r of rows) {
  if (!dev.has(r.device_id)) dev.set(r.device_id, { events: new Set(), count: 0, days: new Set() });
  const d = dev.get(r.device_id);
  d.events.add(r.event_name); d.count++; d.days.add(r.occurred_at.slice(0,10));
}

const total = dev.size;
const has = (d, ...names) => names.some((n) => d.events.has(n));

// Deepest-stage bucket per device (mutually exclusive, in order).
let exported = 0, createdNoExport = 0, engagedNoCreate = 0, openedOnly = 0, returned = 0;
for (const [, d] of dev) {
  if (d.days.size > 1) returned++;
  if (has(d, 'resume_export_succeeded')) { exported++; continue; }
  if (has(d, 'resume_created')) { createdNoExport++; continue; }
  // "engaged but didn't create" = poked around (templates/paywall/ai) but no resume
  if (has(d, 'template_selected', 'ai_wizard_opened', 'paywall_shown', 'resume_import_succeeded')) { engagedNoCreate++; continue; }
  openedOnly++; // only lifecycle/opened events — basically never used it
}

const pct = (n) => `${((n / total) * 100).toFixed(0)}%`;
console.log(`\n=== ENGAGEMENT DEPTH — ${total} devices, last 30 days ===\n`);
const bar = (n) => '█'.repeat(Math.round((n / total) * 32)).padEnd(32, '·');
console.log(`${bar(openedOnly)} ${String(openedOnly).padStart(3)}  ${pct(openedOnly).padStart(4)}  Opened only — never really used it`);
console.log(`${bar(engagedNoCreate)} ${String(engagedNoCreate).padStart(3)}  ${pct(engagedNoCreate).padStart(4)}  Poked around — no resume created`);
console.log(`${bar(createdNoExport)} ${String(createdNoExport).padStart(3)}  ${pct(createdNoExport).padStart(4)}  Created a resume — never downloaded`);
console.log(`${bar(exported)} ${String(exported).padStart(3)}  ${pct(exported).padStart(4)}  Downloaded a PDF (the goal)`);
console.log(`\nReturned on 2+ days: ${returned} (${pct(returned)})`);

// Distribution of total events per device (how shallow is shallow?)
const buckets = { '1': 0, '2-3': 0, '4-9': 0, '10-24': 0, '25+': 0 };
for (const [, d] of dev) {
  if (d.count === 1) buckets['1']++;
  else if (d.count <= 3) buckets['2-3']++;
  else if (d.count <= 9) buckets['4-9']++;
  else if (d.count <= 24) buckets['10-24']++;
  else buckets['25+']++;
}
console.log('\n=== EVENTS PER DEVICE (how shallow is the typical session) ===');
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padStart(5)} events: ${String(v).padStart(3)} devices  ${pct(v)}`);
console.log('');
