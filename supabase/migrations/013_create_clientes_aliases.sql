-- Migração 013: Cria a tabela clientes_aliases para rastrear clientes unificados
-- Esta tabela garante que clientes deletados via "Unificar Cadastros" não voltem
-- a existir durante uma re-sincronização do Excel, e que suas vendas sejam
-- redirecionadas automaticamente para o cliente destino.
CREATE TABLE IF NOT EXISTS clientes_aliases (
  nome_origem       TEXT PRIMARY KEY,
  cliente_id_destino UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para lookup rápido por cliente destino (útil para listar aliases de um cliente)
CREATE INDEX IF NOT EXISTS idx_clientes_aliases_destino ON clientes_aliases(cliente_id_destino);
