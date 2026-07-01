# Refaccionaria de Motos — Estado del proyecto (para retomar en otro chat)

Este documento resume TODO lo necesario para continuar el proyecto en una sesión nueva.

## 🌐 Enlaces

- **App en vivo:** https://aivoraia.com (también `software-1-livid.vercel.app`)
- **Repositorio:** `silvanochavez11-creator/software-1-`
- **Rama de trabajo:** `claude/moto-parts-inventory-accounting-1jzn39`
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

## ✅ Funciones ya hechas

- **Web pública (landing)**: los visitantes sin sesión ven una página de presentación del SaaS
  (funciones, cómo funciona, precios, preguntas frecuentes) con botones a login/registro.
  Está en el componente `LandingPage` dentro de `refaccionaria-motos.jsx`.
- Multi-refaccionaria con login (Supabase Auth) y datos en la nube.
- Panel de administrador: crear/editar/eliminar/suspender refaccionarias, asignar dueños,
  tablero global y resumen por negocio, buscador.
- Por refaccionaria: Tablero, Inventario (CRUD, buscar, importar/exportar CSV, vaciar),
  Punto de venta (descuenta stock, calcula utilidad, tickets imprimibles con folio y logo),
  Gastos, Contabilidad (estado de resultados por Hoy/Semana/Mes/Histórico, gráficas por día/semana/mes).
- Asistente IA (GPT): maneja inventario por texto e importa archivos (CSV/XML/CFDI/PDF).
- Avisos de stock: campana con contador, niveles de color, aviso al vender, lista de reorden.
- Personalización por negocio: nombre, logo, color de marca, tema claro/oscuro, stock mínimo por defecto.
- Recuperación de contraseña por correo.

## 💡 Ideas pendientes (posibles siguientes pasos)

- 📸 **Foto de facturas de papel** (GPT visión) para el importador.
- 📧 / 📲 **Avisos por correo o WhatsApp** de stock bajo (requiere SMTP / API de WhatsApp).
- 👥 **Empleados con roles** por refaccionaria (varios usuarios, permisos).
- 💾 **Respaldo / exportación** de datos por negocio; reporte mensual para el contador.
- 🧾 **Clientes y fiados** (cuentas por cobrar).
- ✉️ **SMTP propio** para que los correos (recuperación) no caigan en spam.
- 🔤 Formato de fechas más amigable en gráficas (ej. "27 jun").

## ▶️ Cómo continuar en otro chat

1. Inicia una sesión nueva de Claude Code **apuntando al mismo repositorio** `software-1-`
   y a la rama `claude/moto-parts-inventory-accounting-1jzn39`.
2. Pídele que lea este archivo (`PROYECTO.md`) para ponerse al día.
3. Todo el código está commiteado y pusheado; al hacer cambios y push, Vercel publica solo.
