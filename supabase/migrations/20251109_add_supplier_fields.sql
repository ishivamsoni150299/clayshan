-- Supplier fields for dropshipping
alter table public.products add column if not exists supplier text;
alter table public.products add column if not exists supplier_sku text;
alter table public.products add column if not exists supplier_data jsonb not null default '{}'::jsonb;
create index if not exists idx_products_supplier_sku on public.products (supplier, supplier_sku);

alter table public.orders add column if not exists supplier_order_id text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists shipping_carrier text;
create index if not exists idx_orders_supplier_order_id on public.orders (supplier_order_id);
