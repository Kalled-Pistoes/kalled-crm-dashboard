import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.fiuqspnmpuvtlhoklfqp',
  password: '@Kalled2089@',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Conectado. Aplicando migration 013...');
  const sql = fs.readFileSync('c:/Users/estagiario02/Desktop/Projeto Kalled/supabase/migrations/013_create_clientes_aliases.sql', 'utf8');
  await client.query(sql);
  console.log('✅ Migration 013 aplicada com sucesso!');
  await client.end();
}
run().catch(console.error);
