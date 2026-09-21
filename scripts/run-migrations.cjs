/**
 * Automated Supabase Migration Runner for Madhura Tex POS
 * 
 * Usage:
 *   node scripts/run-migrations.cjs [db_password]
 * Or set SUPABASE_DB_PASSWORD=... in your environment.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const projectRefMatch = SUPABASE_URL.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
const projectRef = projectRefMatch ? projectRefMatch[1] : '';

const dbPassword = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || '';
const databaseUrl = process.env.DATABASE_URL || (
  dbPassword && projectRef
    ? `postgres://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
    : ''
);

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 MADHURA TEX - AUTOMATED DATABASE MIGRATION RUNNER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Supabase URL : ${SUPABASE_URL}`);
  console.log(`Project Ref  : ${projectRef || 'unknown'}`);

  if (!databaseUrl) {
    console.log('\n⚠️  Direct PostgreSQL connection requires the database password.');
    console.log('You can run migrations in one of two ways:\n');
    console.log('OPTION 1: Run with your database password:');
    console.log('  npm run migrate:db <your-db-password>');
    console.log('  (Or set SUPABASE_DB_PASSWORD=<password> in your terminal)\n');
    console.log('OPTION 2: 1-Click execution via Supabase SQL Editor:');
    console.log('  1. Open: https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('  2. Copy and paste the contents of:');
    console.log('     supabase/all_migrations_consolidated.sql');
    console.log('  3. Click "Run" to apply all migrations in one shot!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files in supabase/migrations/\n`);

  // Try standard pooler regions if connection fails on ap-south-1
  const regions = ['ap-south-1', 'ap-southeast-1', 'eu-central-1', 'us-east-1'];
  let connectedClient = null;

  for (const region of regions) {
    const connStr = databaseUrl.includes('pooler.supabase.com')
      ? databaseUrl.replace(/aws-0-[a-z0-9-]+/, `aws-0-${region}`)
      : databaseUrl;

    console.log(`Attempting connection via pooler (${region})...`);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      console.log(`✅ Connected successfully to ${region}!\n`);
      connectedClient = client;
      break;
    } catch (err) {
      console.log(`   Connection to ${region} failed: ${err.message}`);
      await client.end().catch(() => {});
    }
  }

  if (!connectedClient) {
    console.error('\n❌ Could not connect to PostgreSQL with provided password.');
    console.error('Please verify your database password or use Option 2 (Supabase SQL Editor).');
    process.exit(1);
  }

  const client = connectedClient;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      process.stdout.write(`[${i + 1}/${files.length}] Running ${file}... `);
      const startTime = Date.now();
      await client.query(sql);
      const duration = Date.now() - startTime;
      console.log(`DONE (${duration}ms)`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('\n❌ Migration execution failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
