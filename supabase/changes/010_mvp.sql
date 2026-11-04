-- 010: the MVP race.
--   • player_game_points: one row per player per final game they played, with their fantasy points
--     and what they did (for "player of the week" and the race). Read-only, built from stat rows.
--   • mvp_pins: Eddie (league manager) or Akiva (owner) can pin a player to a place in the race.
--     Everyone can read pins. Nothing is deleted: a pin is removed by voiding it.
-- Safe to run more than once.

-- ── Points per player per final game ───────────────────────────────────────
-- "Played" is the same as in 009 (a stat, a lineup spot, a sub, typed-in minutes), plus being a
-- game's quarterback.
create or replace view public.player_game_points with (security_invoker = true) as
with final_games as (
  select id, season_id, week, starts_at, home_qb_id, away_qb_id
  from public.games where status = 'final' and voided_at is null
),
played as (
  select se.player_id, se.game_id from public.stat_events se
    join final_games g on g.id = se.game_id
    where se.voided_at is null and se.player_id is not null
  union
  select u.player_id, l.game_id from public.lineups l
    join final_games g on g.id = l.game_id
    cross join lateral unnest(l.on_field) as u(player_id)
    where l.voided_at is null
  union
  select s.player_id, s.game_id from public.game_subs s
    join final_games g on g.id = s.game_id
    where s.voided_at is null
  union
  select m.player_id, m.game_id from public.player_minutes m
    join final_games g on g.id = m.game_id
    where m.voided_at is null and m.minutes > 0
  union
  select q.player_id, g.id from final_games g
    cross join lateral (values (g.home_qb_id), (g.away_qb_id)) as q(player_id)
    where q.player_id is not null
),
per_stat as (
  select se.player_id, se.game_id, se.stat_type_id, sum(se.value)::numeric as value,
    sum(se.value * sty.fantasy_points)::numeric as points
  from public.stat_events se
  join final_games g on g.id = se.game_id
  join public.stat_types sty on sty.id = se.stat_type_id
  where se.voided_at is null and se.player_id is not null
  group by se.player_id, se.game_id, se.stat_type_id
)
select p.player_id, p.game_id, g.season_id, g.week, g.starts_at,
  coalesce(sum(ps.points), 0)::numeric as points,
  coalesce(jsonb_object_agg(ps.stat_type_id, ps.value) filter (where ps.stat_type_id is not null), '{}'::jsonb) as stats
from played p
join final_games g on g.id = p.game_id
left join per_stat ps on ps.player_id = p.player_id and ps.game_id = p.game_id
group by p.player_id, p.game_id, g.season_id, g.week, g.starts_at;

revoke all on public.player_game_points from anon;
grant select on public.player_game_points to authenticated;

-- ── MVP pins ───────────────────────────────────────────────────────────────
create table if not exists public.mvp_pins (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id),
  player_id  uuid not null references public.players (id),
  place      smallint not null check (place between 1 and 50),
  pinned_by  uuid references public.players (id),
  voided_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz, updated_by uuid
);
create index if not exists mvp_pins_season on public.mvp_pins (season_id);
-- One live pin per player and one per place, per season.
create unique index if not exists mvp_pins_one_player on public.mvp_pins (season_id, player_id) where voided_at is null;
create unique index if not exists mvp_pins_one_place on public.mvp_pins (season_id, place) where voided_at is null;

-- Who pinned it is always the person signed in, so the screen can say "Set by Eddie".
create or replace function app_private.mvp_pin_who() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.pinned_by := coalesce(app_private.my_player_id(), new.pinned_by);
  return new;
end $$;
revoke all on function app_private.mvp_pin_who() from public, anon, authenticated;

drop trigger if exists who on public.mvp_pins;
create trigger who before insert or update on public.mvp_pins for each row execute function app_private.mvp_pin_who();

alter table public.mvp_pins enable row level security;
drop trigger if exists stamp on public.mvp_pins;
create trigger stamp before insert or update on public.mvp_pins for each row execute function app_private.stamp();
drop trigger if exists history on public.mvp_pins;
create trigger history after insert or update on public.mvp_pins for each row execute function app_private.record_history('id');

drop policy if exists members_read on public.mvp_pins;
create policy members_read on public.mvp_pins for select to authenticated using (app_private.is_member());
drop policy if exists admins_add on public.mvp_pins;
create policy admins_add on public.mvp_pins for insert to authenticated with check (app_private.is_admin());
drop policy if exists admins_change on public.mvp_pins;
create policy admins_change on public.mvp_pins for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

revoke all on public.mvp_pins from anon;
grant select, insert, update on public.mvp_pins to authenticated;
revoke delete, truncate on public.mvp_pins from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mvp_pins') then
    alter publication supabase_realtime add table public.mvp_pins;
  end if;
end $$;
