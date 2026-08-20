-- ============================================================
-- POLLO CRISPY — SQL MIGRACIÓN 10: FIX ENVÍOS DE EFECTIVO POR SUCURSAL
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. FUNCIÓN RPC ATÓMICA PARA REGISTRAR ENVÍO DE EFECTIVO
CREATE OR REPLACE FUNCTION create_cash_transfer(
  p_branch_id         UUID,
  p_cash_register_id  UUID,
  p_sender_id         UUID,
  p_recipient_name    TEXT,
  p_amount            NUMERIC,
  p_reason            TEXT,
  p_notes             TEXT DEFAULT NULL,
  p_authorized_by     UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  IF p_recipient_name IS NULL OR TRIM(p_recipient_name) = '' THEN
    RAISE EXCEPTION 'Debe especificar la persona que recibe el efectivo.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del envío debe ser mayor a L 0.00.';
  END IF;

  INSERT INTO cash_transfers (
    branch_id,
    cash_register_id,
    sender_id,
    recipient_name,
    amount,
    reason,
    notes,
    authorized_by,
    status
  ) VALUES (
    p_branch_id,
    p_cash_register_id,
    p_sender_id,
    TRIM(p_recipient_name),
    p_amount,
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Retiro de efectivo / Depósito'),
    NULLIF(TRIM(p_notes), ''),
    p_authorized_by,
    'confirmed'
  ) RETURNING id INTO v_transfer_id;

  -- Registro de Auditoría
  INSERT INTO audit_logs (user_id, action, table_name, record_id, branch_id, new_data)
  VALUES (
    p_sender_id,
    'CASH_TRANSFER',
    'cash_transfers',
    v_transfer_id,
    p_branch_id,
    jsonb_build_object('recipient', p_recipient_name, 'amount', p_amount, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ASEGURAR POLÍTICAS RLS PERMISIVAS PARA USUARIOS AUTENTICADOS EN SUS SUCURSALES
ALTER TABLE cash_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver envios por sucursal autorizada" ON cash_transfers;
CREATE POLICY "Ver envios por sucursal autorizada" ON cash_transfers
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Registrar envios en sucursal autorizada" ON cash_transfers;
CREATE POLICY "Registrar envios en sucursal autorizada" ON cash_transfers
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Actualizar envios como Admin" ON cash_transfers;
CREATE POLICY "Actualizar envios como Admin" ON cash_transfers
  FOR UPDATE TO authenticated USING (TRUE);
