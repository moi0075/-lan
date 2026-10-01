-- Integration checks use synthetic accounts inside a rolled-back transaction.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  pa uuid; pb uuid; pc uuid; result jsonb; mine jsonb; previous_name text;
  strongest jsonb := '{"id":"strong","learning":{"xp":1000000000,"attempts":100,"correct":80,"memory":{"IND":{"acquired":true,"streak":3},"FRA":{"acquired":false,"streak":3},"BRA":{"acquired":true,"streak":2}}},"naming":{"learning":{"xp":1000,"attempts":10,"correct":8,"memory":{}}}}';
begin
  insert into auth.users(id,email) values (a,'leaderboard-a@example.test'),(b,'leaderboard-b@example.test'),(c,'leaderboard-c@example.test');
  insert into public.learning_accounts(user_id,store) values
    (a,jsonb_build_object('version',1,'activeId','weak','profiles',jsonb_build_array(strongest,'{"id":"weak","learning":{"xp":999999999,"attempts":5,"correct":5}}'::jsonb))),
    (b,'{"version":1,"profiles":[{"learning":{"xp":1000001000,"attempts":1,"correct":1}}]}'),
    (c,'{"version":1,"profiles":[{"learning":{"xp":0,"attempts":0,"correct":0}}]}');
  select player_id into pa from elan_private.leaderboard_owners where user_id=a;
  select player_id into pb from elan_private.leaderboard_owners where user_id=b;
  select player_id into pc from elan_private.leaderboard_owners where user_id=c;
  update public.leaderboard_players set display_name='Éléonore test' where player_id=pa;
  update public.leaderboard_players set display_name='Bastien test' where player_id=pb;
  update public.leaderboard_players set display_name='Célia test' where player_id=pc;

  result := public.learning_leaderboard(p_self=>pa);
  mine := result->'mine';
  assert (mine->>'xp')::bigint = 1000001000, 'profiles must never be added together';
  assert (mine->>'attempts')::int = 110, 'both games are included';
  assert (mine->>'mastered')::int = 1, 'mastery must match the learning engine';
  assert (mine->>'item_count')::int = 394, 'two distinct learning skills per country';
  assert (mine->>'rank')::int = 1, 'equal XP share the same rank';
  assert (result->'rows'->0->>'rank') = (result->'rows'->1->>'rank'), 'tie ranks';
  result := public.learning_leaderboard(p_game=>'world-place',p_self=>pa);
  assert (result->'mine'->>'xp')::bigint = 1000000000, 'game filtering';
  assert (result->'mine'->>'rank')::int = 2, 'game ranks recomputed';
  result := public.learning_leaderboard(p_game=>'world-place',p_search=>'eleonore');
  assert jsonb_array_length(result->'rows')=1, 'accent-insensitive search';
  assert (result->'rows'->0->>'rank')::int=2, 'search must retain the global rank';
  result := public.learning_leaderboard(p_search=>'%',p_self=>pa);
  assert (result->>'total')::int=0 and result->'mine'->>'player_id'=pa::text, 'literal search and own rank outside results';
  assert (public.learning_leaderboard(p_theme=>'unknown')->>'total')::int=0, 'unknown themes are empty';
  result := public.learning_leaderboard(p_sort=>'accuracy',p_self=>pc);
  assert result->'mine'->>'accuracy' is null and (result->'mine'->>'rank')::int>1, 'zero responses rank last for accuracy';
  result := public.learning_leaderboard(p_sort=>'attempts',p_limit=>1,p_offset=>1);
  assert jsonb_array_length(result->'rows')=1 and (result->>'total')::int>=3, 'pagination';

  perform set_config('request.jwt.claim.sub',a::text,true);
  assert public.my_leaderboard_identity()->>'player_id'=pa::text, 'own public identity';
  previous_name := (select display_name from public.leaderboard_players where player_id=pb);
  perform public.my_leaderboard_identity('Mon pseudo');
  assert (select display_name from public.leaderboard_players where player_id=pb)=previous_name, 'cannot edit another player';
  begin
    perform public.my_leaderboard_identity('email@example.test');
    raise exception 'email alias must be rejected';
  exception when invalid_parameter_value then null; end;

  update public.learning_accounts set store=jsonb_set(store,'{profiles,0,learning,xp}','1000000001') where user_id=a;
  assert (public.learning_leaderboard(p_self=>pa)->'mine'->>'xp')::bigint=1000001001, 'new answers project immediately';
  assert (public.my_leaderboard_identity()->>'display_name')='Mon pseudo', 'sync preserves public alias';
  assert not has_table_privilege('anon','public.learning_accounts','SELECT'), 'no anonymous private journeys';
  assert not has_table_privilege('authenticated','public.leaderboard_players','UPDATE'), 'public rows cannot be written directly';
  assert not has_function_privilege('authenticated','elan_private.project_leaderboard(uuid,jsonb)','EXECUTE'), 'no arbitrary projections';
  assert not has_function_privilege('anon','public.my_leaderboard_identity(text)','EXECUTE'), 'no anonymous alias edits';
  assert position('email' in result::text)=0 and position('user_id' in result::text)=0 and position('history' in result::text)=0, 'only sanitized public statistics';
  delete from auth.users where id=c;
  assert not exists(select 1 from public.leaderboard_players where player_id=pc), 'account deletion removes public statistics';
end;
$$;
set local role authenticated;
do $$
begin
  assert public.my_leaderboard_identity()->>'display_name'='Mon pseudo', 'authenticated wrapper reads only its own identity';
  perform public.my_leaderboard_identity('Pseudo authentifié');
  assert public.my_leaderboard_identity()->>'display_name'='Pseudo authentifié', 'authenticated alias update';
  assert (select count(*) from public.learning_accounts)=1, 'private journey RLS remains in force';
  begin
    perform elan_private.project_leaderboard(gen_random_uuid(), '{}'::jsonb);
    raise exception 'projection must not be callable by a player';
  exception when insufficient_privilege then null; end;
  begin
    update public.leaderboard_players set display_name='Forbidden';
    raise exception 'direct public writes must be denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
select public.learning_leaderboard(p_limit=>1) as anonymous_public_read;
reset role;
rollback;
