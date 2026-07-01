-- ============================================================================
--  MIGRACIÓN: Planes (Básico / Pro / Elite) y límites por plan
--  Para bases YA CREADAS. Pegar TODO en: Supabase -> SQL Editor -> Run.
--  (Las instalaciones nuevas no la necesitan: schema.sql ya incluye todo.)
-- ============================================================================

-- 1) Columnas nuevas en organizations
alter table public.organizations add column if not exists plan text default 'basico';
alter table public.organizations add column if not exists paid_until date;

-- Los negocios existentes quedan en 'basico'; cámbialos desde el panel de
-- administrador, o aquí de una vez, por ejemplo:
--   update public.organizations set plan = 'pro' where name = 'NOMBRE DEL NEGOCIO';

-- 2) Límite de productos según el plan (básico 300, pro 1500, elite sin límite)
create or replace function public.parts_limit_of(target uuid)
returns int language sql stable security definer set search_path = public as $$
  select case coalesce(o.plan, 'basico')
    when 'basico' then 300
    when 'pro'    then 1500
    else null
  end from public.organizations o where o.id = target;
$$;

create or replace function public.enforce_parts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; cnt int;
begin
  lim := public.parts_limit_of(new.org_id);
  if lim is not null then
    select count(*) into cnt from public.parts where org_id = new.org_id;
    if cnt > lim then
      raise exception 'Límite de productos del plan alcanzado (% piezas). Mejora tu plan para agregar más.', lim;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists parts_limit on public.parts;
create trigger parts_limit after insert on public.parts
  for each row execute function public.enforce_parts_limit();

-- 3) Límite de usuarios según el plan (básico 1, pro 3, elite sin límite)
create or replace function public.enforce_users_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; cnt int;
begin
  select case coalesce(o.plan, 'basico') when 'basico' then 1 when 'pro' then 3 else null end
    into lim from public.organizations o where o.id = new.org_id;
  if lim is not null then
    select count(*) into cnt from public.memberships where org_id = new.org_id;
    if cnt > lim then
      raise exception 'Límite de usuarios del plan alcanzado (%). Mejora el plan para agregar más.', lim;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists users_limit on public.memberships;
create trigger users_limit after insert on public.memberships
  for each row execute function public.enforce_users_limit();

-- 4) Solo el admin puede cambiar plan, pago y estado (el dueño no puede
--    "auto-mejorarse" el plan aunque manipule las peticiones)
create or replace function public.protect_org_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.plan       := old.plan;
    new.paid_until := old.paid_until;
    new.status     := old.status;
  end if;
  return new;
end; $$;
drop trigger if exists org_protect on public.organizations;
create trigger org_protect before update on public.organizations
  for each row execute function public.protect_org_fields();
