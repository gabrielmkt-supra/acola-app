-- FUNÇÕES PARA ATOMICIDADE DE ESTOQUE NO ACOLA APP
-- Cole este código no SQL Editor do seu Supabase

-------------------------------------------------------------------------------
-- 1. FUNÇÃO PARA PROCESSAR VENDA
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_sale(
  p_order_payload JSONB,
  p_items JSONB -- Array de {product_id, qty, name}
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID; -- Ou BIGINT se seu projeto usar serial
  v_item RECORD;
  v_prev_stock NUMERIC;
  v_new_stock NUMERIC;
  v_result JSONB;
BEGIN
  -- 1. Inserir o Pedido
  INSERT INTO orders (
    client_name, client_phone, total, payment_method, payment_status, 
    items, channel, platform_fees, platform_incentives, delivery_fee, 
    net_amount, is_delivery, delivery_date, timestamp
  )
  SELECT 
    (p_order_payload->>'client_name'),
    (p_order_payload->>'client_phone'),
    (p_order_payload->>'total')::NUMERIC,
    (p_order_payload->>'payment_method'),
    (p_order_payload->>'payment_status'),
    (p_order_payload->'items'),
    (p_order_payload->>'channel'),
    (p_order_payload->>'platform_fees')::NUMERIC,
    (p_order_payload->>'platform_incentives')::NUMERIC,
    (p_order_payload->>'delivery_fee')::NUMERIC,
    (p_order_payload->>'net_amount')::NUMERIC,
    (p_order_payload->>'is_delivery')::BOOLEAN,
    (p_order_payload->>'delivery_date'),
    (p_order_payload->>'timestamp')
  RETURNING id INTO v_order_id;

  -- 2. Processar cada item do carrinho
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, qty NUMERIC, name TEXT)
  LOOP
    -- Buscar estoque atual
    SELECT stock INTO v_prev_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
    
    v_new_stock := v_prev_stock - v_item.qty;

    -- Atualizar Produto
    UPDATE products SET stock = v_new_stock WHERE id = v_item.product_id;

    -- Registrar Movimentação
    INSERT INTO inventory_movements (
      product_id, product_name, type, amount, 
      previous_stock, final_stock, note
    ) VALUES (
      v_item.product_id, v_item.name, 'Saída', -v_item.qty,
      v_prev_stock, v_new_stock, 'VENDA: ' || (p_order_payload->>'client_name') || ' (Pedido #' || v_order_id || ')'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------------------------------------
-- 2. FUNÇÃO PARA PROCESSAR REPOSIÇÃO / AJUSTE
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_inventory_update(
  p_product_id UUID,
  p_amount NUMERIC,
  p_is_adjustment BOOLEAN,
  p_note TEXT
) RETURNS JSONB AS $$
DECLARE
  v_prev_stock NUMERIC;
  v_new_stock NUMERIC;
BEGIN
  -- Buscar estoque atual
  SELECT stock INTO v_prev_stock FROM products WHERE id = p_product_id FOR UPDATE;

  IF p_is_adjustment THEN
    v_new_stock := p_amount; -- No ajuste, o amount é o valor final
  ELSE
    v_new_stock := v_prev_stock + p_amount;
  END IF;

  -- Atualizar Produto
  UPDATE products SET stock = v_new_stock WHERE id = p_product_id;

  -- Registrar Movimentação
  INSERT INTO inventory_movements (
    product_id, product_name, type, amount, 
    previous_stock, final_stock, note
  ) 
  SELECT 
    p_product_id, name, 
    CASE WHEN p_is_adjustment THEN 'Ajuste' ELSE 'Entrada' END,
    CASE WHEN p_is_adjustment THEN (v_new_stock - v_prev_stock) ELSE p_amount END,
    v_prev_stock, v_new_stock, p_note
  FROM products WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'new_stock', v_new_stock);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
