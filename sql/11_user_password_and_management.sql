-- ============================================================
-- POLLO CRISPY - GESTIÓN SEGURA DE CONTRASEÑAS Y USUARIOS
-- Script 11: Cambio de contraseña administrativo y comprobación de integridad
-- ============================================================

-- Habilitar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ============================================================
-- 0. FUNCIÓN: get_app_users_with_email
-- Obtiene perfiles de usuarios junto con su correo electrónico de auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_app_users_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  role user_role,
  is_active BOOLEAN,
  avatar_url TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 
    p.id,
    p.full_name,
    p.phone,
    p.role,
    p.is_active,
    p.avatar_url,
    p.permissions,
    p.created_at,
    p.updated_at,
    u.email::TEXT
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.full_name;
$$;

-- ============================================================
-- 1. FUNCIÓN: admin_reset_user_password
-- Permite a SUPER_ADMIN y ADMIN restablecer la contraseña de un usuario
-- respetando estrictamente los roles y sucursales.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_target_user_id UUID,
  p_new_password   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_caller_id     UUID;
  v_caller_role   user_role;
  v_target_role   user_role;
  v_target_name   TEXT;
  v_target_email  TEXT;
  v_has_common_branch BOOLEAN;
  v_encrypted_pw  TEXT;
BEGIN
  -- 1. Validar sesión del usuario que ejecuta
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no válida o expirada. Por favor inicie sesión de nuevo.');
  END IF;

  -- 2. Obtener rol del operador actual
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró el perfil del operador autenticado.');
  END IF;

  -- 3. Los Cajeros NO pueden cambiar contraseñas de otros usuarios
  IF v_caller_role = 'CAJERO' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos para cambiar contraseñas de otros usuarios.');
  END IF;

  -- 4. Obtener datos del usuario objetivo
  SELECT role, full_name INTO v_target_role, v_target_name FROM public.profiles WHERE id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario seleccionado no existe.');
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- 5. Validaciones de permisos jerárquicos
  IF v_caller_role = 'ADMIN' THEN
    -- Admin NO puede cambiar contraseña de Super Admin ni de otros Admins
    IF v_target_role IN ('SUPER_ADMIN', 'ADMIN') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Los administradores solo pueden cambiar contraseñas de usuarios con rol CAJERO.');
    END IF;

    -- Validar que el Cajero pertenezca a al menos una sucursal del Admin
    SELECT EXISTS (
      SELECT 1 
      FROM public.user_branches ub_admin
      INNER JOIN public.user_branches ub_target ON ub_admin.branch_id = ub_target.branch_id
      WHERE ub_admin.user_id = v_caller_id AND ub_target.user_id = p_target_user_id
    ) INTO v_has_common_branch;

    IF NOT v_has_common_branch THEN
      RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para modificar usuarios de otras sucursales.');
    END IF;
  END IF;

  -- 6. Validar contraseña
  IF p_new_password IS NULL OR LENGTH(TRIM(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
  END IF;

  -- 7. Generar Hash Bcrypt GoTrue-compatible
  BEGIN
    v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));
  EXCEPTION WHEN OTHERS THEN
    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));
  END;

  -- 8. Actualizar contraseña en auth.users
  UPDATE auth.users
  SET encrypted_password = v_encrypted_pw,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 9. Registrar en auditoría (sin registrar jamás la contraseña)
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
  VALUES (
    v_caller_id,
    'ADMIN_RESET_PASSWORD',
    'profiles',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_name', v_target_name,
      'target_email', v_target_email,
      'target_role', v_target_role
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña del usuario actualizada correctamente');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================
-- 2. FUNCIÓN: check_user_has_history
-- Verifica si un usuario tiene registros históricos financieros
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_user_has_history(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_sales_count       BIGINT := 0;
  v_registers_count   BIGINT := 0;
  v_transfers_count   BIGINT := 0;
  v_has_history       BOOLEAN := false;
BEGIN
  -- Contar ventas realizadas
  SELECT COUNT(*) INTO v_sales_count FROM public.sales WHERE cashier_id = p_target_user_id;

  -- Contar turnos de caja
  SELECT COUNT(*) INTO v_registers_count FROM public.cash_registers WHERE cashier_id = p_target_user_id;

  -- Contar envíos de efectivo
  SELECT COUNT(*) INTO v_transfers_count FROM public.cash_transfers WHERE sender_id = p_target_user_id;

  IF (v_sales_count > 0 OR v_registers_count > 0 OR v_transfers_count > 0) THEN
    v_has_history := true;
  END IF;

  RETURN jsonb_build_object(
    'has_history', v_has_history,
    'sales_count', v_sales_count,
    'registers_count', v_registers_count,
    'transfers_count', v_transfers_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'has_history', true,
    'error', SQLERRM
  );
END;
$$;


-- ============================================================
-- 3. FUNCIÓN: delete_app_user (Mejorada con validación de historial)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_app_user(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_caller_role       user_role;
  v_caller_id         UUID;
  v_target_name       TEXT;
  v_sales_count       BIGINT := 0;
  v_registers_count   BIGINT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no válida o expirada.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role != 'SUPER_ADMIN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el Super Admin tiene permiso para eliminar usuarios.');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminar tu propia cuenta de Super Admin.');
  END IF;

  -- Comprobar si tiene registros de ventas o caja
  SELECT COUNT(*) INTO v_sales_count FROM public.sales WHERE cashier_id = p_target_user_id;
  SELECT COUNT(*) INTO v_registers_count FROM public.cash_registers WHERE cashier_id = p_target_user_id;

  IF (v_sales_count > 0 OR v_registers_count > 0) THEN
    RETURN jsonb_build_object(
      'success', false,
      'has_history', true,
      'error', 'Este usuario tiene registros históricos de ventas o caja y no puede eliminarse físicamente para proteger la integridad contable. Desactiva su acceso en su lugar.'
    );
  END IF;

  SELECT full_name INTO v_target_name FROM public.profiles WHERE id = p_target_user_id;

  -- Registrar en auditoría antes de eliminar
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
  VALUES (
    v_caller_id,
    'DELETE_USER',
    'profiles',
    p_target_user_id,
    jsonb_build_object('deleted_user_id', p_target_user_id, 'name', v_target_name)
  );

  -- Borrar de auth.users (cascada a profiles y user_branches)
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado correctamente');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
