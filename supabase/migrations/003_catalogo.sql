-- ============================================================
-- Tabela independente para consulta pública de catálogo
-- Não tem FK com outras tabelas — uso exclusivo para clientes
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE catalogo_produtos (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cod                   TEXT        NOT NULL UNIQUE,
  pa                    TEXT,
  descricao             TEXT,
  grupo                 TEXT,
  montadora             TEXT,
  veiculo               TEXT,
  ano_aplicacao         TEXT,
  motor                 TEXT,
  sobremedida           TEXT,
  qtd_pistoes           INTEGER,
  diametro_cilindro     NUMERIC,
  ref_metal_leve_sulloy TEXT,
  ref_anel_kalled       TEXT,
  espessura_canaletas   TEXT,
  anel_kalled           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance nas buscas mais comuns
CREATE INDEX idx_catalogo_montadora ON catalogo_produtos(montadora);
CREATE INDEX idx_catalogo_grupo     ON catalogo_produtos(grupo);
CREATE INDEX idx_catalogo_cod       ON catalogo_produtos(cod);
CREATE INDEX idx_catalogo_veiculo   ON catalogo_produtos USING gin(to_tsvector('portuguese', coalesce(veiculo, '')));
CREATE INDEX idx_catalogo_motor     ON catalogo_produtos USING gin(to_tsvector('portuguese', coalesce(motor, '')));

-- ── RLS: leitura pública, sem autenticação necessária ──────────────────────────
ALTER TABLE catalogo_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_public_read"
  ON catalogo_produtos
  FOR SELECT
  TO anon, authenticated
  USING (true);
