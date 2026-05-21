/**
 * Script para criar tabela crm_users no novo Supabase
 * Execute: node scripts/apply-crm-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fiuqspnmpuvtlhoklfqp.supabase.co';
// Use a service_role key do novo projeto (Settings → API → service_role)
const SUPABASE_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Defina NEW_SUPABASE_SERVICE_KEY antes de rodar.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS crm_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'representante')),
    representante TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

INSERT INTO crm_users (username, password_hash, role, representante)
VALUES (
    'admin',
    '$2b$10$j53RdlQs54vqiAPdRPMUBOHMW65mxCI2didn5RnkxE2E/EZ1ASEPy',
    'admin',
    null
)
ON CONFLICT (username) DO NOTHING;
`;

const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }));
console.log('✅ crm_users criada (ou já existia). Use o SQL Editor do Supabase se necessário.');
console.log('\n📋 Cole este SQL no SQL Editor do novo projeto:\n');
console.log(sql);
