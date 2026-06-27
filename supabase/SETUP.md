# Conectar la app a Supabase — guía paso a paso

## 1. Crear las tablas y la seguridad

1. En tu proyecto de Supabase, abre **SQL Editor** (icono `</>` en la barra izquierda).
2. **New query**, pega TODO el contenido de [`schema.sql`](./schema.sql) y pulsa **Run**.
3. Deberías ver "Success. No rows returned". Esto crea las tablas, las reglas de
   seguridad (RLS) y el disparador que registra cada usuario nuevo.

## 2. Tus llaves de conexión (¡ojo con cuál!)

Ve a **Project Settings → API**. Verás varias llaves:

| Llave | ¿Se puede compartir? | Uso |
|---|---|---|
| **Project URL** | Sí (pública) | `https://npxjpkcyfgxfbdvvlcrx.supabase.co` |
| **anon public** | Sí (pública, protegida por RLS) | La que usa la app en el navegador |
| **service_role** | ❌ **NUNCA** la compartas ni la pongas en el frontend | Solo servidor |

> ⚠️ **Importante:** la llave `anon public` está diseñada para ir en el frontend; la
> seguridad real la dan las políticas RLS que ya instalaste. **La llave `service_role`
> es secreta**: no la pegues en el chat, no la subas al repo, no la pongas en el código.

## 3. Hacerte administrador

1. Cuando la app esté conectada, **regístrate** una vez con tu correo (será tu cuenta de admin).
2. Vuelve al **SQL Editor** y corre (con tu correo real):

   ```sql
   update public.profiles set is_admin = true
   where email = 'TU_CORREO@ejemplo.com';
   ```

3. Vuelve a entrar en la app: ya verás el **panel de administrador**.

## 4. Cómo se crean las refaccionarias y sus cuentas

- Tú (admin) creas la **refaccionaria** en el panel (nombre, logo, color).
- El **dueño** se registra con su correo y contraseña.
- Tú lo **asignas** a su refaccionaria desde el panel. A partir de ahí, ese dueño
  solo ve y maneja los datos de SU negocio (lo garantiza la base de datos, no el código).

## 5. Modelo de datos (resumen)

```
organizations  refaccionarias (nombre, logo, color)
profiles       espejo de usuarios + bandera is_admin
memberships    qué usuario pertenece a qué refaccionaria (rol owner/employee)
parts          inventario (org_id)
sales          ventas (org_id)
expenses       gastos (org_id)
```

El campo `org_id` en cada tabla + las políticas RLS = aislamiento total entre negocios.
