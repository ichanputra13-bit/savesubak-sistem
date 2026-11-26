const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Pemakaian: node --env-file=.env.local run-migration.js docs/migration_vXX_nama.sql');
    process.exit(1);
  }

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('SUPABASE_DB_URL tidak ada di .env.local — jalankan dengan node --env-file=.env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database!');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await client.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
