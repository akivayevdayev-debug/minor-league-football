/*
 * The MVP race (migration 010), tested on a local Postgres (PGlite).
 * Proves: points per game count only final games a player played (a QB counts too), with what they
 * did; only Eddie (league manager) and Akiva (owner) can pin places; everyone can read pins; pins
 * are never deleted; one live pin per player and per place; and the migration can run twice.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, runAs, sql } from './helpers'

const U = {
  akiva: '00000000-0000-0000-0000-00000000000a',
  eddie: '00000000-0000-0000-0000-00000000000e',
  maurice: '00000000-0000-0000-0000-0000000000b1',
  david: '00000000-0000-0000-0000-0000000000b2',
}
const P = {
  akiva: '30000000-0000-0000-0000-000000000001',
  eddie: '30000000-0000-0000-0000-000000000002',
  maurice: '30000000-0000-0000-0000-000000000003',
  david: '30000000-0000-0000-0000-000000000004',
  ben: '30000000-0000-0000-0000-000000000005',
}
const TEAM_A = '40000000-0000-0000-0000-000000000001'
const TEAM_B = '40000000-0000-0000-0000-000000000002'
const G_FINAL = '50000000-0000-0000-0000-000000000001'
const G_LIVE = '50000000-0000-0000-0000-000000000002'

let db: PGlite
let season2 = ''
const as = <T>(user: string, query: string, params: unknown[] = []) => runAs<T>(db, user, query, params)
const pin = (user: string, player: string, place: number) =>
  as<{ id: string }>(user, `insert into public.mvp_pins (season_id, player_id, place) values ($1, $2, $3) returning id`, [
    season2,
    player,
    place,
  ])

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
  const logins = ['akiva', 'eddie', 'maurice', 'david'] as const
  await db.exec(`
    insert into public.seasons (name) values ('2026 season');
    insert into public.players (id, full_name, login_name) values
      ${logins.map((k) => `('${P[k]}', '${k} Test', '${k}')`).join(', ')}, ('${P.ben}', 'Ben Test', null);
    insert into auth.users values ${logins.map((k) => `('${U[k]}', '${k}@mlf.invalid', now())`).join(', ')};
    update public.member_logins set is_league_manager = true where user_id = '${U.eddie}';
  `)
  await db.exec(sql('008_season_2.sql'))
  await db.exec(sql('009_per_game_estimates.sql'))
  await db.exec(sql('010_mvp.sql'))
  await db.exec(sql('010_mvp.sql')) // safe to run twice
  await db.exec(sql('011_qb_points.sql'))
  await db.exec(sql('011_qb_points.sql'))
  season2 = (await db.query<{ id: string }>(`select id from public.seasons where name = 'Season 2'`)).rows[0]!.id
  await db.exec(`
    insert into public.teams (id, season_id, name, short_name, color_key) values
      ('${TEAM_A}', '${season2}', 'A Team', 'A', 'shpitzy'), ('${TEAM_B}', '${season2}', 'B Team', 'B', 'sucks');
    insert into public.games (id, season_id, week, home_team_id, away_team_id, status, home_qb_id) values
      ('${G_FINAL}', '${season2}', 1, '${TEAM_A}', '${TEAM_B}', 'scheduled', '${P.eddie}'),
      ('${G_LIVE}', '${season2}', 2, '${TEAM_A}', '${TEAM_B}', 'scheduled', null);
    insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value) values
      ('${season2}', '${G_FINAL}', '${TEAM_A}', '${P.david}', 'td', 2),
      ('${season2}', '${G_FINAL}', '${TEAM_A}', '${P.david}', 'rec', 3),
      ('${season2}', '${G_LIVE}', '${TEAM_A}', '${P.david}', 'td', 5);
    insert into public.lineups (game_id, team_id, on_field, half, clock_seconds) values
      ('${G_FINAL}', '${TEAM_B}', array['${P.ben}'::uuid], 1, 720);
    update public.games set status = 'final' where id = '${G_FINAL}';
  `)
})

describe('points per game', () => {
  it('counts only final games, with points and what the player did', async () => {
    const pts = Object.fromEntries(
      (await db.query<{ id: string; fantasy_points: string }>(`select id, fantasy_points from public.stat_types`)).rows.map((r) => [
        r.id,
        Number(r.fantasy_points),
      ]),
    )
    const rows = await as<{ game_id: string; week: number; points: string; stats: Record<string, number> }>(
      U.david,
      `select game_id, week, points, stats from public.player_game_points where player_id = $1`,
      [P.david],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.game_id).toBe(G_FINAL)
    expect(rows[0]!.week).toBe(1)
    expect(Number(rows[0]!.points)).toBe(2 * pts.td! + 3 * pts.rec!)
    expect(rows[0]!.stats).toEqual({ td: 2, rec: 3 })
  })

  it('counts a game played with no stats (lineup spot) and a QB game, at 0 points', async () => {
    const rows = await as<{ player_id: string; points: string; stats: object }>(
      U.david,
      `select player_id, points, stats from public.player_game_points where player_id in ($1, $2) order by player_id`,
      [P.eddie, P.ben],
    )
    expect(rows.map((r) => [r.player_id, Number(r.points), r.stats])).toEqual([
      [P.eddie, 0, {}],
      [P.ben, 0, {}],
    ])
  })

  it('is hidden from logged-out visitors', async () => {
    await expect(as('anon', `select * from public.player_game_points`)).rejects.toThrow(/permission denied/)
  })
})

describe('QB points (011)', () => {
  it('scores passing TDs +4, QB rushing TDs +6 and interceptions thrown -2; fumble lost stays 0', async () => {
    const rows = (
      await db.query<{ id: string; fantasy_points: string }>(
        `select id, fantasy_points from public.stat_types where id in ('pass_td', 'qb_rush_td', 'int_thrown', 'fumble_lost', 'fumble', 'completion')`,
      )
    ).rows
    expect(Object.fromEntries(rows.map((r) => [r.id, Number(r.fantasy_points)]))).toEqual({
      pass_td: 4,
      qb_rush_td: 6,
      int_thrown: -2,
      fumble_lost: 0,
      fumble: -2,
      completion: 0,
    })
  })
})

describe('MVP pins', () => {
  it('lets Eddie pin a player, and records that Eddie set it', async () => {
    const [row] = await pin(U.eddie, P.david, 1)
    const [read] = await as<{ pinned_by: string; place: number }>(U.david, `select pinned_by, place from public.mvp_pins where id = $1`, [
      row!.id,
    ])
    expect(read).toEqual({ pinned_by: P.eddie, place: 1 })
  })

  it('lets Akiva pin a player', async () => {
    const [row] = await pin(U.akiva, P.ben, 2)
    expect(row!.id).toBeTruthy()
  })

  it('refuses Maurice and other players', async () => {
    await expect(pin(U.maurice, P.akiva, 3)).rejects.toThrow(/row-level security/)
    await expect(pin(U.david, P.akiva, 3)).rejects.toThrow(/row-level security/)
  })

  it('stops a player from changing a pin', async () => {
    const changed = await as(U.david, `update public.mvp_pins set place = 9 where player_id = $1 returning id`, [P.david])
    expect(changed).toHaveLength(0)
  })

  it('allows one live pin per player and per place', async () => {
    await expect(pin(U.eddie, P.david, 4)).rejects.toThrow(/mvp_pins_one_player/)
    await expect(pin(U.eddie, P.maurice, 1)).rejects.toThrow(/mvp_pins_one_place/)
  })

  it('removes a pin by voiding it, never deleting', async () => {
    await expect(as(U.akiva, `delete from public.mvp_pins where player_id = $1`, [P.ben])).rejects.toThrow(/permission denied/)
    await as(U.akiva, `update public.mvp_pins set voided_at = now() where player_id = $1 and voided_at is null`, [P.ben])
    const [row] = await pin(U.eddie, P.maurice, 2) // the place is free again
    expect(row!.id).toBeTruthy()
  })

  it('is hidden from logged-out visitors', async () => {
    await expect(as('anon', `select * from public.mvp_pins`)).rejects.toThrow(/permission denied/)
  })
})
