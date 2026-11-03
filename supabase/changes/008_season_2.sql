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

-- ===== Section 3: trades and captains (Task 12) =====
-- • A team can have two captains (David's team: David and Ilan while David can't play).
-- • A captain changes their own team's name, short name and logo. Akiva changes any team.
-- • A captain proposes a trade between their own team and another. It waits as "pending" until
--   Eddie or Maurice answers: the first answer decides (approve moves the players, veto cancels).
--   Akiva can do anything. Vetoed trades stay in the history.
-- • Rosters change only through an approved trade, or by Akiva or Eddie directly.

alter table public.teams add column if not exists co_captain_player_id uuid references public.players (id);

alter table public.trades
  add column if not exists status text not null default 'approved',
  add column if not exists proposed_by uuid references public.players (id),
  add column if not exists decided_by uuid references public.players (id),
  add column if not exists decided_at timestamptz;
alter table public.trades alter column status set default 'pending';
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades add constraint trades_status_check check (status in ('pending', 'approved', 'vetoed'));

-- True when this login captains that team (either captain slot).
create or replace function app_private.is_captain_of(p_team_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.my_player_id() is not null and exists (
    select 1 from public.teams
     where id = p_team_id and voided_at is null
       and app_private.my_player_id() in (captain_player_id, co_captain_player_id))
$$;

-- Eddie (the league manager) and Maurice answer trades.
create or replace function app_private.can_decide_trades() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member_logins ml join public.players p on p.id = ml.player_id
     where ml.user_id = auth.uid() and (ml.is_league_manager or p.login_name = 'maurice'))
$$;

revoke all on function app_private.is_captain_of(uuid), app_private.can_decide_trades() from public, anon;
grant execute on function app_private.is_captain_of(uuid), app_private.can_decide_trades() to authenticated;

-- ── Teams ───────────────────────────────────────────────────────────────────
drop policy if exists members_add on public.teams;
drop policy if exists members_change on public.teams;
create policy members_add on public.teams for insert to authenticated
  with check (app_private.is_admin());
create policy members_change on public.teams for update to authenticated
  using (app_private.is_owner() or app_private.is_captain_of(id))
  with check (app_private.is_owner() or app_private.is_captain_of(id));

-- A captain may change only the name, short name, logo and team photo.
create or replace function app_private.guard_team_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not app_private.is_owner()
     and (new.season_id is distinct from old.season_id
          or new.color_key is distinct from old.color_key
          or new.captain_player_id is distinct from old.captain_player_id
          or new.co_captain_player_id is distinct from old.co_captain_player_id
          or new.voided_at is distinct from old.voided_at) then
    raise exception 'Captains can change the team name, short name and logo. Ask Akiva for anything else.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_team_fields on public.teams;
create trigger guard_team_fields before update on public.teams
  for each row execute function app_private.guard_team_fields();

-- ── Rosters: only Akiva or Eddie directly; everyone else through a trade ────
drop policy if exists members_add on public.roster_memberships;
drop policy if exists members_change on public.roster_memberships;
create policy members_add on public.roster_memberships for insert to authenticated
  with check (app_private.is_admin());
create policy members_change on public.roster_memberships for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

-- ── Trades: written only through the functions below (Akiva may also fix a row) ──
drop policy if exists members_add on public.trades;
drop policy if exists members_change on public.trades;
drop policy if exists owner_add on public.trades;
drop policy if exists owner_change on public.trades;
create policy owner_add on public.trades for insert to authenticated
  with check (app_private.is_owner());
create policy owner_change on public.trades for update to authenticated
  using (app_private.is_owner()) with check (app_private.is_owner());

-- Checks a trade's teams and players. Every player must be on that team right now.
create or replace function app_private.check_trade(
  p_team_a uuid, p_players_a uuid[], p_team_b uuid, p_players_b uuid[]
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_wrong int;
begin
  if p_team_a is null or p_team_b is null or p_team_a = p_team_b then
    raise exception 'Pick two different teams.' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_players_a, '{}')) + cardinality(coalesce(p_players_b, '{}')) = 0 then
    raise exception 'Pick at least one player to trade.' using errcode = '22023';
  end if;
  if (select count(distinct season_id) from public.teams
       where id in (p_team_a, p_team_b) and voided_at is null) <> 1
     or (select count(*) from public.teams where id in (p_team_a, p_team_b) and voided_at is null) <> 2 then
    raise exception 'Both teams must be in the same season.' using errcode = '22023';
  end if;
  select count(*) into v_wrong from (
    select unnest(coalesce(p_players_a, '{}')) as player_id, p_team_a as team_id
    union all
    select unnest(coalesce(p_players_b, '{}')), p_team_b
  ) want
  where not exists (
    select 1 from public.roster_memberships rm
     where rm.player_id = want.player_id and rm.team_id = want.team_id
       and rm.ends_on is null and rm.voided_at is null);
  if v_wrong > 0 then
    raise exception 'Someone in this trade is not on that team any more.' using errcode = '22023';
  end if;
end $$;

-- Moves the players of an approved trade. The move date is never before anyone's current roster line.
create or replace function app_private.apply_trade(p_trade_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.trades;
  v_on date;
  v_moving uuid[];
begin
  select * into t from public.trades where id = p_trade_id;
  perform app_private.check_trade(t.team_a_id, t.players_a, t.team_b_id, t.players_b);
  v_moving := t.players_a || t.players_b;
  select greatest(t.traded_on, coalesce(max(starts_on), t.traded_on)) into v_on
    from public.roster_memberships
   where player_id = any (v_moving) and ends_on is null and voided_at is null;
  update public.roster_memberships set ends_on = v_on
   where player_id = any (v_moving) and ends_on is null and voided_at is null;
  insert into public.roster_memberships (player_id, team_id, starts_on, note)
    select unnest(t.players_a), t.team_b_id, v_on, 'Trade'
    union all
    select unnest(t.players_b), t.team_a_id, v_on, 'Trade';
  update public.trades set traded_on = v_on where id = p_trade_id;
end $$;

-- A captain (or Akiva) proposes a trade. It waits for Eddie or Maurice.
create or replace function public.propose_trade(
  p_team_a uuid, p_players_a uuid[], p_team_b uuid, p_players_b uuid[], p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not app_private.is_member() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if not (app_private.is_owner() or app_private.is_captain_of(p_team_a)) then
    raise exception 'Only a team''s captain can offer a trade for that team.' using errcode = '42501';
  end if;
  perform app_private.check_trade(p_team_a, p_players_a, p_team_b, p_players_b);
  if length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;
  insert into public.trades (team_a_id, team_b_id, players_a, players_b, note, status, proposed_by)
    values (p_team_a, p_team_b, coalesce(p_players_a, '{}'), coalesce(p_players_b, '{}'),
            nullif(trim(p_note), ''), 'pending', app_private.my_player_id())
    returning id into v_id;
  return v_id;
end $$;

-- Eddie, Maurice or Akiva answers a pending trade. The first answer decides.
create or replace function public.decide_trade(p_trade_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.trades;
begin
  if not (app_private.can_decide_trades() or app_private.is_owner()) then
    raise exception 'Only Eddie or Maurice can approve or veto a trade.' using errcode = '42501';
  end if;
  select * into t from public.trades where id = p_trade_id and voided_at is null for update;
  if t.id is null then
    raise exception 'That trade was not found.' using errcode = '22023';
  end if;
  if t.status <> 'pending' then
    raise exception 'This trade was already %.', t.status using errcode = '22023';
  end if;
  if p_approve then
    -- Players move from the day it is approved, not the day it was offered.
    update public.trades set traded_on = greatest(traded_on, current_date) where id = p_trade_id;
    perform app_private.apply_trade(p_trade_id);
  end if;
  update public.trades
     set status = case when p_approve then 'approved' else 'vetoed' end,
         decided_by = app_private.my_player_id(), decided_at = now()
   where id = p_trade_id;
end $$;

-- Akiva's direct trade: happens at once, no approval needed. Same arguments as before.
create or replace function public.make_trade(
  p_team_a uuid, p_players_a uuid[], p_team_b uuid, p_players_b uuid[], p_on date default current_date, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not app_private.is_owner() then
    raise exception 'Trades go through a captain and need Eddie or Maurice to approve them.' using errcode = '42501';
  end if;
  perform app_private.check_trade(p_team_a, p_players_a, p_team_b, p_players_b);
  insert into public.trades (traded_on, team_a_id, team_b_id, players_a, players_b, note, status, proposed_by, decided_by, decided_at)
    values (coalesce(p_on, current_date), p_team_a, p_team_b, coalesce(p_players_a, '{}'), coalesce(p_players_b, '{}'),
            nullif(trim(p_note), ''), 'pending', app_private.my_player_id(), null, null)
    returning id into v_id;
  perform app_private.apply_trade(v_id);
  update public.trades set status = 'approved', decided_by = app_private.my_player_id(), decided_at = now() where id = v_id;
  return v_id;
end $$;

-- Akiva or Eddie moves one player (or takes them off a team). Before a season starts the move
-- happens on the first day of their roster line, so the line never ends before it began.
create or replace function public.move_player(p_player_id uuid, p_team_id uuid, p_on date default current_date)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_on date;
begin
  if not app_private.is_admin() then
    raise exception 'Only Akiva or Eddie can move a player. Captains can offer a trade instead.' using errcode = '42501';
  end if;
  select greatest(coalesce(p_on, current_date), coalesce(max(starts_on), p_on)) into v_on
    from public.roster_memberships
   where player_id = p_player_id and ends_on is null and voided_at is null;
  update public.roster_memberships set ends_on = v_on
   where player_id = p_player_id and ends_on is null and voided_at is null;
  if p_team_id is not null then
    insert into public.roster_memberships (player_id, team_id, starts_on) values (p_player_id, p_team_id, v_on);
  end if;
end $$;

revoke all on function app_private.check_trade(uuid, uuid[], uuid, uuid[]), app_private.apply_trade(uuid) from public, anon, authenticated;
revoke all on function public.propose_trade(uuid, uuid[], uuid, uuid[], text), public.decide_trade(uuid, boolean),
  public.make_trade(uuid, uuid[], uuid, uuid[], date, text) from public, anon;
grant execute on function public.propose_trade(uuid, uuid[], uuid, uuid[], text), public.decide_trade(uuid, boolean),
  public.make_trade(uuid, uuid[], uuid, uuid[], date, text) to authenticated;

-- ===== Section 4: owner tools (Task 13) =====
-- Signs logins out on every phone by ending their sessions. Only the "owner-tools" server function
-- can call this (it runs with the secret key Supabase holds); no app login can.
create or replace function public.owner_end_sessions(p_user_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = any (p_user_ids);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.owner_end_sessions(uuid[]) from public, anon, authenticated;
grant execute on function public.owner_end_sessions(uuid[]) to service_role;

-- Akiva's Undo in the edit history. A change puts the row back as it was before; an added row is
-- voided (nothing is ever deleted). The undo itself is recorded in the history like any change.
create or replace function public.owner_undo_change(p_history_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  h public.edit_history;
  v_key text;
  v_cols text;
  n integer;
begin
  if not app_private.is_owner() then
    raise exception 'Only Akiva can undo changes.' using errcode = '42501';
  end if;
  select * into h from public.edit_history where id = p_history_id;
  if h.id is null then
    raise exception 'That change was not found.' using errcode = '22023';
  end if;
  if h.table_name = 'member_logins' or not exists (
    select 1 from pg_catalog.pg_trigger tg
      join pg_catalog.pg_class c on c.oid = tg.tgrelid
      join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relname = h.table_name and tg.tgname = 'history') then
    raise exception 'That change can''t be undone here.' using errcode = '22023';
  end if;
  v_key := case h.table_name when 'game_clocks' then 'game_id' else 'id' end;

  if h.action = 'update' then
    select string_agg(format('%I', column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = h.table_name
       and column_name not in (v_key, 'created_at', 'created_by', 'updated_at', 'updated_by')
       and is_generated = 'NEVER' and is_identity = 'NO';
    execute format('update public.%1$I t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where t.%3$I::text = $2',
                   h.table_name, v_cols, v_key)
      using h.before, h.row_id;
  else
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = h.table_name and column_name = 'voided_at') then
      raise exception 'That added row can''t be taken away (nothing is ever deleted).' using errcode = '22023';
    end if;
    execute format('update public.%I set voided_at = now() where %I::text = $1 and voided_at is null', h.table_name, v_key)
      using h.row_id;
  end if;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Nothing to undo: that row was already changed back or removed.' using errcode = '22023';
  end if;
end $$;

revoke all on function public.owner_undo_change(bigint) from public, anon;
grant execute on function public.owner_undo_change(bigint) to authenticated;
