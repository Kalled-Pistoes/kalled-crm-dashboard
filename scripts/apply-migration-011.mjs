import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  host: 'db.fiuqspnmpuvtlhoklfqp.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '@Kalled2089@',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  console.log('Conectando ao banco de dados PostgreSQL do Supabase...');
  try {
    await client.connect();
    console.log('Conectado com sucesso!');

    const migrationPath = 'c:/Users/estagiario02/Desktop/Projeto Kalled/supabase/migrations/011_add_editado_manualmente_to_clientes.sql';
    console.log(`Lendo arquivo de migração: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executando query SQL...');
    console.log(sql);
    
    await client.query(sql);
    console.log('✅ Migração 011 aplicada com sucesso no banco de dados!');
  } catch (err) {
    console.error('❌ Erro ao aplicar migração:', err);
  } finally {
    await client.end();
    console.log('Conexão encerrada.');
  }
}

run();
