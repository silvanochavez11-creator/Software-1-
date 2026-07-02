-- ============================================================================
--  Refaccionaria de Motos — Esquema multi-inquilino (Supabase / Postgres)
--  Pegar TODO esto en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

-- ---------- Tablas ----------------------------------------------------------

-- Una fila por refaccionaria (negocio / "tenant")
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name              text not null,
  logo_url          text,                   -- dataURL (base64) o URL del logo
  accent            text default '#d4af37', -- color de marca
  status            text default 'active',  -- active | suspended
  default_min_stock int default 0,          -- stock mínimo por defecto del negocio
  theme             text default 'dark',    -- tema de la interfaz: dark | light
  plan              text default 'basico',  -- plan contratado: basico | pro | elite
  paid_until        date,                   -- pagado hasta (control manual de cobranza)
  catalog_slug        text,                 -- dirección del catálogo público (aivoraia.com/c/SLUG)
  catalog_enabled     boolean default false,
  catalog_show_prices boolean default true,
  catalog_whatsapp    text,
  created_at        timestamptz default now()
);
-- Para bases ya creadas: agrega las columnas si faltan
alter table public.organizations add column if not exists default_min_stock int default 0;
alter table public.organizations add column if not exists theme text default 'dark';
alter table public.organizations add column if not exists plan text default 'basico';
alter table public.organizations add column if not exists paid_until date;
alter table public.organizations add column if not exists catalog_slug text;
alter table public.organizations add column if not exists catalog_enabled boolean default false;
alter table public.organizations add column if not exists catalog_show_prices boolean default true;
alter table public.organizations add column if not exists catalog_whatsapp text;
create unique index if not exists organizations_catalog_slug_key
  on public.organizations (catalog_slug) where catalog_slug is not null;

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
  color       text,
  stock       numeric default 0,
  min_stock   numeric default 0,
  cost        numeric default 0,
  price       numeric default 0,          -- precio de menudeo
  price_wholesale numeric default 0,      -- precio de mayoreo (0 = no tiene)
  created_at  timestamptz default now()
);
-- Para bases ya creadas: agrega las columnas si faltan
alter table public.parts add column if not exists color text;
alter table public.parts add column if not exists price_wholesale numeric default 0;

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

-- ¿el usuario es DUEÑO (role owner) de esta organización?
create or replace function public.is_owner(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.memberships
    where org_id = target and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------- Límites por plan (se aplican en la base, no solo en la app) -----

-- Límite de productos según el plan del negocio
create or replace function public.parts_limit_of(target uuid)
returns int language sql stable security definer set search_path = public as $$
  select case coalesce(o.plan, 'basico')
    when 'basico' then 300
    when 'pro'    then 1500
    else null   -- elite: sin límite
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

-- Límite de usuarios según el plan del negocio
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

-- Solo el administrador de la plataforma puede cambiar plan, pago y estado.
-- Si un dueño actualiza su negocio (nombre, logo...), estos campos se conservan.
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

-- ---------- Catálogo público (plan Elite) -----------------------------------
-- El visitante anónimo solo puede leer estas funciones: devuelven únicamente
-- columnas publicables y solo de negocios activos, Elite y con catálogo activo.

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
-- el DUEÑO puede editar (nombre, logo, color) su propia refaccionaria
drop policy if exists org_owner_update on public.organizations;
create policy org_owner_update on public.organizations for update
  using (public.is_owner(id)) with check (public.is_owner(id));

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
