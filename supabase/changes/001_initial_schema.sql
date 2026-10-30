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

-- Standings: final games plus record adjustments. A tie counts half.
-- Order: win %, point difference, points scored. Head-to-head comes first in Phase 2 (standings screen).
create view public.standings with (security_invoker = true) as
with results as (
  select season_id, home_team_id as team_id, home_points as pf, away_points as pa
  from public.game_scores where status = 'final' and home_team_id is not null and away_team_id is not null
  union all
  select season_id, away_team_id, away_points, home_points
  from public.game_scores where status = 'final' and home_team_id is not null and away_team_id is not null
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
