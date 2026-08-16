-- ============================================================
-- POLLO CRISPY - ROW LEVEL SECURITY (RLS)
-- Ejecutar DESPUÉS de 01_schema.sql y 02_seed.sql
-- ============================================================

-- ============================================================
-- FUNCIÓN HELPER: Obtener rol del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN HELPER: Verificar si el usuario tiene acceso a una sucursal
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super Admin tiene acceso a todo
  IF (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;
  -- Admin y Cajero: verificar asignación
  RETURN EXISTS (
    SELECT 1 FROM user_branches
    WHERE user_id = auth.uid()
    AND branch_id = p_branch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_sequences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS: profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  );

-- ============================================================
-- POLÍTICAS: branches
-- ============================================================
DROP POLICY IF EXISTS "branches_select" ON branches;
CREATE POLICY "branches_select" ON branches
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(id)
  );

DROP POLICY IF EXISTS "branches_insert" ON branches;
CREATE POLICY "branches_insert" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS "branches_update" ON branches;
CREATE POLICY "branches_update" ON branches
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(id))
  );

-- ============================================================
-- POLÍTICAS: user_branches
-- ============================================================
DROP POLICY IF EXISTS "user_branches_select" ON user_branches;
CREATE POLICY "user_branches_select" ON user_branches
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_id = auth.uid()
    OR get_current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "user_branches_insert" ON user_branches;
CREATE POLICY "user_branches_insert" ON user_branches
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "user_branches_delete" ON user_branches;
CREATE POLICY "user_branches_delete" ON user_branches
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- POLÍTICAS: categories
-- ============================================================
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- POLÍTICAS: products
-- ============================================================
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- POLÍTICAS: combos
-- ============================================================
DROP POLICY IF EXISTS "combos_select" ON combos;
CREATE POLICY "combos_select" ON combos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "combos_insert" ON combos;
CREATE POLICY "combos_insert" ON combos
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

DROP POLICY IF EXISTS "combos_update" ON combos;
CREATE POLICY "combos_update" ON combos
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- POLÍTICAS: combo_items
-- ============================================================
DROP POLICY IF EXISTS "combo_items_select" ON combo_items;
CREATE POLICY "combo_items_select" ON combo_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "combo_items_manage" ON combo_items;
CREATE POLICY "combo_items_manage" ON combo_items
  FOR ALL TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'))
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));

-- ============================================================
-- POLÍTICAS: cash_registers
-- ============================================================
DROP POLICY IF EXISTS "cash_registers_select" ON cash_registers;
CREATE POLICY "cash_registers_select" ON cash_registers
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR cashier_id = auth.uid()
    OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(branch_id))
  );

DROP POLICY IF EXISTS "cash_registers_insert" ON cash_registers;
CREATE POLICY "cash_registers_insert" ON cash_registers
  FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "cash_registers_update" ON cash_registers;
CREATE POLICY "cash_registers_update" ON cash_registers
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR cashier_id = auth.uid()
    OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(branch_id))
  );

-- ============================================================
-- POLÍTICAS: sale_sequences
-- ============================================================
DROP POLICY IF EXISTS "sale_sequences_select" ON sale_sequences;
CREATE POLICY "sale_sequences_select" ON sale_sequences
  FOR SELECT TO authenticated
  USING (user_has_branch_access(branch_id));

DROP POLICY IF EXISTS "sale_sequences_update" ON sale_sequences;
CREATE POLICY "sale_sequences_update" ON sale_sequences
  FOR UPDATE TO authenticated
  USING (user_has_branch_access(branch_id));

-- ============================================================
-- POLÍTICAS: sales
-- ============================================================
DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR cashier_id = auth.uid()
    OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(branch_id))
  );

DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales
  FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales
  FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(branch_id))
    OR cashier_id = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: sale_items
-- ============================================================
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id
      AND (
        s.cashier_id = auth.uid()
        OR get_current_user_role() = 'SUPER_ADMIN'
        OR (get_current_user_role() = 'ADMIN' AND user_has_branch_access(s.branch_id))
      )
    )
  );

DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id AND s.cashier_id = auth.uid()
    )
  );

-- ============================================================
-- POLÍTICAS: audit_logs
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR (get_current_user_role() = 'ADMIN' AND (branch_id IS NULL OR user_has_branch_access(branch_id)))
  );

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- POLÍTICAS: app_settings
-- ============================================================
DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_update" ON app_settings
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'))
  WITH CHECK (get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
