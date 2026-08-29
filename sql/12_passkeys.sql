-- ============================================================
-- POLLO CRISPY - INICIO DE SESIÓN CON BIOMETRÍA / PASSKEYS (WEBAUTHN)
-- Script 12: Almacenamiento seguro de credenciales WebAuthn
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT,
  device_name TEXT NOT NULL DEFAULT 'Dispositivo Biométrico',
  counter BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar búsquedas por credential_id y user_id
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "user_passkeys_select" ON public.user_passkeys;
CREATE POLICY "user_passkeys_select" ON public.user_passkeys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_passkeys_insert" ON public.user_passkeys;
CREATE POLICY "user_passkeys_insert" ON public.user_passkeys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_passkeys_delete" ON public.user_passkeys;
CREATE POLICY "user_passkeys_delete" ON public.user_passkeys
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- FUNCIÓN SECURITY DEFINER: login_with_passkey
-- Permite validar el acceso biométrico comprobando el credential_id
-- y verificando que el perfil esté activo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.login_with_passkey(p_credential_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_passkey RECORD;
  v_profile RECORD;
  v_email   TEXT;
BEGIN
  -- 1. Buscar credencial registrada
  SELECT * INTO v_passkey FROM public.user_passkeys WHERE credential_id = p_credential_id;
  IF v_passkey IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credencial biométrica no registrada en este sistema.');
  END IF;

  -- 2. Verificar el perfil del usuario
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_passkey.user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró el perfil de usuario asociado.');
  END IF;

  -- 3. Comprobar que la cuenta del usuario esté activa
  IF NOT v_profile.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta se encuentra desactivada. Contacta al administrador.');
  END IF;

  -- 4. Obtener correo del usuario
  SELECT email INTO v_email FROM auth.users WHERE id = v_passkey.user_id;

  -- 5. Registrar en bitácora de auditoría
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (v_profile.id, 'PASSKEY_LOGIN', jsonb_build_object('device_name', v_passkey.device_name));

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_profile.id,
    'email', v_email,
    'full_name', v_profile.full_name,
    'role', v_profile.role
  );
END;
$$;
