-- ============================================================
-- POLLO CRISPY - REPARACIÓN / RECREACIÓN DE USUARIOS PARA LOGIN
-- ============================================================

-- Si los usuarios creados anteriormente dan 500 al iniciar sesión,
-- este script elimina las cuentas creadas de prueba en auth.users
-- para poder volver a crearlas desde la app de forma 100% nativa y limpia.

DELETE FROM auth.users
WHERE email IN (
  'juanramon@pollocrispy.com',
  'juancarlos@poloccrispy.com',
  'carmen@pollocrispy.com',
  'maryi@pollocrispy.com'
);
