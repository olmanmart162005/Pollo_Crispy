-- ============================================================
-- POLLO CRISPY - FUNCIONES Y PROCEDIMIENTOS SQL
-- Ejecutar DESPUÉS de 03_rls.sql
-- ============================================================

-- ============================================================
-- FUNCIÓN: Generar número de venta único por sucursal
-- ============================================================
CREATE OR REPLACE FUNCTION generate_sale_number(p_branch_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_number BIGINT;
  v_sale_number TEXT;
BEGIN
  SELECT code INTO v_code FROM branches WHERE id = p_branch_id;
  
  UPDATE sale_sequences
  SET last_number = last_number + 1
  WHERE branch_id = p_branch_id
  RETURNING last_number INTO v_number;
  
  IF NOT FOUND THEN
    INSERT INTO sale_sequences (branch_id, last_number) VALUES (p_branch_id, 1);
    v_number := 1;
  END IF;
  
  v_sale_number := v_code || '-' || LPAD(v_number::TEXT, 6, '0');
  RETURN v_sale_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: Registrar venta completa (transacción atómica)
-- ============================================================
CREATE OR REPLACE FUNCTION register_sale(
  p_branch_id       UUID,
  p_cashier_id      UUID,
  p_cash_register_id UUID,
  p_customer_name   TEXT,
  p_items           JSONB,
  p_payment_method  payment_method,
  p_amount_received NUMERIC,
  p_discount_type   discount_type,
  p_discount_value  NUMERIC,
  p_discount_by     UUID,
  p_notes           TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_sale_id       UUID;
  v_sale_number   TEXT;
  v_subtotal      NUMERIC := 0;
  v_discount_amt  NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_change        NUMERIC := 0;
  v_item          JSONB;
  v_item_subtotal NUMERIC;
BEGIN
  v_sale_number := generate_sale_number(p_branch_id);
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::NUMERIC;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;
  
  IF p_discount_type IS NOT NULL AND p_discount_value > 0 THEN
    IF p_discount_type = 'percentage' THEN
      v_discount_amt := ROUND(v_subtotal * p_discount_value / 100, 2);
    ELSE
      v_discount_amt := LEAST(p_discount_value, v_subtotal);
    END IF;
  END IF;
  
  v_total := v_subtotal - v_discount_amt;
  v_change := GREATEST(0, COALESCE(p_amount_received, 0) - v_total);
  
  INSERT INTO sales (
    sale_number, branch_id, cashier_id, cash_register_id, customer_name,
    subtotal, discount_type, discount_value, discount_amount, discount_by,
    total, payment_method, amount_received, change_given, notes, status
  ) VALUES (
    v_sale_number, p_branch_id, p_cashier_id, p_cash_register_id, p_customer_name,
    v_subtotal, p_discount_type, COALESCE(p_discount_value, 0), v_discount_amt, p_discount_by,
    v_total, p_payment_method, p_amount_received, v_change, p_notes, 'completed'
  ) RETURNING id INTO v_sale_id;
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::NUMERIC;
    INSERT INTO sale_items (
      sale_id, item_type, product_id, combo_id, name, quantity, unit_price, subtotal
    ) VALUES (
      v_sale_id,
      COALESCE(v_item->>'item_type', 'product'),
      CASE WHEN v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' != 'null'
           THEN (v_item->>'product_id')::UUID ELSE NULL END,
      CASE WHEN v_item->>'combo_id' IS NOT NULL AND v_item->>'combo_id' != 'null'
           THEN (v_item->>'combo_id')::UUID ELSE NULL END,
      v_item->>'name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      v_item_subtotal
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount_amt,
    'total', v_total,
    'change_given', v_change
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: Anular venta
-- ============================================================
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id           UUID,
  p_voided_by         UUID,
  p_void_reason       TEXT,
  p_authorized_by     UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status sale_status;
BEGIN
  SELECT status INTO v_status FROM sales WHERE id = p_sale_id;
  
  IF v_status != 'completed' THEN
    RAISE EXCEPTION 'Solo se pueden anular ventas completadas. Estado actual: %', v_status;
  END IF;
  
  UPDATE sales SET
    status = 'voided',
    voided_by = p_voided_by,
    voided_at = NOW(),
    void_reason = p_void_reason,
    void_authorized_by = p_authorized_by,
    updated_at = NOW()
  WHERE id = p_sale_id;
  
  INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
  VALUES (
    p_voided_by, 'VOID_SALE', 'sales', p_sale_id,
    jsonb_build_object('reason', p_void_reason, 'authorized_by', p_authorized_by)
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCIÓN: Obtener resumen de ventas por rango de fechas
-- ============================================================
CREATE OR REPLACE FUNCTION get_sales_summary(
  p_branch_id   UUID DEFAULT NULL,
  p_start_date  DATE DEFAULT CURRENT_DATE,
  p_end_date    DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sales',     COUNT(*),
    'total_amount',    COALESCE(SUM(total), 0),
    'cash_amount',     COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0),
    'card_amount',     COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0),
    'transfer_amount', COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0),
    'other_amount',    COALESCE(SUM(CASE WHEN payment_method = 'other' THEN total ELSE 0 END), 0),
    'total_discount',  COALESCE(SUM(discount_amount), 0),
    'avg_sale',        COALESCE(AVG(total), 0)
  ) INTO v_result
  FROM sales
  WHERE status = 'completed'
  AND (p_branch_id IS NULL OR branch_id = p_branch_id)
  AND DATE(created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Obtener top productos vendidos
-- ============================================================
CREATE OR REPLACE FUNCTION get_top_products(
  p_branch_id   UUID DEFAULT NULL,
  p_start_date  DATE DEFAULT CURRENT_DATE,
  p_end_date    DATE DEFAULT CURRENT_DATE,
  p_limit       INTEGER DEFAULT 10
)
RETURNS TABLE(product_id UUID, name TEXT, quantity BIGINT, revenue NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.product_id,
    si.name,
    SUM(si.quantity)::BIGINT,
    SUM(si.subtotal)
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE si.item_type = 'product'
  AND si.product_id IS NOT NULL
  AND s.status = 'completed'
  AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  AND DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date
  GROUP BY si.product_id, si.name
  ORDER BY SUM(si.quantity) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Obtener top combos vendidos
-- ============================================================
CREATE OR REPLACE FUNCTION get_top_combos(
  p_branch_id   UUID DEFAULT NULL,
  p_start_date  DATE DEFAULT CURRENT_DATE,
  p_end_date    DATE DEFAULT CURRENT_DATE,
  p_limit       INTEGER DEFAULT 10
)
RETURNS TABLE(combo_id UUID, name TEXT, quantity BIGINT, revenue NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.combo_id,
    si.name,
    SUM(si.quantity)::BIGINT,
    SUM(si.subtotal)
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE si.item_type = 'combo'
  AND si.combo_id IS NOT NULL
  AND s.status = 'completed'
  AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  AND DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date
  GROUP BY si.combo_id, si.name
  ORDER BY SUM(si.quantity) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Ventas por sucursal
-- ============================================================
CREATE OR REPLACE FUNCTION get_sales_by_branch(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(branch_id UUID, branch_name TEXT, branch_code TEXT, total_sales BIGINT, total_amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id, b.name, b.code,
    COUNT(s.id)::BIGINT,
    COALESCE(SUM(s.total), 0)
  FROM branches b
  LEFT JOIN sales s ON s.branch_id = b.id
    AND s.status = 'completed'
    AND DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date
  WHERE user_has_branch_access(b.id)
  GROUP BY b.id, b.name, b.code
  ORDER BY COALESCE(SUM(s.total), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Ventas por cajero
-- ============================================================
CREATE OR REPLACE FUNCTION get_sales_by_cashier(
  p_branch_id   UUID DEFAULT NULL,
  p_start_date  DATE DEFAULT CURRENT_DATE,
  p_end_date    DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(cashier_id UUID, cashier_name TEXT, total_sales BIGINT, total_amount NUMERIC, cash_amount NUMERIC, card_amount NUMERIC, transfer_amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.full_name,
    COUNT(s.id)::BIGINT,
    COALESCE(SUM(s.total), 0),
    COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total ELSE 0 END), 0)
  FROM profiles p
  LEFT JOIN sales s ON s.cashier_id = p.id
    AND s.status = 'completed'
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date
  WHERE p.role = 'CAJERO'
  AND (p_branch_id IS NULL OR EXISTS(
    SELECT 1 FROM user_branches ub WHERE ub.user_id = p.id AND ub.branch_id = p_branch_id
  ))
  GROUP BY p.id, p.full_name
  ORDER BY COALESCE(SUM(s.total), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Ventas agrupadas por día
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_sales(
  p_branch_id UUID DEFAULT NULL,
  p_year      INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  p_month     INTEGER DEFAULT EXTRACT(MONTH FROM NOW())::INTEGER
)
RETURNS TABLE(sale_date DATE, total_sales BIGINT, total_amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa'),
    COUNT(s.id)::BIGINT,
    COALESCE(SUM(s.total), 0)
  FROM sales s
  WHERE s.status = 'completed'
  AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  AND EXTRACT(YEAR FROM s.created_at AT TIME ZONE 'America/Tegucigalpa') = p_year
  AND EXTRACT(MONTH FROM s.created_at AT TIME ZONE 'America/Tegucigalpa') = p_month
  GROUP BY DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa')
  ORDER BY DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Ventas mensuales para gráfico anual
-- ============================================================
CREATE OR REPLACE FUNCTION get_monthly_sales(
  p_branch_id UUID DEFAULT NULL,
  p_year      INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS TABLE(month_num INTEGER, month_name TEXT, total_sales BIGINT, total_amount NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (SELECT generate_series(1,12) as m)
  SELECT
    m.m::INTEGER,
    TO_CHAR(TO_DATE(m.m::TEXT, 'MM'), 'Month'),
    COALESCE(COUNT(s.id), 0)::BIGINT,
    COALESCE(SUM(s.total), 0)
  FROM months m
  LEFT JOIN sales s ON EXTRACT(MONTH FROM s.created_at AT TIME ZONE 'America/Tegucigalpa') = m.m
    AND EXTRACT(YEAR FROM s.created_at AT TIME ZONE 'America/Tegucigalpa') = p_year
    AND s.status = 'completed'
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  GROUP BY m.m
  ORDER BY m.m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Resumen de cierre de caja
-- ============================================================
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_register_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_opening NUMERIC;
BEGIN
  SELECT opening_amount INTO v_opening FROM cash_registers WHERE id = p_register_id;
  
  SELECT jsonb_build_object(
    'total_sales',     COUNT(*),
    'total_amount',    COALESCE(SUM(s.total), 0),
    'cash_sales',      COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0),
    'card_sales',      COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0),
    'transfer_sales',  COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total ELSE 0 END), 0),
    'other_sales',     COALESCE(SUM(CASE WHEN s.payment_method = 'other' THEN s.total ELSE 0 END), 0),
    'opening_amount',  v_opening,
    'expected_cash',   v_opening + COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0)
  ) INTO v_result
  FROM sales s
  WHERE s.cash_register_id = p_register_id
  AND s.status = 'completed';
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Registrar entrada de auditoría
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit(
  p_action      TEXT,
  p_table_name  TEXT DEFAULT NULL,
  p_record_id   UUID DEFAULT NULL,
  p_old_data    JSONB DEFAULT NULL,
  p_new_data    JSONB DEFAULT NULL,
  p_branch_id   UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, branch_id)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_old_data, p_new_data, p_branch_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
