-- Supabase schema for Clayshan Jewellery

-- Ensure required extensions
create extension if not exists pgcrypto;

-- Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price numeric not null,
  currency text not null default 'INR',
  images text[] not null default '{}',
  description text not null default '',
  category text not null default 'Uncategorized',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inquiries table
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security (RLS)
alter table public.products enable row level security;
alter table public.inquiries enable row level security;

-- Read policy for anon (optional; server uses service role)
drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select using (true);

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();
