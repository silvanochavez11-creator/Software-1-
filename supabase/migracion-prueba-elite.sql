-- ============================================================================
--  Migración: PRUEBA GRATIS del plan Elite (15 días) para negocios nuevos
--  Pegar TODO en: Supabase Dashboard -> SQL Editor -> New query -> Run
--
--  Qué hace:
--  1) Columna organizations.trial: marca los negocios que están en prueba.
--  2) crear_mi_negocio ahora acepta trial_in: si es true, el negocio nuevo
--     arranca en plan Elite con paid_until = hoy + 15 días y trial = true.
--  3) El catálogo público y su agente IA se APAGAN solos cuando una prueba
--     vence (para no gastar en IA de pruebas vencidas). A los negocios de
--     paga no les cambia nada: el admin sigue controlando su plan a mano.
-- ============================================================================

alter table public.organizations add column if not exists trial boolean default false;

-- crear_mi_negocio con opción de prueba Elite.
-- Se elimina la versión anterior para que no haya dos firmas ambiguas.
drop function if exists public.crear_mi_negocio(text, text, text);
create or replace function public.crear_mi_negocio(
  name_in text, logo_in text default null, accent_in text default null, trial_in boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid; vname text;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para crear tu negocio.';
  end if;
  vname := trim(coalesce(name_in, ''));
  if length(vname) < 2 or length(vname) > 80 then
    raise exception 'Ponle un nombre a tu negocio (de 2 a 80 letras).';
  end if;
  if logo_in is not null and length(logo_in) > 400000 then
    raise exception 'El logo es demasiado pesado. Usa una imagen más chica.';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'Tu cuenta ya pertenece a un negocio.';
  end if;
  insert into public.organizations (name, logo_url, accent, plan, status, paid_until, trial)
  values (
    vname,
    nullif(logo_in, ''),
    coalesce(nullif(trim(accent_in), ''), '#55AEEA'),
    case when coalesce(trial_in, false) then 'elite' else 'basico' end,
    'active',
    case when coalesce(trial_in, false) then current_date + 15 else null end,
    coalesce(trial_in, false)
  )
  returning id into oid;
  insert into public.memberships (user_id, org_id, role) values (auth.uid(), oid, 'owner');
  return oid;
end; $$;

grant execute on function public.crear_mi_negocio(text, text, text, boolean) to authenticated;
revoke execute on function public.crear_mi_negocio(text, text, text, boolean) from public, anon;

-- ---------- Catálogo público: se apaga cuando la PRUEBA vence ---------------
-- (solo afecta a negocios con trial = true; a los de paga no les cambia nada)

create or replace function public.catalog_info(slug_in text)
returns table(name text, logo_url text, accent text, theme text, show_prices boolean, whatsapp text)
language sql stable security definer set search_path = public as $$
  select o.name, o.logo_url, o.accent, o.theme,
         coalesce(o.catalog_show_prices, true), o.catalog_whatsapp
  from public.organizations o
  where o.catalog_slug = lower(trim(slug_in))
    and o.catalog_enabled
    and o.status = 'active'
    and coalesce(o.plan, 'basico') = 'elite'
    and (not coalesce(o.trial, false) or coalesce(o.paid_until, current_date) >= current_date);
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
    and (not coalesce(o.trial, false) or coalesce(o.paid_until, current_date) >= current_date)
  order by (coalesce(p.stock, 0) > 0) desc, p.name asc;
$$;

create or replace function public.catalog_chat_tick(slug_in text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if not exists (
    select 1 from public.organizations o
    where o.catalog_slug = lower(trim(slug_in))
      and o.catalog_enabled and o.status = 'active'
      and coalesce(o.plan, 'basico') = 'elite'
      and (not coalesce(o.trial, false) or coalesce(o.paid_until, current_date) >= current_date)
  ) then
    return false;
  end if;
  insert into public.catalog_chat_usage as u (slug, day, count)
  values (lower(trim(slug_in)), current_date, 1)
  on conflict (slug, day) do update set count = u.count + 1
  returning count into c;
  return c <= 400;  -- tope: 400 mensajes al día por negocio
end; $$;
