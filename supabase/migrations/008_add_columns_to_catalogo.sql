-- Adiciona colunas adicionais para o catálogo de produtos que estavam faltando no novo banco
ALTER TABLE catalogo_produtos 
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS combustivel TEXT,
  ADD COLUMN IF NOT EXISTS medida_haste TEXT,
  ADD COLUMN IF NOT EXISTS comprimento_total TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;
