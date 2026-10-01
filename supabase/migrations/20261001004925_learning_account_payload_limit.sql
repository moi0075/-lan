-- Match the 10 MB application limit even for direct calls to the Data API.
-- No existing learning data is removed by this constraint.
alter table public.learning_accounts
  add constraint learning_accounts_payload_limit
  check (octet_length(store::text) <= 10000000);
