-- 009: estimated points per game are per game again.
-- Before: a player with no tracked minutes got everything they had ever done divided by the games
-- their team has played THIS season. Season 2 has played none (counted as 1), so the "per game"
-- estimate was their whole career total. Now: what they did in the final games they played,
-- divided by how many games that was (any season). Tracked minutes still win when there are 2+.
-- Same columns and types as before, so the app needs no change. Safe to run more than once.

create or replace view public.player_projections with (security_invoker = true) as
with half as (
  select (select half_minutes from public.settings where id = 1) * 60 as secs
),
team_games as (
  select st.team_id, greatest(st.games_played, 1) as games
  from public.standings st join public.current_season cs on cs.id = st.season_id
),
-- Final games each player actually played: a stat line, a lineup spot, a sub, or typed-in minutes.
played as (
  select se.player_id, se.game_id from public.stat_events se
    join public.games g on g.id = se.game_id and g.status = 'final' and g.voided_at is null
    where se.voided_at is null and se.player_id is not null
  union
  select u.player_id, l.game_id from public.lineups l
    join public.games g on g.id = l.game_id and g.status = 'final' and g.voided_at is null
    cross join lateral unnest(l.on_field) as u(player_id)
    where l.voided_at is null
  union
  select s.player_id, s.game_id from public.game_subs s
    join public.games g on g.id = s.game_id and g.status = 'final' and g.voided_at is null
    where s.voided_at is null
  union
  select m.player_id, m.game_id from public.player_minutes m
    join public.games g on g.id = m.game_id and g.status = 'final' and g.voided_at is null
    where m.voided_at is null and m.minutes > 0
),
games_played as (
  select player_id, count(distinct game_id)::int as games from played group by player_id
),
-- What the player did in the games they played, any season.
game_stats as (
  select se.player_id,
    sum(se.value) filter (where se.stat_type_id = 'rec')::numeric as rec,
    sum(se.value) filter (where se.stat_type_id = 'td')::numeric as td,
    sum(se.value) filter (where se.stat_type_id = 'int')::numeric as int,
    sum(se.value * sty.fantasy_points)::numeric as points
  from public.stat_events se
  join public.games g on g.id = se.game_id and g.status = 'final' and g.voided_at is null
  join public.stat_types sty on sty.id = se.stat_type_id
  where se.voided_at is null and se.player_id is not null
  group by se.player_id
),
-- Everything the player has ever done, including old totals with no game (for the total, and as a
-- last resort for a player who has only old totals).
all_stats as (
  select se.player_id,
    sum(se.value) filter (where se.stat_type_id = 'rec')::numeric as rec,
    sum(se.value) filter (where se.stat_type_id = 'td')::numeric as td,
    sum(se.value) filter (where se.stat_type_id = 'int')::numeric as int,
    sum(se.value * sty.fantasy_points)::numeric as points
  from public.stat_events se join public.stat_types sty on sty.id = se.stat_type_id
  where se.voided_at is null and se.player_id is not null
  group by se.player_id
),
-- Lineup segments in final games: from one lineup change to the next (the last one runs to the game's final clock).
seg as (
  select l.game_id, l.team_id, l.on_field,
    (l.half - 1) * h.secs + greatest(0, h.secs - l.clock_seconds) as from_s,
    lead((l.half - 1) * h.secs + greatest(0, h.secs - l.clock_seconds))
      over (partition by l.game_id, l.team_id
            order by (l.half - 1) * h.secs + greatest(0, h.secs - l.clock_seconds), l.created_at) as next_s,
    (c.half - 1) * h.secs + greatest(0, h.secs - c.seconds_left) as game_end_s
  from public.lineups l
  join public.games g on g.id = l.game_id and g.status = 'final' and g.voided_at is null
  left join public.game_clocks c on c.game_id = l.game_id
  cross join half h
  where l.voided_at is null
),
tracked as (
  select game_id, team_id from seg group by game_id, team_id having min(from_s) <= 60
),
minutes as (
  select s.game_id, u.player_id,
    sum(greatest(coalesce(s.next_s, s.game_end_s) - s.from_s, 0)) as seconds
  from seg s
  join tracked t on t.game_id = s.game_id and t.team_id = s.team_id
  cross join lateral unnest(s.on_field) as u(player_id)
  where coalesce(s.next_s, s.game_end_s) is not null
  group by s.game_id, u.player_id
  having sum(greatest(coalesce(s.next_s, s.game_end_s) - s.from_s, 0)) > 0
),
latest as (
  select distinct on (m.player_id) m.player_id, m.seconds as latest_secs
  from minutes m join public.games g on g.id = m.game_id
  order by m.player_id, g.week desc, g.created_at desc
),
tracked_minutes as (
  select m.player_id, sum(m.seconds) as tracked_secs, count(*) as tracked_games from minutes m group by m.player_id
),
-- What the player did in just the tracked games.
tracked_stats as (
  select se.player_id,
    sum(se.value) filter (where se.stat_type_id = 'rec')::numeric as rec,
    sum(se.value) filter (where se.stat_type_id = 'td')::numeric as td,
    sum(se.value) filter (where se.stat_type_id = 'int')::numeric as int,
    sum(se.value * sty.fantasy_points)::numeric as points
  from public.stat_events se
  join minutes m on m.game_id = se.game_id and m.player_id = se.player_id
  join public.stat_types sty on sty.id = se.stat_type_id
  where se.voided_at is null
  group by se.player_id
),
scaled as (
  select tm.player_id, lt.latest_secs::numeric / tm.tracked_secs as factor,
    coalesce(ts.rec, 0) as rec, coalesce(ts.td, 0) as td, coalesce(ts.int, 0) as int, coalesce(ts.points, 0) as points
  from tracked_minutes tm
  join latest lt on lt.player_id = tm.player_id
  left join tracked_stats ts on ts.player_id = tm.player_id
  where tm.tracked_games >= 2
)
select
  cr.player_id,
  cr.team_id,
  coalesce(gp.games, tg.games) as games,
  round(case when sc.player_id is not null then sc.rec * sc.factor
             when gp.games > 0 then coalesce(gs.rec, 0) / gp.games
             else coalesce(a.rec, 0) / tg.games end, 1) as rec_per_game,
  round(case when sc.player_id is not null then sc.td * sc.factor
             when gp.games > 0 then coalesce(gs.td, 0) / gp.games
             else coalesce(a.td, 0) / tg.games end, 1) as td_per_game,
  round(case when sc.player_id is not null then sc.int * sc.factor
             when gp.games > 0 then coalesce(gs.int, 0) / gp.games
             else coalesce(a.int, 0) / tg.games end, 1) as int_per_game,
  round(coalesce(a.points, 0), 1) as points_total,
  round(case when sc.player_id is not null then sc.points * sc.factor
             when gp.games > 0 then coalesce(gs.points, 0) / gp.games
             else coalesce(a.points, 0) / tg.games end, 1) as points_per_game
from public.current_rosters cr
join team_games tg on tg.team_id = cr.team_id
left join all_stats a on a.player_id = cr.player_id
left join games_played gp on gp.player_id = cr.player_id
left join game_stats gs on gs.player_id = cr.player_id
left join scaled sc on sc.player_id = cr.player_id;
