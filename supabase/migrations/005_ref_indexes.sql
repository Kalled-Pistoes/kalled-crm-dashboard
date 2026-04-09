-- ============================================================
-- Índices trigram para busca parcial (ilike) em refs de concorrentes
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Habilita extensão pg_trgm (necessária para GIN trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN trigram para busca com ilike em refs de concorrentes
-- Sem esses índices, ilike faz full table scan → timeout na Vercel Function
CREATE INDEX IF NOT EXISTS idx_catalogo_ref_metal_leve_sulloy
  ON catalogo_produtos USING gin (ref_metal_leve_sulloy gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_catalogo_ref_anel_kalled
  ON catalogo_produtos USING gin (ref_anel_kalled gin_trgm_ops);

-- Índice adicional para busca por código (cod) com ilike
CREATE INDEX IF NOT EXISTS idx_catalogo_cod_trgm
  ON catalogo_produtos USING gin (cod gin_trgm_ops);
