-- ============================================================
-- POLLO CRISPY — SQL MIGRACIÓN 12: CONTROL DE APERTURA Y CIERRE DE CAJA
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 0. AGREGAR COLUMNA closed_by A cash_registers (Si no existe)
-- ============================================================
ALTER TABLE cash_registers 
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES profiles(id);

-- 1. ACTUALIZAR FUNCIÓN: get_cash_register_summary (Prevenir cualquier valor NULL)
-- ============================================================
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_register_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_opening NUMERIC := 0;
  v_transfers NUMERIC := 0;
BEGIN
  -- Obtener fondo inicial de la caja
  SELECT COALESCE(opening_amount, 0) INTO v_opening
  FROM cash_registers WHERE id = p_register_id;
  IF v_opening IS NULL THEN
    v_opening := 0;
  END IF;

  -- Obtener transferencias/envíos confirmados de la caja
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers
  FROM cash_transfers
  WHERE cash_register_id = p_register_id AND status = 'confirmed';
  IF v_transfers IS NULL THEN
    v_transfers := 0;
  END IF;

  -- Calcular métricas de ventas completadas
  SELECT jsonb_build_object(
    'total_sales',      COUNT(*),
    'total_amount',     COALESCE(SUM(s.total), 0),
    'cash_sales',       COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0),
    'card_sales',       COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0),
    'transfer_sales',   COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total ELSE 0 END), 0),
    'other_sales',      COALESCE(SUM(CASE WHEN s.payment_method = 'other' THEN s.total ELSE 0 END), 0),
    'opening_amount',   v_opening,
    'total_transfers',  v_transfers,
    'expected_cash',    v_opening + COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0) - v_transfers
  ) INTO v_result
  FROM sales s
  WHERE s.cash_register_id = p_register_id
  AND s.status = 'completed';

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. FUNCIÓN RPC ATÓMICA: open_cash_register
--    Regla: Solo a partir de las 6:00 AM (Zona America/Tegucigalpa).
--    Regla: Solo una caja abierta por cajero/sucursal.
-- ============================================================
CREATE OR REPLACE FUNCTION open_cash_register(
  p_branch_id        UUID,
  p_cashier_id       UUID,
  p_opening_amount   NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id        UUID;
  v_existing_id      UUID;
  v_existing_branch  TEXT;
  v_current_hour     INT;
  v_new_id           UUID;
  v_result           JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    v_caller_id := p_cashier_id;
  END IF;

  -- Control de Horario: A partir de las 6:00 AM
  v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Tegucigalpa'))::INT;
  IF v_current_hour < 6 THEN
    RAISE EXCEPTION 'No se puede abrir la caja antes de las 6:00 AM. El horario permitido de apertura inicia a las 6:00 AM.';
  END IF;

  IF p_opening_amount IS NULL OR p_opening_amount < 0 THEN
    RAISE EXCEPTION 'El monto inicial debe ser mayor o igual a L 0.00.';
  END IF;

  -- Comprobar si el cajero ya tiene una caja abierta en alguna sucursal
  SELECT cr.id, COALESCE(b.name, 'otra sucursal')
  INTO v_existing_id, v_existing_branch
  FROM cash_registers cr
  LEFT JOIN branches b ON b.id = cr.branch_id
  WHERE cr.cashier_id = p_cashier_id AND cr.status = 'open'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una caja abierta en "%". Solo se permite una caja abierta por turno.', v_existing_branch;
  END IF;

  -- Insertar nuevo turno
  INSERT INTO cash_registers (
    branch_id,
    cashier_id,
    opening_amount,
    status,
    opened_at,
    created_at,
    updated_at
  ) VALUES (
    p_branch_id,
    p_cashier_id,
    p_opening_amount,
    'open',
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_id;

  -- Registro de Auditoría
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, branch_id, new_data)
    VALUES (
      v_caller_id,
      'OPEN_CASH_REGISTER',
      'cash_registers',
      v_new_id,
      p_branch_id,
      jsonb_build_object(
        'opening_amount', p_opening_amount,
        'cashier_id', p_cashier_id,
        'opened_at', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Retornar el registro completo
  SELECT jsonb_build_object(
    'id', cr.id,
    'branch_id', cr.branch_id,
    'cashier_id', cr.cashier_id,
    'opening_amount', cr.opening_amount,
    'status', cr.status,
    'opened_at', cr.opened_at,
    'success', true
  ) INTO v_result
  FROM cash_registers cr
  WHERE cr.id = v_new_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN RPC ATÓMICA: close_cash_register
--    Regla: No cerrar antes de las 9:00 AM para cajas abiertas el mismo día.
--    Regla: A partir de las 9:00 AM permitido en cualquier horario.
-- ============================================================
CREATE OR REPLACE FUNCTION close_cash_register(
  p_register_id      UUID,
  p_closing_amount   NUMERIC,
  p_observations     TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_reg              cash_registers%ROWTYPE;
  v_summary          JSONB;
  v_expected         NUMERIC := 0;
  v_diff             NUMERIC := 0;
  v_current_hour     INT;
  v_is_same_day      BOOLEAN;
  v_caller_id        UUID;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_reg FROM cash_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El turno de caja no fue encontrado.';
  END IF;

  IF v_reg.status = 'closed' THEN
    RAISE EXCEPTION 'Este turno de caja ya fue cerrado previamente.';
  END IF;

  -- Control de Horario de Cierre: No antes de las 9:00 AM si se abrió el mismo día
  v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Tegucigalpa'))::INT;
  v_is_same_day := (DATE(v_reg.opened_at AT TIME ZONE 'America/Tegucigalpa') = DATE(NOW() AT TIME ZONE 'America/Tegucigalpa'));

  IF v_is_same_day AND v_current_hour < 9 THEN
    RAISE EXCEPTION 'No se puede cerrar la caja todavía. El cierre de caja está habilitado a partir de las 9:00 AM. Por favor, continúe operando hasta el horario permitido.';
  END IF;

  IF p_closing_amount IS NULL OR p_closing_amount < 0 THEN
    RAISE EXCEPTION 'El monto de efectivo contado debe ser mayor o igual a L 0.00.';
  END IF;

  -- Calcular el resumen exacto
  v_summary := get_cash_register_summary(p_register_id);
  v_expected := COALESCE((v_summary->>'expected_cash')::NUMERIC, v_reg.opening_amount, 0);
  v_diff := p_closing_amount - v_expected;

  -- Actualizar registro de caja
  UPDATE cash_registers
  SET status = 'closed',
      closing_amount = p_closing_amount,
      expected_cash = v_expected,
      difference = v_diff,
      observations = NULLIF(TRIM(p_observations), ''),
      closed_by = COALESCE(v_caller_id, v_reg.cashier_id),
      closed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_register_id;

  -- Auditoría
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, branch_id, new_data)
    VALUES (
      COALESCE(v_caller_id, v_reg.cashier_id),
      'CLOSE_CASH_REGISTER',
      'cash_registers',
      p_register_id,
      v_reg.branch_id,
      jsonb_build_object(
        'closed_by', COALESCE(v_caller_id, v_reg.cashier_id),
        'closing_amount', p_closing_amount,
        'expected_cash', v_expected,
        'difference', v_diff,
        'observations', p_observations,
        'closed_at', NOW()
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'id', p_register_id,
    'status', 'closed',
    'closing_amount', p_closing_amount,
    'expected_cash', v_expected,
    'difference', v_diff,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PERMISOS DE EJECUCIÓN RPC
-- ============================================================
GRANT EXECUTE ON FUNCTION open_cash_register(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION close_cash_register(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cash_register_summary(UUID) TO authenticated;

-- 5. POLÍTICAS RLS PERMISIVAS EN cash_registers PARA USUARIOS AUTENTICADOS
-- ============================================================
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_registers_select" ON cash_registers;
CREATE POLICY "cash_registers_select" ON cash_registers
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "cash_registers_insert" ON cash_registers;
CREATE POLICY "cash_registers_insert" ON cash_registers
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "cash_registers_update" ON cash_registers;
CREATE POLICY "cash_registers_update" ON cash_registers
  FOR UPDATE TO authenticated USING (TRUE);

-- 6. ACTUALIZAR VISTA: v_cash_register_summary (con closed_by y LEFT JOINs seguros)
-- ============================================================
DROP VIEW IF EXISTS v_cash_register_summary CASCADE;

CREATE VIEW v_cash_register_summary AS
SELECT
  cr.id,
  cr.branch_id,
  COALESCE(b.name, 'Sin Sucursal')     AS branch_name,
  cr.cashier_id,
  COALESCE(p.full_name, 'Sin Cajero')  AS cashier_name,
  cr.status,
  cr.opening_amount,
  cr.closing_amount,
  cr.expected_cash,
  cr.difference,
  cr.observations,
  cr.opened_at,
  cr.closed_at,
  cr.closed_by,
  COALESCE(cb.full_name, '—')          AS closed_by_name,
  COALESCE(stats.total_sales, 0)       AS total_sales,
  COALESCE(stats.total_amount, 0)      AS total_amount,
  COALESCE(stats.cash_amount, 0)       AS cash_amount,
  COALESCE(stats.card_amount, 0)       AS card_amount,
  COALESCE(stats.transfer_amount, 0)   AS transfer_amount,
  COALESCE(tr.total_transfers, 0)      AS total_transfers,
  (cr.opening_amount + COALESCE(stats.cash_amount, 0) - COALESCE(tr.total_transfers, 0)) AS current_expected_cash
FROM cash_registers cr
LEFT JOIN branches b ON b.id = cr.branch_id
LEFT JOIN profiles p ON p.id = cr.cashier_id
LEFT JOIN profiles cb ON cb.id = cr.closed_by
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                          AS total_sales,
    SUM(total)                                                        AS total_amount,
    SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END)     AS cash_amount,
    SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END)     AS card_amount,
    SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS transfer_amount
  FROM sales
  WHERE cash_register_id = cr.id AND status = 'completed'
) stats ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total_transfers
  FROM cash_transfers
  WHERE cash_register_id = cr.id AND status = 'confirmed'
) tr ON true;

GRANT SELECT ON v_cash_register_summary TO authenticated;
