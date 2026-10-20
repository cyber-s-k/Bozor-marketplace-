-- Bozor Marketplace MVP database.
-- Run this entire script in Supabase Dashboard -> SQL Editor.
-- This starter allows anonymous public access for an early demo. Before a real public launch,
-- add Supabase Auth and restrict write/read policies; do NOT use a service_role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 90),
  price numeric(14,2) not null check (price > 0),
  category text not null default 'Другое',
  description text not null default '',
  seller_id text not null,
  seller_name text not null,
  image_url text,
  status text not null default 'active' check (status in ('active','sold','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sender_id text not null,
  sender_name text not null,
  receiver_id text not null,
  receiver_name text,
  product_title text,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id text not null,
  buyer_name text not null default 'Покупатель',
  seller_id text not null,
  price numeric(14,2) not null check (price > 0),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists products_created_at_idx on public.products(created_at desc);
create index if not exists products_status_idx on public.products(status);
create index if not exists messages_product_created_idx on public.messages(product_id,created_at);
create index if not exists messages_receiver_idx on public.messages(receiver_id,created_at desc);
create index if not exists offers_buyer_idx on public.offers(buyer_id,created_at desc);
create index if not exists offers_seller_idx on public.offers(seller_id,created_at desc);

alter table public.products enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;

-- MVP demo policies: data is shared across devices. These policies are intentionally broad
-- because this version uses guest IDs rather than real authenticated accounts.
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select to anon, authenticated using (true);
drop policy if exists "products guest insert" on public.products;
create policy "products guest insert" on public.products for insert to anon, authenticated with check (true);
drop policy if exists "products guest update" on public.products;
create policy "products guest update" on public.products for update to anon, authenticated using (true) with check (true);
drop policy if exists "products guest delete" on public.products;
create policy "products guest delete" on public.products for delete to anon, authenticated using (true);

drop policy if exists "messages public read" on public.messages;
create policy "messages public read" on public.messages for select to anon, authenticated using (true);
drop policy if exists "messages guest insert" on public.messages;
create policy "messages guest insert" on public.messages for insert to anon, authenticated with check (true);
drop policy if exists "messages guest update" on public.messages;
create policy "messages guest update" on public.messages for update to anon, authenticated using (true) with check (true);

drop policy if exists "offers public read" on public.offers;
create policy "offers public read" on public.offers for select to anon, authenticated using (true);
drop policy if exists "offers guest insert" on public.offers;
create policy "offers guest insert" on public.offers for insert to anon, authenticated with check (true);
drop policy if exists "offers guest update" on public.offers;
create policy "offers guest update" on public.offers for update to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update on public.messages to anon, authenticated;
grant select, insert, update on public.offers to anon, authenticated;

-- Enable realtime updates for catalogue and offer status changes.
do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
when undefined_object then raise notice 'Create publication supabase_realtime if it is missing.';
end $$;
do $$
begin
  alter publication supabase_realtime add table public.offers;
exception when duplicate_object then null;
when undefined_object then raise notice 'Create publication supabase_realtime if it is missing.';
end $$;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then raise notice 'Create publication supabase_realtime if it is missing.';
end $$;

-- Add product title to messages if you want the inbox label stored at send-time.
-- This app works without it; it will show a generic label if no title is stored.
