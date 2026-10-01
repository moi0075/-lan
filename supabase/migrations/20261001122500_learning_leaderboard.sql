-- Public statistics are a projection; private journeys and Auth identities stay private.
create schema if not exists elan_private;
revoke all on schema elan_private from public, anon, authenticated;
grant usage on schema elan_private to authenticated;

create table public.leaderboard_players (
  player_id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 32 and position('@' in display_name) = 0)
);
create table elan_private.leaderboard_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id uuid not null unique references public.leaderboard_players(player_id) on delete cascade
);
create table public.leaderboard_games (
  game_id text primary key,
  theme_id text not null,
  track_path text[] not null,
  item_count integer not null check (item_count > 0)
);
insert into public.leaderboard_games values
  ('world-place', 'geography', array['learning'], 197),
  ('world-name', 'geography', array['naming','learning'], 197);
create table public.leaderboard_scores (
  player_id uuid not null references public.leaderboard_players(player_id) on delete cascade,
  game_id text not null references public.leaderboard_games(game_id) on delete cascade,
  xp bigint not null check (xp >= 0),
  attempts bigint not null check (attempts >= 0),
  correct bigint not null check (correct between 0 and attempts),
  mastered integer not null check (mastered >= 0),
  primary key (player_id, game_id)
);
create index leaderboard_scores_game_idx on public.leaderboard_scores(game_id);
alter table public.leaderboard_players enable row level security;
alter table public.leaderboard_games enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table elan_private.leaderboard_owners enable row level security;
revoke all on public.leaderboard_players, public.leaderboard_games, public.leaderboard_scores from public, anon, authenticated;
revoke all on elan_private.leaderboard_owners from public, anon, authenticated;
grant select on public.leaderboard_players, public.leaderboard_games, public.leaderboard_scores to anon, authenticated;
create policy "Public player aliases" on public.leaderboard_players for select to anon, authenticated using (true);
create policy "Public game catalogue" on public.leaderboard_games for select to anon, authenticated using (true);
create policy "Public learning totals" on public.leaderboard_scores for select to anon, authenticated using (true);

-- Defensive conversion: malformed client values cannot break journey synchronization.
create function elan_private.learning_count(value text) returns bigint
language sql immutable set search_path = '' as $$
  select case when value ~ '^[0-9]{1,12}$' then value::bigint else 0 end;
$$;
revoke all on function elan_private.learning_count(text) from public, anon, authenticated;

create function elan_private.project_leaderboard(owner_id uuid, journey jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  public_id uuid;
  best_profile jsonb;
  game record;
  track jsonb;
  answers bigint;
  acquired integer;
begin
  select o.player_id into public_id from elan_private.leaderboard_owners o where o.user_id = owner_id;
  if public_id is null then
    public_id := gen_random_uuid();
    insert into public.leaderboard_players values (public_id, 'Joueur ' || left(replace(public_id::text, '-', ''), 6));
    insert into elan_private.leaderboard_owners values (owner_id, public_id);
  end if;
  -- A single complete profile per account: multiple profiles never multiply XP.
  select p.value into best_profile
  from jsonb_array_elements(case when jsonb_typeof(journey->'profiles') = 'array' then journey->'profiles' else '[]'::jsonb end)
    with ordinality p(value, ordinal)
  order by (select coalesce(sum(elan_private.learning_count(p.value #>> (g.track_path || array['xp']))),0) from public.leaderboard_games g) desc,
    (select coalesce(sum(elan_private.learning_count(p.value #>> (g.track_path || array['attempts']))),0) from public.leaderboard_games g) desc,
    p.ordinal asc limit 1;
  for game in select * from public.leaderboard_games loop
    track := best_profile #> game.track_path;
    answers := elan_private.learning_count(track->>'attempts');
    select least(game.item_count, count(*))::integer into acquired
    from jsonb_each(case when jsonb_typeof(track->'memory') = 'object' then track->'memory' else '{}'::jsonb end) m
    where m.value->>'acquired' = 'true' and elan_private.learning_count(m.value->>'streak') >= 3;
    insert into public.leaderboard_scores(player_id, game_id, xp, attempts, correct, mastered)
    values(public_id, game.game_id, elan_private.learning_count(track->>'xp'), answers,
      least(answers, elan_private.learning_count(track->>'correct')), acquired)
    on conflict (player_id, game_id) do update set xp = excluded.xp, attempts = excluded.attempts,
      correct = excluded.correct, mastered = excluded.mastered;
  end loop;
end;
$$;
revoke all on function elan_private.project_leaderboard(uuid,jsonb) from public, anon, authenticated;
create function elan_private.sync_leaderboard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform elan_private.project_leaderboard(new.user_id, new.store);
  return new;
end;
$$;
revoke all on function elan_private.sync_leaderboard() from public, anon, authenticated;
create trigger learning_accounts_leaderboard after insert or update of store on public.learning_accounts
for each row execute function elan_private.sync_leaderboard();

create function elan_private.remove_leaderboard_player() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.leaderboard_players where player_id = old.player_id;
  return old;
end;
$$;
revoke all on function elan_private.remove_leaderboard_player() from public, anon, authenticated;
create trigger leaderboard_owner_deleted after delete on elan_private.leaderboard_owners
for each row execute function elan_private.remove_leaderboard_player();

create function elan_private.my_leaderboard_identity(new_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare public_id uuid; cleaned text;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select player_id into public_id from elan_private.leaderboard_owners where user_id = auth.uid();
  if public_id is null then return null; end if;
  if new_name is not null then
    cleaned := btrim(new_name);
    if char_length(cleaned) not between 2 and 32 or position('@' in cleaned) > 0 or cleaned ~ '[[:cntrl:]]' then
      raise exception 'Choisissez un pseudo de 2 à 32 caractères, sans adresse e-mail.' using errcode = '22023';
    end if;
    update public.leaderboard_players set display_name = cleaned where player_id = public_id;
  end if;
  return (select jsonb_build_object('player_id', player_id, 'display_name', display_name)
    from public.leaderboard_players where player_id = public_id);
end;
$$;
revoke all on function elan_private.my_leaderboard_identity(text) from public, anon, authenticated;
grant execute on function elan_private.my_leaderboard_identity(text) to authenticated;
create function public.my_leaderboard_identity(p_name text default null) returns jsonb
language sql security invoker set search_path = '' as $$
  select elan_private.my_leaderboard_identity(p_name);
$$;
revoke all on function public.my_leaderboard_identity(text) from public, anon, authenticated;
grant execute on function public.my_leaderboard_identity(text) to authenticated;

create function public.learning_leaderboard(
  p_theme text default null, p_game text default null, p_search text default '',
  p_sort text default 'xp', p_offset integer default 0, p_limit integer default 25,
  p_self uuid default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with totals as (
    select p.player_id, p.display_name, sum(s.xp)::bigint xp, sum(s.attempts)::bigint attempts,
      sum(s.correct)::bigint correct, sum(s.mastered)::integer mastered, sum(g.item_count)::integer item_count
    from public.leaderboard_players p
    join public.leaderboard_scores s using(player_id)
    join public.leaderboard_games g using(game_id)
    where (p_theme is null or g.theme_id = p_theme) and (p_game is null or g.game_id = p_game)
    group by p.player_id, p.display_name
  ), measured as (
    select *, case when attempts > 0 then 100.0 * correct / attempts else null end accuracy from totals
  ), scored as (
    select *, case p_sort when 'mastered' then mastered when 'attempts' then attempts
      when 'accuracy' then accuracy else xp end sort_value from measured
  ), ranked as (
    select *, rank() over(order by sort_value desc nulls last) rank from scored
  ), matched as (
    select * from ranked where strpos(
      translate(lower(display_name), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      translate(lower(left(btrim(coalesce(p_search,'')),80)), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy')) > 0
  ), paged as (
    select * from matched order by sort_value desc nulls last, xp desc, display_name, player_id
    offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,25),1),50)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(paged) - 'sort_value' order by sort_value desc nulls last, xp desc, display_name, player_id) from paged),'[]'::jsonb),
    'total', (select count(*) from matched),
    'player_count', (select count(*) from ranked),
    'mine', (select to_jsonb(ranked) - 'sort_value' from ranked where player_id = p_self)
  );
$$;
revoke all on function public.learning_leaderboard(text,text,text,text,integer,integer,uuid) from public, anon, authenticated;
grant execute on function public.learning_leaderboard(text,text,text,text,integer,integer,uuid) to anon, authenticated;

-- Include existing accounts without modifying their saved journeys.
select elan_private.project_leaderboard(user_id, store) from public.learning_accounts;
