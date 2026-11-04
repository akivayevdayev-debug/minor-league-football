-- 011: QB stats score fantasy points (ESPN standard; Akiva, 2026-11-04).
--   Passing touchdown +4, QB rushing touchdown +6, interception thrown -2.
--   Fumbles already cost -2 for everyone (QBs too), so "fumble lost" stays 0 to avoid charging twice.
--   Completions, incompletions and first downs stay 0.
-- Points are worked out from stat rows each time, so past games use the new values too.
-- Safe to run more than once.
update public.stat_types set fantasy_points = v.points
from (values ('pass_td', 4.0), ('qb_rush_td', 6.0), ('int_thrown', -2.0)) as v(id, points)
where stat_types.id = v.id and stat_types.fantasy_points is distinct from v.points;
