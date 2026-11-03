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
