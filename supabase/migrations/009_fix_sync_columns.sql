-- Migração 009: Adiciona colunas faltantes para sincronização da base de vendas e CRM
-- Resolve os problemas de tabelas como clientes, produtos, vendas_representantes, visitas_tecnicas e api_sync_status

-- 1. Clientes
ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS uf TEXT;

-- 2. Produtos
ALTER TABLE produtos 
  ADD COLUMN IF NOT EXISTS ref_metal_leve TEXT,
  ADD COLUMN IF NOT EXISTS ref_sulloy TEXT,
  ADD COLUMN IF NOT EXISTS ref_ks TEXT,
  ADD COLUMN IF NOT EXISTS ref_apex TEXT,
  ADD COLUMN IF NOT EXISTS ref_sintech TEXT;

-- 3. Vendas Representantes
ALTER TABLE vendas_representantes 
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

-- 4. Visitas Técnicas
ALTER TABLE visitas_tecnicas 
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT;

-- 5. Monitoramento de Sincronização (api_sync_status)
CREATE TABLE IF NOT EXISTS api_sync_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        TEXT,
  error_message TEXT,
  last_sync     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Insere o registro inicial se não existir
INSERT INTO api_sync_status (id, status, last_sync, error_message, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Nunca sincronizado', NULL, NULL, now()) 
ON CONFLICT (id) DO NOTHING;
