-- ============================================================
-- POLLO CRISPY - SCHEMA PRINCIPAL
-- Ejecutar primero en el Editor SQL de Supabase
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TIPOS ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CAJERO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_status AS ENUM ('completed', 'cancelled', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'card', 'transfer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cash_register_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLA: branches (Sucursales)
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  address     TEXT,
  phone       TEXT,
  city        TEXT,
  department  TEXT,
  status      branch_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_code   ON branches(code);

-- ============================================================
-- TABLA: profiles (Extiende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'CAJERO',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  avatar_url    TEXT,
  permissions   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role      ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- ============================================================
-- TABLA: user_branches (Relación usuarios <-> sucursales)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_branches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branches_user   ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_id);

-- ============================================================
-- TABLA: categories (Categorías de productos)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort      ON categories(sort_order);

-- ============================================================
-- TABLA: products (Productos)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id   UUID NOT NULL REFERENCES categories(id),
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  status        product_status NOT NULL DEFAULT 'active',
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);

-- ============================================================
-- TABLA: combos
-- ============================================================
CREATE TABLE IF NOT EXISTS combos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  status        product_status NOT NULL DEFAULT 'active',
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combos_status ON combos(status);

-- ============================================================
-- TABLA: combo_items (Contenido de cada combo)
-- ============================================================
CREATE TABLE IF NOT EXISTS combo_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id    UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(combo_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo   ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_product ON combo_items(product_id);

-- ============================================================
-- TABLA: cash_registers (Cajas / turnos)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_registers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  cashier_id          UUID NOT NULL REFERENCES profiles(id),
  status              cash_register_status NOT NULL DEFAULT 'open',
  opening_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_amount      NUMERIC(10,2),
  expected_cash       NUMERIC(10,2),
  difference          NUMERIC(10,2),
  observations        TEXT,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_branch   ON cash_registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_cashier  ON cash_registers(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status   ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened   ON cash_registers(opened_at);

-- ============================================================
-- SECUENCIA: Numeración de ventas por sucursal
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_sequences (
  branch_id   UUID PRIMARY KEY REFERENCES branches(id),
  last_number BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLA: sales (Ventas)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number       TEXT NOT NULL UNIQUE,
  branch_id         UUID NOT NULL REFERENCES branches(id),
  cashier_id        UUID NOT NULL REFERENCES profiles(id),
  cash_register_id  UUID REFERENCES cash_registers(id),
  customer_name     TEXT,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_type     discount_type,
  discount_value    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_by       UUID REFERENCES profiles(id),
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    payment_method NOT NULL DEFAULT 'cash',
  amount_received   NUMERIC(10,2),
  change_given      NUMERIC(10,2),
  status            sale_status NOT NULL DEFAULT 'completed',
  voided_by         UUID REFERENCES profiles(id),
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT,
  void_authorized_by UUID REFERENCES profiles(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_branch      ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier     ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_status      ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at  ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_register    ON sales(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_sales_number      ON sales(sale_number);

-- ============================================================
-- TABLA: sale_items (Detalle de ventas)
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_type     TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product','combo')),
  product_id    UUID REFERENCES products(id),
  combo_id      UUID REFERENCES combos(id),
  name          TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL,
  subtotal      NUMERIC(10,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_combo   ON sale_items(combo_id);

-- ============================================================
-- TABLA: audit_logs (Auditoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(id),
  action        TEXT NOT NULL,
  table_name    TEXT,
  record_id     UUID,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  branch_id     UUID REFERENCES branches(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch     ON audit_logs(branch_id);

-- ============================================================
-- TABLA: app_settings (Configuración de la aplicación)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key           TEXT NOT NULL UNIQUE,
  value         JSONB,
  description   TEXT,
  updated_by    UUID REFERENCES profiles(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','profiles','categories','products','combos','sales','cash_registers']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- TRIGGER: Crear profile automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'CAJERO')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
