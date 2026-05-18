-- ============================================================
-- Tabela para rastrear visitantes do catálogo
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE visitantes_catalogo (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  telefone   TEXT        NOT NULL UNIQUE,
  estado     TEXT        NOT NULL,
  cnpj       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_visitantes_telefone ON visitantes_catalogo(telefone);

-- ── RLS: leitura e escrita pública, sem autenticação necessária ──────────────────────────
ALTER TABLE visitantes_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitantes_public_read"
  ON visitantes_catalogo
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "visitantes_public_insert"
  ON visitantes_catalogo
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
