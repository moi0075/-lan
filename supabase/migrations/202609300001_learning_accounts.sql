begin;
create table public.learning_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null check (jsonb_typeof(store) = 'object' and store->>'version' = '1'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.learning_accounts enable row level security;
revoke all on public.learning_accounts from anon;
grant select, insert, update on public.learning_accounts to authenticated;
create policy "Read own learning" on public.learning_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own learning" on public.learning_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own learning" on public.learning_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
