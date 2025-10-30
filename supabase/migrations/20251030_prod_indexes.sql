-- Production indexes for common queries
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_created_at on public.products (created_at desc);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

