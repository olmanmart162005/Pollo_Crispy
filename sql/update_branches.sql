-- ============================================================
-- POLLO CRISPY - ACTUALIZAR NOMBRES DE SUCURSALES
-- ============================================================

-- Actualizar los nombres de las sucursales existentes por su código
UPDATE branches SET name = 'Pollo Crispy 1' WHERE code = 'SUC01';
UPDATE branches SET name = 'Pollo Crispy 2' WHERE code = 'SUC02';
UPDATE branches SET name = 'Pollo Crispy 3' WHERE code = 'SUC03';

-- Si no existían con esos códigos, insertarlas
INSERT INTO branches (id, name, code, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Pollo Crispy 1', 'SUC01', 'active'),
  ('a1000000-0000-0000-0000-000000000002', 'Pollo Crispy 2', 'SUC02', 'active'),
  ('a1000000-0000-0000-0000-000000000003', 'Pollo Crispy 3', 'SUC03', 'active')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

-- Inicializar secuencias
INSERT INTO sale_sequences (branch_id, last_number)
  SELECT id, 0 FROM branches
ON CONFLICT (branch_id) DO NOTHING;
