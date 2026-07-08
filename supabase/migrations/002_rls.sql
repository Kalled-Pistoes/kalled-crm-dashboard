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
