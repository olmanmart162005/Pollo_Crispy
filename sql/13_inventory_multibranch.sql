-- ============================================================
-- POLLO CRISPY — SQL MIGRACIÓN 13: CONTROL DE INSUMOS, MATERIA PRIMA Y SUMINISTROS
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 0. LIMPIEZA DE TABLAS, VISTAS Y FUNCIONES PREVIAS (Para evitar error 42P13 de parámetros)
DROP VIEW IF EXISTS v_inventory_movements CASCADE;
DROP VIEW IF EXISTS v_branch_inventory CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS branch_inventory CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;

-- Eliminar funciones previas para poder renombrar parámetros
DROP FUNCTION IF EXISTS register_inventory_movement(UUID, UUID, TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS register_inventory_movement CASCADE;
DROP FUNCTION IF EXISTS adjust_inventory_stock(UUID, UUID, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS adjust_inventory_stock CASCADE;
DROP FUNCTION IF EXISTS update_inventory_min_stock(UUID, UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS update_inventory_min_stock CASCADE;
DROP FUNCTION IF EXISTS create_inventory_item(TEXT, TEXT, TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS create_inventory_item CASCADE;

-- 1. TABLA: inventory_items (Catálogo Maestro de Insumos - Tandas de Pollo)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL DEFAULT 'Pollo',
  unit_measure    TEXT NOT NULL DEFAULT 'Tanda',
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_cat ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_act ON inventory_items(is_active);

-- 2. TABLA: branch_inventory (Existencias de Tandas por Sucursal)
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  stock           NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(12,2) NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_branch_item UNIQUE (branch_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch ON branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_item   ON branch_inventory(item_id);

-- 3. TABLA: inventory_movements (Kardex / Historial de Entradas, Salidas y Ajustes)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity        NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  previous_stock  NUMERIC(12,2) NOT NULL,
  new_stock       NUMERIC(12,2) NOT NULL,
  user_id         UUID REFERENCES profiles(id),
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_branch   ON inventory_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_item     ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type     ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_created  ON inventory_movements(created_at DESC);

-- 4. POBLADO INICIAL: ÚNICAMENTE TANDAS DE POLLO
-- ============================================================
INSERT INTO inventory_items (name, category, unit_measure, cost_price) VALUES
  ('Tandas de Pollo', 'Pollo', 'Tanda', 0.00)
ON CONFLICT (name) DO NOTHING;

-- 5. ASIGNAR TANDAS DE POLLO A CADA SUCURSAL CON STOCK 0 Y MÍNIMO 3 TANDAS
-- ============================================================
INSERT INTO branch_inventory (branch_id, item_id, stock, min_stock, updated_at)
SELECT b.id, ii.id, 0, 3, NOW()
FROM branches b
CROSS JOIN inventory_items ii
ON CONFLICT (branch_id, item_id) DO NOTHING;

-- 6. VISTA: v_branch_inventory (Existencias de insumos valorizadas)
-- ============================================================
CREATE VIEW v_branch_inventory AS
SELECT
  bi.id,
  bi.branch_id,
  b.name              AS branch_name,
  b.code              AS branch_code,
  bi.item_id,
  ii.name             AS item_name,
  ii.category         AS category,
  ii.unit_measure     AS unit_measure,
  ii.cost_price       AS cost_price,
  ii.is_active        AS item_active,
  bi.stock,
  bi.min_stock,
  ROUND(bi.stock * ii.cost_price, 2) AS total_value,
  CASE
    WHEN bi.stock <= 0 THEN 'out_of_stock'
    WHEN bi.stock <= bi.min_stock THEN 'low_stock'
    ELSE 'available'
  END                 AS stock_status,
  bi.updated_at
FROM branch_inventory bi
JOIN branches b        ON b.id = bi.branch_id
JOIN inventory_items ii ON ii.id = bi.item_id;

GRANT SELECT ON v_branch_inventory TO authenticated;

-- 7. VISTA: v_inventory_movements (Kardex detallado)
-- ============================================================
CREATE VIEW v_inventory_movements AS
SELECT
  im.id,
  im.branch_id,
  b.name              AS branch_name,
  im.item_id,
  ii.name             AS item_name,
  ii.category         AS category,
  ii.unit_measure     AS unit_measure,
  im.movement_type,
  im.quantity,
  im.previous_stock,
  im.new_stock,
  im.user_id,
  COALESCE(pr.full_name, 'Sistema') AS user_name,
  COALESCE(pr.role::text, 'SISTEMA') AS user_role,
  im.reason,
  im.created_at
FROM inventory_movements im
JOIN branches b        ON b.id = im.branch_id
JOIN inventory_items ii ON ii.id = im.item_id
LEFT JOIN profiles pr  ON pr.id = im.user_id;

GRANT SELECT ON v_inventory_movements TO authenticated;

-- 8. FUNCIÓN RPC: create_inventory_item (Crear nuevo insumo y habilitarlo en sucursales)
-- ============================================================
CREATE OR REPLACE FUNCTION create_inventory_item(
  p_name          TEXT,
  p_category      TEXT,
  p_unit_measure  TEXT,
  p_cost_price    NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_item_id       UUID;
BEGIN
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'El nombre del insumo es requerido.';
  END IF;

  INSERT INTO inventory_items (name, category, unit_measure, cost_price)
  VALUES (TRIM(p_name), COALESCE(TRIM(p_category), 'General'), COALESCE(TRIM(p_unit_measure), 'Unidad'), COALESCE(p_cost_price, 0))
  RETURNING id INTO v_item_id;

  -- Asignar a todas las sucursales con stock 0
  INSERT INTO branch_inventory (branch_id, item_id, stock, min_stock, updated_at)
  SELECT b.id, v_item_id, 0, 5, NOW()
  FROM branches b
  ON CONFLICT (branch_id, item_id) DO NOTHING;

  RETURN jsonb_build_object(
    'id', v_item_id,
    'name', p_name,
    'category', p_category,
    'unit_measure', p_unit_measure,
    'cost_price', p_cost_price,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FUNCIÓN RPC: register_inventory_movement (Entrada o Salida de Insumo)
-- ============================================================
CREATE OR REPLACE FUNCTION register_inventory_movement(
  p_branch_id       UUID,
  p_item_id         UUID,
  p_movement_type   TEXT,
  p_quantity        NUMERIC,
  p_reason          TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id       UUID;
  v_prev_stock      NUMERIC := 0;
  v_new_stock       NUMERIC := 0;
  v_inv_id          UUID;
BEGIN
  v_caller_id := auth.uid();

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0.';
  END IF;

  IF p_movement_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de movimiento inválido. Use "in" para entrada o "out" para salida.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo u observación es requerido.';
  END IF;

  SELECT id, stock INTO v_inv_id, v_prev_stock
  FROM branch_inventory
  WHERE branch_id = p_branch_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_inv_id IS NULL THEN
    INSERT INTO branch_inventory (branch_id, item_id, stock, min_stock, updated_at)
    VALUES (p_branch_id, p_item_id, 0, 5, NOW())
    RETURNING id, stock INTO v_inv_id, v_prev_stock;
  END IF;

  IF p_movement_type = 'in' THEN
    v_new_stock := v_prev_stock + p_quantity;
  ELSIF p_movement_type = 'out' THEN
    IF (v_prev_stock - p_quantity) < 0 THEN
      RAISE EXCEPTION 'No hay existencias suficientes de este insumo. Stock actual: %, solicitado: %', v_prev_stock, p_quantity;
    END IF;
    v_new_stock := v_prev_stock - p_quantity;
  END IF;

  UPDATE branch_inventory
  SET stock = v_new_stock,
      updated_at = NOW()
  WHERE id = v_inv_id;

  INSERT INTO inventory_movements (
    branch_id, item_id, movement_type, quantity, previous_stock, new_stock, user_id, reason, created_at
  ) VALUES (
    p_branch_id, p_item_id, p_movement_type, p_quantity, v_prev_stock, v_new_stock, v_caller_id, p_reason, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'branch_id', p_branch_id,
    'item_id', p_item_id,
    'movement_type', p_movement_type,
    'quantity', p_quantity,
    'previous_stock', v_prev_stock,
    'new_stock', v_new_stock
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. FUNCIÓN RPC: adjust_inventory_stock (Ajuste Físico de Insumo)
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_inventory_stock(
  p_branch_id       UUID,
  p_item_id         UUID,
  p_new_stock       NUMERIC,
  p_reason          TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id       UUID;
  v_prev_stock      NUMERIC := 0;
  v_diff            NUMERIC := 0;
  v_inv_id          UUID;
BEGIN
  v_caller_id := auth.uid();

  IF p_new_stock IS NULL OR p_new_stock < 0 THEN
    RAISE EXCEPTION 'El nuevo stock debe ser mayor o igual a 0.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo del ajuste es requerido.';
  END IF;

  SELECT id, stock INTO v_inv_id, v_prev_stock
  FROM branch_inventory
  WHERE branch_id = p_branch_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_inv_id IS NULL THEN
    INSERT INTO branch_inventory (branch_id, item_id, stock, min_stock, updated_at)
    VALUES (p_branch_id, p_item_id, p_new_stock, 5, NOW())
    RETURNING id, stock INTO v_inv_id, v_prev_stock;
    v_diff := p_new_stock;
  ELSE
    v_diff := p_new_stock - v_prev_stock;
    UPDATE branch_inventory
    SET stock = p_new_stock,
        updated_at = NOW()
    WHERE id = v_inv_id;
  END IF;

  INSERT INTO inventory_movements (
    branch_id, item_id, movement_type, quantity, previous_stock, new_stock, user_id, reason, created_at
  ) VALUES (
    p_branch_id, p_item_id, 'adjustment', ABS(v_diff), v_prev_stock, p_new_stock, v_caller_id, p_reason, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'branch_id', p_branch_id,
    'item_id', p_item_id,
    'previous_stock', v_prev_stock,
    'new_stock', p_new_stock,
    'difference', v_diff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNCIÓN RPC: update_inventory_min_stock
-- ============================================================
CREATE OR REPLACE FUNCTION update_inventory_min_stock(
  p_branch_id       UUID,
  p_item_id         UUID,
  p_min_stock       NUMERIC
)
RETURNS JSONB AS $$
BEGIN
  IF p_min_stock IS NULL OR p_min_stock < 0 THEN
    RAISE EXCEPTION 'El stock mínimo debe ser mayor o igual a 0.';
  END IF;

  INSERT INTO branch_inventory (branch_id, item_id, stock, min_stock, updated_at)
  VALUES (p_branch_id, p_item_id, 0, p_min_stock, NOW())
  ON CONFLICT (branch_id, item_id)
  DO UPDATE SET min_stock = p_min_stock, updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. PERMISOS DE EJECUCIÓN RPC
-- ============================================================
GRANT EXECUTE ON FUNCTION create_inventory_item(TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION register_inventory_movement(UUID, UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_inventory_stock(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_inventory_min_stock(UUID, UUID, NUMERIC) TO authenticated;

-- 13. POLÍTICAS RLS EN TABLAS
-- ============================================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_all" ON inventory_items;
CREATE POLICY "inventory_items_all" ON inventory_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "branch_inventory_select" ON branch_inventory;
CREATE POLICY "branch_inventory_select" ON branch_inventory
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "branch_inventory_manage" ON branch_inventory;
CREATE POLICY "branch_inventory_manage" ON branch_inventory
  FOR ALL TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(branch_id)
  )
  WITH CHECK (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "inventory_movements_select" ON inventory_movements;
CREATE POLICY "inventory_movements_select" ON inventory_movements
  FOR SELECT TO authenticated
  USING (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(branch_id)
  );

DROP POLICY IF EXISTS "inventory_movements_insert" ON inventory_movements;
CREATE POLICY "inventory_movements_insert" ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() = 'SUPER_ADMIN'
    OR user_has_branch_access(branch_id)
  );
