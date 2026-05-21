-- Migração 010: Torna representante_id nullable em vendas_representantes e visitas_tecnicas
-- Motivo: nem todos os vendedores/representantes da aba Excel batem exatamente com os
-- cadastrados, e essas tabelas são para exibição individual — não precisam de FK obrigatória.

-- vendas_representantes: remove NOT NULL e recria FK como opcional
ALTER TABLE vendas_representantes
  ALTER COLUMN representante_id DROP NOT NULL;

-- Adiciona coluna representante_nome para armazenar o nome como fallback textual
ALTER TABLE vendas_representantes
  ADD COLUMN IF NOT EXISTS representante_nome TEXT;

-- visitas_tecnicas: remove NOT NULL
ALTER TABLE visitas_tecnicas
  ALTER COLUMN representante_id DROP NOT NULL;

-- Adiciona coluna representante_nome para armazenar o nome como fallback textual
ALTER TABLE visitas_tecnicas
  ADD COLUMN IF NOT EXISTS representante_nome TEXT;
