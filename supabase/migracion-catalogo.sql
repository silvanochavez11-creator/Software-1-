-- ============================================================================
--  MIGRACIÓN: Catálogo público con enlace (plan Elite)
--  Para bases YA CREADAS. Pegar TODO en: Supabase -> SQL Editor -> Run.
-- ============================================================================

-- 1) Configuración del catálogo por negocio
alter table public.organizations add column if not exists catalog_slug text;
alter table public.organizations add column if not exists catalog_enabled boolean default false;
alter table public.organizations add column if not exists catalog_show_prices boolean default true;
alter table public.organizations add column if not exists catalog_whatsapp text;
create unique index if not exists organizations_catalog_slug_key
  on public.organizations (catalog_slug) where catalog_slug is not null;

-- 2) Acceso público de SOLO LECTURA y SOLO columnas seguras, vía funciones.
--    El visitante anónimo nunca toca las tablas directamente: estas funciones
--    devuelven únicamente lo publicable, y solo si el negocio está activo,
--    tiene el catálogo encendido y es plan Elite.

create or replace function public.catalog_info(slug_in text)
returns table(name text, logo_url text, accent text, theme text, show_prices boolean, whatsapp text)
language sql stable security definer set search_path = public as $$
  select o.name, o.logo_url, o.accent, o.theme,
         coalesce(o.catalog_show_prices, true), o.catalog_whatsapp
  from public.organizations o
  where o.catalog_slug = lower(trim(slug_in))
    and o.catalog_enabled
    and o.status = 'active'
    and coalesce(o.plan, 'basico') = 'elite';
$$;

create or replace function public.catalog_parts(slug_in text)
returns table(name text, brand text, category text, compat text, color text, price numeric, in_stock boolean)
language sql stable security definer set search_path = public as $$
  select p.name, p.brand, p.category, p.compat, p.color,
         p.price, (coalesce(p.stock, 0) > 0) as in_stock
  from public.parts p
  join public.organizations o on o.id = p.org_id
  where o.catalog_slug = lower(trim(slug_in))
    and o.catalog_enabled
    and o.status = 'active'
    and coalesce(o.plan, 'basico') = 'elite'
  order by (coalesce(p.stock, 0) > 0) desc, p.name asc;
$$;

grant execute on function public.catalog_info(text) to anon, authenticated;
grant execute on function public.catalog_parts(text) to anon, authenticated;
