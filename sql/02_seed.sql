-- ============================================================
-- POLLO CRISPY - DATOS INICIALES (SEED)
-- Ejecutar DESPUÉS de 01_schema.sql
-- Estos son datos de prueba. El Super Admin puede modificarlos.
-- ============================================================

-- Configuración inicial de la aplicación
INSERT INTO app_settings (key, value, description) VALUES
  ('business_name',     '"Pollo Crispy"',                    'Nombre del negocio'),
  ('business_phone',    '"+504 9999-9999"',                   'Teléfono del negocio'),
  ('business_address',  '"Honduras"',                         'Dirección principal'),
  ('currency_symbol',   '"L"',                                'Símbolo de moneda'),
  ('currency_code',     '"HNL"',                              'Código de moneda'),
  ('tax_rate',          '0',                                   'Tasa de impuesto (%)'),
  ('ticket_footer',     '"Gracias por su compra"',            'Pie del ticket'),
  ('ticket_header',     '"POLLO CRISPY"',                     'Encabezado del ticket'),
  ('low_stock_alert',   '5',                                   'Alerta de stock bajo')
ON CONFLICT (key) DO NOTHING;

-- Sucursales de ejemplo (datos iniciales)
INSERT INTO branches (id, name, code, address, phone, city, department, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Pollo Crispy 1', 'SUC01', 'Calle Principal #1, Centro', '9999-0001', 'Choluteca', 'Choluteca', 'active'),
  ('a1000000-0000-0000-0000-000000000002', 'Pollo Crispy 2', 'SUC02', 'Av. Comercial #45',          '9999-0002', 'Choluteca', 'Choluteca', 'active'),
  ('a1000000-0000-0000-0000-000000000003', 'Pollo Crispy 3', 'SUC03', 'Barrio El Centro, El Triunfo','9999-0003', 'El Triunfo', 'Choluteca', 'active')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

-- Inicializar secuencias de venta para cada sucursal
INSERT INTO sale_sequences (branch_id, last_number)
  SELECT id, 0 FROM branches
ON CONFLICT (branch_id) DO NOTHING;

-- Categorías de productos
INSERT INTO categories (id, name, description, icon, sort_order) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Piezas de Pollo', 'Piezas de pollo fritas',        '🍗', 1),
  ('b1000000-0000-0000-0000-000000000002', 'Combos',          'Combos especiales',              '🍱', 2),
  ('b1000000-0000-0000-0000-000000000003', 'Complementos',    'Acompañamientos y sides',        '🍟', 3),
  ('b1000000-0000-0000-0000-000000000004', 'Bebidas',         'Refrescos y bebidas',            '🥤', 4),
  ('b1000000-0000-0000-0000-000000000005', 'Postres',         'Postres y dulces',               '🎂', 5),
  ('b1000000-0000-0000-0000-000000000006', 'Extras',          'Salsas, extras y adicionales',   '🧂', 6),
  ('b1000000-0000-0000-0000-000000000007', 'Otros',           'Otros productos',                '📦', 7)
ON CONFLICT (id) DO NOTHING;

-- Productos - Piezas de Pollo
INSERT INTO products (id, category_id, name, description, price, sort_order, is_featured) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '1 Pieza de Pollo',   'Una pieza de pollo frito crujiente',             45.00, 1, false),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', '2 Piezas de Pollo',  'Dos piezas de pollo frito crujiente',            85.00, 2, false),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', '3 Piezas de Pollo',  'Tres piezas de pollo frito crujiente',          120.00, 3, true),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', '4 Piezas de Pollo',  'Cuatro piezas de pollo frito crujiente',        155.00, 4, false),
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', '6 Piezas de Pollo',  'Seis piezas de pollo frito crujiente',          225.00, 5, true),
  ('c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', '8 Piezas de Pollo',  'Ocho piezas de pollo frito crujiente',          290.00, 6, false),
  ('c1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000001', '10 Piezas de Pollo', 'Diez piezas de pollo frito crujiente',          350.00, 7, false)
ON CONFLICT (id) DO NOTHING;

-- Productos - Complementos
INSERT INTO products (id, category_id, name, description, price, sort_order) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 'Papas Pequeñas',  'Papas fritas tamaño pequeño',  35.00, 1),
  ('c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'Papas Medianas',  'Papas fritas tamaño mediano',  45.00, 2),
  ('c2000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'Papas Grandes',   'Papas fritas tamaño grande',   55.00, 3),
  ('c2000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000003', 'Ensalada',        'Ensalada fresca',              30.00, 4),
  ('c2000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000003', 'Yuca Frita',      'Yuca frita crujiente',         40.00, 5)
ON CONFLICT (id) DO NOTHING;

-- Productos - Bebidas
INSERT INTO products (id, category_id, name, description, price, sort_order) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'Coca-Cola 355ml', 'Refresco Coca-Cola 355ml', 25.00, 1),
  ('c3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'Coca-Cola 600ml', 'Refresco Coca-Cola 600ml', 35.00, 2),
  ('c3000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004', 'Coca-Cola 1.5L',  'Refresco Coca-Cola 1.5L',  55.00, 3),
  ('c3000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'Agua Purificada', 'Agua purificada 500ml',    20.00, 4),
  ('c3000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000004', 'Jugo Natural',    'Jugo de frutas natural',   30.00, 5)
ON CONFLICT (id) DO NOTHING;

-- Productos - Extras
INSERT INTO products (id, category_id, name, description, price, sort_order) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006', 'Salsa BBQ',     'Salsa barbacoa',       10.00, 1),
  ('c4000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', 'Salsa Ranch',   'Salsa ranch cremosa',  10.00, 2),
  ('c4000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006', 'Salsa Picante', 'Salsa picante casera', 10.00, 3)
ON CONFLICT (id) DO NOTHING;

-- Combos
INSERT INTO combos (id, name, description, price, is_featured, sort_order) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Combo Individual', 'Ideal para 1 persona. Incluye pollo, papas y bebida',               130.00, true,  1),
  ('d1000000-0000-0000-0000-000000000002', 'Combo 2 Piezas',   '2 piezas de pollo con papas medianas y bebida',                     150.00, false, 2),
  ('d1000000-0000-0000-0000-000000000003', 'Combo 3 Piezas',   '3 piezas de pollo con papas grandes y bebida',                      185.00, true,  3),
  ('d1000000-0000-0000-0000-000000000004', 'Combo Pareja',     'Para 2 personas: 4 piezas, 2 papas medianas y 2 bebidas',           260.00, false, 4),
  ('d1000000-0000-0000-0000-000000000005', 'Combo Familiar',   'Para la familia: 8 piezas, 2 papas grandes, ensalada y 4 bebidas',  450.00, true,  5)
ON CONFLICT (id) DO NOTHING;

-- Contenido de los combos
INSERT INTO combo_items (combo_id, product_id, quantity) VALUES
  -- Combo Individual: 1 pieza + papas pequeñas + Coca 355ml
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1),
  ('d1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1),
  ('d1000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 1),
  -- Combo 2 Piezas
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 1),
  ('d1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 1),
  ('d1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 1),
  -- Combo 3 Piezas
  ('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 1),
  ('d1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000003', 1),
  ('d1000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001', 1),
  -- Combo Pareja
  ('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 1),
  ('d1000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000002', 2),
  ('d1000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000001', 2),
  -- Combo Familiar
  ('d1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 1),
  ('d1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003', 2),
  ('d1000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000004', 1),
  ('d1000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000001', 4)
ON CONFLICT (combo_id, product_id) DO NOTHING;

-- ============================================================
-- NOTA: Para crear el primer Super Admin:
-- 1. Ve a Supabase Dashboard > Authentication > Users > Add user
-- 2. Crea el usuario con email y contraseña
-- 3. Ejecuta en SQL Editor:
--    UPDATE profiles SET role = 'SUPER_ADMIN', full_name = 'Tu Nombre'
--    WHERE id = 'auth-user-uuid-aqui';
-- ============================================================
