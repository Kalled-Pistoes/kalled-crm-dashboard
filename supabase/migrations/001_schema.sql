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

-- 4. VENDAS (aba Vendas — uma linha por produto vendido)
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

-- 5. VENDAS REPRESENTANTES (aba Vendas Representantes — por pedido)
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
