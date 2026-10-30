-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 005: stat fixes. Run once, after 004.
--
--   • Live stats reach every open phone instantly (stat_events joins Supabase Realtime).
--   • Score estimates use regular-season games only, like the standings.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stat_events') then
    alter publication supabase_realtime add table public.stat_events;
  end if;
end $$;

-- Per upcoming game: each side scores the average of its own points-for and the other side's
-- points-against (regular-season games only); the record nudges the win chance.
create or replace view public.game_projections with (security_invoker = true) as
with results as (
  select season_id, home_team_id as team_id, home_points as pf, away_points as pa
  from public.game_scores where status = 'final' and kind = 'regular' and home_team_id is not null and away_team_id is not null
  union all
  select season_id, away_team_id, away_points, home_points
  from public.game_scores where status = 'final' and kind = 'regular' and home_team_id is not null and away_team_id is not null
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
