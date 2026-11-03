/*
 * Season 2 database changes (migration 008, section 1), tested on a local Postgres (PGlite).
 * Proves: Season 1 is closed and Season 2 has the rulebook rules, teams belong to a season,
 * stat types have groups and limits, safety scores 2, and the new tables follow the house rules.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, runAs, sql } from './helpers'

const SEASON_1_ID = '20000000-0000-0000-0000-000000000001'
const AKIVA = '00000000-0000-0000-0000-00000000000a'

let db: PGlite

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
  // The database as it is before Season 2: the 2026 season and three teams, with no season column yet.
  await db.exec(`
    insert into public.players (full_name, login_name) values ('Akiva Test', 'akiva');
    insert into public.seasons (id, name) values ('${SEASON_1_ID}', '2026 season');
    insert into public.teams (id, name, short_name, color_key) values
      ('10000000-0000-0000-0000-000000000001', 'Tigers', 'TIG', 'tigers'),
      ('10000000-0000-0000-0000-000000000002', 'Speed Demons', 'SD', 'demons'),
      ('10000000-0000-0000-0000-000000000003', 'Daybies', 'DAY', 'daybies');
    insert into auth.users values ('${AKIVA}', 'akiva@mlf.invalid', now());
  `)
  await db.exec(sql('008_season_2.sql'))
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

describe('new columns on games and events', () => {
  it('accepts clock seconds from 0 to 3600 and rejects others', async () => {
    await expect(
      db.exec(`insert into public.score_events (game_id, team_id, scoring_type_id, points, clock_seconds) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'td', 6, 3601)`),
    ).rejects.toThrow(/check constraint|foreign key/)
    const cols = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and (
          (table_name = 'stat_events' and column_name = 'clock_seconds') or
          (table_name = 'score_events' and column_name = 'clock_seconds') or
          (table_name = 'games' and column_name in ('home_qb_id','away_qb_id')))`,
    )
    expect(cols.rows).toHaveLength(4)
  })
})

describe('game_subs and player_minutes', () => {
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
})
