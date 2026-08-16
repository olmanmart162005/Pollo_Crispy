-- ============================================================
-- POLLO CRISPY — ACTUALIZAR IMÁGENES CON ARCHIVOS LOCALES
-- Ejecutar desde: Supabase Dashboard → SQL Editor
-- Las rutas /assets/... apuntan a los archivos en public/assets/
-- ============================================================

-- ============================================================
-- PASO 1: DESACTIVAR COCA-COLA (si no se hizo antes)
-- ============================================================
UPDATE products
SET status = 'inactive', updated_at = NOW()
WHERE LOWER(name) LIKE '%coca-cola%'
   OR LOWER(name) LIKE '%cocacola%'
   OR LOWER(name) LIKE '%fanta%'
   OR LOWER(name) LIKE '%sprite%'
   OR LOWER(name) LIKE '%coca cola%';

-- ============================================================
-- PASO 2: ASEGURAR CATEGORÍAS CORRECTAS
-- ============================================================

-- Asegurar categoría "Pollo Crispy" (puede llamarse "Piezas de Pollo")
INSERT INTO categories (name, description, icon, sort_order, is_active)
VALUES ('Pollo Crispy', 'Piezas de pollo crispy', '🍗', 1, true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description, icon = EXCLUDED.icon,
      is_active = true, updated_at = NOW();

-- Asegurar categoría "Pollo Asado"
INSERT INTO categories (name, description, icon, sort_order, is_active)
VALUES ('Pollo Asado', 'Piezas de pollo asado', '🍖', 2, true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description, icon = EXCLUDED.icon,
      is_active = true, updated_at = NOW();

-- Asegurar categoría "Bebidas"
INSERT INTO categories (name, description, icon, sort_order, is_active)
VALUES ('Bebidas', 'Refrescos y bebidas', '🥤', 5, true)
ON CONFLICT (name) DO UPDATE SET is_active = true, updated_at = NOW();

-- ============================================================
-- PASO 3: PRODUCTOS POLLO CRISPY — CON IMÁGENES LOCALES
-- ============================================================

-- Pollo Entero — L 210
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pollo Entero', 'Pollo entero crispy frito crujiente', 210.00, 'active', true, 1,
  '/assets/pollo-entero-frito.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=210.00, status='active', image_url='/assets/pollo-entero-frito.jpg', updated_at=NOW()
WHERE LOWER(name)='pollo entero' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- Medio Pollo — L 135
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Medio Pollo', 'Medio pollo crispy frito crujiente', 135.00, 'active', false, 2,
  '/assets/Crispy2.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=135.00, status='active', image_url='/assets/Crispy2.jpg', updated_at=NOW()
WHERE LOWER(name)='medio pollo' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- Pechuga — L 60
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pechuga', 'Pechuga de pollo crispy', 60.00, 'active', true, 3,
  '/assets/pechuga.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=60.00, status='active', image_url='/assets/pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- Muslo — L 40
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Muslo', 'Muslo de pollo crispy', 40.00, 'active', false, 4,
  '/assets/muslo.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=40.00, status='active', image_url='/assets/muslo.jpg', updated_at=NOW()
WHERE LOWER(name)='muslo' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- Pierna — L 25
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pierna', 'Pierna de pollo crispy', 25.00, 'active', false, 5,
  '/assets/pierna.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=25.00, status='active', image_url='/assets/pierna.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- Ala — L 25
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Ala', 'Ala de pollo crispy', 25.00, 'active', false, 6,
  '/assets/ala.jpg'
FROM categories WHERE name = 'Pollo Crispy' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=25.00, status='active', image_url='/assets/ala.jpg', updated_at=NOW()
WHERE LOWER(name)='ala' AND category_id=(SELECT id FROM categories WHERE name='Pollo Crispy' LIMIT 1);

-- ============================================================
-- PASO 4: PRODUCTOS POLLO ASADO — CON IMÁGENES LOCALES
-- ============================================================

-- Pollo Asado Entero — L 240
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pollo Asado Entero', 'Pollo entero asado al carbón', 240.00, 'active', true, 1,
  '/assets/pollo-entero-asado.jpg'
FROM categories WHERE name = 'Pollo Asado' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=240.00, status='active', image_url='/assets/pollo-entero-asado.jpg', updated_at=NOW()
WHERE LOWER(name)='pollo asado entero' AND category_id=(SELECT id FROM categories WHERE name='Pollo Asado' LIMIT 1);

-- Medio Pollo Asado — L 120
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Medio Pollo Asado', 'Medio pollo asado al carbón', 120.00, 'active', false, 2,
  '/assets/pollo-entero-asado.jpg'
FROM categories WHERE name = 'Pollo Asado' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=120.00, status='active', image_url='/assets/pollo-entero-asado.jpg', updated_at=NOW()
WHERE LOWER(name)='medio pollo asado' AND category_id=(SELECT id FROM categories WHERE name='Pollo Asado' LIMIT 1);

-- Pechuga y Ala — L 65
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pechuga y Ala', 'Pechuga y ala de pollo asado', 65.00, 'active', false, 3,
  '/assets/pierna-pechuga.jpg'
FROM categories WHERE name = 'Pollo Asado' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=65.00, status='active', image_url='/assets/pierna-pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga y ala' AND category_id=(SELECT id FROM categories WHERE name='Pollo Asado' LIMIT 1);

-- Pierna y Muslo — L 55
INSERT INTO products (category_id, name, description, price, status, is_featured, sort_order, image_url)
SELECT id, 'Pierna y Muslo', 'Pierna y muslo de pollo asado', 55.00, 'active', false, 4,
  '/assets/pierna-pechuga.jpg'
FROM categories WHERE name = 'Pollo Asado' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET price=55.00, status='active', image_url='/assets/pierna-pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna y muslo' AND category_id=(SELECT id FROM categories WHERE name='Pollo Asado' LIMIT 1);

-- ============================================================
-- PASO 5: BEBIDAS PEPSI (sin precio inventado)
-- ============================================================
INSERT INTO products (category_id, name, description, price, status, sort_order, image_url)
SELECT id, 'Pepsi', 'Refresco Pepsi', 0.00, 'active', 10, '/assets/refrescos.jpg'
FROM categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET status='active', image_url='/assets/refrescos.jpg', updated_at=NOW()
WHERE LOWER(name)='pepsi' AND category_id=(SELECT id FROM categories WHERE name='Bebidas' LIMIT 1);

INSERT INTO products (category_id, name, description, price, status, sort_order, image_url)
SELECT id, 'Pepsi Black', 'Refresco Pepsi Black sin azúcar', 0.00, 'active', 11, '/assets/refrescos.jpg'
FROM categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET status='active', image_url='/assets/refrescos.jpg', updated_at=NOW()
WHERE LOWER(name)='pepsi black' AND category_id=(SELECT id FROM categories WHERE name='Bebidas' LIMIT 1);

INSERT INTO products (category_id, name, description, price, status, sort_order, image_url)
SELECT id, '7UP', 'Refresco 7UP limón', 0.00, 'active', 12, '/assets/refrescos.jpg'
FROM categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET status='active', image_url='/assets/refrescos.jpg', updated_at=NOW()
WHERE LOWER(name)='7up' AND category_id=(SELECT id FROM categories WHERE name='Bebidas' LIMIT 1);

INSERT INTO products (category_id, name, description, price, status, sort_order, image_url)
SELECT id, 'Mirinda', 'Refresco Mirinda naranja', 0.00, 'active', 13, '/assets/refrescos.jpg'
FROM categories WHERE name = 'Bebidas' LIMIT 1
ON CONFLICT DO NOTHING;
UPDATE products SET status='active', image_url='/assets/refrescos.jpg', updated_at=NOW()
WHERE LOWER(name)='mirinda' AND category_id=(SELECT id FROM categories WHERE name='Bebidas' LIMIT 1);

-- ============================================================
-- PASO 6: COMBOS CON IMÁGENES LOCALES
-- ============================================================

-- Muslo con Tajada — L 90
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Muslo con Tajada','Muslo de pollo crispy con tajada',90.00,'active',false,10,'/assets/muslo con tajadas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=90.00, status='active', image_url='/assets/muslo con tajadas.jpg', updated_at=NOW()
WHERE LOWER(name)='muslo con tajada';

-- Pechuga con Tajada — L 115
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Pechuga con Tajada','Pechuga de pollo crispy con tajada',115.00,'active',true,11,'/assets/pechuga con tajadas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=115.00, status='active', image_url='/assets/pechuga con tajadas.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga con tajada';

-- Muslo y Pierna con Tajada — L 105
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Muslo y Pierna con Tajada','Muslo y pierna de pollo crispy con tajada',105.00,'active',false,12,'/assets/pierna con tajadas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=105.00, status='active', image_url='/assets/pierna con tajadas.jpg', updated_at=NOW()
WHERE LOWER(name)='muslo y pierna con tajada';

-- Pechuga y Ala con Tajada — L 140
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Pechuga y Ala con Tajada','Pechuga y ala de pollo crispy con tajada',140.00,'active',true,13,'/assets/alas con tajadas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=140.00, status='active', image_url='/assets/alas con tajadas.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga y ala con tajada';

-- Pierna y Ala — L 95
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Pierna y Ala','Pierna y ala de pollo crispy',95.00,'active',false,14,'/assets/alas con papas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=95.00, status='active', image_url='/assets/alas con papas.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna y ala';

-- Pierna o Ala — L 75
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Pierna o Ala','Pierna o ala de pollo crispy',75.00,'active',false,15,'/assets/pierna con tajadas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=75.00, status='active', image_url='/assets/pierna con tajadas.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna o ala';

-- Chilakiles Chico — L 85
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Chilakiles Chico','Chilakiles tamaño chico',85.00,'active',false,16,'/assets/Chilaquiles.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=85.00, status='active', image_url='/assets/Chilaquiles.jpg', updated_at=NOW()
WHERE LOWER(name)='chilakiles chico';

-- Chilakiles Grande — L 115
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Chilakiles Grande','Chilakiles tamaño grande',115.00,'active',false,17,'/assets/Chilaquiles.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=115.00, status='active', image_url='/assets/Chilaquiles.jpg', updated_at=NOW()
WHERE LOWER(name)='chilakiles grande';

-- Medio con Tajadas — L 210
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Medio con Tajadas','Medio pollo crispy con tajadas',210.00,'active',true,18,'/assets/Crispy3.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET price=210.00, status='active', image_url='/assets/Crispy3.jpg', updated_at=NOW()
WHERE LOWER(name)='medio con tajadas';

-- Tajada o Papa (acompañamiento)
INSERT INTO combos (name, description, price, status, is_featured, sort_order, image_url)
VALUES ('Tajada o Papa','Acompañamiento: tajada o papa frita',0.00,'active',false,19,'/assets/papas.jpg')
ON CONFLICT DO NOTHING;
UPDATE combos SET status='active', image_url='/assets/papas.jpg', updated_at=NOW()
WHERE LOWER(name)='tajada o papa';

-- ============================================================
-- PASO 7: ACTUALIZAR IMÁGENES EN PRODUCTOS EXISTENTES QUE
--         YA EXISTEN PERO CON image_url de Unsplash (o vacía)
-- ============================================================

-- Pollo Entero (cualquier categoría que lo tenga)
UPDATE products SET image_url='/assets/pollo-entero-frito.jpg', updated_at=NOW()
WHERE LOWER(name)='pollo entero'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Medio Pollo
UPDATE products SET image_url='/assets/Crispy2.jpg', updated_at=NOW()
WHERE LOWER(name)='medio pollo'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Pechuga
UPDATE products SET image_url='/assets/pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Muslo
UPDATE products SET image_url='/assets/muslo.jpg', updated_at=NOW()
WHERE LOWER(name)='muslo'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Pierna
UPDATE products SET image_url='/assets/pierna.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Ala
UPDATE products SET image_url='/assets/ala.jpg', updated_at=NOW()
WHERE LOWER(name)='ala'
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- Pollo Asado Entero
UPDATE products SET image_url='/assets/pollo-entero-asado.jpg', updated_at=NOW()
WHERE LOWER(name)='pollo asado entero';

-- Medio Pollo Asado
UPDATE products SET image_url='/assets/pollo-entero-asado.jpg', updated_at=NOW()
WHERE LOWER(name)='medio pollo asado';

-- Pechuga y Ala
UPDATE products SET image_url='/assets/pierna-pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pechuga y ala';

-- Pierna y Muslo
UPDATE products SET image_url='/assets/pierna-pechuga.jpg', updated_at=NOW()
WHERE LOWER(name)='pierna y muslo';

-- Crispy genéricos sin imagen
UPDATE products SET image_url='/assets/Crispy1.jpg', updated_at=NOW()
WHERE image_url IS NULL
  AND category_id IN (SELECT id FROM categories WHERE name IN ('Pollo Crispy','Piezas de Pollo'));

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT p.name, p.price, p.status, p.image_url, c.name as cat
-- FROM products p JOIN categories c ON p.category_id = c.id
-- WHERE p.status = 'active' ORDER BY c.sort_order, p.sort_order;
