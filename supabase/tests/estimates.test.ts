/*
 * Estimated points per game (migration 009), tested on a local Postgres (PGlite).
 * Proves: the estimate is what a player did in the games they played, divided by those games,
 * even when their new team has played no games yet; a game they played without a stat still counts;
 * games that aren't final don't count; and a player with only old totals keeps the old fallback.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, sql } from './helpers'

const SEASON_1 = '20000000-0000-0000-0000-000000000001'
const OLD_A = '10000000-0000-0000-0000-000000000001'
const OLD_B = '10000000-0000-0000-0000-000000000002'
const NEW_TEAM = '10000000-0000-0000-0000-000000000009'
const G1 = '30000000-0000-0000-0000-000000000001'
const G2 = '30000000-0000-0000-0000-000000000002'
const G3 = '30000000-0000-0000-0000-000000000003'
const G_LIVE = '30000000-0000-0000-0000-000000000004'
const SAM = '40000000-0000-0000-0000-000000000001'
const OLDIE = '40000000-0000-0000-0000-000000000002'

let db: PGlite
let points: Record<string, number> = {}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of [
    '001_initial_schema.sql',
    '002_reference_data.sql',
    '003_game_night_trades_projections.sql',
    '004_photos.sql',
    '005_stat_fixes.sql',
    '006_lineups.sql',
    '007_minutes_projections.sql',
  ]) {
    await db.exec(sql(file))
  }
  await db.exec(`
    insert into public.players (id, full_name) values ('${SAM}', 'Sam Test'), ('${OLDIE}', 'Old Test');
    insert into public.seasons (id, name) values ('${SEASON_1}', '2026 season');
    insert into public.teams (id, name, short_name, color_key) values
      ('${OLD_A}', 'Tigers', 'TIG', 'tigers'), ('${OLD_B}', 'Speed Demons', 'SD', 'demons');
  `)
  await db.exec(sql('008_season_2.sql'))
  const season2 = (await db.query<{ id: string }>(`select id from public.seasons where name = 'Season 2'`)).rows[0]?.id
  points = Object.fromEntries(
    (await db.query<{ id: string; fantasy_points: string }>(`select id, fantasy_points from public.stat_types`)).rows.map((r) => [
      r.id,
      Number(r.fantasy_points),
    ]),
  )
  // Season 1: Sam has stats in two final games, plays a third with no stat (a lineup spot),
  // and has a stat in a game that isn't final yet. Then Sam joins a Season 2 team with no games.
  await db.exec(`
    insert into public.games (id, season_id, week, home_team_id, away_team_id, status, kind) values
      ('${G1}', '${SEASON_1}', 1, '${OLD_A}', '${OLD_B}', 'final', 'regular'),
      ('${G2}', '${SEASON_1}', 2, '${OLD_A}', '${OLD_B}', 'final', 'regular'),
      ('${G3}', '${SEASON_1}', 3, '${OLD_A}', '${OLD_B}', 'final', 'regular'),
      ('${G_LIVE}', '${SEASON_1}', 4, '${OLD_A}', '${OLD_B}', 'live', 'regular');
    insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value, half) values
      ('${SEASON_1}', '${G1}', '${OLD_A}', '${SAM}', 'rec', 3, 1),
      ('${SEASON_1}', '${G1}', '${OLD_A}', '${SAM}', 'td', 1, 1),
      ('${SEASON_1}', '${G2}', '${OLD_A}', '${SAM}', 'rec', 5, 2),
      ('${SEASON_1}', '${G_LIVE}', '${OLD_A}', '${SAM}', 'rec', 4, 1),
      ('${SEASON_1}', null, null, '${OLDIE}', 'rec', 8, null);
    insert into public.lineups (game_id, team_id, on_field, half, clock_seconds)
      values ('${G3}', '${OLD_A}', array['${SAM}']::uuid[], 1, 720);
    insert into public.teams (id, name, short_name, color_key, season_id)
      values ('${NEW_TEAM}', 'New Team', 'NEW', 'tigers', '${season2}');
    insert into public.roster_memberships (player_id, team_id) values ('${SAM}', '${NEW_TEAM}'), ('${OLDIE}', '${NEW_TEAM}');
  `)
  await db.exec(sql('009_per_game_estimates.sql'))
})

const projection = async (playerId: string) =>
  (
    await db.query<{ games: number; rec_per_game: string; points_per_game: string; points_total: string }>(
      `select games, rec_per_game, points_per_game, points_total from public.player_projections where player_id = $1`,
      [playerId],
    )
  ).rows[0]

describe('estimated points per game', () => {
  it('divides what a player did by the final games they played, not by their new team’s games', async () => {
    const p = await projection(SAM)
    const total = 8 * points.rec! + 1 * points.td!
    expect(p?.games).toBe(3)
    expect(Number(p?.points_per_game)).toBe(Math.round((total / 3) * 10) / 10)
    expect(Number(p?.rec_per_game)).toBe(Math.round((8 / 3) * 10) / 10)
  })

  it('is far below the career total once a player has played more than one game', async () => {
    const p = await projection(SAM)
    expect(Number(p?.points_per_game)).toBeLessThan(Number(p?.points_total) / 2)
  })

  it('keeps the old fallback for a player who has only old totals with no games', async () => {
    const p = await projection(OLDIE)
    expect(p?.games).toBe(1)
    expect(Number(p?.points_per_game)).toBe(8 * points.rec!)
  })

  it('can be run twice', async () => {
    await expect(db.exec(sql('009_per_game_estimates.sql'))).resolves.toBeDefined()
  })
})
