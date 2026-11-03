-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 008: Season 2 (game-ready). Run once, after 007. Safe to re-run.
--
--   • Season 1 (the "2026 season") is renamed and finished. Season 2 starts 2026-11-08.
--   • Each season carries its own rules: half, halftime, overtime and players on the field.
--   • Teams belong to a season. Team names only need to be unique within a season.
--   • Stat types get a group (qb, receiving, line, defense, kicks, team) and a limit per game.
--   • Safety is a scoring type (2 points).
--   • Games record their quarterbacks. Stat and score lines can record the clock second.
--   • game_subs and player_minutes: who came in, and how long each player was on the field.
--   • standings lists only each season's own teams.
--
-- Re-running this file resets the stat group and limit of every stat type listed below, and sets
-- conv1, conv2 and conv_old back to inactive. Any hand edit to those fields is lost. Stat types
-- not listed below that still have no limit are set to legacy, limit 15, inactive.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Seasons: each season has its own rules ─────────────────────────────────
alter table public.seasons add column if not exists half_minutes smallint
  check (half_minutes between 1 and 60);
alter table public.seasons add column if not exists halftime_minutes smallint
  check (halftime_minutes between 0 and 30);
alter table public.seasons add column if not exists overtime_minutes smallint
  check (overtime_minutes between 1 and 30);  -- null = no overtime
alter table public.seasons add column if not exists on_field smallint
  check (on_field between 1 and 3);

-- Season 1: the old 2026 season, now closed. Its rules were 10 / 7 / no overtime / 2 on the field.
update public.seasons set name = 'Season 1' where name = '2026 season';
update public.seasons
set status = 'finished', half_minutes = 10, halftime_minutes = 7, overtime_minutes = null, on_field = 2
where name = 'Season 1' and half_minutes is null;

-- Season 2: the rulebook rules (12 / 7 / 8 minutes of overtime / 3 on the field).
insert into public.seasons (name, starts_on, ends_on, status, half_minutes, halftime_minutes, overtime_minutes, on_field)
select 'Season 2', date '2026-11-08', date '2027-01-03', 'regular', 12, 7, 8, 3
where not exists (select 1 from public.seasons where name = 'Season 2');

-- The season the app treats as "now" is the newest one that counts and isn't finished. Now it also gives its name.
create or replace view public.current_season with (security_invoker = true) as
select id, name from public.seasons
where counts_for_standings and status <> 'finished' and voided_at is null
order by starts_on desc nulls last, created_at desc
limit 1;

-- ── Teams: each team belongs to one season ─────────────────────────────────
alter table public.teams add column if not exists season_id uuid references public.seasons (id);
update public.teams set season_id = (select id from public.seasons where name = 'Season 1') where season_id is null;
alter table public.teams alter column season_id set not null;
alter table public.teams add column if not exists captain_player_id uuid references public.players (id);

-- Team names are unique within a season, not across all seasons.
alter table public.teams drop constraint if exists teams_name_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teams_season_name_key') then
    alter table public.teams add constraint teams_season_name_key unique (season_id, name);
  end if;
end $$;

-- Colours for Season 2 teams (each one names a token in tokens.css).
alter table public.teams drop constraint if exists teams_color_key_check;
alter table public.teams add constraint teams_color_key_check
  check (color_key in ('demons', 'daybies', 'tigers', 'gooners', 'sucks', 'spicy', 'shpitzy'));

-- Standings: each counting season lists only its own teams (was: every season crossed with every team).
-- Same columns and order as before, so grants and the app keep working.
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
    and tm.season_id = s.id
)
select *,
  wins + losses + ties as games_played,
  round((wins + 0.5 * ties) / nullif(wins + losses + ties, 0), 3) as win_pct,
  points_for - points_against as point_diff,
  rank() over (partition by season_id
    order by (wins + 0.5 * ties) / nullif(wins + losses + ties, 0) desc nulls last,
             points_for - points_against desc, points_for desc) as rank
from totals;

-- ── Stat types: groups and limits per game ─────────────────────────────────
alter table public.stat_types add column if not exists stat_group text not null default 'legacy'
  check (stat_group in ('qb', 'receiving', 'line', 'defense', 'kicks', 'team', 'legacy'));
alter table public.stat_types add column if not exists max_per_game smallint
  check (max_per_game > 0);

-- Existing ids (rec, target, drop, fumble, int, block, td, pick6, conv1, conv2, conv_old) are reused:
-- on conflict only their group and limit change, never their label or display order.
-- New ids are added with fantasy_points 0.
insert into public.stat_types (id, label, display_order, stat_group, max_per_game) values
  -- Quarterback
  ('completion',       'Completion',               12, 'qb', 40),
  ('incompletion',     'Incompletion',             13, 'qb', 40),
  ('pass_td',          'Passing touchdown',        14, 'qb', 15),
  ('int_thrown',       'Interception thrown',      15, 'qb', 15),
  ('qb_run',           'QB run',                   16, 'qb', 20),
  ('qb_rush_td',       'QB rushing touchdown',     17, 'qb', 10),
  ('rollout',          'Rollout',                  18, 'qb', 30),
  ('sack_taken',       'Sack taken',               19, 'qb', 20),
  ('fumble',           'Fumbles',                   5, 'qb', 10),
  ('fumble_lost',      'Fumble lost',              20, 'qb', 10),
  ('pass_first_down',  'Passing first down',       21, 'qb', 30),
  ('rush_first_down',  'Rushing first down',       22, 'qb', 20),
  -- Receiving
  ('target',           'Targets',                   2, 'receiving', 60),
  ('rec',              'Receptions',                1, 'receiving', 40),
  ('rec_td',           'Receiving touchdown',      23, 'receiving', 15),
  ('drop',             'Drops',                     3, 'receiving', 30),
  ('first_down_catch', 'First-down catch',         24, 'receiving', 30),
  -- Offensive line
  ('sack_allowed',     'Sack allowed',             25, 'line', 20),
  ('pressure_allowed', 'Pressure allowed',         26, 'line', 30),
  ('block',            'Blocks',                   10, 'line', 40),
  ('blocking_penalty', 'Blocking penalty',         27, 'line', 10),
  -- Defense
  ('sack',             'Sack',                     28, 'defense', 20),
  ('int',              'Interceptions',             6, 'defense', 15),
  ('pass_defended',    'Pass defended',            29, 'defense', 30),
  ('forced_fumble',    'Forced fumble',            30, 'defense', 10),
  ('fumble_recovery',  'Fumble recovery',          31, 'defense', 10),
  ('safety',           'Safety',                   32, 'defense', 5),
  ('two_hand_touch',   'Two-hand touch',           33, 'defense', 60),
  -- Kicks and returns
  ('kickoff_return',   'Kickoff return',           34, 'kicks', 20),
  ('punt_return',      'Punt return',              35, 'kicks', 20),
  ('return_td',        'Return touchdown',         36, 'kicks', 10),
  ('touchback',        'Touchback',                37, 'kicks', 20),
  ('onside_recovery',  'Onside recovery',          38, 'kicks', 10),
  ('kickoff',          'Kickoff',                  39, 'kicks', 20),
  ('punt',             'Punt',                     40, 'kicks', 20),
  -- Team
  ('penalty',          'Penalty',                  41, 'team', 30),
  ('first_down',       'First down',               42, 'team', 40),
  ('turnover',         'Turnover',                 43, 'team', 20),
  -- Legacy (old ids kept so history still reads). td and pick6 stay active; the 1 and 2 point conversions do not.
  ('td',               'Touchdowns',                4, 'legacy', 15),
  ('pick6',            'Pick 6',                    7, 'legacy', 15),
  ('conv1',            '1-point conversion',        8, 'legacy', 15),
  ('conv2',            '2-point conversion',        9, 'legacy', 15),
  ('conv_old',         'Conversion (old sheet, 1 or 2 pt not split)', 11, 'legacy', 15)
on conflict (id) do update
  set stat_group = excluded.stat_group,
      max_per_game = excluded.max_per_game;

update public.stat_types set active = false
where id in ('conv1', 'conv2', 'conv_old') and active;

-- Any other existing stat type without a limit is old: legacy, 15 per game, inactive. td and pick6 stay active.
update public.stat_types set stat_group = 'legacy', max_per_game = 15, active = false
where stat_group = 'legacy' and id not in ('td', 'pick6') and max_per_game is null;

-- ── Scoring: safety ────────────────────────────────────────────────────────
insert into public.scoring_types (id, label, points, display_order) values
  ('safety', 'Safety', 2, 4)
on conflict (id) do nothing;

-- ── Games: quarterbacks ────────────────────────────────────────────────────
alter table public.games add column if not exists home_qb_id uuid references public.players (id);
alter table public.games add column if not exists away_qb_id uuid references public.players (id);

-- ── Clock second on score and stat lines (null = not recorded) ─────────────
alter table public.score_events add column if not exists clock_seconds integer
  check (clock_seconds between 0 and 3600);
alter table public.stat_events add column if not exists clock_seconds integer
  check (clock_seconds between 0 and 3600);

-- ── Substitutions and playing time (same safety as lineups) ────────────────
create table if not exists public.game_subs (
  id         uuid primary key default gen_random_uuid(), -- client-generated, idempotent
  game_id    uuid not null references public.games (id),
  team_id    uuid not null references public.teams (id),
  player_id  uuid not null references public.players (id),
  voided_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);
create index if not exists game_subs_game on public.game_subs (game_id);

create table if not exists public.player_minutes (
  id         uuid primary key default gen_random_uuid(), -- client-generated, idempotent
  game_id    uuid not null references public.games (id),
  player_id  uuid not null references public.players (id),
  minutes    numeric(4, 1) not null check (minutes between 0 and 60),
  voided_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);
create index if not exists player_minutes_game on public.player_minutes (game_id);

-- One live row per player per game. Voided rows do not count, so a mistake can be voided and re-entered.
create unique index if not exists game_subs_one_live on public.game_subs (game_id, player_id) where voided_at is null;
create unique index if not exists player_minutes_one_live on public.player_minutes (game_id, player_id) where voided_at is null;

-- RLS, stamps, history, member policies, grants (no delete), as in 006_lineups.
do $$
declare
  t text;
begin
  foreach t in array array['game_subs', 'player_minutes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists stamp on public.%I', t);
    execute format('create trigger stamp before insert or update on public.%I for each row execute function app_private.stamp()', t);
    execute format('drop trigger if exists history on public.%I', t);
    execute format('create trigger history after insert or update on public.%I for each row execute function app_private.record_history(%L)', t, 'id');
    execute format('drop policy if exists members_read on public.%I', t);
    execute format('create policy members_read on public.%I for select to authenticated using (app_private.is_member())', t);
    execute format('drop policy if exists members_add on public.%I', t);
    execute format('create policy members_add on public.%I for insert to authenticated with check (app_private.is_member())', t);
    execute format('drop policy if exists members_change on public.%I', t);
    execute format('create policy members_change on public.%I for update to authenticated using (app_private.is_member()) with check (app_private.is_member())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Live updates to open phones (same as lineups).
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['game_subs', 'player_minutes'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ===== Section 2: permissions and limits (Task 2) =====
-- Who can change what from Season 2 on:
--   • Profiles: you edit your own; Akiva (the owner) edits anyone's. Anyone can still add a guest.
--   • Game lines (stats, score, lineups, subs, minutes): anyone while the game is live or at
--     halftime; otherwise only Akiva and Eddie.
--   • A final game can only be reopened by Akiva or Eddie.
--   • Limits: no player can pass a stat's per-game limit; at most 30 score lines per team per game.
-- The SQL editor (no login) is never blocked, so the owner can always fix things by hand.

alter table public.member_logins
  add column if not exists is_owner boolean not null default false,
  add column if not exists must_change_password boolean not null default false;

update public.member_logins set is_owner = true
 where player_id in (select id from public.players where login_name = 'akiva') and not is_owner;

create or replace function app_private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner from public.member_logins where user_id = auth.uid()), false)
$$;

create or replace function app_private.my_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select player_id from public.member_logins where user_id = auth.uid()
$$;

create or replace function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_owner() or app_private.is_league_manager()
$$;

-- True when this login may add or change lines for this game.
create or replace function app_private.can_edit_game(p_game_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_admin()
      or exists (select 1 from public.games
                  where id = p_game_id and status in ('live', 'halftime') and voided_at is null)
$$;

-- Clears the "pick a new password" flag for the signed-in login only.
create or replace function public.clear_my_password_flag() returns void
language sql security definer set search_path = '' as $$
  update public.member_logins set must_change_password = false where user_id = auth.uid()
$$;

revoke all on function app_private.is_owner(), app_private.my_player_id(), app_private.is_admin(),
  app_private.can_edit_game(uuid), public.clear_my_password_flag() from public, anon;
grant execute on function app_private.is_owner(), app_private.my_player_id(), app_private.is_admin(),
  app_private.can_edit_game(uuid), public.clear_my_password_flag() to authenticated;

-- ── Profiles ────────────────────────────────────────────────────────────────
drop policy if exists members_add on public.players;
drop policy if exists members_change on public.players;
create policy members_add on public.players for insert to authenticated
  with check (app_private.is_member() and (app_private.is_owner() or (is_guest and login_name is null)));
create policy members_change on public.players for update to authenticated
  using (app_private.is_member() and (id = app_private.my_player_id() or app_private.is_owner()))
  with check (app_private.is_member() and (id = app_private.my_player_id() or app_private.is_owner()));

create or replace function app_private.guard_player_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not app_private.is_owner()
     and (new.is_guest is distinct from old.is_guest
          or new.login_name is distinct from old.login_name
          or new.voided_at is distinct from old.voided_at) then
    raise exception 'Only Akiva can change logins, guest status or remove a player.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_player_fields on public.players;
create trigger guard_player_fields before update on public.players
  for each row execute function app_private.guard_player_fields();

-- ── Game lines ──────────────────────────────────────────────────────────────
do $$
declare
  t text;
  rule text := 'app_private.is_member() and (case when game_id is null then app_private.is_admin()'
            || ' else app_private.can_edit_game(game_id) end)';
begin
  foreach t in array array['stat_events', 'score_events', 'lineups', 'game_subs', 'player_minutes'] loop
    execute format('drop policy if exists members_add on public.%I', t);
    execute format('drop policy if exists members_change on public.%I', t);
    execute format('create policy members_add on public.%I for insert to authenticated with check (%s)', t, rule);
    execute format('create policy members_change on public.%I for update to authenticated using (%s) with check (%s)', t, rule, rule);
  end loop;
end $$;

-- ── Finished games ──────────────────────────────────────────────────────────
-- Once a game is final, only Akiva or Eddie can change anything about it (reopen, void, swap
-- teams, change its kind). Only they can void a game or create one that is already final.
create or replace function app_private.guard_final_game() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or app_private.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'final' or new.voided_at is not null then
      raise exception 'Only Akiva or Eddie can add a finished game.' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.status = 'final' and (new.status, new.season_id, new.week, new.starts_at, new.field,
       new.home_team_id, new.away_team_id, new.home_slot, new.away_slot, new.kind, new.voided_at,
       new.home_qb_id, new.away_qb_id)
     is distinct from (old.status, old.season_id, old.week, old.starts_at, old.field,
       old.home_team_id, old.away_team_id, old.home_slot, old.away_slot, old.kind, old.voided_at,
       old.home_qb_id, old.away_qb_id) then
    raise exception 'Only Akiva or Eddie can reopen or change a finished game.' using errcode = '42501';
  end if;
  if new.voided_at is distinct from old.voided_at then
    raise exception 'Only Akiva or Eddie can remove a game.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_final_game on public.games;
create trigger guard_final_game before insert or update on public.games
  for each row execute function app_private.guard_final_game();

-- ── Stat rules (groups, limits, on/off) belong to Akiva and Eddie ──────────
create or replace function app_private.guard_stat_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not app_private.is_admin()
     and (new.max_per_game, new.stat_group, new.active)
         is distinct from (old.max_per_game, old.stat_group, old.active) then
    raise exception 'Only Akiva or Eddie can change stat limits.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_stat_rules on public.stat_types;
create trigger guard_stat_rules before update on public.stat_types
  for each row execute function app_private.guard_stat_rules();

-- ── Limits ──────────────────────────────────────────────────────────────────
-- The app reads "MLF_LIMIT:<label>:<max>" and shows a friendly message.
-- Two phones adding the same stat at the same moment wait for each other (advisory lock), so
-- both cannot slip past a limit. A player's total for a stat in a game stays between 0 and the
-- limit, so a negative correction ("type a new total") works but cannot cancel out the limit.
create or replace function app_private.check_stat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_max smallint;
  v_label text;
  v_total bigint;
begin
  if new.voided_at is not null or new.game_id is null then
    return new;
  end if;
  select max_per_game, label into v_max, v_label from public.stat_types where id = new.stat_type_id;
  perform pg_advisory_xact_lock(hashtextextended(
    'stat:' || new.game_id::text || ':' || coalesce(new.player_id::text, 'team:' || new.team_id::text)
    || ':' || new.stat_type_id, 0));
  select coalesce(sum(value), 0) into v_total
    from public.stat_events
   where game_id = new.game_id and stat_type_id = new.stat_type_id
     and voided_at is null and id <> new.id
     and (case when new.player_id is not null then player_id = new.player_id
               else player_id is null and team_id = new.team_id end);
  if v_max is not null and v_total + new.value > v_max then
    raise exception 'MLF_LIMIT:%:%', v_label, v_max using errcode = '23514';
  end if;
  if auth.uid() is not null and v_total + new.value < 0 then
    raise exception 'A total cannot go below 0.' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists check_stat_limit on public.stat_events;
create trigger check_stat_limit before insert or update on public.stat_events
  for each row execute function app_private.check_stat_limit();

create or replace function app_private.check_score_line_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.voided_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.voided_at is null
     and (new.game_id, new.team_id) is not distinct from (old.game_id, old.team_id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('score:' || new.game_id::text || ':' || new.team_id::text, 0));
  if (select count(*) from public.score_events
       where game_id = new.game_id and team_id = new.team_id and voided_at is null and id <> new.id) >= 30 then
    raise exception 'MLF_LIMIT:Score lines:30' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists check_score_line_limit on public.score_events;
create trigger check_score_line_limit before insert or update on public.score_events
  for each row execute function app_private.check_score_line_limit();

-- Akiva's login is the owner whenever it gets linked, even if that happens after this change.
create or replace function app_private.mark_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.players where id = new.player_id and login_name = 'akiva') then
    new.is_owner := true;
  end if;
  return new;
end $$;

drop trigger if exists mark_owner on public.member_logins;
create trigger mark_owner before insert on public.member_logins
  for each row execute function app_private.mark_owner();
