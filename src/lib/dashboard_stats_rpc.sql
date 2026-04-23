-- FUNÇÃO RPC: ESTATÍSTICAS DO DASHBOARD
-- Cole no SQL Editor do Supabase (junto com o optimization.sql já aplicado)
-- Retorna todos os números do painel em uma única chamada, sem transferir dados brutos

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_today       DATE := CURRENT_DATE;
  v_week_start  TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  v_month_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());

  -- Vendas
  v_sales_today     NUMERIC := 0;
  v_sales_week      NUMERIC := 0;
  v_sales_month     NUMERIC := 0;
  v_sales_pending   NUMERIC := 0;

  -- Compras
  v_purchases_today NUMERIC := 0;
  v_purchases_week  NUMERIC := 0;
  v_purchases_month NUMERIC := 0;

  -- Estoque
  v_total_units     NUMERIC := 0;
  v_stock_value     NUMERIC := 0;
BEGIN
  -- Vendas pagas - Hoje
  SELECT COALESCE(SUM(total), 0) INTO v_sales_today
  FROM orders
  WHERE payment_status = 'pago'
    AND DATE(timestamp) = v_today;

  -- Vendas pagas - Semana
  SELECT COALESCE(SUM(total), 0) INTO v_sales_week
  FROM orders
  WHERE payment_status = 'pago'
    AND timestamp >= v_week_start;

  -- Vendas pagas - Mês
  SELECT COALESCE(SUM(total), 0) INTO v_sales_month
  FROM orders
  WHERE payment_status = 'pago'
    AND timestamp >= v_month_start;

  -- Total a receber (Fiado)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_pending
  FROM orders
  WHERE payment_status = 'pendente';

  -- Compras - Hoje
  SELECT COALESCE(SUM(total_price), 0) INTO v_purchases_today
  FROM purchases
  WHERE date = v_today;

  -- Compras - Semana
  SELECT COALESCE(SUM(total_price), 0) INTO v_purchases_week
  FROM purchases
  WHERE date >= v_week_start::DATE;

  -- Compras - Mês
  SELECT COALESCE(SUM(total_price), 0) INTO v_purchases_month
  FROM purchases
  WHERE date >= v_month_start::DATE;

  -- Estoque
  SELECT
    COALESCE(SUM(stock), 0),
    COALESCE(SUM(price * stock), 0)
  INTO v_total_units, v_stock_value
  FROM products
  WHERE status = 'active' OR status IS NULL;

  RETURN jsonb_build_object(
    'sales', jsonb_build_object(
      'today',   v_sales_today,
      'week',    v_sales_week,
      'month',   v_sales_month,
      'pending', v_sales_pending
    ),
    'purchases', jsonb_build_object(
      'today', v_purchases_today,
      'week',  v_purchases_week,
      'month', v_purchases_month
    ),
    'stock', jsonb_build_object(
      'total_units', v_total_units,
      'stock_value', v_stock_value
    )
  );
END;
$$ LANGUAGE plpgsql;
