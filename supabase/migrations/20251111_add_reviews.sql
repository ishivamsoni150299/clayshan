-- Reviews storage for real ratings
create table if not exists public.reviews (
  id bigserial primary key,
  slug text not null,
  stars smallint not null check (stars between 1 and 5),
  name text,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_slug_idx on public.reviews (slug);

alter table public.reviews enable row level security;
-- Simple policy: allow inserts from anon; reads to everyone
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow read to all') then
    create policy "Allow read to all" on public.reviews for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'Allow insert to all') then
    create policy "Allow insert to all" on public.reviews for insert with check (true);
  end if;
end $$;

