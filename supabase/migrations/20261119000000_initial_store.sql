create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category text not null,
  collection text,
  price_cents integer not null check (price_cents > 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text not null,
  image_urls text[] not null default '{}',
  badge text,
  description text not null,
  compatibility text not null,
  colors text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_created_idx on public.products (active, created_at desc);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('RD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  checkout_request_id uuid not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  customer_name text not null,
  email text not null,
  phone text,
  status text not null default 'invoice_pending' check (status in ('invoice_pending', 'invoice_sent', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  amount_subtotal_cents bigint not null check (amount_subtotal_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  amount_total_cents bigint not null check (amount_total_cents >= 0),
  currency text not null default 'usd',
  shipping_address jsonb not null,
  customer_note text,
  invoice_number text,
  tracking_number text,
  inventory_reserved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  variant text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id, variant)
);

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  name text not null check (length(name) between 1 and 100),
  email text not null,
  model text not null,
  style text not null,
  color text not null,
  rider_name text,
  race_number text,
  instructions text,
  reference_path text,
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'received' check (status in ('received', 'reviewing', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_requests_created_idx on public.custom_requests (created_at desc);
create unique index if not exists custom_requests_order_unique_idx on public.custom_requests (order_id) where order_id is not null;

create table if not exists public.newsletter_subscribers (
  email text primary key check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  rating integer not null check (rating between 1 and 5),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 2000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, product_id, user_id)
);

create index if not exists product_reviews_published_created_idx on public.product_reviews (published, created_at desc);

create table if not exists public.store_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();
create trigger custom_requests_set_updated_at before update on public.custom_requests
  for each row execute procedure public.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings
  for each row execute procedure public.set_updated_at();

insert into public.store_settings (key, value) values
  ('free_shipping_threshold_cents', '15000'),
  ('standard_shipping_cents', '995'),
  ('store_email', 'hello@ropcadesigns.com')
on conflict (key) do nothing;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.custom_requests enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.product_reviews enable row level security;
alter table public.store_settings enable row level security;

create policy "Profiles can be read by owner or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers can update their profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select public.current_profile_role()));
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy "Active products are public" on public.products
  for select to anon, authenticated using (active or (select public.is_admin()));
create policy "Admins manage products" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Customers read their own orders" on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers read their own order items" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.customer_id = (select auth.uid()) or (select public.is_admin()))
  ));

create policy "Admins review custom requests" on public.custom_requests
  for select to authenticated using ((select public.is_admin()));
create policy "Admins update custom requests" on public.custom_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Anyone can subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
create policy "Admins read subscribers" on public.newsletter_subscribers
  for select to authenticated using ((select public.is_admin()));

create policy "Published reviews are public" on public.product_reviews
  for select to anon, authenticated using (published or (select public.is_admin()));
create policy "Verified customers can write reviews" on public.product_reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.orders
      join public.order_items on order_items.order_id = orders.id
      where orders.id = product_reviews.order_id
        and orders.customer_id = (select auth.uid())
        and orders.status in ('paid', 'processing', 'shipped', 'delivered')
        and order_items.product_id = product_reviews.product_id
    )
  );
create policy "Admins moderate reviews" on public.product_reviews
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public can read shipping settings" on public.store_settings
  for select to anon, authenticated using (key in ('free_shipping_threshold_cents', 'standard_shipping_cents', 'store_email'));
create policy "Admins manage store settings" on public.store_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('custom-references', 'custom-references', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Product images are publicly readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
create policy "Admins manage product images" on storage.objects
  for all to authenticated using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins read custom reference images" on storage.objects
  for select to authenticated using (bucket_id = 'custom-references' and (select public.is_admin()));

create or replace function public.create_invoice_order(
  p_checkout_request_id uuid,
  p_customer_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_shipping_address jsonb,
  p_customer_note text,
  p_custom_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal bigint := 0;
  v_shipping bigint := 0;
  v_threshold bigint;
  v_standard_shipping bigint;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_product_quantity integer;
  v_variant text;
  v_result jsonb;
  v_updated integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_checkout_request_id::text, 0));
  select jsonb_build_object(
    'order_number', order_number,
    'amount_total_cents', amount_total_cents,
    'shipping_cents', shipping_cents
  ) into v_result
  from public.orders
  where checkout_request_id = p_checkout_request_id;
  if found then
    return v_result;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_CART';
  end if;
  if jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'INVALID_CART';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items) as cart(value)
    order by value ->> 'id', coalesce(value ->> 'variant', '')
  loop
    if coalesce((v_item ->> 'quantity') !~ '^[1-9][0-9]*$', true) then
      raise exception 'INVALID_CART';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity > 99 then
      raise exception 'INVALID_CART';
    end if;
    v_variant := nullif(v_item ->> 'variant', '');
    select * into v_product
    from public.products
    where id = (v_item ->> 'id')::uuid
    for update;
    if not found or not v_product.active then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;
    if v_variant is not null and not (v_variant = any(v_product.colors)) then
      raise exception 'INVALID_VARIANT';
    end if;
    select sum((item.value ->> 'quantity')::integer)
    into v_product_quantity
    from jsonb_array_elements(p_items) as item(value)
    where item.value ->> 'id' = v_product.id::text;
    if v_product.stock < v_product_quantity then
      raise exception 'OUT_OF_STOCK';
    end if;
    v_subtotal := v_subtotal + (v_product.price_cents::bigint * v_quantity);
  end loop;

  select
    coalesce((select value::bigint from public.store_settings where key = 'free_shipping_threshold_cents'), 15000),
    coalesce((select value::bigint from public.store_settings where key = 'standard_shipping_cents'), 995)
  into v_threshold, v_standard_shipping;
  v_shipping := case when v_subtotal >= v_threshold then 0 else v_standard_shipping end;

  insert into public.orders (
    checkout_request_id, customer_id, customer_name, email, phone, status,
    amount_subtotal_cents, shipping_cents, amount_total_cents, currency,
    shipping_address, customer_note, inventory_reserved
  ) values (
    p_checkout_request_id,
    case when exists (select 1 from public.profiles where id = p_customer_id) then p_customer_id else null end,
    btrim(p_name), lower(btrim(p_email)), nullif(btrim(p_phone), ''), 'invoice_pending',
    v_subtotal, v_shipping, v_subtotal + v_shipping, 'usd',
    p_shipping_address, nullif(btrim(p_customer_note), ''), true
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items) as cart(value)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    v_variant := nullif(v_item ->> 'variant', '');
    select * into v_product from public.products where id = (v_item ->> 'id')::uuid;
    update public.products
      set stock = stock - v_quantity, updated_at = now()
      where id = v_product.id;
    insert into public.order_items (order_id, product_id, product_name, variant, quantity, unit_price_cents)
      values (v_order_id, v_product.id, v_product.name, v_variant, v_quantity, v_product.price_cents);
  end loop;

  if p_custom_request_id is not null then
    update public.custom_requests
      set order_id = v_order_id
      where id = p_custom_request_id
        and lower(email) = lower(btrim(p_email))
        and order_id is null
        and status in ('received', 'reviewing', 'quoted');
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'CUSTOM_BRIEF_UNAVAILABLE';
    end if;
  end if;

  return jsonb_build_object(
    'order_number', v_order_number,
    'amount_total_cents', v_subtotal + v_shipping,
    'shipping_cents', v_shipping
  );
end;
$$;

revoke all on function public.create_invoice_order(uuid, uuid, text, text, text, jsonb, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_invoice_order(uuid, uuid, text, text, text, jsonb, text, uuid, jsonb) to service_role;

create or replace function public.admin_update_invoice_order(
  p_order_id uuid,
  p_status text,
  p_invoice_number text,
  p_tracking_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_status not in ('invoice_pending', 'invoice_sent', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'INVALID_STATUS';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'ORDER_CANCELLED';
  end if;

  if p_status = 'cancelled' and v_order.status <> 'cancelled' and v_order.inventory_reserved then
    for v_item in select product_id, quantity from public.order_items where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        update public.products
        set stock = stock + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
      end if;
    end loop;
    update public.orders set inventory_reserved = false where id = p_order_id;
  end if;

  update public.orders
  set status = p_status,
      invoice_number = nullif(btrim(p_invoice_number), ''),
      tracking_number = nullif(btrim(p_tracking_number), '')
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_update_invoice_order(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_invoice_order(uuid, text, text, text) to authenticated, service_role;
