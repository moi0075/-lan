-- The mapping is only read by the narrowly scoped private functions.
create policy "No direct access to account mapping" on elan_private.leaderboard_owners
  for all to authenticated using (false) with check (false);
