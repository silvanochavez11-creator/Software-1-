-- ============================================================================
--  MIGRACIÓN: Agente IA de ventas del catálogo (plan Elite)
--  Contador de mensajes por día por negocio, para limitar el gasto de OpenAI.
--  Para bases YA CREADAS. Pegar en: Supabase -> SQL Editor -> Run.
-- ============================================================================

create table if not exists public.catalog_chat_usage (
  slug  text not null,
  day   date not null default current_date,
  count int  not null default 0,
  primary key (slug, day)
);
-- Sin políticas: nadie la toca directamente; solo la función de abajo.
alter table public.catalog_chat_usage enable row level security;

-- Suma un mensaje al contador del día y dice si aún está dentro del tope.
-- Solo cuenta para catálogos válidos (Elite, activos y encendidos).
create or replace function public.catalog_chat_tick(slug_in text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if not exists (
    select 1 from public.organizations o
    where o.catalog_slug = lower(trim(slug_in))
      and o.catalog_enabled and o.status = 'active'
      and coalesce(o.plan, 'basico') = 'elite'
  ) then
    return false;
  end if;
  insert into public.catalog_chat_usage as u (slug, day, count)
  values (lower(trim(slug_in)), current_date, 1)
  on conflict (slug, day) do update set count = u.count + 1
  returning count into c;
  return c <= 400;  -- tope: 400 mensajes al día por negocio
end; $$;

grant execute on function public.catalog_chat_tick(text) to anon, authenticated;
