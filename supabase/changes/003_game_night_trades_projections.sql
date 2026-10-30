-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 003: game clock, final-score entry, trades, fantasy points, projections.
-- Paste the whole file into Supabase → SQL Editor → Run, after 001 and 002. Run it once.
--
--   • game_clocks: one row per game. Stores only state changes (started at / seconds left),
--     never a ticking number. Phones work out the countdown with server time.
--   • set_final_score(): types in a final score in one step (old score lines are voided, not deleted).
--   • trades + make_trade(): swaps players between two teams and keeps a record.
--   • stat_types.fantasy_points: how many MLF points each stat is worth (members can change it).
--   • renames the Daybies to their full name, the Dumbo Daybies.
--   • standings: count regular-season games only (the playoff final never changes the table).
--   • player_projections / game_projections: estimates, worked out here so the app never disagrees with itself.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Team name: the Daybies are the Dumbo Daybies (DUMBO, Brooklyn) ──────────
update public.teams set name = 'Dumbo Daybies' where short_name = 'DAY' and name = 'Daybies';

-- ── Standings: regular-season games only ───────────────────────────────────
-- Standings: final regular-season games plus record adjustments (the playoff final never changes the table). A tie counts half.
-- Order: win %, point difference, points scored. Head-to-head comes first in Phase 2 (standings screen).
create or replace view public.standings with (security_invoker = true) as
with results as (
  select season_id, home_team_id as team_id, home_points as pf, away_points as pa
  from public.game_scores where status = 'final' and kind = 'regular' and home_team_id is not null and away_team_id is not null
  union all
  select season_id, away_team_id, away_points, home_points
  from public.game_scores where status = 'final' and kind = 'regular' and home_team_id is not null and away_team_id is not null
),
played as (
  select season_id, team_id,
    count(*) filter (where pf > pa) as w, count(*) filter (where pf < pa) as l,
    count(*) filter (where pf = pa) as t, sum(pf) as pf, sum(pa) as pa
  from results group by season_id, team_id
),
adjusted as (
  select season_id, team_id, sum(wins) as w, sum(losses) as l, sum(ties) as t
  from public.record_adjustments where voided_at is null group by season_id, team_id
),
totals as (
  select s.id as season_id, tm.id as team_id,
    (coalesce(p.w, 0) + coalesce(a.w, 0))::int as wins,
    (coalesce(p.l, 0) + coalesce(a.l, 0))::int as losses,
    (coalesce(p.t, 0) + coalesce(a.t, 0))::int as ties,
    coalesce(p.pf, 0)::int as points_for,
    coalesce(p.pa, 0)::int as points_against
  from public.seasons s
  cross join public.teams tm
  left join played p on p.season_id = s.id and p.team_id = tm.id
  left join adjusted a on a.season_id = s.id and a.team_id = tm.id
  where s.counts_for_standings and s.voided_at is null and tm.voided_at is null
)
select *,
  wins + losses + ties as games_played,
  round((wins + 0.5 * ties) / nullif(wins + losses + ties, 0), 3) as win_pct,
  points_for - points_against as point_diff,
  rank() over (partition by season_id
    order by (wins + 0.5 * ties) / nullif(wins + losses + ties, 0) desc nulls last,
             points_for - points_against desc, points_for desc) as rank
from totals;

-- ── Game clock ──────────────────────────────────────────────────────────────
create table public.game_clocks (
  game_id      uuid primary key references public.games (id),
  running      boolean not null default false,
  seconds_left integer not null check (seconds_left between 0 and 7200),
  started_at   timestamptz,  -- server time the clock was last started; null while stopped
  half         smallint not null default 1 check (half in (1, 2, 3)),  -- 3 = overtime
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint running_has_start check (not running or started_at is not null)
);

-- ── Trades ──────────────────────────────────────────────────────────────────
create table public.trades (
  id         uuid primary key default gen_random_uuid(),
  traded_on  date not null default current_date,
  team_a_id  uuid not null references public.teams (id),
  team_b_id  uuid not null references public.teams (id),
  players_a  uuid[] not null,  -- left team A, joined team B
  players_b  uuid[] not null,  -- left team B, joined team A
  note       text check (length(note) <= 500),
  voided_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint two_teams check (team_a_id <> team_b_id),
  constraint someone_moves check (cardinality(players_a) + cardinality(players_b) > 0)
);

-- Same safety as every other table: RLS, stamps, history, members read/add/change, nobody deletes.
do $$
declare
  t record;
begin
  for t in select * from (values ('game_clocks', 'game_id'), ('trades', 'id')) as v(name, key_column)
  loop
    execute format('alter table public.%I enable row level security', t.name);
    execute format('create trigger stamp before insert or update on public.%I for each row execute function app_private.stamp()', t.name);
    execute format('create trigger history after insert or update on public.%I for each row execute function app_private.record_history(%L)', t.name, t.key_column);
    execute format('create policy members_read on public.%I for select to authenticated using (app_private.is_member())', t.name);
    execute format('create policy members_add on public.%I for insert to authenticated with check (app_private.is_member())', t.name);
    execute format('create policy members_change on public.%I for update to authenticated using (app_private.is_member()) with check (app_private.is_member())', t.name);
    execute format('revoke all on public.%I from anon', t.name);
    execute format('grant select, insert, update on public.%I to authenticated', t.name);
    execute format('revoke delete, truncate on public.%I from authenticated', t.name);
  end loop;
end $$;

-- ── Fantasy points per stat ─────────────────────────────────────────────────
alter table public.stat_types add column if not exists fantasy_points numeric(4, 1) not null default 0
  check (fantasy_points between -20 and 20);

update public.stat_types set fantasy_points = v.pts
from (values ('rec', 1), ('target', 0), ('drop', -1), ('td', 6), ('fumble', -2), ('int', 3),
             ('pick6', 3), ('conv1', 1), ('conv2', 2), ('block', 1), ('conv_old', 1)) as v(id, pts)
where stat_types.id = v.id;

-- ── Actions ─────────────────────────────────────────────────────────────────
-- Server time, so every phone's clock agrees whatever time the phone thinks it is.
create or replace function public.server_now() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

-- Type in a final score. Earlier score lines for the game are voided (kept in history), then two
-- "final score" lines are added and the game is marked final. One step, so it can't half-happen.
create or replace function public.set_final_score(p_game_id uuid, p_home integer, p_away integer)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  g public.games;
begin
  if not app_private.is_member() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_home not between 0 and 200 or p_away not between 0 and 200 then
    raise exception 'Scores must be between 0 and 200.' using errcode = '22023';
  end if;
  select * into g from public.games where id = p_game_id and voided_at is null;
  if g.id is null or g.home_team_id is null or g.away_team_id is null then
    raise exception 'That game needs both teams first.' using errcode = '22023';
  end if;
  update public.score_events set voided_at = now() where game_id = p_game_id and voided_at is null;
  insert into public.score_events (game_id, team_id, scoring_type_id, points) values
    (p_game_id, g.home_team_id, 'final_manual', p_home),
    (p_game_id, g.away_team_id, 'final_manual', p_away);
  update public.games set status = 'final' where id = p_game_id;
  update public.game_clocks set running = false, started_at = null where game_id = p_game_id;
end $$;

-- Swap players between two teams from a date. Every player in p_players_a must be on team A now,
-- every player in p_players_b on team B. Old roster lines are closed (kept), new ones opened.
create or replace function public.make_trade(
  p_team_a uuid, p_players_a uuid[], p_team_b uuid, p_players_b uuid[], p_on date default current_date, p_note text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_wrong int;
begin
  if not app_private.is_member() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_team_a = p_team_b then
    raise exception 'Pick two different teams.' using errcode = '22023';
  end if;
  select count(*) into v_wrong from (
    select unnest(coalesce(p_players_a, '{}')) as player_id, p_team_a as team_id
    union all
    select unnest(coalesce(p_players_b, '{}')), p_team_b
  ) want
  where not exists (
    select 1 from public.roster_memberships rm
    where rm.player_id = want.player_id and rm.team_id = want.team_id and rm.ends_on is null and rm.voided_at is null
  );
  if v_wrong > 0 then
    raise exception 'Someone in this trade is not on that team any more.' using errcode = '22023';
  end if;

  update public.roster_memberships set ends_on = p_on
    where ends_on is null and voided_at is null
      and player_id = any (coalesce(p_players_a, '{}') || coalesce(p_players_b, '{}'));
  insert into public.roster_memberships (player_id, team_id, starts_on)
    select unnest(coalesce(p_players_a, '{}')), p_team_b, p_on
    union all
    select unnest(coalesce(p_players_b, '{}')), p_team_a, p_on;
  insert into public.trades (traded_on, team_a_id, team_b_id, players_a, players_b, note)
    values (p_on, p_team_a, p_team_b, coalesce(p_players_a, '{}'), coalesce(p_players_b, '{}'), nullif(trim(p_note), ''))
    returning id into v_id;
  return v_id;
end $$;

-- ── Projections (always shown as "estimate") ────────────────────────────────
-- The season the app treats as "now": newest one that counts and isn't finished.
create view public.current_season with (security_invoker = true) as
select id from public.seasons
where counts_for_standings and status <> 'finished' and voided_at is null
order by starts_on desc nulls last, created_at desc
limit 1;

-- Per player, per game: career stat totals divided by the games their current team has played
-- this season (the old stat sheet covers this season's games, including unrecorded ones).
create view public.player_projections with (security_invoker = true) as
with totals as (
  select se.player_id, se.stat_type_id, sum(se.value)::numeric as total
  from public.stat_events se
  where se.voided_at is null and se.player_id is not null
  group by se.player_id, se.stat_type_id
),
team_games as (
  select st.team_id, greatest(st.games_played, 1) as games
  from public.standings st join public.current_season cs on cs.id = st.season_id
)
select
  cr.player_id,
  cr.team_id,
  tg.games,
  round(coalesce(sum(t.total) filter (where t.stat_type_id = 'rec'), 0) / tg.games, 1) as rec_per_game,
  round(coalesce(sum(t.total) filter (where t.stat_type_id = 'td'), 0) / tg.games, 1) as td_per_game,
  round(coalesce(sum(t.total) filter (where t.stat_type_id = 'int'), 0) / tg.games, 1) as int_per_game,
  round(coalesce(sum(t.total * sty.fantasy_points), 0), 1) as points_total,
  round(coalesce(sum(t.total * sty.fantasy_points), 0) / tg.games, 1) as points_per_game
from public.current_rosters cr
join team_games tg on tg.team_id = cr.team_id
left join totals t on t.player_id = cr.player_id
left join public.stat_types sty on sty.id = t.stat_type_id
group by cr.player_id, cr.team_id, tg.games;

-- Per upcoming game: each side scores the average of its own points-for and the other side's
-- points-against; the record nudges the win chance. Null when a team has no scored games yet.
create view public.game_projections with (security_invoker = true) as
with results as (
  select season_id, home_team_id as team_id, home_points as pf, away_points as pa
  from public.game_scores where status = 'final' and home_team_id is not null and away_team_id is not null
  union all
  select season_id, away_team_id, away_points, home_points
  from public.game_scores where status = 'final' and home_team_id is not null and away_team_id is not null
),
form as (
  select season_id, team_id, avg(pf) as avg_pf, avg(pa) as avg_pa from results group by season_id, team_id
),
sides as (
  select g.id as game_id, g.season_id,
    round((h.avg_pf + a.avg_pa) / 2)::int as home_points,
    round((a.avg_pf + h.avg_pa) / 2)::int as away_points,
    coalesce(hs.win_pct, 0.5) - coalesce(aws.win_pct, 0.5) as record_edge
  from public.games g
  join form h on h.season_id = g.season_id and h.team_id = g.home_team_id
  join form a on a.season_id = g.season_id and a.team_id = g.away_team_id
  left join public.standings hs on hs.season_id = g.season_id and hs.team_id = g.home_team_id
  left join public.standings aws on aws.season_id = g.season_id and aws.team_id = g.away_team_id
  where g.voided_at is null and g.status <> 'final'
)
select game_id, season_id, home_points, away_points,
  round(1 / (1 + exp(-((home_points - away_points) + 10 * record_edge) / 8.0)), 2) as home_win_chance
from sides;

-- ── Live updates ────────────────────────────────────────────────────────────
-- Open game screens hear score, clock and status changes instantly (Supabase Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.score_events, public.game_clocks, public.games;
  end if;
end $$;

-- ── Who can use what ────────────────────────────────────────────────────────
revoke all on public.current_season, public.player_projections, public.game_projections from anon;
grant select on public.current_season, public.player_projections, public.game_projections to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.server_now(),
  public.set_final_score(uuid, integer, integer),
  public.make_trade(uuid, uuid[], uuid, uuid[], date, text)
  to authenticated;
