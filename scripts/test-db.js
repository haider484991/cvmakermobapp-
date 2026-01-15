const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = 'Hacker484991??';

console.log('Password:', password);
console.log('Password length:', password.length);

// Try ALL known Supabase pooler regions (AWS + others)
const hosts = [
  // AWS regions
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-us-east-2.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
  'aws-0-us-west-2.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-eu-west-2.pooler.supabase.com',
  'aws-0-eu-west-3.pooler.supabase.com',
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-ap-southeast-2.pooler.supabase.com',
  'aws-0-ap-northeast-1.pooler.supabase.com',
  'aws-0-ap-northeast-2.pooler.supabase.com',
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-0-sa-east-1.pooler.supabase.com',
  'aws-0-ca-central-1.pooler.supabase.com',
  'aws-0-af-south-1.pooler.supabase.com',
  'aws-0-me-south-1.pooler.supabase.com',
];

async function tryConnection(host, port) {
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user: 'postgres.qbzlfpbspdvfzuzgbmcs',
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000
  });

  try {
    await client.connect();
    console.log(`✅ Connected via ${host}:${port}!`);

    // Run migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed!');

    // Verify tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('Created tables:', result.rows.map(r => r.table_name).join(', '));

    await client.end();
    return true;
  } catch (err) {
    const msg = err.message.substring(0, 50);
    if (!msg.includes('ENOTFOUND') && !msg.includes('ETIMEDOUT')) {
      console.log(`❌ ${host}:${port} - ${msg}`);
    }
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  // Try both session (5432) and transaction (6543) pooler modes
  for (const host of hosts) {
    if (await tryConnection(host, 5432)) return;
  }
  console.log('\nNo connection succeeded. Please run migration manually in SQL Editor.');
}

main();
