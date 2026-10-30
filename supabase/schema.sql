-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 001: the Phase 1a schema.
-- Source of truth: docs/checkpoint-0-database-plan.md.
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run once on an empty project.
--
-- The rules this file enforces:
--   • Logged out = nothing. Logged in but not linked to a player = nothing.
--   • Linked members can read everything and add or change rows. Nobody can DELETE: use voided_at.
--   • Every insert and update is copied to edit_history automatically (who, when, before, after).
--   • Stats and scores are event rows; totals are views. Views run with the caller's rights.
-- Phase 1b+ tables (game clock, attendance, injuries, news, MVP…) come in later change files.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Private helper schema (not exposed through the Data API) ────────────────
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Login names become fake email addresses: "leo" → "leo@mlf.invalid". One place to change it.
create or replace function app_private.login_domain() returns text
language sql immutable as $$ select 'mlf.invalid' $$;

-- ── League setup ────────────────────────────────────────────────────────────
create table public.settings (
  id               smallint primary key default 1 check (id = 1), -- exactly one row
  half_minutes     smallint not null default 10 check (half_minutes between 1 and 60),
  halftime_minutes smallint not null default 7 check (halftime_minutes between 0 and 30),
  overtime_rule    text,                                  -- still to be confirmed by Akiva
  default_field    text not null default 'Marine Park',
  time_zone        text not null default 'America/New_York',
  games_per_week   smallint check (games_per_week > 0),   -- optional, not enforced
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

create table public.seasons (
  id        uuid primary key default gen_random_uuid(),
  name      text not null check (length(name) between 1 and 80),
  starts_on date,
  ends_on   date check (ends_on is null or starts_on is null or ends_on >= starts_on),
  status    text not null default 'regular' check (status in ('regular', 'playoffs', 'finished')),
  counts_for_standings boolean not null default true,  -- false for "Earlier totals"
  games_planned smallint check (games_planned > 0),
  voided_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

create table public.scoring_types (
  id            text primary key check (id ~ '^[a-z0-9_]{1,32}$'),
  label         text not null,
  points        smallint check (points >= 0),  -- null = typed by hand (imported final scores)
  display_order smallint not null default 0,
  active        boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

create table public.stat_types (
  id            text primary key check (id ~ '^[a-z0-9_]{1,32}$'),
  label         text not null,
  display_order smallint not null default 0,  -- only the league manager may change this
  active        boolean not null default true,
  team_level    boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

-- ── People and teams ────────────────────────────────────────────────────────
create table public.players (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (length(full_name) between 1 and 80),
  nickname     text check (length(nickname) between 1 and 40),
  login_name   text unique check (login_name ~ '^[a-z][a-z0-9_-]{1,31}$'),
  jersey       smallint check (jersey between 0 and 99),  -- 0 allowed, blank allowed
  positions    text[] not null default '{}',
  birth_year   smallint check (birth_year between 1950 and 2030), -- year only, never a full date
  height_in    numeric(4, 1) check (height_in between 36 and 96),  -- 65.5 = 5'5.5"
  weight_lb    smallint check (weight_lb between 50 and 400),
  photo_path   text,
  achievements text not null default '' check (length(achievements) <= 2000),
  is_guest     boolean not null default false,
  voided_at    timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint guests_have_no_login check (not is_guest or login_name is null)
);

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(name) between 1 and 40),
  short_name text not null check (length(short_name) between 1 and 12),
  color_key  text not null check (color_key in ('demons', 'daybies', 'tigers')), -- names a token in tokens.css
  logo_path  text,
  voided_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

-- Which player is on which team, and when. A move closes one line and opens another.
create table public.roster_memberships (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id),
  team_id   uuid not null references public.teams (id),
  starts_on date not null default current_date,
  ends_on   date,
  note      text check (length(note) <= 500),
  voided_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint ends_after_start check (ends_on is null or ends_on >= starts_on)
);
create unique index one_open_team_per_player on public.roster_memberships (player_id)
  where ends_on is null and voided_at is null;

-- One login per player. Written only by the database itself (auto-link) or the owner in the dashboard.
create table public.member_logins (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  player_id         uuid not null unique references public.players (id),
  is_league_manager boolean not null default false,
  linked_at         timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

-- ── Games ───────────────────────────────────────────────────────────────────
create table public.games (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons (id),
  week         smallint check (week between 1 and 99),
  starts_at    timestamptz,  -- null = date not set yet
  field        text check (length(field) <= 80), -- null = settings.default_field
  home_team_id uuid references public.teams (id),
  away_team_id uuid references public.teams (id),
  home_slot    text check (home_slot ~ '^rank:[0-9]{1,2}$'), -- playoff final: "rank:1"
  away_slot    text check (away_slot ~ '^rank:[0-9]{1,2}$'),
  status       text not null default 'scheduled' check (status in ('scheduled', 'live', 'halftime', 'final')),
  kind         text not null default 'regular' check (kind in ('regular', 'playoff')),
  voided_at    timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint two_different_teams check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  constraint each_side_known check ((home_team_id is not null or home_slot is not null)
                                and (away_team_id is not null or away_slot is not null))
);
create index games_season_starts on public.games (season_id, starts_at);

-- The official score: one line per score press. Current score = sum of non-voided lines.
create table public.score_events (
  id              uuid primary key default gen_random_uuid(), -- phones send their own id, so a resend can't double count
  game_id         uuid not null references public.games (id),
  team_id         uuid not null references public.teams (id),
  scoring_type_id text not null references public.scoring_types (id),
  points          smallint not null check (points between 0 and 200),
  player_id       uuid references public.players (id),
  voided_at       timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);
create index score_events_game on public.score_events (game_id);

-- Stats: the heart of the system. Never running totals.
create table public.stat_events (
  id           uuid primary key default gen_random_uuid(), -- client-generated, idempotent
  season_id    uuid not null references public.seasons (id),
  game_id      uuid references public.games (id),  -- null only for "Earlier totals" lines
  team_id      uuid references public.teams (id),
  player_id    uuid references public.players (id),
  stat_type_id text not null references public.stat_types (id),
  value        integer not null check (value <> 0 and value between -999 and 999),
  half         smallint check (half in (1, 2, 3)),  -- 3 = overtime
  voided_at    timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid,
  constraint credited_to_someone check (player_id is not null or team_id is not null)
);
create index stat_events_game on public.stat_events (game_id);
create index stat_events_player on public.stat_events (player_id, season_id);

-- Hand-entered extra wins/losses/ties, only to match the league's older unrecorded results.
create table public.record_adjustments (
  id        uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  team_id   uuid not null references public.teams (id),
  wins      smallint not null default 0 check (wins >= 0),
  losses    smallint not null default 0 check (losses >= 0),
  ties      smallint not null default 0 check (ties >= 0),
  note      text not null check (length(note) between 1 and 500),
  voided_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);

-- ── Safety: edit history ────────────────────────────────────────────────────
create table public.edit_history (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text not null,
  action     text not null check (action in ('insert', 'update')),
  before     jsonb,
  after      jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index edit_history_row on public.edit_history (table_name, row_id, changed_at desc);

-- ── Who is who ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER so policies can ask without tripping member_logins' own policy.
create or replace function app_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_logins where user_id = auth.uid())
$$;

-- The one role check for Eddie's powers. Add a power by using this in a policy or trigger.
create or replace function app_private.is_league_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_league_manager from public.member_logins where user_id = auth.uid()), false)
$$;

-- ── Automatic stamps and history ────────────────────────────────────────────
-- Fills created_by / updated_by from the login, and stops anyone rewriting who created a row.
create or replace function app_private.stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
    new.updated_at := null;
    new.updated_by := null;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

create or replace function app_private.record_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  key_column text := tg_argv[0];
begin
  insert into public.edit_history (table_name, row_id, action, before, after, changed_by)
  values (
    tg_table_name,
    to_jsonb(new) ->> key_column,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    auth.uid()
  );
  return null;
end $$;

-- Stat order on profiles belongs to the league manager (the owner in the SQL editor has no login, so is allowed).
create or replace function app_private.guard_stat_order() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and new.display_order is distinct from old.display_order
     and not app_private.is_league_manager() then
    raise exception 'Only the league manager can change the stat order.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_stat_order before update on public.stat_types
  for each row execute function app_private.guard_stat_order();

-- ── Row Level Security, privileges, stamps and history on every table ───────
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('settings', 'id'), ('seasons', 'id'), ('scoring_types', 'id'), ('stat_types', 'id'),
      ('players', 'id'), ('teams', 'id'), ('roster_memberships', 'id'), ('member_logins', 'user_id'),
      ('games', 'id'), ('score_events', 'id'), ('stat_events', 'id'), ('record_adjustments', 'id')
    ) as v(name, key_column)
  loop
    execute format('alter table public.%I enable row level security', t.name);
    execute format('create trigger stamp before insert or update on public.%I for each row execute function app_private.stamp()', t.name);
    execute format('create trigger history after insert or update on public.%I for each row execute function app_private.record_history(%L)', t.name, t.key_column);
  end loop;
end $$;

alter table public.edit_history enable row level security;

-- Nobody outside a login gets anything. Nobody inside can delete or truncate.
-- Grants are explicit so this works whether or not "expose new tables" was ticked at project setup.
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
revoke insert, update on public.edit_history, public.member_logins from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke delete, truncate on tables from authenticated;

-- Members (linked logins): read everything, add and change rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'seasons', 'scoring_types', 'stat_types', 'players', 'teams',
    'roster_memberships', 'games', 'score_events', 'stat_events', 'record_adjustments'
  ]
  loop
    execute format('create policy members_read on public.%I for select to authenticated using (app_private.is_member())', t);
    execute format('create policy members_add on public.%I for insert to authenticated with check (app_private.is_member())', t);
    execute format('create policy members_change on public.%I for update to authenticated using (app_private.is_member()) with check (app_private.is_member())', t);
  end loop;
end $$;

-- A login can always see its own link (to tell "linked" from "not linked"); members see all links.
create policy read_links on public.member_logins for select to authenticated
  using (user_id = auth.uid() or app_private.is_member());

create policy members_read on public.edit_history for select to authenticated
  using (app_private.is_member());

-- ── Calculations (views). security_invoker = the caller's rules apply. ──────
create view public.game_scores with (security_invoker = true) as
select
  g.id as game_id, g.season_id, g.status, g.kind, g.starts_at,
  g.home_team_id, g.away_team_id,
  coalesce(sum(se.points) filter (where se.team_id = g.home_team_id), 0)::int as home_points,
  coalesce(sum(se.points) filter (where se.team_id = g.away_team_id), 0)::int as away_points
from public.games g
left join public.score_events se on se.game_id = g.id and se.voided_at is null
where g.voided_at is null
group by g.id;

-- Standings: final regular-season games plus record adjustments (the playoff final never changes the table). A tie counts half.
-- Order: win %, point difference, points scored. Head-to-head comes first in Phase 2 (standings screen).
create view public.standings with (security_invoker = true) as
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

create view public.player_stat_totals with (security_invoker = true) as
select season_id, player_id, stat_type_id, sum(value)::int as total
from public.stat_events
where voided_at is null and player_id is not null
group by season_id, player_id, stat_type_id;

create view public.current_rosters with (security_invoker = true) as
select rm.id as membership_id, rm.player_id, rm.team_id, rm.starts_on
from public.roster_memberships rm
where rm.ends_on is null and rm.voided_at is null;

revoke all on public.game_scores, public.standings, public.player_stat_totals, public.current_rosters from anon;
grant select on public.game_scores, public.standings, public.player_stat_totals, public.current_rosters to authenticated;

-- ── Actions ─────────────────────────────────────────────────────────────────
-- Link a login to the player with the same login name. Only confirmed logins (the owner ticks
-- "auto confirm"), so a stranger who signed up with someone's name can never take their profile.
create or replace function app_private.link_user(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_player uuid;
begin
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = p_user_id;
  if v_email is null or v_confirmed is null
     or split_part(v_email, '@', 2) <> app_private.login_domain() then
    return null;
  end if;
  select id into v_player from public.players
    where login_name = lower(split_part(v_email, '@', 1)) and not is_guest and voided_at is null;
  if v_player is null then
    return null;
  end if;
  insert into public.member_logins (user_id, player_id) values (p_user_id, v_player)
    on conflict do nothing;
  return (select player_id from public.member_logins where user_id = p_user_id);
end $$;

create or replace function app_private.link_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.link_user(new.id);
  return null;
end $$;

create trigger link_to_player after insert or update of email_confirmed_at on auth.users
  for each row execute function app_private.link_new_user();

-- "Match my login to my player profile" (for a profile created after the login).
create or replace function public.link_my_login() returns uuid
language sql security definer set search_path = '' as $$
  select app_private.link_user(auth.uid())
$$;

-- Move a player to another team (or to no team) from a date. Keeps the old line as history.
create or replace function public.move_player(p_player_id uuid, p_team_id uuid, p_on date default current_date)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not app_private.is_member() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.roster_memberships
    set ends_on = p_on
    where player_id = p_player_id and ends_on is null and voided_at is null;
  if p_team_id is not null then
    insert into public.roster_memberships (player_id, team_id, starts_on) values (p_player_id, p_team_id, p_on);
  end if;
end $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema app_private from public, anon;
grant execute on function public.link_my_login(), public.move_player(uuid, uuid, date) to authenticated;
grant execute on function app_private.is_member(), app_private.is_league_manager() to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 002: league settings, scoring types and stat types (no personal data).
-- Paste into Supabase → SQL Editor → Run, after 001. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.scoring_types (id, label, points, display_order) values
  ('td',           'Touchdown',                    6,    1),
  ('conv1',        '1-point conversion',           1,    2),
  ('conv2',        '2-point conversion',           2,    3),
  ('final_manual', 'Final score (entered by hand)', null, 99)
on conflict (id) do nothing;

insert into public.stat_types (id, label, display_order) values
  ('rec',      'Receptions',                              1),
  ('target',   'Targets',                                 2),
  ('drop',     'Drops',                                   3),
  ('td',       'Touchdowns',                              4),
  ('fumble',   'Fumbles',                                 5),
  ('int',      'Interceptions',                           6),
  ('pick6',    'Pick 6',                                  7),
  ('conv1',    '1-point conversion',                      8),
  ('conv2',    '2-point conversion',                      9),
  ('block',    'Blocks',                                  10),
  ('conv_old', 'Conversion (old sheet, 1 or 2 pt not split)', 11)
on conflict (id) do nothing;
-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 003: game clock, final-score entry, trades, fantasy points, projections.
-- Paste the whole file into Supabase → SQL Editor → Run, after 001 and 002. Run it once.
--
--   • game_clocks: one row per game. Stores only state changes (started at / seconds left),
--     never a ticking number. Phones work out the countdown with server time.
--   • set_final_score(): types in a final score in one step (old score lines are voided, not deleted).
--   • trades + make_trade(): swaps players between two teams and keeps a record.
--   • stat_types.fantasy_points: how many MLF points each stat is worth (members can change it).
--   • player_projections / game_projections: estimates, worked out here so the app never disagrees with itself.
-- ════════════════════════════════════════════════════════════════════════════

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
