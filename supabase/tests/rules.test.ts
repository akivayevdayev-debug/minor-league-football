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
]

describe('logged out', () => {
  it.each(TABLES)('gets nothing from %s', async (table) => {
    await expect(as('anon', `select * from public.${table}`)).rejects.toThrow(/permission denied/)
  })

  it('cannot call actions', async () => {
    await expect(as('anon', 'select public.link_my_login()')).rejects.toThrow(/permission denied/)
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
