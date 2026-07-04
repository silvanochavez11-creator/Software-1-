# Conectar la app a Supabase — guía paso a paso

La app ya trae configurada la URL del proyecto y la llave pública (`publishable`),
así que solo faltan unos ajustes en el panel de Supabase.

## 1. Crear las tablas y la seguridad ✅

En **SQL Editor → New query**, pega el contenido de [`schema.sql`](./schema.sql) y pulsa
**Run**. Debe decir *"Success. No rows returned"*. (Esto ya lo hiciste.)

Después corre también [`migracion-equipo-registro.sql`](./migracion-equipo-registro.sql)
(roles dueño/vendedor + registro automático de negocios). En una base que ya existía,
basta con correr esa migración una vez.

## 2. Desactivar la confirmación por correo (para empezar más fácil)

Para que los registros funcionen al instante sin tener que abrir un correo de confirmación:

1. Menú izquierdo → **Authentication**.
2. Entra a **Sign In / Providers** (o **Providers**) → **Email**.
3. **Desactiva** la opción **"Confirm email"** y guarda.

> Más adelante, en producción, conviene volver a activarla. Por ahora, así avanzamos rápido.

## 3. Crear tu cuenta de administrador

1. Abre la app. Verás la pantalla de **inicio de sesión**.
2. Pulsa **"Regístrate"** y crea tu cuenta con tu correo (este será el de admin).
3. Vuelve a Supabase → **SQL Editor** y corre esto (con tu correo real):

   ```sql
   update public.profiles set is_admin = true
   where email = 'TU_CORREO@ejemplo.com';
   ```

4. En la app, **cierra sesión y entra otra vez** (o recarga). Ya verás el **Panel de administrador**.

## 4. Flujo de cuentas

**Dueños (registro automático):**

1. El dueño se **registra** con su correo y contraseña.
2. La app le pide **nombre, logo y color** de su refaccionaria y la crea al instante
   (queda en plan Básico; tú le asignas su plan real desde el panel de admin).

**Vendedores (los agrega cada dueño):**

1. El vendedor **crea su cuenta** (gratis) con su correo.
2. El dueño entra a **"Negocio → 👥 Mi equipo"** y agrega ese correo (respetando el
   límite de usuarios de su plan).
3. El vendedor entra y solo ve **Punto de venta** e **Inventario de consulta** — sin
   costos, utilidades, gastos ni contabilidad, y vende siempre a precio de lista.

Desde tu panel de admin también puedes seguir creando refaccionarias y asignando
dueños a mano (menú **"Asignar a…"** en "Cuentas de usuarios").

## Sobre las llaves

- La llave que va en la app es la **`publishable`** (pública por diseño; la seguridad la
  dan las políticas RLS). Está en el código en la constante `SB_KEY`.
- La llave **`secret` / `service_role` NUNCA** va en el frontend ni se comparte.

## Modelo de datos

```
organizations  refaccionarias (nombre, logo, color)
profiles       espejo de usuarios + bandera is_admin
memberships    qué usuario pertenece a qué refaccionaria (rol owner/employee)
parts          inventario (org_id)
sales          ventas (org_id)
expenses       gastos (org_id)
```

`org_id` en cada tabla + políticas RLS = aislamiento total entre negocios.
