-- ============================================================================
--  Refaccionaria de Motos — Esquema multi-inquilino (Supabase / Postgres)
--  Pegar TODO esto en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

-- ---------- Tablas ----------------------------------------------------------

-- Una fila por refaccionaria (negocio / "tenant")
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,                       -- dataURL (base64) o URL del logo
  accent      text default '#d4af37',     -- color de marca
  status      text default 'active',      -- active | suspended
  created_at  timestamptz default now()
);

-- Espejo de auth.users: guarda el rol de plataforma (super-admin o no)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  is_admin    boolean default false,      -- TRUE = administrador de la plataforma (tú)
  created_at  timestamptz default now()
);

-- Qué usuario pertenece a qué refaccionaria, y con qué rol
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  role        text not null default 'owner',   -- owner | employee
  created_at  timestamptz default now(),
  unique (user_id, org_id)
);

-- Inventario (cada pieza pertenece a UNA refaccionaria)
create table if not exists public.parts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  sku         text,
  name        text not null,
  brand       text,
  category    text,
  compat      text,
  stock       numeric default 0,
  min_stock   numeric default 0,
  cost        numeric default 0,
  price       numeric default 0,
  created_at  timestamptz default now()
);

-- Ventas (los renglones de la venta van en 'items' como JSON)
create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  folio       int,
  customer    text,
  items       jsonb not null default '[]',
  total       numeric default 0,
  cogs        numeric default 0,
  profit      numeric default 0,
  sold_at     date default current_date,
  created_at  timestamptz default now()
);

-- Gastos del negocio
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  category    text,
  amount      numeric default 0,
  note        text,
  spent_at    date default current_date,
  created_at  timestamptz default now()
);

create index if not exists idx_parts_org    on public.parts(org_id);
create index if not exists idx_sales_org     on public.sales(org_id);
create index if not exists idx_expenses_org  on public.expenses(org_id);
create index if not exists idx_memberships_user on public.memberships(user_id);

-- ---------- Funciones de ayuda (para las políticas) -------------------------
-- SECURITY DEFINER evita recursión de RLS al consultar memberships/profiles.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_member(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships
    where org_id = target and user_id = auth.uid()
  );
$$;

-- ---------- Crear el profile automáticamente al registrarse ----------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Activar Row Level Security --------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.parts         enable row level security;
alter table public.sales         enable row level security;
alter table public.expenses      enable row level security;

-- ---------- Políticas -------------------------------------------------------

-- organizations: el admin ve/gestiona todas; el dueño solo ve la(s) suya(s)
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select
  using (public.is_admin() or public.is_member(id));
drop policy if exists org_admin_write on public.organizations;
create policy org_admin_write on public.organizations for all
  using (public.is_admin()) with check (public.is_admin());

-- profiles: cada quien ve el suyo; el admin ve todos (para asignar usuarios)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- memberships: cada quien ve las suyas; solo el admin las crea/borra
drop policy if exists mem_select on public.memberships;
create policy mem_select on public.memberships for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists mem_admin_write on public.memberships;
create policy mem_admin_write on public.memberships for all
  using (public.is_admin()) with check (public.is_admin());

-- parts / sales / expenses: el admin todo; el dueño solo lo de SU org
drop policy if exists parts_rw on public.parts;
create policy parts_rw on public.parts for all
  using (public.is_admin() or public.is_member(org_id))
  with check (public.is_admin() or public.is_member(org_id));

drop policy if exists sales_rw on public.sales;
create policy sales_rw on public.sales for all
  using (public.is_admin() or public.is_member(org_id))
  with check (public.is_admin() or public.is_member(org_id));

drop policy if exists expenses_rw on public.expenses;
create policy expenses_rw on public.expenses for all
  using (public.is_admin() or public.is_member(org_id))
  with check (public.is_admin() or public.is_member(org_id));

-- ============================================================================
--  PASO FINAL (después de registrarte por primera vez en la app):
--  Convierte TU usuario en administrador de la plataforma.
--  Reemplaza el correo por el tuyo y ejecútalo:
--
--    update public.profiles set is_admin = true
--    where email = 'TU_CORREO_AQUI@ejemplo.com';
-- ============================================================================
