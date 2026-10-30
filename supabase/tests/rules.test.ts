/*
 * Database rules, tested on a local Postgres (PGlite) that imitates Supabase's login roles.
 * Proves: logged out = nothing, unlinked = nothing, no deletes, history fills itself,
 * only confirmed logins link, only the league manager reorders stats, standings add up.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const sql = (file: string) => readFileSync(new URL(`../changes/${file}`, import.meta.url), 'utf8')

// The bits of Supabase that our schema leans on: roles, auth.users, auth.uid(), and its
// default "expose everything to anon" grants (the worst case our revokes must undo).
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
`

const AKIVA = '00000000-0000-0000-0000-00000000000a'
const EDDIE = '00000000-0000-0000-0000-00000000000e'
const STRANGER = '00000000-0000-0000-0000-000000000005'

let db: PGlite

async function as<T>(user: string | 'anon', query: string, params: unknown[] = []): Promise<T[]> {
  const role = user === 'anon' ? 'anon' : 'authenticated'
  const sub = user === 'anon' ? '' : user
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub])
    await tx.exec(`set local role ${role}`)
    const res = await tx.query<T>(query, params)
    return res.rows
  })
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(sql('001_initial_schema.sql'))
  await db.exec(sql('002_reference_data.sql'))
  await db.exec(sql('003_game_night_trades_projections.sql'))
  await db.exec(sql('004_photos.sql'))
  // Owner setup (as in the SQL editor): players, teams, a season.
  await db.exec(`
    insert into public.players (full_name, login_name) values ('Akiva Test', 'akiva'), ('Eddie Test', 'eddie'), ('Leon Test', 'leo');
    insert into public.teams (id, name, short_name, color_key) values
      ('10000000-0000-0000-0000-000000000001', 'Tigers', 'TIG', 'tigers'),
      ('10000000-0000-0000-0000-000000000002', 'Speed Demons', 'SD', 'demons'),
      ('10000000-0000-0000-0000-000000000003', 'Daybies', 'DAY', 'daybies');
    insert into public.seasons (id, name) values ('20000000-0000-0000-0000-000000000001', 'Test season');
  `)
  // Logins: Akiva and Eddie confirmed (the owner ticks auto-confirm); a stranger signs up as "leo", unconfirmed.
  await db.exec(`
    insert into auth.users values ('${AKIVA}', 'akiva@mlf.invalid', now()), ('${EDDIE}', 'eddie@mlf.invalid', now());
    insert into auth.users values ('${STRANGER}', 'leo@mlf.invalid', null);
    update public.member_logins set is_league_manager = true where user_id = '${EDDIE}';
  `)
})

const TABLES = [
  'settings', 'seasons', 'scoring_types', 'stat_types', 'players', 'teams', 'roster_memberships',
  'member_logins', 'games', 'score_events', 'stat_events', 'record_adjustments', 'edit_history',
  'game_scores', 'standings', 'player_stat_totals', 'current_rosters',
  'game_clocks', 'trades', 'current_season', 'player_projections', 'game_projections',
]

describe('logged out', () => {
  it.each(TABLES)('gets nothing from %s', async (table) => {
    await expect(as('anon', `select * from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('cannot call actions', async () => {
    await expect(as('anon', 'select public.link_my_login()')).rejects.toThrow(/permission denied/)
    await expect(as('anon', `select public.set_final_score(gen_random_uuid(), 1, 2)`)).rejects.toThrow(/permission denied/)
    await expect(as('anon', `select public.make_trade(gen_random_uuid(), '{}', gen_random_uuid(), '{}')`)).rejects.toThrow(/permission denied/)
  })
})

describe('linking logins to players', () => {
  it('links a confirmed login to the player with the same login name', async () => {
    const rows = await db.query<{ n: number }>(`select count(*)::int as n from public.member_logins`)
    expect(rows.rows[0]?.n).toBe(2)
  })

  it('never links an unconfirmed login, so nobody can sign up as someone else', async () => {
    const rows = await as<{ link_my_login: string | null }>(STRANGER, 'select public.link_my_login()')
    expect(rows[0]?.link_my_login).toBeNull()
  })

  it('shows an unlinked login nothing at all', async () => {
    expect(await as(STRANGER, 'select * from public.players')).toEqual([])
    expect(await as(STRANGER, 'select * from public.member_logins')).toEqual([])
  })

  it('lets a linked login see its own link', async () => {
    const rows = await as<{ user_id: string }>(AKIVA, 'select user_id from public.member_logins where user_id = auth.uid()')
    expect(rows).toHaveLength(1)
  })
})

describe('members', () => {
  it('can add and change rows, and the stamps cannot be forged', async () => {
    const [guest] = await as<{ id: string; created_by: string }>(
      AKIVA,
      `insert into public.players (full_name, is_guest, created_by) values ('Guest Sub', true, '${EDDIE}') returning id, created_by`,
    )
    expect(guest?.created_by).toBe(AKIVA)
    await as(AKIVA, `update public.players set nickname = 'Subby' where id = $1`, [guest?.id])
  })

  it.each(['players', 'score_events', 'edit_history', 'member_logins'])('cannot delete from %s', async (table) => {
    await expect(as(AKIVA, `delete from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('cannot write the edit history or links by hand', async () => {
    await expect(
      as(AKIVA, `insert into public.edit_history (table_name, row_id, action, after) values ('x', 'y', 'insert', '{}')`),
    ).rejects.toThrow(/permission denied/)
    await expect(as(AKIVA, `update public.member_logins set is_league_manager = true`)).rejects.toThrow(/permission denied/)
  })

  it('every change lands in the edit history with who did it', async () => {
    const rows = await as<{ action: string; changed_by: string; before: { nickname: string | null } | null }>(
      AKIVA,
      `select action, changed_by, before from public.edit_history where table_name = 'players' and changed_by = auth.uid() order by id`,
    )
    expect(rows.map((r) => r.action)).toEqual(['insert', 'update'])
    expect(rows[1]?.before?.nickname).toBeNull()
  })

  it('can void instead of delete', async () => {
    const rows = await as<{ voided_at: string }>(
      AKIVA,
      `update public.players set voided_at = now() where full_name = 'Guest Sub' returning voided_at`,
    )
    expect(rows[0]?.voided_at).toBeTruthy()
  })
})

describe('league manager', () => {
  it('is the only one who can change the stat order', async () => {
    await expect(as(AKIVA, `update public.stat_types set display_order = 50 where id = 'rec'`)).rejects.toThrow(
      /Only the league manager/,
    )
    await as(EDDIE, `update public.stat_types set display_order = 50 where id = 'rec'`)
  })

  it('lets members still switch a stat type on or off', async () => {
    await as(AKIVA, `update public.stat_types set active = false where id = 'block'`)
  })
})

describe('calculations', () => {
  it('works out standings from final games plus record adjustments', async () => {
    const season = '20000000-0000-0000-0000-000000000001'
    const tig = '10000000-0000-0000-0000-000000000001'
    const sd = '10000000-0000-0000-0000-000000000002'
    const day = '10000000-0000-0000-0000-000000000003'
    const [game] = await as<{ id: string }>(
      AKIVA,
      `insert into public.games (season_id, home_team_id, away_team_id, status) values ($1, $2, $3, 'final') returning id`,
      [season, tig, day],
    )
    await as(
      AKIVA,
      `insert into public.score_events (game_id, team_id, scoring_type_id, points) values
        ($1, $2, 'final_manual', 21), ($1, $3, 'final_manual', 14), ($1, $3, 'final_manual', 30)`,
      [game?.id, tig, day],
    )
    // The 30 is a mistake, voided: it must not count.
    await as(AKIVA, `update public.score_events set voided_at = now() where points = 30`)
    await as(
      AKIVA,
      `insert into public.record_adjustments (season_id, team_id, wins, losses, note) values ($1, $2, 2, 1, 'Older games')`,
      [season, sd],
    )
    const rows = await as<{ team_id: string; wins: number; losses: number; points_for: number; rank: string }>(
      AKIVA,
      `select team_id, wins, losses, points_for, rank from public.standings where season_id = $1 order by rank`,
      [season],
    )
    expect(rows.map((r) => [r.team_id, r.wins, r.losses, r.points_for, Number(r.rank)])).toEqual([
      [tig, 1, 0, 21, 1],
      [sd, 2, 1, 0, 2],
      [day, 0, 1, 14, 3],
    ])
  })

  it('moves a player to a new team and keeps the old line', async () => {
    const [leo] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'leo'`)
    const tig = '10000000-0000-0000-0000-000000000001'
    const sd = '10000000-0000-0000-0000-000000000002'
    await as(AKIVA, `select public.move_player($1, $2, '2026-09-01')`, [leo?.id, tig])
    await as(AKIVA, `select public.move_player($1, $2, '2026-10-01')`, [leo?.id, sd])
    const rows = await as<{ team_id: string; ends_on: string | null }>(
      AKIVA,
      `select team_id, ends_on::text from public.roster_memberships where player_id = $1 order by starts_on`,
      [leo?.id],
    )
    expect(rows).toEqual([
      { team_id: tig, ends_on: '2026-10-01' },
      { team_id: sd, ends_on: null },
    ])
  })
})

describe('game night, trades and projections (change 003)', () => {
  const season = '20000000-0000-0000-0000-000000000001'
  const tig = '10000000-0000-0000-0000-000000000001'
  const sd = '10000000-0000-0000-0000-000000000002'
  const day = '10000000-0000-0000-0000-000000000003'

  it('types in a final score in one step and voids the old lines', async () => {
    const [game] = await as<{ id: string }>(
      AKIVA,
      `insert into public.games (season_id, home_team_id, away_team_id) values ($1, $2, $3) returning id`,
      [season, sd, day],
    )
    await as(AKIVA, `insert into public.score_events (game_id, team_id, scoring_type_id, points) values ($1, $2, 'td', 6)`, [game?.id, sd])
    await as(AKIVA, `select public.set_final_score($1, 28, 35)`, [game?.id])
    const [score] = await as<{ status: string; home_points: number; away_points: number }>(
      AKIVA,
      `select status, home_points, away_points from public.game_scores where game_id = $1`,
      [game?.id],
    )
    expect(score).toEqual({ status: 'final', home_points: 28, away_points: 35 })
    const voided = await as(AKIVA, `select 1 from public.score_events where game_id = $1 and voided_at is not null`, [game?.id])
    expect(voided).toHaveLength(1)
  })

  it('refuses silly scores', async () => {
    const [game] = await as<{ id: string }>(AKIVA, `select id from public.games limit 1`)
    await expect(as(AKIVA, `select public.set_final_score($1, 500, 0)`, [game?.id])).rejects.toThrow(/between 0 and 200/)
  })

  it('swaps players in a trade, keeps the old lines and records it', async () => {
    const [akiva] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'akiva'`)
    const [leo] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'leo'`)
    await as(AKIVA, `select public.move_player($1, $2, '2026-09-01')`, [akiva?.id, day])
    // Leo is on Speed Demons from the earlier test.
    await as(AKIVA, `select public.make_trade($1, array[$2]::uuid[], $3, array[$4]::uuid[], '2026-10-20', 'Test trade')`, [day, akiva?.id, sd, leo?.id])
    const now = await as<{ player_id: string; team_id: string }>(
      AKIVA,
      `select player_id, team_id from public.current_rosters where player_id in ($1, $2) order by team_id`,
      [akiva?.id, leo?.id],
    )
    expect(now).toEqual(expect.arrayContaining([{ player_id: akiva?.id, team_id: sd }, { player_id: leo?.id, team_id: day }]))
    const trades = await as<{ note: string }>(AKIVA, `select note from public.trades`)
    expect(trades).toEqual([{ note: 'Test trade' }])
  })

  it('refuses a trade when a player is not on that team', async () => {
    const [akiva] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'akiva'`)
    await expect(
      as(AKIVA, `select public.make_trade($1, array[$2]::uuid[], $3, '{}')`, [day, akiva?.id, tig]),
    ).rejects.toThrow(/not on that team/)
  })

  it('projects players from their stats and their team games', async () => {
    const [akiva] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'akiva'`)
    await as(
      AKIVA,
      `insert into public.stat_events (season_id, player_id, stat_type_id, value) values ($1, $2, 'td', 4), ($1, $2, 'rec', 10)`,
      [season, akiva?.id],
    )
    const [p] = await as<{ games: number; td_per_game: string; points_total: string; points_per_game: string }>(
      AKIVA,
      `select games, td_per_game, points_total, points_per_game from public.player_projections where player_id = $1`,
      [akiva?.id],
    )
    // Speed Demons: 2-1 adjustment + the 28-35 loss = 4 games. 4 TD x 6 + 10 catches x 1 = 34 points.
    expect({ ...p, td_per_game: Number(p?.td_per_game), points_total: Number(p?.points_total), points_per_game: Number(p?.points_per_game) })
      .toEqual({ games: 4, td_per_game: 1, points_total: 34, points_per_game: 8.5 })
  })

  it('projects an upcoming game between teams that have played', async () => {
    const [game] = await as<{ id: string }>(
      AKIVA,
      `insert into public.games (season_id, home_team_id, away_team_id) values ($1, $2, $3) returning id`,
      [season, tig, day],
    )
    const [g] = await as<{ home_points: number; away_points: number; home_win_chance: string }>(
      AKIVA,
      `select home_points, away_points, home_win_chance from public.game_projections where game_id = $1`,
      [game?.id],
    )
    // Tigers: scored 21, let in 14. Daybies: scored 14 and 35 (avg 24.5), let in 21 and 28 (avg 24.5).
    expect(g?.home_points).toBe(Math.round((21 + 24.5) / 2))
    expect(g?.away_points).toBe(Math.round((24.5 + 14) / 2))
    expect(Number(g?.home_win_chance)).toBeGreaterThan(0.5)
  })

  it('keeps a game clock that only members can change', async () => {
    const [game] = await as<{ id: string }>(AKIVA, `select id from public.games limit 1`)
    await as(AKIVA, `insert into public.game_clocks (game_id, seconds_left) values ($1, 600)`, [game?.id])
    await as(AKIVA, `update public.game_clocks set running = true, started_at = public.server_now() where game_id = $1`, [game?.id])
    await expect(as(STRANGER, `update public.game_clocks set running = false where game_id = $1`, [game?.id]).then((r) => r.length)).resolves.toBe(0)
    const [c] = await as<{ running: boolean }>(AKIVA, `select running from public.game_clocks where game_id = $1`, [game?.id])
    expect(c?.running).toBe(true)
  })
})

describe('playoffs', () => {
  it('never lets the championship game change the regular-season table', async () => {
    const season = '20000000-0000-0000-0000-000000000001'
    const tig = '10000000-0000-0000-0000-000000000001'
    const sd = '10000000-0000-0000-0000-000000000002'
    const table = () =>
      as<{ team_id: string; wins: number; losses: number; points_for: number }>(
        AKIVA,
        `select team_id, wins, losses, points_for from public.standings where season_id = $1 order by team_id`,
        [season],
      )
    const before = await table()
    const [game] = await as<{ id: string }>(
      AKIVA,
      `insert into public.games (season_id, home_team_id, away_team_id, kind) values ($1, $2, $3, 'playoff') returning id`,
      [season, tig, sd],
    )
    await as(AKIVA, `select public.set_final_score($1, 40, 12)`, [game?.id])
    const [score] = await as<{ kind: string; status: string }>(AKIVA, `select kind, status from public.game_scores where game_id = $1`, [game?.id])
    expect(score).toEqual({ kind: 'playoff', status: 'final' })
    expect(await table()).toEqual(before)
  })
})

describe('photos (change 004)', () => {
  const tig = '10000000-0000-0000-0000-000000000001'
  const file = (folder: string) => `${folder}/${crypto.randomUUID()}.webp`

  it('keeps the photos bucket private', async () => {
    const [b] = (await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'photos'`)).rows
    expect(b?.public).toBe(false)
  })

  it('lets a member add and see a player photo, then point the player at it', async () => {
    const [p] = await as<{ id: string }>(AKIVA, `select id from public.players where login_name = 'akiva'`)
    const name = file(`players/${p?.id}`)
    await as(AKIVA, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [name])
    await expect(as(EDDIE, `select name from storage.objects where name = $1`, [name]).then((r) => r.length)).resolves.toBe(1)
    await as(AKIVA, `update public.players set photo_path = $1 where id = $2`, [name, p?.id])
    const [h] = await as<{ n: number }>(AKIVA, `select count(*)::int as n from public.edit_history where table_name = 'players' and row_id = $1`, [p?.id])
    expect(h?.n).toBeGreaterThan(0)
  })

  it('accepts team logos and team photos', async () => {
    const logo = `teams/${tig}/logo-${crypto.randomUUID()}.webp`
    const photo = `teams/${tig}/photo-${crypto.randomUUID()}.jpg`
    await as(AKIVA, `insert into storage.objects (bucket_id, name) values ('photos', $1), ('photos', $2)`, [logo, photo])
    await as(AKIVA, `update public.teams set logo_path = $1, photo_path = $2 where id = $3`, [logo, photo, tig])
    const [t] = await as<{ logo_path: string }>(AKIVA, `select logo_path from public.teams where id = $1`, [tig])
    expect(t?.logo_path).toBe(logo)
  })

  it('keeps photos away from logged-out visitors and unlinked logins', async () => {
    await expect(as('anon', `select name from storage.objects where bucket_id = 'photos'`).then((r) => r.length)).resolves.toBe(0)
    await expect(as(STRANGER, `select name from storage.objects where bucket_id = 'photos'`).then((r) => r.length)).resolves.toBe(0)
    await expect(as(STRANGER, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [file(`players/${tig}`)])).rejects.toThrow()
  })

  it('refuses odd file names, overwrites and deletes', async () => {
    await expect(as(AKIVA, `insert into storage.objects (bucket_id, name) values ('photos', 'anything/evil.html')`)).rejects.toThrow()
    await expect(as(AKIVA, `update public.players set photo_path = 'http://elsewhere/x.png' where login_name = 'akiva'`)).rejects.toThrow()
    await expect(as(AKIVA, `update storage.objects set name = 'x' where bucket_id = 'photos'`).then((r) => r.length)).resolves.toBe(0)
    await expect(as(AKIVA, `delete from storage.objects where bucket_id = 'photos'`).then((r) => r.length)).resolves.toBe(0)
  })
})
