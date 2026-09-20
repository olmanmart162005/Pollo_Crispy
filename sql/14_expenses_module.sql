-- ============================================================
-- POLLO CRISPY — SQL MIGRACIÓN 14: MÓDULO DE GASTOS OPERATIVOS
-- Completamente independiente del Inventario
-- Integración exclusiva con Caja para pagos en Efectivo
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 0. LIMPIEZA PREVIA SI EXISTIESE (Evita error 42P16 de nombres/orden de columnas)
DROP VIEW IF EXISTS v_cash_register_summary CASCADE;
DROP VIEW IF EXISTS v_expenses_detail CASCADE;

-- 1. TABLA: expense_categories (Categorías de Gastos)
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_act ON expense_categories(is_active);

-- Poblado de categorías iniciales
INSERT INTO expense_categories (name, description) VALUES
  ('Servicios',        'Agua, energía eléctrica, internet, telefonía'),
  ('Transporte',       'Fletes, combustible, pasajes para diligencias'),
  ('Mantenimiento',    'Reparación de freidoras, refrigeradores, mobiliario'),
  ('Limpieza',         'Detergentes, desinfectantes, bolsas, papel higiénico'),
  ('Gas',              'Recargas de cilindros o tanques de gas GLP'),
  ('Hielo',            'Bolsas de hielo para bebidas o conservación'),
  ('Empaques',         'Compras urgentes o locales de bolsas, cajas, vasos'),
  ('Alquiler',         'Pago de arrendamiento de locales comerciales'),
  ('Personal',         'Viáticos, anticipos, almuerzos de personal o bonos'),
  ('Compras menores',  'Compras rápidas no planificadas de cocina o mostrador'),
  ('Otros',            'Cualquier otro gasto operativo no clasificado')
ON CONFLICT (name) DO NOTHING;

-- 2. TABLA: expenses (Gastos Operativos)
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id    UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
  category_id         UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  category_name       TEXT NOT NULL,
  description         TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  receipt_number      TEXT,
  notes               TEXT,
  expense_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by          UUID NOT NULL REFERENCES profiles(id),
  authorized_by       UUID REFERENCES profiles(id),
  authorized_at       TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancelled_by        UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch     ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_register   ON expenses(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_method     ON expenses(payment_method);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status     ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created    ON expenses(created_at DESC);

-- 3. VISTA: v_expenses_detail (Historial detallado de gastos)
-- ============================================================
CREATE OR REPLACE VIEW v_expenses_detail AS
SELECT
  e.id,
  e.branch_id,
  b.name              AS branch_name,
  b.code              AS branch_code,
  e.cash_register_id,
  e.category_id,
  e.category_name,
  e.description,
  e.amount,
  e.payment_method,
  e.receipt_number,
  e.notes,
  e.expense_date,
  e.created_by,
  cp.full_name        AS created_by_name,
  cp.role::text       AS created_by_role,
  e.authorized_by,
  ap.full_name        AS authorized_by_name,
  e.authorized_at,
  e.status,
  e.cancelled_by,
  kan.full_name       AS cancelled_by_name,
  e.cancellation_reason,
  e.cancelled_at,
  e.created_at,
  e.updated_at
FROM expenses e
JOIN branches b        ON b.id = e.branch_id
JOIN profiles cp       ON cp.id = e.created_by
LEFT JOIN profiles ap  ON ap.id = e.authorized_by
LEFT JOIN profiles kan ON kan.id = e.cancelled_by;

GRANT SELECT ON v_expenses_detail TO authenticated;

-- 4. ACTUALIZAR get_cash_register_summary CON DEDUCCIÓN DE GASTOS EN EFECTIVO
-- ============================================================
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_register_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_opening NUMERIC := 0;
  v_transfers NUMERIC := 0;
  v_cash_expenses NUMERIC := 0;
  v_total_expenses NUMERIC := 0;
BEGIN
  -- Fondo inicial
  SELECT COALESCE(opening_amount, 0) INTO v_opening
  FROM cash_registers WHERE id = p_register_id;

  -- Envíos de efectivo confirmados
  SELECT COALESCE(SUM(amount), 0) INTO v_transfers
  FROM cash_transfers
  WHERE cash_register_id = p_register_id AND status = 'confirmed';

  -- Gastos en efectivo pagados de esta caja (solo activos)
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_expenses
  FROM expenses
  WHERE cash_register_id = p_register_id
    AND payment_method = 'cash'
    AND status = 'active';

  -- Total general de gastos asociados a este turno (incluyendo tarjeta, transf, etc)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM expenses
  WHERE cash_register_id = p_register_id
    AND status = 'active';

  -- Resumen consolidado: Efectivo Esperado = Fondo + Ventas Efectivo - Envíos - Gastos Efectivo
  SELECT jsonb_build_object(
    'total_sales',          COUNT(*),
    'total_amount',         COALESCE(SUM(s.total), 0),
    'cash_sales',           COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0),
    'card_sales',           COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0),
    'transfer_sales',       COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.total ELSE 0 END), 0),
    'other_sales',          COALESCE(SUM(CASE WHEN s.payment_method = 'other' THEN s.total ELSE 0 END), 0),
    'opening_amount',       v_opening,
    'total_transfers',      v_transfers,
    'cash_expenses',        v_cash_expenses,
    'total_expenses',       v_total_expenses,
    'expected_cash',        v_opening + COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0) - v_transfers - v_cash_expenses
  ) INTO v_result
  FROM sales s
  WHERE s.cash_register_id = p_register_id
  AND s.status = 'completed';

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. ACTUALIZAR VISTA: v_cash_register_summary
-- ============================================================
DROP VIEW IF EXISTS v_cash_register_summary CASCADE;
CREATE VIEW v_cash_register_summary AS
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
  COALESCE(exp.cash_expenses, 0)     AS cash_expenses,
  COALESCE(exp.total_expenses, 0)    AS total_expenses,
  (cr.opening_amount + COALESCE(stats.cash_amount, 0) - COALESCE(tr.total_transfers, 0) - COALESCE(exp.cash_expenses, 0)) AS current_expected_cash
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
JOIN profiles p ON p.id = cr.cashier_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                          AS total_sales,
    COALESCE(SUM(total), 0)                                           AS total_amount,
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total END), 0)     AS cash_amount,
    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total END), 0)     AS card_amount,
    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total END), 0) AS transfer_amount
  FROM sales
  WHERE cash_register_id = cr.id AND status = 'completed'
) stats ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(amount), 0) AS total_transfers
  FROM cash_transfers
  WHERE cash_register_id = cr.id AND status = 'confirmed'
) tr ON true
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_expenses,
    COALESCE(SUM(amount), 0) AS total_expenses
  FROM expenses
  WHERE cash_register_id = cr.id AND status = 'active'
) exp ON true;

GRANT SELECT ON v_cash_register_summary TO authenticated;

-- 6. FUNCIONES RPC: create_expense, authorize_expense, cancel_expense
-- ============================================================

-- A. create_expense
CREATE OR REPLACE FUNCTION create_expense(
  p_branch_id        UUID,
  p_category_id      UUID,
  p_category_name    TEXT,
  p_description      TEXT,
  p_amount           NUMERIC,
  p_payment_method   TEXT,
  p_receipt_number   TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL,
  p_cash_register_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id        UUID;
  v_caller_role      TEXT;
  v_register_id      UUID := p_cash_register_id;
  v_new_id           UUID;
BEGIN
  v_caller_id := auth.uid();
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller_id;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del gasto debe ser mayor a L 0.00.';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'La descripción del gasto es obligatoria.';
  END IF;

  IF p_payment_method NOT IN ('cash', 'card', 'transfer', 'other') THEN
    RAISE EXCEPTION 'Método de pago inválido. Use cash, card, transfer u other.';
  END IF;

  -- Si es en efectivo y no se especificó caja, buscar caja abierta del usuario o sucursal
  IF p_payment_method = 'cash' AND v_register_id IS NULL THEN
    SELECT id INTO v_register_id
    FROM cash_registers
    WHERE branch_id = p_branch_id AND status = 'open' AND (cashier_id = v_caller_id OR v_caller_role IN ('ADMIN', 'SUPER_ADMIN'))
    ORDER BY opened_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO expenses (
    branch_id,
    cash_register_id,
    category_id,
    category_name,
    description,
    amount,
    payment_method,
    receipt_number,
    notes,
    expense_date,
    created_by,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_branch_id,
    v_register_id,
    p_category_id,
    TRIM(p_category_name),
    TRIM(p_description),
    p_amount,
    p_payment_method,
    NULLIF(TRIM(p_receipt_number), ''),
    NULLIF(TRIM(p_notes), ''),
    CURRENT_DATE,
    v_caller_id,
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_id;

  -- Auditoría
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, branch_id, new_data)
    VALUES (
      v_caller_id,
      'CREATE_EXPENSE',
      'expenses',
      v_new_id,
      p_branch_id,
      jsonb_build_object(
        'description', p_description,
        'amount', p_amount,
        'payment_method', p_payment_method,
        'cash_register_id', v_register_id,
        'category', p_category_name
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'success', true,
    'message', 'Gasto registrado correctamente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. authorize_expense (Revisar / Autorizar gasto)
CREATE OR REPLACE FUNCTION authorize_expense(p_expense_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_exp         expenses%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Solo un Administrador o Super Admin puede autorizar o revisar gastos.';
  END IF;

  SELECT * INTO v_exp FROM expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El gasto no fue encontrado.';
  END IF;

  IF v_exp.status = 'cancelled' THEN
    RAISE EXCEPTION 'No se puede autorizar un gasto que ha sido anulado.';
  END IF;

  UPDATE expenses
  SET authorized_by = v_caller_id,
      authorized_at = NOW(),
      updated_at = NOW()
  WHERE id = p_expense_id;

  RETURN jsonb_build_object('success', true, 'message', 'Gasto marcado como revisado y autorizado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. cancel_expense (Anular gasto)
CREATE OR REPLACE FUNCTION cancel_expense(p_expense_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_exp         expenses%ROWTYPE;
BEGIN
  v_caller_id := auth.uid();
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Solo un Administrador o Super Admin tiene permisos para anular gastos.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Debe especificar el motivo de anulación del gasto.';
  END IF;

  SELECT * INTO v_exp FROM expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El gasto no fue encontrado.';
  END IF;

  IF v_exp.status = 'cancelled' THEN
    RAISE EXCEPTION 'Este gasto ya se encuentra anulado.';
  END IF;

  UPDATE expenses
  SET status = 'cancelled',
      cancelled_by = v_caller_id,
      cancellation_reason = TRIM(p_reason),
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_expense_id;

  -- Auditoría
  BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, branch_id, new_data)
    VALUES (
      v_caller_id,
      'CANCEL_EXPENSE',
      'expenses',
      p_expense_id,
      v_exp.branch_id,
      jsonb_build_object(
        'amount', v_exp.amount,
        'description', v_exp.description,
        'reason', p_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Gasto anulado. Si fue pagado en efectivo, el monto fue reintegrado automáticamente a la caja.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. POLÍTICAS RLS (Row Level Security)
-- ============================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- expense_categories: todos los autenticados pueden leer
DROP POLICY IF EXISTS "Ver categorias autenticados" ON expense_categories;
CREATE POLICY "Ver categorias autenticados" ON expense_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Administrar categorias Admin" ON expense_categories;
CREATE POLICY "Administrar categorias Admin" ON expense_categories
  FOR ALL TO authenticated USING (is_admin_or_super());

-- expenses:
-- Super Admin: todo
-- Admin: su sucursal
-- Cajero: registrar y ver sus propios gastos
DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT TO authenticated
  USING (
    is_admin_or_super() OR
    created_by = auth.uid() OR
    user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_super() OR
    user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE TO authenticated
  USING (is_admin_or_super());

GRANT ALL ON expense_categories TO authenticated;
GRANT ALL ON expenses TO authenticated;
GRANT SELECT ON v_expenses_detail TO authenticated;
GRANT EXECUTE ON FUNCTION create_expense(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION authorize_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_expense(UUID, TEXT) TO authenticated;

-- Recargar caché de PostgREST en Supabase para que las nuevas tablas sean detectadas de inmediato
NOTIFY pgrst, 'reload schema';
