-- ============================================================
-- CRM Kalled Pistoes - Schema inicial
-- Execute no SQL Editor do Supabase (em ordem)
-- ============================================================

-- 1. REPRESENTANTES
-- Vinculado ao auth.users via user_id apos criar o usuario no Supabase Auth
CREATE TABLE representantes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL UNIQUE,
  estado      TEXT,
  meta_mensal NUMERIC,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. CLIENTES
CREATE TABLE clientes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT        NOT NULL UNIQUE,
  status           TEXT,
  grupo            TEXT,
  desconto         TEXT,
  pagamento        TEXT,
  prazo            TEXT,
  representante_id UUID        REFERENCES representantes(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. PRODUTOS (aba Cross do Excel)
-- linhas: array com as marcas do produto ex: ['Metal Leve', 'KS']
CREATE TABLE produtos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pn         TEXT        NOT NULL UNIQUE,
  descricao  TEXT,
  linhas     TEXT[]      DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. VENDAS (aba Vendas â€” uma linha por produto vendido)
-- representante_id denormalizado para RLS simples sem joins
CREATE TABLE vendas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data             DATE        NOT NULL,
  cliente_id       UUID        NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  produto_id       UUID        REFERENCES produtos(id) ON DELETE SET NULL,
  quantidade       NUMERIC,
  valor            NUMERIC,
  representante_id UUID        REFERENCES representantes(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 5. VENDAS REPRESENTANTES (aba Vendas Representantes â€” por pedido)
CREATE TABLE vendas_representantes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data             DATE        NOT NULL,
  representante_id UUID        NOT NULL REFERENCES representantes(id) ON DELETE CASCADE,
  cliente_id       UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  valor_pedido     NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 6. VISITAS TECNICAS
CREATE TABLE visitas_tecnicas (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data               DATE        NOT NULL,
  tipo_visita        TEXT,
  responsavel_visita TEXT,
  representante_id   UUID        NOT NULL REFERENCES representantes(id) ON DELETE CASCADE,
  cliente_id         UUID        REFERENCES clientes(id) ON DELETE SET NULL,
  status             TEXT,
  objetivos_metas    TEXT,
  potencial_compra   NUMERIC     DEFAULT 0,
  custo_visita       NUMERIC     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES de performance
-- ============================================================
CREATE INDEX idx_vendas_data        ON vendas(data);
CREATE INDEX idx_vendas_rep         ON vendas(representante_id);
CREATE INDEX idx_vendas_cliente     ON vendas(cliente_id);
CREATE INDEX idx_vr_rep             ON vendas_representantes(representante_id);
CREATE INDEX idx_vr_data            ON vendas_representantes(data);
CREATE INDEX idx_vt_rep             ON visitas_tecnicas(representante_id);
CREATE INDEX idx_vt_data            ON visitas_tecnicas(data);
CREATE INDEX idx_clientes_rep       ON clientes(representante_id);
CREATE INDEX idx_produtos_linhas    ON produtos USING gin(linhas);
-- ============================================================
-- CRM Kalled Pistoes - Row Level Security (RLS)
-- Execute APOS o 001_schema.sql
-- ============================================================
-- Modelo:
--   Gerente  -> ve TUDO (user_metadata.role = 'gerente')
--   Representante -> ve apenas os proprios dados
-- ============================================================

-- Funcao helper: verifica se o usuario logado e gerente
CREATE OR REPLACE FUNCTION is_gerente()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' = 'gerente'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
$$;

-- Funcao helper: retorna o representante_id do usuario logado
CREATE OR REPLACE FUNCTION meu_representante_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM representantes WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- RLS: REPRESENTANTES
-- Cada rep ve apenas a si mesmo; gerente ve todos
-- ============================================================
ALTER TABLE representantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_select" ON representantes
  FOR SELECT
  USING (user_id = auth.uid() OR is_gerente());

-- ============================================================
-- RLS: CLIENTES
-- Rep ve apenas os clientes que sao seus
-- ============================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON clientes
  FOR SELECT
  USING (representante_id = meu_representante_id() OR is_gerente());

-- ============================================================
-- RLS: PRODUTOS
-- Todos os usuarios autenticados veem o catalogo
-- ============================================================
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select" ON produtos
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS: VENDAS
-- Rep ve apenas as suas vendas (via representante_id denormalizado)
-- ============================================================
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_select" ON vendas
  FOR SELECT
  USING (representante_id = meu_representante_id() OR is_gerente());

-- ============================================================
-- RLS: VENDAS REPRESENTANTES
-- ============================================================
ALTER TABLE vendas_representantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_rep_select" ON vendas_representantes
  FOR SELECT
  USING (representante_id = meu_representante_id() OR is_gerente());

-- ============================================================
-- RLS: VISITAS TECNICAS
-- ============================================================
ALTER TABLE visitas_tecnicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitas_select" ON visitas_tecnicas
  FOR SELECT
  USING (representante_id = meu_representante_id() OR is_gerente());

-- ============================================================
-- COMO CRIAR UM USUARIO GERENTE (rodar no SQL Editor):
--
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "gerente"}'::jsonb
-- WHERE email = 'gerente@kalled.com.br';
--
-- COMO VINCULAR UM REPRESENTANTE AO SEU USUARIO:
--
-- UPDATE representantes
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'rep@kalled.com.br')
-- WHERE nome = 'Nome do Representante';
-- ============================================================
-- ============================================================
-- Tabela independente para consulta pÃºblica de catÃ¡logo
-- NÃ£o tem FK com outras tabelas â€” uso exclusivo para clientes
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

-- Ãndices para performance nas buscas mais comuns
CREATE INDEX idx_catalogo_montadora ON catalogo_produtos(montadora);
CREATE INDEX idx_catalogo_grupo     ON catalogo_produtos(grupo);
CREATE INDEX idx_catalogo_cod       ON catalogo_produtos(cod);
CREATE INDEX idx_catalogo_veiculo   ON catalogo_produtos USING gin(to_tsvector('portuguese', coalesce(veiculo, '')));
CREATE INDEX idx_catalogo_motor     ON catalogo_produtos USING gin(to_tsvector('portuguese', coalesce(motor, '')));

-- â”€â”€ RLS: leitura pÃºblica, sem autenticaÃ§Ã£o necessÃ¡ria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE catalogo_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_public_read"
  ON catalogo_produtos
  FOR SELECT
  TO anon, authenticated
  USING (true);
-- Tabela de usuÃ¡rios do CRM (auth local com JWT + bcrypt)
CREATE TABLE IF NOT EXISTS crm_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'representante')),
    representante TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas service_role acessa (nenhuma policy pÃºblica)
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

-- Inserir admin padrÃ£o (hash bcrypt de 'admin123!' com custo 10)
-- Se o admin jÃ¡ existir, nÃ£o faz nada
INSERT INTO crm_users (username, password_hash, role, representante)
VALUES (
    'admin',
    '$2b$10$j53RdlQs54vqiAPdRPMUBOHMW65mxCI2didn5RnkxE2E/EZ1ASEPy',
    'admin',
    null
)
ON CONFLICT (username) DO NOTHING;
-- Adiciona coluna lanÃ§amentos Ã  tabela de catÃ¡logo
-- Execute no SQL Editor do Supabase

ALTER TABLE catalogo_produtos
  ADD COLUMN IF NOT EXISTS lancamentos BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_catalogo_lancamentos ON catalogo_produtos(lancamentos);
-- ============================================================
-- Ãndices trigram para busca parcial (ilike) em refs de concorrentes
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Habilita extensÃ£o pg_trgm (necessÃ¡ria para GIN trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ãndices GIN trigram para busca com ilike em refs de concorrentes
-- Sem esses Ã­ndices, ilike faz full table scan â†’ timeout na Vercel Function
CREATE INDEX IF NOT EXISTS idx_catalogo_ref_metal_leve_sulloy
  ON catalogo_produtos USING gin (ref_metal_leve_sulloy gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_catalogo_ref_anel_kalled
  ON catalogo_produtos USING gin (ref_anel_kalled gin_trgm_ops);

-- Ãndice adicional para busca por cÃ³digo (cod) com ilike
CREATE INDEX IF NOT EXISTS idx_catalogo_cod_trgm
  ON catalogo_produtos USING gin (cod gin_trgm_ops);
-- ============================================================
-- Tabela para rastrear visitantes do catÃ¡logo
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

-- Ãndices
CREATE INDEX idx_visitantes_telefone ON visitantes_catalogo(telefone);

-- â”€â”€ RLS: leitura e escrita pÃºblica, sem autenticaÃ§Ã£o necessÃ¡ria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
