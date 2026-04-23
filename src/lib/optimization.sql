-- SCRIPT DE OTIMIZAÇÃO DE PERFORMANCE (ÍNDICES)
-- Cole este código no SQL Editor do seu Supabase para acelerar o app

-- 1. Índices para a tabela de Produtos (Acelera busca e PDV)
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- 2. Índices para a tabela de Pedidos/Vendas (Acelera Dashboard e Fluxo de Caixa)
CREATE INDEX IF NOT EXISTS idx_orders_timestamp_desc ON orders (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);

-- 3. Índices para a tabela de Compras (Acelera Dashboard)
CREATE INDEX IF NOT EXISTS idx_purchases_date_desc ON purchases (date DESC);

-- 4. Índices para Movimentações de Estoque (Acelera Auditoria)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_timestamp_desc ON inventory_movements (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements (product_id);

-- 5. Índices para Insumos
CREATE INDEX IF NOT EXISTS idx_insumos_nome ON insumos (nome);

ANALYZE; -- Atualiza as estatísticas do banco de dados para o otimizador
