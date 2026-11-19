create extension if not exists pgcrypto;

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists checkout_request_id uuid;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists amount_subtotal_cents bigint not null default 0;
alter table public.orders add column if not exists shipping_cents bigint not null default 0;
alter table public.orders add column if not exists customer_note text;
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists inventory_reserved boolean not null default false;

update public.orders
set order_number = 'RD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where order_number is null;
update public.orders
set checkout_request_id = gen_random_uuid()
where checkout_request_id is null;
update public.orders
set customer_name = coalesce(
  (select profiles.full_name from public.profiles where profiles.id = orders.customer_id),
  orders.email
)
where customer_name is null;
update public.orders
set amount_subtotal_cents = amount_total_cents
where amount_subtotal_cents = 0 and amount_total_cents > 0;

alter table public.orders alter column order_number set default ('RD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
alter table public.orders alter column order_number set not null;
alter table public.orders alter column checkout_request_id set default gen_random_uuid();
alter table public.orders alter column checkout_request_id set not null;
alter table public.orders alter column customer_name set default 'Customer';
alter table public.orders alter column customer_name set not null;
alter table public.orders alter column amount_subtotal_cents drop default;
alter table public.orders alter column shipping_address set default '{}'::jsonb;
update public.orders set shipping_address = '{}'::jsonb where shipping_address is null;
alter table public.orders alter column shipping_address set not null;
alter table public.orders alter column status set default 'invoice_pending';

create unique index if not exists orders_order_number_idx on public.orders (order_number);
create unique index if not exists orders_checkout_request_id_idx on public.orders (checkout_request_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_amount_subtotal_cents_check') then
    alter table public.orders add constraint orders_amount_subtotal_cents_check check (amount_subtotal_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_shipping_cents_check') then
    alter table public.orders add constraint orders_shipping_cents_check check (shipping_cents >= 0);
  end if;
end;
$$;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('invoice_pending', 'invoice_sent', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

drop function if exists public.fulfill_paid_order(text, text, uuid, text, bigint, text, jsonb, uuid, jsonb);
alter table public.orders drop column if exists stripe_checkout_session_id;
alter table public.orders drop column if exists stripe_payment_intent_id;

drop policy if exists "Admins update orders" on public.orders;
drop policy if exists "Verified customers can write reviews" on public.product_reviews;
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
