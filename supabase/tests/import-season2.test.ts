/*
 * Checks the private Season 2 import (data/private/season-2-import.sql) on a local Postgres (PGlite).
 * Builds a pre-Season-2 league, runs migrations 001 to 008, then the import twice (idempotency).
 * Private values (jerseys, birth years, heights, weights, positions) are read from
 * data/private/season-2-players.json at run time and never written into this file.
 * Names, teams and the schedule are not private, so they are written out here.
 * Skipped automatically on machines without the private files (e.g. a fresh clone).
 */
import { existsSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, sql } from './helpers'

const PLAYERS_JSON = new URL('../../data/private/season-2-players.json', import.meta.url)
const IMPORT = new URL('../../data/private/season-2-import.sql', import.meta.url)
const has = existsSync(PLAYERS_JSON) && existsSync(IMPORT)

interface PrivatePlayer {
  full_name: string
  nickname?: string
  jersey: number
  birth_date: string | null
  height_in: number
  weight_lb: number
  positions: string[]
  team: string | null
}
interface PrivateFile {
  players: PrivatePlayer[]
  details_still_to_come: string[]
}

// Logins for the players the private file names (it does not carry logins itself).
const LOGIN_BY_NAME: Record<string, string> = {
  'Moshe Lahav': 'moshe',
  'Joseph Torjman Thomas': 'jtt',
  'Norman Shabot': 'norman',
  'Maurice Cohen': 'maurice',
  'Aaron Ozone': 'aaron',
  'Eddie Rasp': 'eddierasp',
  'Michael Bensimon': 'michael',
}

// Season 2 rosters: the existing players by login, and the new ones (Ben Haber has no details yet).
const ROSTERS: Record<string, string[]> = {
  sucks: ['leo', 'michael', 'moshe', 'norman'],
  spicy: ['akiva', 'eddierasp', 'jtt', 'mair'],
  shpitzy: ['ben', 'david', 'max', 'morris'],
  gooners: ['aaron', 'ariel', 'chaimy', 'lawrence'],
}
const CAPTAIN_LOGIN: Record<string, string> = { sucks: 'leo', spicy: 'mair', shpitzy: 'david', gooners: 'lawrence' }
const TEAMS = [
  { name: "Mair's Team Sucks", short_name: 'SUCKS', color_key: 'sucks' },
  { name: "Torj's Spicy Feet", short_name: 'SPICY', color_key: 'spicy' },
  { name: 'Shpitzy Etshalom', short_name: 'SHPZ', color_key: 'shpitzy' },
  { name: 'Golden Gooners', short_name: 'GOON', color_key: 'gooners' },
]

// The 18 regular games (spec A4): week, New York date and time, home team first.
const SCHEDULE: [number, string, string, string, string, string][] = [
  [1, '2026-11-08', '12:15', 'shpitzy', 'gooners', ''],
  [1, '2026-11-08', '13:45', 'sucks', 'spicy', ''],
  [2, '2026-11-15', '12:15', 'gooners', 'spicy', ''],
  [2, '2026-11-15', '13:45', 'shpitzy', 'sucks', ''],
  [3, '2026-11-22', '12:15', 'gooners', 'sucks', ''],
  [3, '2026-11-22', '13:45', 'shpitzy', 'spicy', ''],
  [4, '2026-11-29', '12:15', 'sucks', 'spicy', ''],
  [4, '2026-11-29', '13:45', 'shpitzy', 'gooners', ''],
  [5, '2026-12-06', '12:15', 'shpitzy', 'sucks', ''],
  [5, '2026-12-06', '13:45', 'gooners', 'spicy', ''],
  [6, '2026-12-13', '12:15', 'sucks', 'gooners', ''],
  [6, '2026-12-13', '13:45', 'spicy', 'shpitzy', ''],
  [7, '2026-12-20', '12:15', 'sucks', 'spicy', ''],
  [7, '2026-12-20', '13:45', 'shpitzy', 'gooners', ''],
  [8, '2026-12-27', '12:15', 'gooners', 'spicy', ''],
  [8, '2026-12-27', '13:45', 'shpitzy', 'sucks', ''],
  [9, '2027-01-03', '12:15', 'gooners', 'sucks', ''],
  [9, '2027-01-03', '13:45', 'shpitzy', 'spicy', ''],
]

// Ids for the seeded pre-Season-2 league.
const u = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ID = {
  leo: u(1), mair: u(2), david: u(3), lawrence: u(4), akiva: u(5), morris: u(6), max: u(7), ariel: u(8), chaimy: u(9),
  eddieSalem: u(10), maurice: u(11),
  season1: u(100), tigers: u(101), demons: u(102), daybies: u(103), game1: u(104),
}

// The league as it is before Season 2: the 2026 season, three teams, nine players with
// open memberships, Eddie Salem (QB, no team) and Maurice as a guest.
const SEED = `
  insert into public.seasons (id, name) values ('${ID.season1}', '2026 season');
  insert into public.teams (id, name, short_name, color_key) values
    ('${ID.tigers}', 'Tigers', 'TIG', 'tigers'),
    ('${ID.demons}', 'Speed Demons', 'SD', 'demons'),
    ('${ID.daybies}', 'Dumbo Daybies', 'DAY', 'daybies');
  insert into public.players (id, full_name, login_name, positions, is_guest) values
    ('${ID.leo}', 'Leon Souid', 'leo', '{}', false),
    ('${ID.mair}', 'Mair Salman', 'mair', '{}', false),
    ('${ID.david}', 'David Kopolovitz', 'david', '{}', false),
    ('${ID.lawrence}', 'Lawrence Kurtz', 'lawrence', '{}', false),
    ('${ID.akiva}', 'Akiva Yevdayev', 'akiva', '{}', false),
    ('${ID.morris}', 'Morris Kurtz', 'morris', '{}', false),
    ('${ID.max}', 'Max Simovitch', 'max', '{}', false),
    ('${ID.ariel}', 'Ariel Levy', 'ariel', '{}', false),
    ('${ID.chaimy}', 'Chaimy Salman', 'chaimy', '{}', false),
    ('${ID.eddieSalem}', 'Eddie Salem', null, '{QB}', false),
    ('${ID.maurice}', 'Maurice Cohen', null, '{}', true);
  insert into public.roster_memberships (player_id, team_id, starts_on) values
    ('${ID.leo}', '${ID.tigers}', '2026-03-01'),
    ('${ID.mair}', '${ID.tigers}', '2026-03-01'),
    ('${ID.david}', '${ID.tigers}', '2026-03-01'),
    ('${ID.lawrence}', '${ID.tigers}', '2026-03-01'),
    ('${ID.akiva}', '${ID.demons}', '2026-03-01'),
    ('${ID.morris}', '${ID.demons}', '2026-03-01'),
    ('${ID.max}', '${ID.demons}', '2026-03-01'),
    ('${ID.ariel}', '${ID.daybies}', '2026-03-01'),
    ('${ID.chaimy}', '${ID.daybies}', '2026-03-01');
  insert into public.games (id, season_id, week, home_team_id, away_team_id, status, kind)
    values ('${ID.game1}', '${ID.season1}', 1, '${ID.tigers}', '${ID.demons}', 'final', 'regular');
`

const yearOf = (d: string | null) => (d ? Number(d.slice(0, 4)) : null)
const SEASON_2 = `(select id from public.seasons where name = 'Season 2')`

describe.skipIf(!has)('Season 2 private import', () => {
  let db: PGlite
  let priv: PrivateFile
  let importSql: string

  const q = async <T = Record<string, unknown>>(query: string, params: unknown[] = []) =>
    (await db.query<T>(query, params)).rows

  const count = async (query: string) => Number((await q<{ n: number }>(`select count(*)::int as n from (${query}) x`))[0]?.n)

  // Everything the import writes, as text, so two runs can be compared exactly.
  const snapshot = async () =>
    JSON.stringify({
      players: await q(`select full_name, login_name, is_guest, jersey, nickname, birth_year, height_in::text, weight_lb, positions
                          from public.players order by full_name`),
      teams: await q(`select name, short_name, color_key, season_id, captain_player_id from public.teams order by name`),
      memberships: await q(`select p.full_name, t.name, rm.starts_on::text as starts, rm.ends_on::text as ends
                              from public.roster_memberships rm join public.players p on p.id = rm.player_id
                              join public.teams t on t.id = rm.team_id order by p.full_name, rm.starts_on`),
      games: await q(`select g.kind, g.week, g.starts_at::text as starts, g.field, h.name as home, a.name as away,
                             g.home_slot, g.away_slot
                        from public.games g left join public.teams h on h.id = g.home_team_id
                        left join public.teams a on a.id = g.away_team_id
                       where g.season_id = ${SEASON_2} order by g.kind, g.week, g.starts_at`),
    })

  beforeAll(async () => {
    priv = JSON.parse(readFileSync(PLAYERS_JSON, 'utf8'))
    importSql = readFileSync(IMPORT, 'utf8')
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
    await db.exec(SEED)
    await db.exec(sql('008_season_2.sql'))
    await db.exec(importSql)
    const once = await snapshot()
    await db.exec(importSql)
    expect(await snapshot()).toBe(once)
  })

  it('creates the four Season 2 teams with their colours, short names and captains', async () => {
    const rows = await q<{ name: string; short_name: string; color_key: string; captain: string | null }>(`
      select t.name, t.short_name, t.color_key, p.login_name as captain
        from public.teams t left join public.players p on p.id = t.captain_player_id
       where t.season_id = ${SEASON_2} order by t.name`)
    expect(rows).toHaveLength(TEAMS.length)
    for (const team of TEAMS) {
      const row = rows.find((r) => r.name === team.name)
      expect(row).toBeDefined()
      expect(row?.short_name).toBe(team.short_name)
      expect(row?.color_key).toBe(team.color_key)
      expect(row?.captain).toBe(CAPTAIN_LOGIN[team.color_key])
    }
  })

  it('puts exactly the named players on each Season 2 team, from 2026-11-08', async () => {
    const rows = await q<{ color_key: string; login: string; starts: string; ends: string | null }>(`
      select t.color_key, p.login_name as login, rm.starts_on::text as starts, rm.ends_on::text as ends
        from public.roster_memberships rm join public.teams t on t.id = rm.team_id
        join public.players p on p.id = rm.player_id
       where t.season_id = ${SEASON_2} and rm.voided_at is null`)
    const got = rows.map((r) => `${r.color_key}:${r.login}`).sort()
    const want = Object.entries(ROSTERS).flatMap(([team, logins]) => logins.map((l) => `${team}:${l}`)).sort()
    expect(got).toEqual(want)
    expect(rows.every((r) => r.starts === '2026-11-08' && r.ends === null)).toBe(true)
  })

  it('ends every Season 1 membership on 2026-11-07', async () => {
    const rows = await q<{ starts: string; ends: string | null }>(`
      select rm.starts_on::text as starts, rm.ends_on::text as ends
        from public.roster_memberships rm join public.teams t on t.id = rm.team_id
       where t.season_id = '${ID.season1}'`)
    expect(rows).toHaveLength(9)
    expect(rows.every((r) => r.ends === '2026-11-07')).toBe(true)
  })

  it('brings in each private detail exactly as the private file has it', async () => {
    for (const p of priv.players) {
      const row = (await q<Record<string, unknown>>(`select * from public.players where full_name = $1`, [p.full_name]))[0]
      expect(row, p.full_name).toBeDefined()
      expect(row?.jersey, `${p.full_name} jersey`).toBe(p.jersey)
      expect(row?.birth_year, `${p.full_name} birth year`).toBe(yearOf(p.birth_date))
      expect(Number(row?.height_in), `${p.full_name} height`).toBe(p.height_in)
      expect(row?.weight_lb, `${p.full_name} weight`).toBe(p.weight_lb)
      expect(row?.positions, `${p.full_name} positions`).toEqual(p.positions)
      expect(row?.nickname ?? null, `${p.full_name} nickname`).toBe(p.nickname ?? null)
      expect(row?.is_guest, `${p.full_name} is a real player`).toBe(false)
      expect(row?.login_name ?? null, `${p.full_name} login`).toBe(LOGIN_BY_NAME[p.full_name] ?? null)
    }
  })

  it('stores Maurice as a real QB with no team', async () => {
    const row = (await q<Record<string, unknown>>(`select * from public.players where full_name = 'Maurice Cohen'`))[0]
    expect(row?.is_guest).toBe(false)
    expect(row?.login_name).toBe('maurice')
    expect(row?.positions).toEqual(['QB'])
    expect(await count(`select 1 from public.roster_memberships rm where rm.player_id = '${ID.maurice}' and rm.ends_on is null`)).toBe(0)
  })

  it('adds the backups with no login and no team, and the name-only players with no details', async () => {
    for (const name of ['Joseph Cohen', 'Ilan Gorbatov']) {
      const row = (await q<Record<string, unknown>>(`select * from public.players where full_name = $1`, [name]))[0]
      expect(row, name).toBeDefined()
      expect(row?.is_guest).toBe(false)
      expect(row?.login_name ?? null).toBeNull()
    }
    for (const name of priv.details_still_to_come) {
      const row = (await q<Record<string, unknown>>(`select * from public.players where full_name = $1`, [name]))[0]
      expect(row, name).toBeDefined()
      expect(row?.jersey ?? null, name).toBeNull()
      expect(row?.birth_year ?? null, name).toBeNull()
      expect(row?.height_in ?? null, name).toBeNull()
      expect(row?.weight_lb ?? null, name).toBeNull()
    }
    const onTeam = await count(`
      select 1 from public.roster_memberships rm join public.players p on p.id = rm.player_id
       where p.full_name in ('Joseph Cohen', 'Ilan Gorbatov') and rm.ends_on is null`)
    expect(onTeam).toBe(0)
  })

  it('stores birth year only, never a full date', async () => {
    const cols = await q<{ column_name: string }>(`
      select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'players' and column_name like '%birth%'`)
    expect(cols).toEqual([{ column_name: 'birth_year' }])
  })

  it('keeps the Season 1 game and its season untouched', async () => {
    expect(await count(`select 1 from public.games where season_id = '${ID.season1}'`)).toBe(1)
    const s1 = await q<{ name: string; status: string }>(`select name, status from public.seasons where id = '${ID.season1}'`)
    expect(s1).toEqual([{ name: 'Season 1', status: 'finished' }])
  })

  it('schedules 18 regular games exactly as the spec table says, in New York time', async () => {
    const rows = await q<{ week: number; day: string; time: string; home: string; away: string }>(`
      select g.week, to_char(g.starts_at at time zone 'America/New_York', 'YYYY-MM-DD') as day,
             to_char(g.starts_at at time zone 'America/New_York', 'HH24:MI') as time,
             h.color_key as home, a.color_key as away
        from public.games g join public.teams h on h.id = g.home_team_id join public.teams a on a.id = g.away_team_id
       where g.season_id = ${SEASON_2} and g.kind = 'regular' order by g.starts_at`)
    expect(rows).toHaveLength(SCHEDULE.length)
    SCHEDULE.forEach(([week, day, time, home, away], i) => {
      expect(rows[i], `game ${i + 1}`).toEqual({ week, day, time, home, away })
    })
  })

  it('has every pair of teams meet exactly three times', async () => {
    const rows = await q<{ n: number }>(`
      select count(*)::int as n from public.games g
       where g.season_id = ${SEASON_2} and g.kind = 'regular'
       group by least(g.home_team_id, g.away_team_id), greatest(g.home_team_id, g.away_team_id)`)
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.n === 3)).toBe(true)
  })

  it('plays each Sunday at 12:15 and 13:45 New York time at Marine Park', async () => {
    const rows = await q<{ dow: number; time: string; field: string }>(`
      select extract(dow from g.starts_at at time zone 'America/New_York')::int as dow,
             to_char(g.starts_at at time zone 'America/New_York', 'HH24:MI') as time, g.field
        from public.games g where g.season_id = ${SEASON_2} and g.kind = 'regular'`)
    expect(rows.every((r) => r.dow === 0 && r.field === 'Marine Park')).toBe(true)
    expect(rows.filter((r) => r.time === '12:15')).toHaveLength(9)
    expect(rows.filter((r) => r.time === '13:45')).toHaveLength(9)
  })

  it('adds one playoff final for rank 1 against rank 2, with no date yet', async () => {
    const rows = await q<Record<string, unknown>>(`
      select kind, week, home_slot, away_slot, home_team_id, away_team_id, starts_at
        from public.games where season_id = ${SEASON_2} and kind = 'playoff'`)
    expect(rows).toEqual([
      { kind: 'playoff', week: 10, home_slot: 'rank:1', away_slot: 'rank:2', home_team_id: null, away_team_id: null, starts_at: null },
    ])
  })

  it('leaves the snapshot the same when the import runs a second time', async () => {
    const before = await snapshot()
    await db.exec(importSql)
    expect(await snapshot()).toBe(before)
    expect(await count(`select 1 from public.games where season_id = ${SEASON_2}`)).toBe(19)
    expect(await count(`select 1 from public.teams where season_id = ${SEASON_2}`)).toBe(4)
  })
})
