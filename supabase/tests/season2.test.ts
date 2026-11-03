/*
 * Season 2 database changes (migration 008, section 1), tested on a local Postgres (PGlite).
 * Proves: Season 1 is closed and its data does not change, Season 2 has the rulebook rules,
 * teams belong to a season, standings list only their own season's teams, stat types have groups
 * and limits, safety scores 2, clock seconds are range-checked, and the new tables follow the house rules.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, runAs, sql } from './helpers'

const SEASON_1_ID = '20000000-0000-0000-0000-000000000001'
const EARLIER_ID = '20000000-0000-0000-0000-000000000002'
const TEAM_1 = '10000000-0000-0000-0000-000000000001'
const TEAM_2 = '10000000-0000-0000-0000-000000000002'
const TEAM_3 = '10000000-0000-0000-0000-000000000003'
const GAME_1 = '30000000-0000-0000-0000-000000000001'
const PLAYER_SAM = '40000000-0000-0000-0000-000000000001'
const AKIVA = '00000000-0000-0000-0000-00000000000a'

// Season 2 test data (created after migration 008)
const CLOCK_TEAM_A = '50000000-0000-0000-0000-000000000001'
const CLOCK_TEAM_B = '50000000-0000-0000-0000-000000000002'
const GAME_2 = '30000000-0000-0000-0000-000000000002'
const P_CLOCK = '40000000-0000-0000-0000-000000000002'
const P_SUB = '40000000-0000-0000-0000-000000000003'
const P_MIN = '40000000-0000-0000-0000-000000000004'
const P_ZERO = '40000000-0000-0000-0000-000000000005'
const P_MAX = '40000000-0000-0000-0000-000000000006'
const P_OVER = '40000000-0000-0000-0000-000000000007'
const P_NEG = '40000000-0000-0000-0000-000000000008'

const ROLLBACK = 'rollback-test'

let db: PGlite
let before: { standings: Record<string, unknown>[]; game_scores: Record<string, unknown>[]; player_stat_totals: Record<string, unknown>[] }
let season2Id = ''

const as = <T>(user: string | 'anon', query: string, params: unknown[] = []) => runAs<T>(db, user, query, params)

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
  // The database as it is before Season 2: the 2026 season with real results, an "Earlier totals"
  // season with a stat line, a record adjustment, and three teams with no season column yet.
  await db.exec(`
    insert into public.players (id, full_name, login_name) values
      ('${PLAYER_SAM}', 'Sam Test', null),
      ('40000000-0000-0000-0000-0000000000a1', 'Akiva Test', 'akiva');
    insert into public.seasons (id, name) values ('${SEASON_1_ID}', '2026 season');
    insert into public.seasons (id, name, status, counts_for_standings)
      values ('${EARLIER_ID}', 'Earlier totals', 'finished', false);
    insert into public.teams (id, name, short_name, color_key) values
      ('${TEAM_1}', 'Tigers', 'TIG', 'tigers'),
      ('${TEAM_2}', 'Speed Demons', 'SD', 'demons'),
      ('${TEAM_3}', 'Daybies', 'DAY', 'daybies');
    insert into public.games (id, season_id, week, home_team_id, away_team_id, status, kind)
      values ('${GAME_1}', '${SEASON_1_ID}', 1, '${TEAM_1}', '${TEAM_2}', 'final', 'regular');
    insert into public.score_events (game_id, team_id, scoring_type_id, points) values
      ('${GAME_1}', '${TEAM_1}', 'td', 6),
      ('${GAME_1}', '${TEAM_1}', 'conv1', 1),
      ('${GAME_1}', '${TEAM_2}', 'td', 6);
    insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value, half) values
      ('${SEASON_1_ID}', '${GAME_1}', '${TEAM_1}', '${PLAYER_SAM}', 'rec', 2, 1),
      ('${EARLIER_ID}', null, null, '${PLAYER_SAM}', 'rec', 5, null);
    insert into public.record_adjustments (season_id, team_id, wins, losses, ties, note)
      values ('${SEASON_1_ID}', '${TEAM_3}', 1, 0, 0, 'Recorded before the app');
    insert into auth.users values ('${AKIVA}', 'akiva@mlf.invalid', now());
  `)
  // Snapshot of everything Season 1 shows, taken before migration 008 runs.
  before = {
    standings: (await db.query<Record<string, unknown>>(`select * from public.standings order by season_id, team_id`)).rows,
    game_scores: (await db.query<Record<string, unknown>>(`select * from public.game_scores order by game_id`)).rows,
    player_stat_totals: (
      await db.query<Record<string, unknown>>(`select * from public.player_stat_totals order by season_id, player_id, stat_type_id`)
    ).rows,
  }
  await db.exec(sql('008_season_2.sql'))
  season2Id = (await db.query<{ id: string }>(`select id from public.seasons where name = 'Season 2'`)).rows[0]?.id ?? ''
})

describe('seasons', () => {
  it('renames 2026 season to Season 1 and finishes it, with the old rules', async () => {
    const rows = await db.query<Record<string, unknown>>(
      `select name, status, half_minutes, halftime_minutes, overtime_minutes, on_field
         from public.seasons where id = '${SEASON_1_ID}'`,
    )
    expect(rows.rows[0]).toEqual({
      name: 'Season 1',
      status: 'finished',
      half_minutes: 10,
      halftime_minutes: 7,
      overtime_minutes: null,
      on_field: 2,
    })
  })

  it('creates Season 2 with rulebook rules', async () => {
    const rows = await db.query<Record<string, unknown>>(
      `select name, half_minutes, halftime_minutes, overtime_minutes, on_field,
              starts_on::text as starts_on, ends_on::text as ends_on
         from public.seasons where name = 'Season 2'`,
    )
    expect(rows.rows).toEqual([
      {
        name: 'Season 2',
        half_minutes: 12,
        halftime_minutes: 7,
        overtime_minutes: 8,
        on_field: 3,
        starts_on: '2026-11-08',
        ends_on: '2027-01-03',
      },
    ])
  })

  it('current_season is Season 2', async () => {
    const rows = await db.query<{ name: string }>(`select name from public.current_season`)
    expect(rows.rows).toEqual([{ name: 'Season 2' }])
  })

  it('is safe to run again', async () => {
    await db.exec(sql('008_season_2.sql'))
    const seasons = await db.query<{ n: number }>(`select count(*)::int as n from public.seasons where name = 'Season 2'`)
    expect(seasons.rows[0]?.n).toBe(1)
    const s1 = await db.query<{ n: number }>(`select count(*)::int as n from public.seasons where name = 'Season 1'`)
    expect(s1.rows[0]?.n).toBe(1)
  })
})

describe('Season 1 data is unchanged', () => {
  it('Season 1 standings are identical before and after', async () => {
    const after = await db.query<Record<string, unknown>>(`select * from public.standings order by season_id, team_id`)
    const s1 = (rows: Record<string, unknown>[]) => rows.filter((r) => r.season_id === SEASON_1_ID)
    expect(s1(after.rows)).toEqual(s1(before.standings))
    expect(s1(after.rows)).toHaveLength(3)
  })

  it('game scores are identical before and after', async () => {
    const after = await db.query<Record<string, unknown>>(`select * from public.game_scores order by game_id`)
    expect(after.rows).toEqual(before.game_scores)
  })

  it('player stat totals, including Earlier totals, are identical before and after', async () => {
    const after = await db.query<Record<string, unknown>>(
      `select * from public.player_stat_totals order by season_id, player_id, stat_type_id`,
    )
    expect(after.rows).toEqual(before.player_stat_totals)
  })

  it('standings list only each season’s own teams, and Season 2 has none yet', async () => {
    let seen: { team_season: string; standing_season: string }[] = []
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(`
          insert into public.teams (name, short_name, color_key, season_id)
            select 'Gooners', 'GOO', 'gooners', id from public.seasons where name = 'Season 2';
        `)
        const r = await tx.query<{ team_season: string; standing_season: string }>(
          `select t.season_id as team_season, st.season_id as standing_season
             from public.standings st join public.teams t on t.id = st.team_id`,
        )
        seen = r.rows
        throw new Error(ROLLBACK)
      }),
    ).rejects.toThrow(ROLLBACK)
    // 3 Season 1 teams plus 1 Season 2 team; every row matches its own season. The insert was rolled back.
    expect(seen).toHaveLength(4)
    expect(seen.every((r) => r.team_season === r.standing_season)).toBe(true)
    expect(seen.filter((r) => r.standing_season === season2Id)).toHaveLength(1)
  })
})

describe('teams', () => {
  it('old teams belong to Season 1', async () => {
    const rows = await db.query<{ total: number; in_season_1: number }>(
      `select count(*)::int as total, count(*) filter (where season_id = '${SEASON_1_ID}')::int as in_season_1
         from public.teams`,
    )
    expect(rows.rows[0]).toEqual({ total: 3, in_season_1: 3 })
  })

  it('team names are unique per season only', async () => {
    await db.exec(`
      insert into public.teams (name, short_name, color_key, season_id)
        select 'Tigers', 'TIG', 'tigers', id from public.seasons where name = 'Season 2';
    `)
    await expect(
      db.exec(`
        insert into public.teams (name, short_name, color_key, season_id)
          select 'Tigers', 'TIG', 'tigers', id from public.seasons where name = 'Season 2';
      `),
    ).rejects.toThrow(/duplicate key|unique/)
  })

  it('accepts the Season 2 colour keys and rejects others', async () => {
    await db.exec(`
      insert into public.teams (name, short_name, color_key, season_id)
        select 'Gooners', 'GOO', 'gooners', id from public.seasons where name = 'Season 2';
    `)
    await expect(
      db.exec(`
        insert into public.teams (name, short_name, color_key, season_id)
          select 'Nope', 'NOP', 'purple', id from public.seasons where name = 'Season 2';
      `),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('scoring and stat types', () => {
  it('safety scores 2', async () => {
    const rows = await db.query<{ points: number }>(`select points from public.scoring_types where id = 'safety'`)
    expect(rows.rows).toEqual([{ points: 2 }])
  })

  it('new stat types have groups and limits', async () => {
    const rows = await db.query<{ id: string; stat_group: string; max_per_game: number | null }>(
      `select id, stat_group, max_per_game from public.stat_types
        where id in ('sack_taken','rec_td','sack_allowed','sack','punt_return','penalty')
        order by id`,
    )
    expect(rows.rows).toEqual([
      { id: 'penalty', stat_group: 'team', max_per_game: 30 },
      { id: 'punt_return', stat_group: 'kicks', max_per_game: 20 },
      { id: 'rec_td', stat_group: 'receiving', max_per_game: 15 },
      { id: 'sack', stat_group: 'defense', max_per_game: 20 },
      { id: 'sack_allowed', stat_group: 'line', max_per_game: 20 },
      { id: 'sack_taken', stat_group: 'qb', max_per_game: 20 },
    ])
  })

  it('reuses existing stat type ids and sets their groups, without adding duplicates', async () => {
    const rows = await db.query<{ n: number }>(`select count(*)::int as n from public.stat_types where id = 'rec'`)
    expect(rows.rows[0]?.n).toBe(1)
    const rec = await db.query<{ stat_group: string; max_per_game: number }>(
      `select stat_group, max_per_game from public.stat_types where id = 'rec'`,
    )
    expect(rec.rows).toEqual([{ stat_group: 'receiving', max_per_game: 40 }])
  })

  it('old stat types are in the legacy group and kept out of the app, except td and pick6', async () => {
    const rows = await db.query<{ id: string; stat_group: string; max_per_game: number; active: boolean }>(
      `select id, stat_group, max_per_game, active from public.stat_types
        where id in ('td','pick6','conv1','conv2','conv_old') order by id`,
    )
    expect(rows.rows).toEqual([
      { id: 'conv1', stat_group: 'legacy', max_per_game: 15, active: false },
      { id: 'conv2', stat_group: 'legacy', max_per_game: 15, active: false },
      { id: 'conv_old', stat_group: 'legacy', max_per_game: 15, active: false },
      { id: 'pick6', stat_group: 'legacy', max_per_game: 15, active: true },
      { id: 'td', stat_group: 'legacy', max_per_game: 15, active: true },
    ])
  })

  it('rejects a stat group outside the list', async () => {
    await expect(
      db.exec(`insert into public.stat_types (id, label, stat_group) values ('bogus_group', 'Bogus', 'offense')`),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('clock seconds (score and stat lines)', () => {
  beforeAll(async () => {
    await db.exec(`
      insert into public.teams (id, name, short_name, color_key, season_id) values
        ('${CLOCK_TEAM_A}', 'Clock A', 'CLA', 'sucks', '${season2Id}'),
        ('${CLOCK_TEAM_B}', 'Clock B', 'CLB', 'spicy', '${season2Id}');
      insert into public.games (id, season_id, home_team_id, away_team_id, status, kind)
        values ('${GAME_2}', '${season2Id}', '${CLOCK_TEAM_A}', '${CLOCK_TEAM_B}', 'scheduled', 'regular');
      insert into public.players (id, full_name) values ('${P_CLOCK}', 'Clock Player');
    `)
  })

  it('score lines accept 0, 3600 and no clock second', async () => {
    await db.exec(`
      insert into public.score_events (game_id, team_id, scoring_type_id, points, clock_seconds) values
        ('${GAME_2}', '${CLOCK_TEAM_A}', 'td', 6, 0),
        ('${GAME_2}', '${CLOCK_TEAM_A}', 'td', 6, 3600),
        ('${GAME_2}', '${CLOCK_TEAM_A}', 'td', 6, null);
    `)
    const rows = await db.query<{ clock_seconds: number | null }>(
      `select clock_seconds from public.score_events where game_id = '${GAME_2}' order by clock_seconds nulls last`,
    )
    expect(rows.rows.map((r) => r.clock_seconds)).toEqual([0, 3600, null])
  })

  it('score lines refuse 3601 and -1', async () => {
    await expect(
      db.exec(`insert into public.score_events (game_id, team_id, scoring_type_id, points, clock_seconds)
               values ('${GAME_2}', '${CLOCK_TEAM_A}', 'td', 6, 3601)`),
    ).rejects.toThrow(/check constraint/)
    await expect(
      db.exec(`insert into public.score_events (game_id, team_id, scoring_type_id, points, clock_seconds)
               values ('${GAME_2}', '${CLOCK_TEAM_A}', 'td', 6, -1)`),
    ).rejects.toThrow(/check constraint/)
  })

  it('stat lines accept 0, 3600 and no clock second', async () => {
    await db.exec(`
      insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value, clock_seconds) values
        ('${season2Id}', '${GAME_2}', '${CLOCK_TEAM_A}', '${P_CLOCK}', 'rec', 1, 0),
        ('${season2Id}', '${GAME_2}', '${CLOCK_TEAM_A}', '${P_CLOCK}', 'rec', 1, 3600),
        ('${season2Id}', '${GAME_2}', '${CLOCK_TEAM_A}', '${P_CLOCK}', 'rec', 1, null);
    `)
    const rows = await db.query<{ clock_seconds: number | null }>(
      `select clock_seconds from public.stat_events where game_id = '${GAME_2}' order by clock_seconds nulls last`,
    )
    expect(rows.rows.map((r) => r.clock_seconds)).toEqual([0, 3600, null])
  })

  it('stat lines refuse 3601 and -1', async () => {
    await expect(
      db.exec(`insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value, clock_seconds)
               values ('${season2Id}', '${GAME_2}', '${CLOCK_TEAM_A}', '${P_CLOCK}', 'rec', 1, 3601)`),
    ).rejects.toThrow(/check constraint/)
    await expect(
      db.exec(`insert into public.stat_events (season_id, game_id, team_id, player_id, stat_type_id, value, clock_seconds)
               values ('${season2Id}', '${GAME_2}', '${CLOCK_TEAM_A}', '${P_CLOCK}', 'rec', 1, -1)`),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('game_subs and player_minutes', () => {
  beforeAll(async () => {
    await db.exec(`
      insert into public.players (id, full_name) values
        ('${P_SUB}', 'Sub Test'), ('${P_MIN}', 'Minutes Test'), ('${P_ZERO}', 'Zero Test'),
        ('${P_MAX}', 'Max Test'), ('${P_OVER}', 'Over Test'), ('${P_NEG}', 'Neg Test');
    `)
  })

  it.each(['game_subs', 'player_minutes'])('%s has row level security and no delete grant', async (table) => {
    const rls = await db.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname = '${table}' and relnamespace = 'public'::regnamespace`,
    )
    expect(rls.rows).toEqual([{ relrowsecurity: true }])
    const del = await db.query<{ can: boolean }>(
      `select has_table_privilege('authenticated', 'public.${table}', 'DELETE') as can`,
    )
    expect(del.rows).toEqual([{ can: false }])
  })

  it.each(['game_subs', 'player_minutes'])('%s is hidden from logged-out visitors', async (table) => {
    await expect(as('anon', `select * from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it.each(['game_subs', 'player_minutes'])('%s cannot be deleted by a member', async (table) => {
    await expect(as(AKIVA, `delete from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('a linked member can add and read game subs and playing time, and the history records it', async () => {
    const linked = await as<{ n: number }>(AKIVA, `select count(*)::int as n from public.member_logins where user_id = auth.uid()`)
    expect(linked).toEqual([{ n: 1 }])

    const [sub] = await as<{ id: string; created_by: string }>(
      AKIVA,
      `insert into public.game_subs (game_id, team_id, player_id) values ($1, $2, $3) returning id, created_by`,
      [GAME_2, CLOCK_TEAM_A, P_SUB],
    )
    expect(sub?.created_by).toBe(AKIVA)
    expect(await as(AKIVA, `select id from public.game_subs where id = $1`, [sub?.id])).toHaveLength(1)

    const [min] = await as<{ id: string; created_by: string }>(
      AKIVA,
      `insert into public.player_minutes (game_id, player_id, minutes) values ($1, $2, 12.5) returning id, created_by`,
      [GAME_2, P_MIN],
    )
    expect(min?.created_by).toBe(AKIVA)
    expect(await as(AKIVA, `select id from public.player_minutes where id = $1`, [min?.id])).toHaveLength(1)

    const hist = await db.query<{ action: string; changed_by: string }>(
      `select action, changed_by::text as changed_by from public.edit_history where table_name = 'game_subs' and row_id = $1`,
      [sub?.id],
    )
    expect(hist.rows).toEqual([{ action: 'insert', changed_by: AKIVA }])
  })

  it('one live sub per player per game: a second is refused, a voided one is allowed', async () => {
    await expect(
      db.exec(`insert into public.game_subs (game_id, team_id, player_id) values ('${GAME_2}', '${CLOCK_TEAM_A}', '${P_SUB}')`),
    ).rejects.toThrow(/duplicate key|unique/)
    await expect(
      db.exec(`insert into public.game_subs (game_id, team_id, player_id, voided_at)
               values ('${GAME_2}', '${CLOCK_TEAM_A}', '${P_SUB}', now())`),
    ).resolves.toBeDefined()
  })

  it('one live playing-time row per player per game: a second is refused, a voided one is allowed', async () => {
    await expect(
      db.exec(`insert into public.player_minutes (game_id, player_id, minutes) values ('${GAME_2}', '${P_MIN}', 5)`),
    ).rejects.toThrow(/duplicate key|unique/)
    await expect(
      db.exec(`insert into public.player_minutes (game_id, player_id, minutes, voided_at)
               values ('${GAME_2}', '${P_MIN}', 5, now())`),
    ).resolves.toBeDefined()
  })

  it('player_minutes accepts 0 and 60, refuses 60.1 and -1', async () => {
    await db.exec(`
      insert into public.player_minutes (game_id, player_id, minutes) values
        ('${GAME_2}', '${P_ZERO}', 0), ('${GAME_2}', '${P_MAX}', 60);
    `)
    const rows = await db.query<{ minutes: number }>(
      `select minutes from public.player_minutes where game_id = '${GAME_2}' and player_id in ('${P_ZERO}', '${P_MAX}') order by minutes`,
    )
    expect(rows.rows.map((r) => Number(r.minutes))).toEqual([0, 60])
    await expect(
      db.exec(`insert into public.player_minutes (game_id, player_id, minutes) values ('${GAME_2}', '${P_OVER}', 60.1)`),
    ).rejects.toThrow(/check constraint|out of range/)
    await expect(
      db.exec(`insert into public.player_minutes (game_id, player_id, minutes) values ('${GAME_2}', '${P_NEG}', -1)`),
    ).rejects.toThrow(/check constraint/)
  })
})
