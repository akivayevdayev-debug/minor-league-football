/*
 * Checks data/private/import.sql against data/private/league-data.json on a local Postgres.
 * Holds no league data itself: every expected number is read from the private file at run time.
 * Skipped automatically on machines without the private folder (e.g. a fresh clone).
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const DATA = new URL('../../data/private/league-data.json', import.meta.url)
const IMPORT = new URL('../../data/private/import.sql', import.meta.url)
const has = existsSync(DATA) && existsSync(IMPORT)
const change = (f: string) => readFileSync(new URL(`../changes/${f}`, import.meta.url), 'utf8')

const STUB = `
  create role anon nologin; create role authenticated nologin; create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`
const STAT_KEYS: Record<string, string> = { recs: 'rec', targets: 'target', drops: 'drop', tds: 'td', fumbles: 'fumble', ints: 'int', pick6: 'pick6', conv: 'conv_old', blocks: 'block' }

interface LeagueData {
  teams: { name: string }[]
  players: { login_name: string; display_name: string; birth_date: string | null }[]
  games_played: { teams: [string, string]; score: [number, number] }[]
  standings_confirmed_by_akiva: { team: string; w: number; l: number }[]
  stats_as_sent: Record<string, number[]> & { columns: string[] }
}

describe.skipIf(!has)('import of the real league data', () => {
  let db: PGlite
  let data: LeagueData

  beforeAll(async () => {
    data = JSON.parse(readFileSync(DATA, 'utf8'))
    db = new PGlite()
    await db.exec(STUB)
    await db.exec(change('001_initial_schema.sql'))
    await db.exec(change('002_reference_data.sql'))
    await db.exec(readFileSync(IMPORT, 'utf8'))
  })

  const one = async (sql: string) => (await db.query<{ v: number }>(sql)).rows[0]?.v

  it('brings in every person and team', async () => {
    expect(await one('select count(*)::int as v from public.players')).toBe(data.players.length)
    expect(await one('select count(*)::int as v from public.teams')).toBe(data.teams.length)
  })

  it('stores birth year only, never a full date', async () => {
    const rows = await db.query<{ login_name: string; birth_year: number | null }>('select login_name, birth_year from public.players')
    for (const p of data.players) {
      const row = rows.rows.find((r) => r.login_name === p.login_name)
      expect(row?.birth_year ?? null).toBe(p.birth_date ? Number(p.birth_date.match(/\d{4}/)?.[0]) : null)
    }
  })

  it('brings in each saved game with its final score', async () => {
    const rows = await db.query<{ home: string; away: string; hp: number; ap: number }>(`
      select h.name as home, a.name as away, s.home_points as hp, s.away_points as ap
      from public.game_scores s join public.teams h on h.id = s.home_team_id join public.teams a on a.id = s.away_team_id`)
    expect(rows.rows).toHaveLength(data.games_played.length)
    for (const g of data.games_played) {
      expect(rows.rows).toContainEqual({ home: g.teams[0], away: g.teams[1], hp: g.score[0], ap: g.score[1] })
    }
  })

  it('matches the confirmed records in the standings', async () => {
    const rows = await db.query<{ name: string; wins: number; losses: number }>(
      `select t.name, s.wins, s.losses from public.standings s join public.teams t on t.id = s.team_id`,
    )
    for (const s of data.standings_confirmed_by_akiva) {
      expect(rows.rows).toContainEqual({ name: s.team, wins: s.w, losses: s.l })
    }
    expect(await one(`select sum(wins + losses)::int / 2 as v from public.standings`)).toBe(
      data.standings_confirmed_by_akiva.reduce((sum, s) => sum + s.w + s.l, 0) / 2,
    )
  })

  it('keeps every old stat sheet number, in a season that never counts for standings', async () => {
    const rows = await db.query<{ login_name: string; stat_type_id: string; total: number; counts: boolean }>(`
      select p.login_name, t.stat_type_id, t.total, s.counts_for_standings as counts
      from public.player_stat_totals t join public.players p on p.id = t.player_id join public.seasons s on s.id = t.season_id`)
    for (const [key, statType] of Object.entries(STAT_KEYS)) {
      data.stats_as_sent.columns.forEach((col, i) => {
        const player = data.players.find((p) => p.display_name === col)!
        const expected = data.stats_as_sent[key]![i] ?? 0
        const row = rows.rows.find((r) => r.login_name === player.login_name && r.stat_type_id === statType)
        expect(row?.total ?? 0, `${statType} for column ${i}`).toBe(expected)
      })
    }
    expect(rows.rows.every((r) => r.counts === false)).toBe(true)
  })

  it('refuses to run twice', async () => {
    await expect(db.exec(readFileSync(IMPORT, 'utf8'))).rejects.toThrow(/already been run/)
  })
})
