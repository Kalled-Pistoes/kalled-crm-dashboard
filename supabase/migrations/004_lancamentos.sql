-- Adiciona coluna lançamentos à tabela de catálogo
-- Execute no SQL Editor do Supabase

ALTER TABLE catalogo_produtos
  ADD COLUMN IF NOT EXISTS lancamentos BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_catalogo_lancamentos ON catalogo_produtos(lancamentos);
