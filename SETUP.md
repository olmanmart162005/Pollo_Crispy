# ✅ Pollo Crispy — Sistema de Ventas y Administración

## Estado del Proyecto

- **Build:** ✅ Exitoso (sin errores TypeScript ni de compilación)
- **Dev server:** ✅ Corriendo en `http://localhost:3000/` (o 3001)
- **Gestión de Usuarios:** ✅ Implementada con RPC segura sin exponer Service Role Key en React

---

## 1. Ejecutar los SQL en Supabase

Ve a **[Supabase Dashboard](https://supabase.com/dashboard/project/crlstnskgpnxqqmbcthc) → SQL Editor** y ejecuta en este orden:

| Archivo | Descripción | Acción |
|---------|-------------|--------|
| `sql/01_schema.sql` | Tablas, tipos, índices, triggers | 1° |
| `sql/02_seed.sql` | Sucursales, categorías, productos, combos | 2° |
| `sql/03_rls.sql` | Row Level Security — políticas | 3° |
| `sql/04_functions.sql` | Funciones RPC (ventas, reportes, caja) | 4° |
| `sql/05_views.sql` | Vistas (`v_sales_summary`, etc.) | 5° |
| `sql/06_user_management.sql` | **Función RPC segura `create_app_user`** | 6° |

---

## 2. Crear el primer Super Admin (Olman Martínez)

1. Ve a **Supabase Dashboard → Authentication → Users → Add user**
2. Crea el usuario con tu correo y contraseña
3. Ejecuta en el **SQL Editor**:

```sql
UPDATE profiles 
SET role = 'SUPER_ADMIN', full_name = 'Olman Martínez'
WHERE id = 'uuid-del-usuario-creado';
```

4. Inicia sesión en `http://localhost:3000/` con tus credenciales.

---

## 3. Crear Administradores y Cajeros desde la Aplicación

Una vez dentro de la app como Super Admin:

1. Dirígete a **Administración → Usuarios**
2. Haz clic en **+ Nuevo Administrador** para crear a:
   - **Juan Carlos Muñoz** → Asignado a `Pollo Crispy 1` (Sucursal Centro)
   - **Maryi Rios** → Asignada a `Pollo Crispy 1`
   - **Juan Ramón Muñoz** → Asignado a `Pollo Crispy 2` y `Pollo Crispy 3`
   - **Carmen Jiménez** → Asignada a `Pollo Crispy 2` y `Pollo Crispy 3`
3. Ingresa su nombre, correo y contraseña temporal.
4. El sistema crea atómicamente el usuario en `auth.users`, `profiles` y `user_branches` mediante la función protegida `create_app_user`.

### Comportamiento de inicio de sesión:
- **Usuario con 1 sola sucursal:** Entra directamente a su sucursal activa. El selector de sucursal se desactiva y oculta otras sucursales.
- **Usuario con 2+ sucursales:** Puede seleccionar la sucursal en la que desea trabajar desde el selector superior.
- **Administrador:** Puede ir a **Usuarios** y presionar **+ Nuevo Cajero**, el cual quedará vinculado automáticamente a su sucursal activa.

---

## 4. Ejecutar el proyecto localmente

```bash
cd D:\PolloCrispy
npm install
npm run dev
```

Accede a: **http://localhost:3000/**
