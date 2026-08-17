-- ============================================================
-- POLLO CRISPY — SQL MIGRACIÓN 09: ENVÍOS DE EFECTIVO, CAJAS Y PERMISOS
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 0. FUNCIÓN HELPER (Asegurar existencia de is_admin_or_super)
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN'),
    FALSE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- 1. TABLA: cash_transfers (Envíos / Retiros de Efectivo de Caja)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_transfers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id  UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
  sender_id         UUID NOT NULL REFERENCES profiles(id),
  recipient_name    TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason            TEXT NOT NULL DEFAULT 'Retiro de efectivo / Depósito',
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  authorized_by     UUID REFERENCES profiles(id),
  confirmed_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cash_transfers_branch ON cash_transfers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_register ON cash_transfers(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_sender ON cash_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_created ON cash_transfers(created_at);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cash_transfers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cash_transfers_updated_at ON cash_transfers;
CREATE TRIGGER trg_cash_transfers_updated_at
  BEFORE UPDATE ON cash_transfers
  FOR EACH ROW EXECUTE FUNCTION update_cash_transfers_updated_at();

-- ============================================================
-- 2. HABILITAR RLS EN cash_transfers
-- ============================================================
ALTER TABLE cash_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver envios por sucursal autorizada" ON cash_transfers;
CREATE POLICY "Ver envios por sucursal autorizada" ON cash_transfers
  FOR SELECT USING (user_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Registrar envios en sucursal autorizada" ON cash_transfers;
CREATE POLICY "Registrar envios en sucursal autorizada" ON cash_transfers
  FOR INSERT WITH CHECK (user_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Actualizar envios como Admin" ON cash_transfers;
CREATE POLICY "Actualizar envios como Admin" ON cash_transfers
  FOR UPDATE USING (is_admin_or_super() AND user_has_branch_access(branch_id));

-- ============================================================
-- 3. ACTUALIZAR FUNCIÓN: get_cash_register_summary
--    Cálculo real: Fondo Inicial + Ventas Efectivo - Retiros/Envíos = Efectivo Esperado
-- ============================================================
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_register_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_opening NUMERIC := 0;
  v_transfers NUMERIC := 0;
BEGIN
  SELECT COALESCE(opening_amount, 0) INTO v_opening
  FROM cash_registers WHERE id = p_register_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_transfers
  FROM cash_transfers
  WHERE cash_register_id = p_register_id AND status = 'confirmed';

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

-- ============================================================
-- 4. ACTUALIZAR VISTA: v_cash_register_summary
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
  COALESCE(stats.transfer_amount, 0) AS transfer_amount,
  COALESCE(tr.total_transfers, 0)    AS total_transfers,
  (cr.opening_amount + COALESCE(stats.cash_amount, 0) - COALESCE(tr.total_transfers, 0)) AS current_expected_cash
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
) stats ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total_transfers
  FROM cash_transfers
  WHERE cash_register_id = cr.id AND status = 'confirmed'
) tr ON true;

-- ============================================================
-- 5. VISTA: v_cash_transfers_detail (Detalle completo de envíos)
-- ============================================================
CREATE OR REPLACE VIEW v_cash_transfers_detail AS
SELECT
  ct.id,
  ct.branch_id,
  b.name          AS branch_name,
  b.code          AS branch_code,
  ct.cash_register_id,
  cr.opened_at    AS register_opened_at,
  ct.sender_id,
  sp.full_name    AS sender_name,
  ct.recipient_name,
  ct.amount,
  ct.reason,
  ct.notes,
  ct.status,
  ct.authorized_by,
  ap.full_name    AS authorizer_name,
  ct.confirmed_at,
  ct.created_at,
  DATE(ct.created_at AT TIME ZONE 'America/Tegucigalpa') AS transfer_date,
  TO_CHAR(ct.created_at AT TIME ZONE 'America/Tegucigalpa', 'HH12:MI:SS AM') AS transfer_time
FROM cash_transfers ct
JOIN branches b ON b.id = ct.branch_id
JOIN profiles sp ON sp.id = ct.sender_id
LEFT JOIN cash_registers cr ON cr.id = ct.cash_register_id
LEFT JOIN profiles ap ON ap.id = ct.authorized_by;

-- ============================================================
-- 6. FUNCIÓN: Obtener resumen de envíos de efectivo
-- ============================================================
CREATE OR REPLACE FUNCTION get_transfers_summary(
  p_branch_id   UUID DEFAULT NULL,
  p_start_date  DATE DEFAULT CURRENT_DATE,
  p_end_date    DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_count',   COUNT(*),
    'total_amount',  COALESCE(SUM(amount), 0),
    'avg_amount',    COALESCE(AVG(amount), 0)
  ) INTO v_result
  FROM cash_transfers
  WHERE status = 'confirmed'
  AND (p_branch_id IS NULL OR branch_id = p_branch_id)
  AND DATE(created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN p_start_date AND p_end_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
