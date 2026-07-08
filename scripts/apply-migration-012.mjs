import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.fiuqspnmpuvtlhoklfqp',
  password: '@Kalled2089@',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  console.log('Conectando ao banco de dados PostgreSQL do Supabase via Connection Pooler (us-west-2)...');
  try {
    await client.connect();
    console.log('Conectado com sucesso!');

    const migrationPath = 'c:/Users/estagiario02/Desktop/Projeto Kalled/supabase/migrations/012_create_clientes_ultima_compra_view.sql';
    console.log(`Lendo arquivo de migração: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executando query SQL...');
    console.log(sql);
    
    await client.query(sql);
    console.log('✅ Migração 012 aplicada com sucesso no banco de dados!');
  } catch (err) {
    console.error('❌ Erro ao aplicar migração:', err);
  } finally {
    await client.end();
    console.log('Conexão encerrada.');
  }
}

run();
