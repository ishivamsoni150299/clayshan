-- Orders table for Razorpay checkout
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  amount numeric not null,
  currency text not null default 'INR',
  email text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Optional: public cannot select; server uses service role

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

