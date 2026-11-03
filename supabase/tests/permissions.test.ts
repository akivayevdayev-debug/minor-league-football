/*
 * Season 2 permissions and limits (migration 008, section 2), tested on a local Postgres (PGlite).
 * Proves: you edit only your own profile (Akiva edits anyone's), anyone logs stats while a game is
 * live, only Akiva and Eddie change a finished game, stat and score-line limits hold, and the
 * "pick a new password" flag can only be cleared by its own login.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, runAs, sql } from './helpers'

const AKIVA = '00000000-0000-0000-0000-00000000000a'
const EDDIE = '00000000-0000-0000-0000-00000000000e'
const MAIR = '00000000-0000-0000-0000-0000000000a1'
const LEO = '00000000-0000-0000-0000-0000000000a2'

const P = {
  akiva: '30000000-0000-0000-0000-000000000001',
  eddie: '30000000-0000-0000-0000-000000000002',
  mair: '30000000-0000-0000-0000-000000000003',
  leo: '30000000-0000-0000-0000-000000000004',
}
const HOME = '40000000-0000-0000-0000-000000000001'
const AWAY = '40000000-0000-0000-0000-000000000002'
const LIVE = '50000000-0000-0000-0000-000000000001'
const FINAL = '50000000-0000-0000-0000-000000000002'

let db: PGlite
let season2: string

const as = <T>(user: string, query: string, params: unknown[] = []) => runAs<T>(db, user, query, params)
const uuid = async () => (await db.query<{ id: string }>('select gen_random_uuid() as id')).rows[0].id

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
  // Four logins, linked automatically when their confirmed accounts appear.
  await db.exec(`
    insert into public.seasons (name) values ('2026 season');
    insert into public.players (id, full_name, login_name) values
      ('${P.akiva}', 'Akiva Test', 'akiva'), ('${P.eddie}', 'Eddie Test', 'eddie'),
      ('${P.mair}', 'Mair Test', 'mair'), ('${P.leo}', 'Leo Test', 'leo');
    insert into auth.users values
      ('${AKIVA}', 'akiva@mlf.invalid', now()), ('${EDDIE}', 'eddie@mlf.invalid', now()),
      ('${MAIR}', 'mair@mlf.invalid', now()), ('${LEO}', 'leo@mlf.invalid', now());
    update public.member_logins set is_league_manager = true where user_id = '${EDDIE}';
  `)
  await db.exec(sql('008_season_2.sql'))
  season2 = (await db.query<{ id: string }>(`select id from public.seasons where name = 'Season 2'`)).rows[0].id
  await db.exec(`
    insert into public.teams (id, season_id, name, short_name, color_key) values
      ('${HOME}', '${season2}', 'Spicy Feet', 'SPICY', 'spicy'),
      ('${AWAY}', '${season2}', 'Team Sucks', 'SUCKS', 'sucks');
    insert into public.games (id, season_id, home_team_id, away_team_id, status) values
      ('${LIVE}', '${season2}', '${HOME}', '${AWAY}', 'live'),
      ('${FINAL}', '${season2}', '${HOME}', '${AWAY}', 'final');
  `)
})

const addStat = (user: string, game: string, stat = 'rec', value = 1, id?: string) =>
  as(
    user,
    `insert into public.stat_events (id, season_id, game_id, team_id, player_id, stat_type_id, value)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7) returning id`,
    [id ?? null, season2, game, HOME, P.mair, stat, value],
  )

describe('roles', () => {
  it('marks Akiva as the owner, nobody else', async () => {
    const rows = await db.query<{ user_id: string }>('select user_id from public.member_logins where is_owner')
    expect(rows.rows.map((r) => r.user_id)).toEqual([AKIVA])
  })
})

describe('profiles', () => {
  it('member edits own profile only', async () => {
    const own = await as(MAIR, `update public.players set achievements = 'MVP' where id = $1 returning id`, [P.mair])
    expect(own).toHaveLength(1)
    const other = await as(MAIR, `update public.players set achievements = 'x' where id = $1 returning id`, [P.leo])
    expect(other).toHaveLength(0)
  })

  it('member cannot change own is_guest or login_name or remove themself', async () => {
    await expect(as(MAIR, `update public.players set login_name = 'boss' where id = $1`, [P.mair])).rejects.toThrow(/Only Akiva/)
    await expect(as(MAIR, `update public.players set voided_at = now() where id = $1`, [P.mair])).rejects.toThrow(/Only Akiva/)
  })

  it('owner edits any profile; league manager cannot', async () => {
    expect(await as(AKIVA, `update public.players set jersey = 7 where id = $1 returning id`, [P.leo])).toHaveLength(1)
    expect(await as(EDDIE, `update public.players set jersey = 8 where id = $1 returning id`, [P.leo])).toHaveLength(0)
  })

  it('quick guest add still works for members, but not a player with a login', async () => {
    expect(await as(MAIR, `insert into public.players (full_name, is_guest) values ('Guest Kid', true) returning id`)).toHaveLength(1)
    await expect(as(MAIR, `insert into public.players (full_name, login_name) values ('Fake', 'fake')`)).rejects.toThrow(/row-level security/)
  })
})

describe('game lines', () => {
  it('anyone logs stats in a live game', async () => {
    expect(await addStat(MAIR, LIVE)).toHaveLength(1)
  })

  it('only owner and league manager add stats to a final game', async () => {
    await expect(addStat(MAIR, FINAL)).rejects.toThrow(/row-level security/)
    expect(await addStat(EDDIE, FINAL)).toHaveLength(1)
    expect(await addStat(AKIVA, FINAL)).toHaveLength(1)
  })

  it('a member cannot void a line in a final game; Eddie can', async () => {
    const [{ id }] = await addStat(AKIVA, FINAL)
    expect(await as(MAIR, `update public.stat_events set voided_at = now() where id = $1 returning id`, [id])).toHaveLength(0)
    expect(await as(EDDIE, `update public.stat_events set voided_at = now() where id = $1 returning id`, [id])).toHaveLength(1)
  })

  it('the same rule covers score lines, lineups, subs and minutes', async () => {
    // Each insert takes the game id and a player id. Subs and minutes allow one live row per
    // player per game, so each attempt uses a different player.
    const tries: Array<[string, string]> = [
      ['score_events', `insert into public.score_events (game_id, team_id, scoring_type_id, points, player_id) values ($1, '${HOME}', 'safety', 2, $2)`],
      ['lineups', `insert into public.lineups (game_id, team_id, on_field, half, clock_seconds) values ($1, '${HOME}', array[$2::uuid], 1, 600)`],
      ['game_subs', `insert into public.game_subs (game_id, team_id, player_id) values ($1, '${HOME}', $2)`],
      ['player_minutes', `insert into public.player_minutes (game_id, player_id, minutes) values ($1, $2, 12)`],
    ]
    for (const [table, q] of tries) {
      await expect(as(MAIR, q, [FINAL, P.leo]), table).rejects.toThrow(/row-level security/)
      expect(await as(EDDIE, `${q} returning id`, [FINAL, P.leo]), table).toHaveLength(1)
      expect(await as(MAIR, `${q} returning id`, [LIVE, P.mair]), table).toHaveLength(1)
    }
  })

  it('stat lines with no game need Akiva or Eddie', async () => {
    const q = `insert into public.stat_events (season_id, player_id, stat_type_id, value) values ($1, $2, 'rec', 3) returning id`
    await expect(as(MAIR, q, [season2, P.mair])).rejects.toThrow(/row-level security/)
    expect(await as(EDDIE, q, [season2, P.mair])).toHaveLength(1)
  })
})

describe('finished games', () => {
  it('member cannot reopen a final game', async () => {
    await expect(as(MAIR, `update public.games set status = 'live' where id = $1`, [FINAL])).rejects.toThrow(/reopen/)
  })

  it('Eddie can reopen a final game, and a member can still start a scheduled one', async () => {
    const g = await uuid()
    await db.query(
      `insert into public.games (id, season_id, home_team_id, away_team_id, status) values ($1, $2, $3, $4, 'final')`,
      [g, season2, HOME, AWAY],
    )
    expect(await as(EDDIE, `update public.games set status = 'live' where id = $1 returning id`, [g])).toHaveLength(1)
    await db.query(`update public.games set status = 'scheduled' where id = $1`, [g])
    expect(await as(MAIR, `update public.games set status = 'live' where id = $1 returning id`, [g])).toHaveLength(1)
  })
})

describe('limits', () => {
  it('stat limit blocks a 16th TD and ignores voided lines', async () => {
    const g = await uuid()
    await db.query(
      `insert into public.games (id, season_id, home_team_id, away_team_id, status) values ($1, $2, $3, $4, 'live')`,
      [g, season2, HOME, AWAY],
    )
    const ids: string[] = []
    for (let i = 0; i < 15; i++) ids.push((await addStat(MAIR, g, 'rec_td'))[0].id as string)
    await expect(addStat(MAIR, g, 'rec_td')).rejects.toThrow(/MLF_LIMIT:.+:15/)
    await as(MAIR, `update public.stat_events set voided_at = now() where id = $1`, [ids[0]])
    expect(await addStat(MAIR, g, 'rec_td')).toHaveLength(1)
  })

  it('a single line bigger than the limit is refused', async () => {
    await expect(addStat(MAIR, LIVE, 'rec_td', 16)).rejects.toThrow(/MLF_LIMIT/)
  })

  it('caps score lines at 30 per team per game', async () => {
    const g = await uuid()
    await db.query(
      `insert into public.games (id, season_id, home_team_id, away_team_id, status) values ($1, $2, $3, $4, 'live')`,
      [g, season2, HOME, AWAY],
    )
    const q = `insert into public.score_events (game_id, team_id, scoring_type_id, points) values ($1, $2, 'safety', 2)`
    for (let i = 0; i < 30; i++) await as(MAIR, q, [g, HOME])
    await expect(as(MAIR, q, [g, HOME])).rejects.toThrow(/MLF_LIMIT:Score lines:30/)
    expect(await as(MAIR, `${q} returning id`, [g, AWAY])).toHaveLength(1)
  })
})

describe('passwords', () => {
  it('clear_my_password_flag clears only my flag', async () => {
    await db.exec(`update public.member_logins set must_change_password = true`)
    await as(MAIR, 'select public.clear_my_password_flag()')
    const rows = await db.query<{ user_id: string; must_change_password: boolean }>(
      'select user_id, must_change_password from public.member_logins order by user_id',
    )
    for (const r of rows.rows) expect(r.must_change_password, r.user_id).toBe(r.user_id !== MAIR)
  })

  it('a member cannot clear the flag by writing the table directly', async () => {
    await db.exec(`update public.member_logins set must_change_password = true`)
    await expect(as(LEO, `update public.member_logins set must_change_password = false`)).rejects.toThrow(
      /permission denied/,
    )
  })
})
