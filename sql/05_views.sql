-- ============================================================
-- POLLO CRISPY - VISTAS
-- Ejecutar DESPUÉS de 04_functions.sql
-- ============================================================

-- ============================================================
-- VISTA: v_sales_summary (Ventas con información completa)
-- ============================================================
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
  s.id,
  s.sale_number,
  s.branch_id,
  b.name          AS branch_name,
  b.code          AS branch_code,
  s.cashier_id,
  p.full_name     AS cashier_name,
  s.customer_name,
  s.subtotal,
  s.discount_type,
  s.discount_value,
  s.discount_amount,
  s.total,
  s.payment_method,
  s.amount_received,
  s.change_given,
  s.status,
  s.voided_at,
  s.void_reason,
  s.notes,
  s.cash_register_id,
  s.created_at,
  DATE(s.created_at AT TIME ZONE 'America/Tegucigalpa') AS sale_date,
  TO_CHAR(s.created_at AT TIME ZONE 'America/Tegucigalpa', 'HH12:MI:SS AM') AS sale_time
FROM sales s
JOIN branches b ON b.id = s.branch_id
JOIN profiles p ON p.id = s.cashier_id;

-- ============================================================
-- VISTA: v_products_with_category (Productos con categoría)
-- ============================================================
CREATE OR REPLACE VIEW v_products_with_category AS
SELECT
  pr.id,
  pr.name,
  pr.description,
  pr.price,
  pr.image_url,
  pr.status,
  pr.is_featured,
  pr.sort_order,
  pr.created_at,
  pr.updated_at,
  c.id    AS category_id,
  c.name  AS category_name,
  c.icon  AS category_icon
FROM products pr
JOIN categories c ON c.id = pr.category_id;

-- ============================================================
-- VISTA: v_combos_with_items (Combos con sus productos)
-- ============================================================
CREATE OR REPLACE VIEW v_combos_with_items AS
SELECT
  co.id,
  co.name,
  co.description,
  co.price,
  co.image_url,
  co.status,
  co.is_featured,
  co.sort_order,
  co.created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',          ci.id,
        'product_id',  ci.product_id,
        'product_name',pr.name,
        'quantity',    ci.quantity,
        'unit_price',  pr.price
      ) ORDER BY pr.name
    ) FILTER (WHERE ci.id IS NOT NULL),
    '[]'::jsonb
  ) AS items
FROM combos co
LEFT JOIN combo_items ci ON ci.combo_id = co.id
LEFT JOIN products pr ON pr.id = ci.product_id
GROUP BY co.id;

-- ============================================================
-- VISTA: v_cash_register_summary (Resumen de cajas)
-- ============================================================
CREATE OR REPLACE VIEW v_cash_register_summary AS
SELECT
  cr.id,
  cr.branch_id,
  b.name      AS branch_name,
  cr.cashier_id,
  p.full_name AS cashier_name,
  cr.status,
  cr.opening_amount,
  cr.closing_amount,
  cr.expected_cash,
  cr.difference,
  cr.observations,
  cr.opened_at,
  cr.closed_at,
  COALESCE(stats.total_sales, 0)     AS total_sales,
  COALESCE(stats.total_amount, 0)    AS total_amount,
  COALESCE(stats.cash_amount, 0)     AS cash_amount,
  COALESCE(stats.card_amount, 0)     AS card_amount,
  COALESCE(stats.transfer_amount, 0) AS transfer_amount
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
JOIN profiles p ON p.id = cr.cashier_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                          AS total_sales,
    SUM(total)                                                        AS total_amount,
    SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END)     AS cash_amount,
    SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END)     AS card_amount,
    SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS transfer_amount
  FROM sales
  WHERE cash_register_id = cr.id AND status = 'completed'
) stats ON true;

-- ============================================================
-- VISTA: v_branch_stats (Estadísticas por sucursal)
-- ============================================================
CREATE OR REPLACE VIEW v_branch_stats AS
SELECT
  b.id,
  b.name,
  b.code,
  b.status,
  COALESCE(today.total_sales, 0)      AS today_sales,
  COALESCE(today.total_amount, 0)     AS today_amount,
  COALESCE(month_data.total_sales, 0) AS month_sales,
  COALESCE(month_data.total_amount, 0) AS month_amount,
  COALESCE(year_data.total_amount, 0) AS year_amount
FROM branches b
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_sales, SUM(total) AS total_amount
  FROM sales
  WHERE branch_id = b.id AND status = 'completed'
  AND DATE(created_at AT TIME ZONE 'America/Tegucigalpa') = CURRENT_DATE
) today ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_sales, SUM(total) AS total_amount
  FROM sales
  WHERE branch_id = b.id AND status = 'completed'
  AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'America/Tegucigalpa') = EXTRACT(YEAR FROM NOW())
  AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'America/Tegucigalpa') = EXTRACT(MONTH FROM NOW())
) month_data ON true
LEFT JOIN LATERAL (
  SELECT SUM(total) AS total_amount
  FROM sales
  WHERE branch_id = b.id AND status = 'completed'
  AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'America/Tegucigalpa') = EXTRACT(YEAR FROM NOW())
) year_data ON true;
