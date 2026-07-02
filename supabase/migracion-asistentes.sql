-- ============================================================================
--  MIGRACIÓN: Apartado "Asistentes IA" del panel de administrador
--  Configuración global (por ahora una sola para todas las refaccionarias):
--  indicaciones del proceso de ventas que sigue el agente IA del catálogo.
--  Para bases YA CREADAS. Pegar en: Supabase -> SQL Editor -> Run.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;

-- Solo el administrador de la plataforma puede ver y editar la configuración
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- El agente del catálogo (público) lee las indicaciones a través de esta función
create or replace function public.catalog_agent_prompt()
returns text language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = 'catalog_agent_prompt';
$$;
grant execute on function public.catalog_agent_prompt() to anon, authenticated;
