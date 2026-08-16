-- ============================================================
-- POLLO CRISPY - GESTIÓN DE USUARIOS SEGURA (REPARACIÓN DEFECTOS GOTRUE 500)
-- ============================================================

-- Habilitar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ELIMINAR SOBRECARGAS PREVIAS DE LA FUNCIÓN
DROP FUNCTION IF EXISTS public.create_app_user(text, text, text, text, user_role, uuid[]);
DROP FUNCTION IF EXISTS public.create_app_user(text, text, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.create_app_user;

-- Función de creación de usuarios 100% GoTrue Compliant
CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email       TEXT,
  p_password    TEXT,
  p_full_name   TEXT,
  p_phone       TEXT DEFAULT '',
  p_role        TEXT DEFAULT 'CAJERO',
  p_branch_ids  UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_caller_role user_role;
  v_caller_id   UUID;
  v_user_id     UUID;
  v_encrypted_pw TEXT;
  v_branch_id   UUID;
  v_target_role user_role;
  v_clean_email TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no válida o expirada. Por favor inicie sesión de nuevo.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró el perfil del usuario autenticado.');
  END IF;

  IF v_caller_role = 'CAJERO' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Los cajeros no tienen permisos para crear usuarios.');
  END IF;

  BEGIN
    v_target_role := p_role::user_role;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', format('El rol "%s" no es válido.', p_role));
  END;

  IF v_caller_role = 'ADMIN' THEN
    IF v_target_role != 'CAJERO' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Los administradores solo pueden crear usuarios con rol CAJERO.');
    END IF;
    
    IF ARRAY_LENGTH(p_branch_ids, 1) > 0 THEN
      FOREACH v_branch_id IN ARRAY p_branch_ids
      LOOP
        IF NOT EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = v_caller_id AND branch_id = v_branch_id) THEN
          RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para asignar usuarios a esta sucursal.');
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_clean_email := LOWER(TRIM(p_email));

  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El correo electrónico es requerido.');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_clean_email) THEN
    RETURN jsonb_build_object('success', false, 'error', format('El correo electrónico "%s" ya está registrado.', v_clean_email));
  END IF;

  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
  END IF;

  v_user_id := gen_random_uuid();
  
  -- Generar Hash Bcrypt 10 rounds exactamente como GoTrue
  BEGIN
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  EXCEPTION WHEN OTHERS THEN
    v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));
  END;

  -- Insertar en auth.users con todos los valores por defecto requeridos por GoTrue Auth
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_clean_email, v_encrypted_pw, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', v_target_role),
    NOW(), NOW(),
    '', '', '', '',
    false, false
  );

  -- Insertar en auth.identities con la estructura idéntica a GoTrue Auth (evita error HTTP 500)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_user_id::text,
    NOW(), NOW(), NOW()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = NOW();

  -- Insertar en profiles
  INSERT INTO public.profiles (id, full_name, phone, role, is_active)
  VALUES (v_user_id, TRIM(p_full_name), TRIM(COALESCE(p_phone, '')), v_target_role, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, role = EXCLUDED.role, is_active = true;

  -- Asignar sucursales
  IF ARRAY_LENGTH(p_branch_ids, 1) > 0 THEN
    FOREACH v_branch_id IN ARRAY p_branch_ids
    LOOP
      INSERT INTO public.user_branches (user_id, branch_id)
      VALUES (v_user_id, v_branch_id)
      ON CONFLICT (user_id, branch_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Auditoría
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
  VALUES (
    v_caller_id, 'CREATE_USER', 'profiles', v_user_id,
    jsonb_build_object('email', v_clean_email, 'full_name', p_full_name, 'role', v_target_role, 'branches', p_branch_ids)
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_clean_email, 'role', v_target_role);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- FUNCIÓN PARA REINICIAR CONTRASEÑA DE CUALQUIER USUARIO EXISTENTE
CREATE OR REPLACE FUNCTION public.reset_app_user_password(
  p_target_user_id UUID,
  p_new_password   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
  v_encrypted_pw TEXT;
BEGIN
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
  END IF;

  BEGIN
    v_encrypted_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));
  EXCEPTION WHEN OTHERS THEN
    v_encrypted_pw := crypt(p_new_password, gen_salt('bf', 10));
  END;

  UPDATE auth.users
  SET encrypted_password = v_encrypted_pw,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada correctamente');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- REPARAR Y ALINEAR TODOS LOS USUARIOS EXISTENTES EN AUTH.IDENTITIES
UPDATE auth.identities
SET id = user_id,
    provider_id = user_id::text,
    identity_data = jsonb_build_object(
      'sub', user_id::text,
      'email', LOWER(TRIM(COALESCE(identity_data->>'email', ''))),
      'email_verified', true,
      'phone_verified', false
    )
WHERE provider = 'email';
