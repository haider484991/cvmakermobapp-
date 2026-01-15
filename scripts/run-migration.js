#!/usr/bin/env node
/**
 * Run Supabase migrations
 *
 * Usage:
 *   node scripts/run-migration.js YOUR_DATABASE_PASSWORD
 *
 * Find your database password in Supabase Dashboard:
 *   Project Settings → Database → Connection string → Password
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Please provide your database password');
  console.error('');
  console.error('Usage: node scripts/run-migration.js YOUR_DATABASE_PASSWORD');
  console.error('');
  console.error('Find your password in Supabase Dashboard:');
  console.error('  Project Settings → Database → Connection string → Password');
  process.exit(1);
}

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432, // Session mode for DDL
  database: 'postgres',
  user: 'postgres.qbzlfpbspdvfzuzgbmcs',
  password: password,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('');
    console.log('📋 Created tables:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('password authentication failed')) {
      console.error('');
      console.error('💡 The password might be incorrect. Find the correct password in:');
      console.error('   Supabase Dashboard → Project Settings → Database');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
