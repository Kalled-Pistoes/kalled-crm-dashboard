-- Adiciona a coluna editado_manualmente na tabela clientes com default false
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS editado_manualmente BOOLEAN DEFAULT false;
