# Refaccionaria de Motos — Estado del proyecto (para retomar en otro chat)

Este documento resume TODO lo necesario para continuar el proyecto en una sesión nueva.

## 🌐 Enlaces

- **App en vivo:** https://aivoraia.com (también `software-1-livid.vercel.app`)
- **Repositorio:** `silvanochavez11-creator/software-1-`
- **Rama de trabajo:** `claude/inventory-workshop-motos-362lzo`
- **Supabase (base de datos + auth):** proyecto `npxjpkcyfgxfbdvvlcrx`
- **Vercel (hosting):** proyecto `software-1` (equipo "Aivora", plan Hobby)
- **IA:** OpenAI (`gpt-4o-mini`)

## 🧱 Qué es

App web multi-inquilino ("multi-refaccionaria") para llevar **inventario y contabilidad**
de refaccionarias de motos. Un **administrador** crea negocios y asigna dueños; cada **dueño**
entra solo a su refaccionaria y ve solo sus datos.

## 🛠️ Arquitectura

- **Frontend:** React en un solo componente grande → `refaccionaria-motos.jsx`. Proyecto **Vite**
  (`index.html`, `src/main.jsx`). Se despliega solo en Vercel al hacer push a la rama.
- **Backend / datos:** **Supabase** (Postgres + Auth + Row Level Security). El frontend habla con
  la API REST/Auth de Supabase por `fetch` (sin SDK). Config en constantes `SB_URL` / `SB_KEY`
  (la llave `publishable` es pública por diseño; la seguridad la dan las políticas RLS).
- **IA:** función serverless `api/ai.js` (Vercel) que guarda la llave de OpenAI en secreto y hace
  de proxy. El Asistente IA y el importador de archivos la usan vía `/api/ai`.
- **Almacenamiento local:** solo la sesión y la config del ticket usan `localStorage` (helper `store`).

## 📁 Archivos clave

| Archivo | Qué es |
|---|---|
| `refaccionaria-motos.jsx` | Toda la app (UI + lógica). Es el archivo principal a editar. |
| `api/ai.js` | Función serverless: proxy seguro a OpenAI. |
| `supabase/schema.sql` | Esquema completo de la BD (tablas, RLS, funciones). |
| `supabase/SETUP.md` | Guía de configuración de Supabase. |
| `index.html`, `src/main.jsx`, `vite.config.js` | Envoltura del proyecto Vite. |
| `public/favicon.svg` | Ícono (engranaje). |
| `plantilla-inventario.csv` | Ejemplo de formato para importar inventario. |

## 🗄️ Modelo de datos (Supabase)

```
organizations  refaccionarias (name, logo_url, accent, status, default_min_stock, theme)
profiles       espejo de usuarios + is_admin
memberships    qué usuario pertenece a qué org (role: owner | employee)
parts          inventario (org_id, sku, name, brand, category, compat, stock, min_stock, cost, price)
sales          ventas (org_id, folio, customer, items jsonb, total, cogs, profit, sold_at)
expenses       gastos (org_id, category, amount, note, spent_at)
```
El aislamiento entre negocios lo garantiza RLS por `org_id` (funciones `is_admin`, `is_member`, `is_owner`).

## ⚙️ Configuración para que funcione (si se monta desde cero)

1. **Supabase → SQL Editor:** correr `supabase/schema.sql`.
2. **Supabase → Authentication:** desactivar "Confirm email"; en URL Configuration poner Site URL
   `https://aivoraia.com` y agregar Redirect URLs `https://aivoraia.com` y `https://aivoraia.com/**`.
3. **Hacerte admin:** registrarte en la app y luego `update public.profiles set is_admin = true where email = 'TU_CORREO';`
4. **Vercel → Settings → Environment Variables:** agregar `OPENAI_API_KEY` (llave `sk-...`) y hacer **Redeploy**.

> ⚠️ NUNCA poner en el frontend ni compartir: la llave `service_role` de Supabase ni la `sk-...` de OpenAI.

## 💳 Planes y límites (SaaS)

Cada refaccionaria tiene un **plan** (`basico | pro | elite`) y una fecha **pagado hasta**
(columnas `plan` y `paid_until` en `organizations`). El admin los asigna desde su panel.

| Límite / función | Básico $299 | Pro $599 | Elite $999 |
|---|---|---|---|
| Productos | 300 | 1,500 | Ilimitados |
| Usuarios | 1 | 3 | Ilimitados |
| Módulo de gastos | ❌ | ✔️ | ✔️ |
| Contabilidad con histórico | ❌ (solo hoy/semana/mes) | ✔️ | ✔️ |
| Asistente IA e importador de facturas | ❌ | ✔️ | ✔️ |

Se aplican en 3 capas: UI (candados y topes), base de datos (triggers `parts_limit`,
`users_limit`, `org_protect` — el dueño no puede auto-cambiarse el plan) y `/api/ai`
(verifica sesión + plan pro/elite + negocio activo).

> ⚠️ **Para bases ya creadas**: correr `supabase/migracion-planes.sql` en el SQL Editor.
> Los negocios existentes quedan en Básico: asigna su plan real desde el panel de admin.

## ✅ Funciones ya hechas

- **Equipo con roles (dueño / vendedor)**: el dueño agrega vendedores por correo en
  "Negocio → 👥 Mi equipo" (respetando el límite de usuarios del plan). El **vendedor**
  solo ve Punto de venta e Inventario de consulta: no ve costos, utilidades, gastos ni
  contabilidad; no puede modificar inventario, cambiar precios (vende SIEMPRE a precio
  de lista, menudeo o mayoreo) ni borrar ventas. Está aplicado en la BASE DE DATOS, no
  solo en la interfaz: RLS deja las tablas solo para dueño/admin y el vendedor opera vía
  funciones seguras `employee_parts` / `employee_sales` / `registrar_venta` (esta última
  registra la venta y descuenta stock del lado del servidor, con costos reales que él no ve).
  Migración: `supabase/migracion-equipo-registro.sql`.
- **Registro automático (autoservicio)**: al registrarse, el usuario crea su propia
  refaccionaria (nombre + logo + color) con la función `crear_mi_negocio` y entra al
  instante como dueño en plan Básico — ya no espera a que el admin lo asigne. La pantalla
  también avisa a los trabajadores que NO creen negocio y pidan al dueño agregarlos.
- **Sesión robusta en celular/Safari (iPhone)**: se corrigió que la página "mezclara"
  sesiones. Ahora el refresco del token es único aunque varias peticiones lo pidan a la
  vez (el refresh token de Supabase es de un solo uso), se coordina entre pestañas por
  localStorage, ante un 401 se refresca y reintenta una vez, la sesión NO se cierra por
  fallas de red (solo si el servidor rechaza el token), y al volver a la pestaña/app se
  detecta si otra pestaña cambió de cuenta y se recarga limpio.
- **Agente IA de ventas en el catálogo (Elite)**: chat flotante público (`/api/catalogo-ia.js`,
  gpt-4o-mini) que responde solo con el inventario publicable y canaliza el cierre a WhatsApp.
  Control de gasto: tope de 400 mensajes/día por negocio (`catalog_chat_tick`,
  migración `supabase/migracion-agente.sql`) + límite por visitante en el cliente.
- **Catálogo público (Elite)**: enlace `aivoraia.com/c/SLUG` sin login; el público ve piezas,
  precios (opcional) y disponibilidad, busca por modelo y pide por WhatsApp. Se configura en
  "Negocio" (activar, WhatsApp, mostrar precios). Acceso anónimo SOLO vía funciones
  `catalog_info`/`catalog_parts` (security definer, columnas seguras, solo Elite activo).
  Migración: `supabase/migracion-catalogo.sql`. Nota: `vite.config.js` usa `base: "/"` y
  `vercel.json` reescribe rutas al index para que `/c/...` funcione.

- **Web pública (landing)**: los visitantes sin sesión ven una página de presentación del SaaS
  (funciones, cómo funciona, precios, preguntas frecuentes) con botones a login/registro.
  Está en el componente `LandingPage` dentro de `refaccionaria-motos.jsx`.
- Multi-refaccionaria con login (Supabase Auth) y datos en la nube.
- Panel de administrador: crear/editar/eliminar/suspender refaccionarias, asignar dueños,
  tablero global y resumen por negocio, buscador.
- Por refaccionaria: Tablero, Inventario (CRUD, buscar, importar/exportar CSV, vaciar),
  Punto de venta (descuenta stock, calcula utilidad, tickets imprimibles con folio y logo),
  Gastos, Contabilidad (estado de resultados por Hoy/Semana/Mes/Histórico, gráficas por día/semana/mes).
- Asistente IA (GPT): maneja inventario por texto, importa archivos (CSV/XML/CFDI/PDF) y
  **lee fotografías** de libretas de inventario o estantes (visión, hasta 12 fotos por tanda).
- Piezas con **color** (columna `color`; correr `supabase/migracion-color.sql` en bases ya creadas).
- Historial de ventas con buscador (folio/cliente/fecha/pieza) y **reimpresión de tickets** con fecha y hora.
- **Corrección y eliminación de ventas (solo dueño/admin)**: desde el historial del punto
  de venta se puede corregir una venta equivocada (precio cobrado, costo o cantidades;
  recalcula total/utilidad y ajusta el stock por la diferencia) o eliminarla por completo
  (las piezas regresan al inventario). El vendedor no puede.
- Avisos de stock: campana con contador, niveles de color, aviso al vender, lista de reorden.
- Personalización por negocio: nombre, logo, color de marca, tema claro/oscuro, stock mínimo por defecto.
- Recuperación de contraseña por correo.
- **Adaptada a celular**: vistas en una columna en pantallas chicas y **PWA instalable**
  ("Agregar a pantalla de inicio" → abre como app; `public/manifest.webmanifest` + `public/sw.js`,
  el service worker no cachea nada a propósito para que siempre cargue la versión más nueva).

> ⚠️ **Migración pendiente de correr en Supabase**: `supabase/migracion-equipo-registro.sql`
> (roles dueño/vendedor + registro automático). Sin ella, los vendedores no pueden entrar
> y el registro autoservicio falla. Correrla una vez en el SQL Editor.

## 💡 Ideas pendientes (posibles siguientes pasos)

- 📧 / 📲 **Avisos por correo o WhatsApp** de stock bajo (requiere SMTP / API de WhatsApp).
- 💾 **Respaldo / exportación** de datos por negocio; reporte mensual para el contador.
- 🧾 **Clientes y fiados** (cuentas por cobrar).
- ✉️ **SMTP propio** para que los correos (recuperación) no caigan en spam.
- 🔤 Formato de fechas más amigable en gráficas (ej. "27 jun").

## ▶️ Cómo continuar en otro chat

1. Inicia una sesión nueva de Claude Code **apuntando al mismo repositorio** `software-1-`
   y a la rama `claude/moto-parts-inventory-accounting-1jzn39`.
2. Pídele que lea este archivo (`PROYECTO.md`) para ponerse al día.
3. Todo el código está commiteado y pusheado; al hacer cambios y push, Vercel publica solo.
