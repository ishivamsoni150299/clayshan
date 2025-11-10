-- Extend products with production fields
alter table public.products add column if not exists inventory integer default null;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;

create index if not exists idx_products_featured on public.products (featured);
