-- Migração 012: Cria a view clientes_ultima_compra para otimizar busca de última compra
CREATE OR REPLACE VIEW clientes_ultima_compra AS
SELECT cliente_id, MAX(data) AS ultima_compra
FROM vendas
GROUP BY cliente_id;
