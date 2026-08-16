-- ============================================================
-- POLLO CRISPY - ELIMINAR USUARIOS DESDE LA APP (RPC SEGURA)
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
  v_caller_role user_role;
  v_caller_id   UUID;
  v_target_name TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión no válida o expirada.');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role != 'SUPER_ADMIN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo el Super Admin puede eliminar usuarios.');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No puedes eliminar tu propio usuario Super Admin.');
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

  -- Borrar de auth.users (cascada automática a profiles y user_branches)
  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado correctamente');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
