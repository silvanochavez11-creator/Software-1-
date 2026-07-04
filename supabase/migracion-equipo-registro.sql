-- ============================================================================
--  Migración: EQUIPO (dueño vs vendedor) + REGISTRO AUTOMÁTICO de negocios
--  Pegar TODO en: Supabase Dashboard -> SQL Editor -> New query -> Run
--
--  Qué hace:
--  1) Endurece los permisos: el VENDEDOR (role 'employee') ya no puede tocar
--     directamente inventario, ventas ni gastos. Solo puede:
--       - consultar el inventario SIN costos (employee_parts)
--       - consultar ventas SIN costos/utilidad para reimprimir tickets (employee_sales)
--       - cobrar en el punto de venta con precios de lista (registrar_venta)
--  2) El DUEÑO administra su equipo: org_members / org_add_employee / org_remove_member
--     (respetando el límite de usuarios del plan).
--  3) Registro automático: un usuario nuevo crea su propia refaccionaria con
--     nombre y logo (crear_mi_negocio) sin esperar al administrador.
-- ============================================================================

-- ---------- 1) Políticas: escribir en las tablas = solo dueño o admin -------
-- El vendedor deja de tener acceso directo (ni siquiera lectura, para que no
-- pueda ver costos ni utilidades con su token). Todo lo del vendedor pasa por
-- las funciones seguras de abajo, que exponen solo columnas permitidas.

drop policy if exists parts_rw on public.parts;
drop policy if exists parts_owner_all on public.parts;
create policy parts_owner_all on public.parts for all
  using (public.is_admin() or public.is_owner(org_id))
  with check (public.is_admin() or public.is_owner(org_id));

drop policy if exists sales_rw on public.sales;
drop policy if exists sales_owner_all on public.sales;
create policy sales_owner_all on public.sales for all
  using (public.is_admin() or public.is_owner(org_id))
  with check (public.is_admin() or public.is_owner(org_id));

drop policy if exists expenses_rw on public.expenses;
drop policy if exists expenses_owner_all on public.expenses;
create policy expenses_owner_all on public.expenses for all
  using (public.is_admin() or public.is_owner(org_id))
  with check (public.is_admin() or public.is_owner(org_id));

-- ---------- 2) Funciones para el VENDEDOR ------------------------------------

-- Inventario visible para el vendedor: SIN la columna de costo.
create or replace function public.employee_parts(org_in uuid)
returns table(
  id uuid, sku text, name text, brand text, category text, compat text,
  color text, stock numeric, min_stock numeric, price numeric,
  price_wholesale numeric, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.sku, p.name, p.brand, p.category, p.compat, p.color,
         p.stock, p.min_stock, p.price, p.price_wholesale, p.created_at
  from public.parts p
  where p.org_id = org_in and public.is_member(org_in)
  order by p.created_at desc;
$$;

-- Ventas visibles para el vendedor (para reimprimir tickets):
-- SIN costo de mercancía ni utilidad, y sin el costo dentro de cada renglón.
create or replace function public.employee_sales(org_in uuid)
returns table(
  id uuid, folio int, customer text, items jsonb, total numeric,
  sold_at date, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.folio, s.customer,
         coalesce((select jsonb_agg(e - 'cost') from jsonb_array_elements(s.items) e), '[]'::jsonb) as items,
         s.total, s.sold_at, s.created_at
  from public.sales s
  where s.org_id = org_in and public.is_member(org_in)
  order by s.created_at desc
  limit 300;
$$;

-- Punto de venta del vendedor: registra la venta y descuenta stock en una sola
-- operación, del lado del servidor. Anti-robos:
--   - el vendedor SIEMPRE vende a precio de lista (menudeo o mayoreo); no puede
--     cambiar precios ni ver costos.
--   - el costo y la utilidad se calculan aquí con los costos reales.
--   - valida stock y pertenencia al negocio; el negocio debe estar activo.
-- El dueño/admin también puede usarla y sí puede mandar un precio por renglón.
create or replace function public.registrar_venta(
  org_in uuid, items_in jsonb, customer_in text default null, tipo_in text default 'menudeo'
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  priv boolean;         -- ¿dueño o admin? (puede ajustar precios)
  it jsonb;
  p public.parts%rowtype;
  vqty int;
  vprice numeric;
  vtotal numeric := 0;
  vcogs numeric := 0;
  vfolio int;
  out_items jsonb := '[]'::jsonb;
  db_items jsonb := '[]'::jsonb;
  srow public.sales%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para vender.';
  end if;
  if not (public.is_admin() or public.is_member(org_in)) then
    raise exception 'No tienes acceso a este negocio.';
  end if;
  if exists (select 1 from public.organizations o where o.id = org_in and o.status = 'suspended') then
    raise exception 'Este negocio está suspendido.';
  end if;
  if items_in is null or jsonb_typeof(items_in) <> 'array' or jsonb_array_length(items_in) = 0 then
    raise exception 'La venta no tiene piezas.';
  end if;

  priv := public.is_admin() or public.is_owner(org_in);

  for it in select * from jsonb_array_elements(items_in) loop
    select * into p from public.parts
      where id = (it->>'part_id')::uuid and org_id = org_in
      for update;
    if not found then
      raise exception 'Una de las piezas ya no existe en el inventario.';
    end if;
    vqty := greatest(1, coalesce((it->>'qty')::int, 1));
    if coalesce(p.stock, 0) < vqty then
      raise exception 'Stock insuficiente de %', p.name;
    end if;
    -- Precio: el vendedor usa el de lista; el dueño puede mandar otro.
    if priv and (it ? 'price') then
      vprice := greatest(0, coalesce((it->>'price')::numeric, 0));
    elsif tipo_in = 'mayoreo' and coalesce(p.price_wholesale, 0) > 0 then
      vprice := p.price_wholesale;
    else
      vprice := coalesce(p.price, 0);
    end if;

    update public.parts set stock = coalesce(stock, 0) - vqty where id = p.id;

    vtotal := vtotal + vqty * vprice;
    vcogs  := vcogs  + vqty * coalesce(p.cost, 0);
    -- renglón que se guarda en la venta (con costo, para la contabilidad del dueño)
    db_items := db_items || jsonb_build_object(
      'partId', p.id, 'name', p.name, 'color', coalesce(p.color, ''), 'sku', coalesce(p.sku, ''),
      'qty', vqty, 'price', vprice, 'cost', coalesce(p.cost, 0));
    -- renglón que se devuelve al vendedor (sin costo)
    out_items := out_items || jsonb_build_object(
      'partId', p.id, 'name', p.name, 'color', coalesce(p.color, ''), 'sku', coalesce(p.sku, ''),
      'qty', vqty, 'price', vprice);
  end loop;

  select coalesce(max(folio), 0) + 1 into vfolio from public.sales where org_id = org_in;

  insert into public.sales (org_id, folio, customer, items, total, cogs, profit, sold_at)
  values (org_in, vfolio, nullif(trim(coalesce(customer_in, '')), ''), db_items, vtotal, vcogs, vtotal - vcogs, current_date)
  returning * into srow;

  return jsonb_build_object(
    'id', srow.id, 'folio', srow.folio, 'customer', coalesce(srow.customer, ''),
    'items', out_items, 'total', srow.total, 'sold_at', srow.sold_at, 'created_at', srow.created_at);
end; $$;

-- ---------- 3) El dueño administra su equipo ---------------------------------

-- Miembros del negocio con su correo (solo dueño o admin pueden verlos)
create or replace function public.org_members(org_in uuid)
returns table(membership_id uuid, user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, p.email, m.role, m.created_at
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = org_in
    and (public.is_admin() or public.is_owner(org_in))
  order by m.created_at asc;
$$;

-- Agregar un VENDEDOR por correo (la persona debe tener cuenta ya creada).
-- El límite de usuarios del plan lo aplica el trigger users_limit al insertar.
create or replace function public.org_add_employee(org_in uuid, email_in text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid; mid uuid;
begin
  if not (public.is_admin() or public.is_owner(org_in)) then
    raise exception 'Solo el dueño puede agregar usuarios a su negocio.';
  end if;
  select id into uid from public.profiles where lower(email) = lower(trim(email_in));
  if uid is null then
    raise exception 'No existe una cuenta con ese correo. Pídele que primero cree su cuenta (gratis) en la página y vuelve a intentarlo.';
  end if;
  if exists (select 1 from public.memberships where user_id = uid and org_id = org_in) then
    raise exception 'Ese usuario ya forma parte de tu equipo.';
  end if;
  insert into public.memberships (user_id, org_id, role)
  values (uid, org_in, 'employee')
  returning id into mid;
  return mid;
end; $$;

-- Quitar a un miembro del equipo. El dueño solo puede quitar VENDEDORES
-- (no puede quitarse a sí mismo ni a otro dueño); el admin puede quitar a cualquiera.
create or replace function public.org_remove_member(membership_in uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare m public.memberships%rowtype;
begin
  select * into m from public.memberships where id = membership_in;
  if not found then return false; end if;
  if public.is_admin() then
    delete from public.memberships where id = membership_in;
    return true;
  end if;
  if public.is_owner(m.org_id) and m.role = 'employee' then
    delete from public.memberships where id = membership_in;
    return true;
  end if;
  raise exception 'Solo el dueño puede quitar vendedores de su equipo.';
end; $$;

-- ---------- 4) Registro automático: crear mi propia refaccionaria -----------
-- Un usuario recién registrado crea su negocio con nombre, logo y color, y
-- queda como DUEÑO, sin necesidad de que el administrador lo asigne.
-- Empieza en plan Básico; el admin le asigna su plan real desde el panel.
create or replace function public.crear_mi_negocio(
  name_in text, logo_in text default null, accent_in text default null
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
  insert into public.organizations (name, logo_url, accent, plan, status)
  values (vname, nullif(logo_in, ''), coalesce(nullif(trim(accent_in), ''), '#55AEEA'), 'basico', 'active')
  returning id into oid;
  insert into public.memberships (user_id, org_id, role) values (auth.uid(), oid, 'owner');
  return oid;
end; $$;

-- ---------- Permisos de ejecución -------------------------------------------
-- Todas validan por dentro quién llama (auth.uid + rol), así que basta con
-- permitir su ejecución a usuarios autenticados.
grant execute on function public.employee_parts(uuid) to authenticated;
grant execute on function public.employee_sales(uuid) to authenticated;
grant execute on function public.registrar_venta(uuid, jsonb, text, text) to authenticated;
grant execute on function public.org_members(uuid) to authenticated;
grant execute on function public.org_add_employee(uuid, text) to authenticated;
grant execute on function public.org_remove_member(uuid) to authenticated;
grant execute on function public.crear_mi_negocio(text, text, text) to authenticated;

-- Que el anónimo no pueda ni intentarlo (PUBLIC incluye a anon; todas además
-- validan por dentro, esto es solo una capa extra)
revoke execute on function public.employee_parts(uuid) from public, anon;
revoke execute on function public.employee_sales(uuid) from public, anon;
revoke execute on function public.registrar_venta(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.org_members(uuid) from public, anon;
revoke execute on function public.org_add_employee(uuid, text) from public, anon;
revoke execute on function public.org_remove_member(uuid) from public, anon;
revoke execute on function public.crear_mi_negocio(text, text, text) from public, anon;
