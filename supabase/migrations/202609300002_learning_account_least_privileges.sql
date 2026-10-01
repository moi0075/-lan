-- Supabase default grants include privileges unused by the browser client.
revoke all on public.learning_accounts from authenticated;
grant select, insert, update on public.learning_accounts to authenticated;
