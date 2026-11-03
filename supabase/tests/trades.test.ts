/*
 * Trades and captains (migration 008, section 3), tested on a local Postgres (PGlite).
 * Proves: only a team's captains (two allowed) offer trades for their own team, Eddie or Maurice
 * decides (first answer wins), approval moves the players, vetoes are kept, rosters can't be
 * changed around a trade, Akiva can do anything, and captains edit only their team's name and logo.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { SUPABASE_STUB, runAs, sql } from './helpers'

const U = {
  akiva: '00000000-0000-0000-0000-00000000000a',
  eddie: '00000000-0000-0000-0000-00000000000e',
  maurice: '00000000-0000-0000-0000-0000000000b1',
  david: '00000000-0000-0000-0000-0000000000b2',
  ilan: '00000000-0000-0000-0000-0000000000b3',
  leo: '00000000-0000-0000-0000-0000000000b4',
  mair: '00000000-0000-0000-0000-0000000000b5',
}
const P = {
  akiva: '30000000-0000-0000-0000-000000000001',
  eddie: '30000000-0000-0000-0000-000000000002',
  maurice: '30000000-0000-0000-0000-000000000003',
  david: '30000000-0000-0000-0000-000000000004',
  ilan: '30000000-0000-0000-0000-000000000005',
  leo: '30000000-0000-0000-0000-000000000006',
  mair: '30000000-0000-0000-0000-000000000007',
  ben: '30000000-0000-0000-0000-000000000008',
  max: '30000000-0000-0000-0000-000000000009',
  sam: '30000000-0000-0000-0000-00000000000a',
}
const SHPITZY = '40000000-0000-0000-0000-000000000001'
const SUCKS = '40000000-0000-0000-0000-000000000002'

let db: PGlite
const as = <T>(user: string, query: string, params: unknown[] = []) => runAs<T>(db, user, query, params)

const teamOf = async (player: string) =>
  (
    await db.query<{ team_id: string | null }>(
      `select team_id from public.roster_memberships where player_id = $1 and ends_on is null and voided_at is null`,
      [player],
    )
  ).rows[0]?.team_id ?? null

const tradeRow = async (id: string) =>
  (
    await db.query<{ status: string; decided_by: string | null; proposed_by: string | null; traded_on: string }>(
      `select status, decided_by, proposed_by, traded_on::text from public.trades where id = $1`,
      [id],
    )
  ).rows[0]

const propose = async (user: string, teamA: string, playersA: string[], teamB: string, playersB: string[]) =>
  (
    await as<{ id: string }>(user, `select public.propose_trade($1, $2::uuid[], $3, $4::uuid[], 'test') as id`, [
      teamA,
      playersA,
      teamB,
      playersB,
    ])
  )[0].id

const decide = (user: string, id: string, approve: boolean) =>
  as(user, `select public.decide_trade($1, $2)`, [id, approve])

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
  const logins = ['akiva', 'eddie', 'maurice', 'david', 'ilan', 'leo', 'mair'] as const
  await db.exec(`
    insert into public.seasons (name) values ('2026 season');
    insert into public.players (id, full_name, login_name) values
      ${logins.map((k) => `('${P[k]}', '${k} Test', '${k}')`).join(', ')},
      ('${P.ben}', 'Ben Test', null), ('${P.max}', 'Max Test', null), ('${P.sam}', 'Sam Test', null);
    insert into auth.users values ${logins.map((k) => `('${U[k]}', '${k}@mlf.invalid', now())`).join(', ')};
    update public.member_logins set is_league_manager = true where user_id = '${U.eddie}';
  `)
  await db.exec(sql('008_season_2.sql'))
  const season2 = (await db.query<{ id: string }>(`select id from public.seasons where name = 'Season 2'`)).rows[0].id
  await db.exec(`
    insert into public.teams (id, season_id, name, short_name, color_key, captain_player_id, co_captain_player_id) values
      ('${SHPITZY}', '${season2}', 'Shpitzy', 'SHPITZY', 'shpitzy', '${P.david}', '${P.ilan}'),
      ('${SUCKS}', '${season2}', 'Team Sucks', 'SUCKS', 'sucks', '${P.leo}', null);
    insert into public.roster_memberships (player_id, team_id, starts_on) values
      ('${P.david}', '${SHPITZY}', current_date + 5), ('${P.ben}', '${SHPITZY}', current_date + 5),
      ('${P.max}', '${SHPITZY}', current_date + 5),
      ('${P.leo}', '${SUCKS}', current_date + 5), ('${P.mair}', '${SUCKS}', current_date + 5),
      ('${P.sam}', '${SUCKS}', current_date + 5);
  `)
})

describe('offering a trade', () => {
  it('lets a captain offer a trade for their own team; it waits and nobody moves yet', async () => {
    const id = await propose(U.david, SHPITZY, [P.ben], SUCKS, [P.sam])
    const row = await tradeRow(id)
    expect(row.status).toBe('pending')
    expect(row.proposed_by).toBe(P.david)
    expect(await teamOf(P.ben)).toBe(SHPITZY)
    expect(await teamOf(P.sam)).toBe(SUCKS)
    await decide(U.akiva, id, false) // tidy up
  })

  it('lets the second captain (Ilan) offer one too', async () => {
    const id = await propose(U.ilan, SHPITZY, [P.max], SUCKS, [])
    expect((await tradeRow(id)).status).toBe('pending')
    await decide(U.akiva, id, false)
  })

  it('refuses a captain offering a trade for another team', async () => {
    await expect(propose(U.david, SUCKS, [P.sam], SHPITZY, [P.ben])).rejects.toThrow(/captain/)
  })

  it('refuses a player who is not a captain', async () => {
    await expect(propose(U.mair, SUCKS, [P.sam], SHPITZY, [P.ben])).rejects.toThrow(/captain/)
  })

  it('refuses a player who is not on that team', async () => {
    await expect(propose(U.david, SHPITZY, [P.sam], SUCKS, [])).rejects.toThrow(/not on that team/)
  })

  it('refuses a trade with nobody in it', async () => {
    await expect(propose(U.david, SHPITZY, [], SUCKS, [])).rejects.toThrow(/at least one player/)
  })
})

describe('approving and vetoing', () => {
  it('Maurice approves: players swap teams, and the move is never before their roster start', async () => {
    const id = await propose(U.david, SHPITZY, [P.ben], SUCKS, [P.sam])
    await decide(U.maurice, id, true)
    const row = await tradeRow(id)
    expect(row.status).toBe('approved')
    expect(row.decided_by).toBe(P.maurice)
    expect(await teamOf(P.ben)).toBe(SUCKS)
    expect(await teamOf(P.sam)).toBe(SHPITZY)
    const start = (await db.query<{ d: string }>(`select (current_date + 5)::text as d`)).rows[0].d
    expect(row.traded_on).toBe(start)
  })

  it('the first answer decides: a later veto is refused', async () => {
    const id = await propose(U.leo, SUCKS, [P.ben], SHPITZY, [P.sam])
    await decide(U.eddie, id, true)
    await expect(decide(U.maurice, id, false)).rejects.toThrow(/already approved/)
    expect(await teamOf(P.ben)).toBe(SHPITZY)
  })

  it('a veto keeps everyone where they are and keeps the trade as "vetoed"', async () => {
    const id = await propose(U.david, SHPITZY, [P.max], SUCKS, [])
    await decide(U.eddie, id, false)
    expect((await tradeRow(id)).status).toBe('vetoed')
    expect(await teamOf(P.max)).toBe(SHPITZY)
    await expect(decide(U.maurice, id, true)).rejects.toThrow(/already vetoed/)
  })

  it('a captain cannot approve their own trade', async () => {
    const id = await propose(U.david, SHPITZY, [P.max], SUCKS, [])
    await expect(decide(U.david, id, true)).rejects.toThrow(/Eddie or Maurice/)
    await expect(decide(U.mair, id, true)).rejects.toThrow(/Eddie or Maurice/)
    expect((await tradeRow(id)).status).toBe('pending')
    await decide(U.akiva, id, false)
  })

  it('refuses to approve when a player has left that team since the offer', async () => {
    const id = await propose(U.david, SHPITZY, [P.max], SUCKS, [])
    await as(U.eddie, `select public.move_player($1, null)`, [P.max])
    await expect(decide(U.maurice, id, true)).rejects.toThrow(/not on that team/)
    expect((await tradeRow(id)).status).toBe('pending')
    await decide(U.akiva, id, false)
    await db.exec(`insert into public.roster_memberships (player_id, team_id, starts_on) values ('${P.max}', '${SHPITZY}', current_date + 6)`)
  })
})

describe('no way around a trade', () => {
  it('a member cannot write trades directly', async () => {
    await expect(
      as(U.david, `insert into public.trades (team_a_id, team_b_id, players_a, players_b, status) values ($1, $2, $3::uuid[], '{}', 'approved')`, [
        SHPITZY,
        SUCKS,
        [P.max],
      ]),
    ).rejects.toThrow()
    const id = await propose(U.david, SHPITZY, [P.max], SUCKS, [])
    const changed = await as(U.david, `update public.trades set status = 'approved' where id = $1 returning id`, [id])
    expect(changed).toHaveLength(0)
    expect((await tradeRow(id)).status).toBe('pending')
    await decide(U.akiva, id, false)
  })

  it('a member cannot move players on the roster directly', async () => {
    await expect(as(U.david, `select public.move_player($1, $2)`, [P.max, SUCKS])).rejects.toThrow()
    const ended = await as(U.david, `update public.roster_memberships set ends_on = current_date + 9 where player_id = $1 returning id`, [P.max])
    expect(ended).toHaveLength(0)
    expect(await teamOf(P.max)).toBe(SHPITZY)
  })

  it('only Akiva can make an instant trade', async () => {
    await expect(
      as(U.eddie, `select public.make_trade($1, $2::uuid[], $3, '{}'::uuid[])`, [SHPITZY, [P.max], SUCKS]),
    ).rejects.toThrow(/captain/)
    const [{ id }] = await as<{ id: string }>(U.akiva, `select public.make_trade($1, $2::uuid[], $3, '{}'::uuid[]) as id`, [
      SHPITZY,
      [P.max],
      SUCKS,
    ])
    expect((await tradeRow(id)).status).toBe('approved')
    expect(await teamOf(P.max)).toBe(SUCKS)
  })

  it('Akiva can fix a trade row by hand', async () => {
    const id = await propose(U.leo, SUCKS, [P.max], SHPITZY, [])
    const changed = await as(U.akiva, `update public.trades set note = 'fixed' where id = $1 returning id`, [id])
    expect(changed).toHaveLength(1)
    await decide(U.akiva, id, false)
  })
})

describe('captains and team details', () => {
  const rename = (user: string, team: string, name: string) =>
    as<{ id: string }>(user, `update public.teams set name = $2 where id = $1 returning id`, [team, name])

  it('a captain (either one) renames their own team and changes its logo', async () => {
    expect(await rename(U.david, SHPITZY, 'Shpitzy FC')).toHaveLength(1)
    expect(await rename(U.ilan, SHPITZY, 'Shpitzy')).toHaveLength(1)
    const logo = await as(U.leo, `update public.teams set logo_path = $2, short_name = 'SCK' where id = $1 returning id`, [
      SUCKS,
      `teams/${SUCKS}/logo-${SUCKS}.png`,
    ])
    expect(logo).toHaveLength(1)
  })

  it('a captain cannot rename another team, and a player cannot rename any team', async () => {
    expect(await rename(U.david, SUCKS, 'Losers')).toHaveLength(0)
    expect(await rename(U.mair, SUCKS, 'Losers')).toHaveLength(0)
    expect(await rename(U.eddie, SUCKS, 'Losers')).toHaveLength(0)
  })

  it('a captain cannot change the colour, the captains or remove the team', async () => {
    await expect(as(U.david, `update public.teams set color_key = 'sucks' where id = $1`, [SHPITZY])).rejects.toThrow(/Ask Akiva/)
    await expect(as(U.david, `update public.teams set co_captain_player_id = null where id = $1`, [SHPITZY])).rejects.toThrow(/Ask Akiva/)
    await expect(as(U.david, `update public.teams set voided_at = now() where id = $1`, [SHPITZY])).rejects.toThrow(/Ask Akiva/)
  })

  it('Akiva can change anything about any team', async () => {
    const changed = await as(U.akiva, `update public.teams set co_captain_player_id = $2, name = 'Team Sucks' where id = $1 returning id`, [
      SUCKS,
      P.mair,
    ])
    expect(changed).toHaveLength(1)
  })
})

describe('owner tools: signing people out', () => {
  const asRole = async (role: string, sub: string, query: string, params: unknown[] = []) =>
    db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub])
      await tx.exec(`set local role ${role}`)
      return (await tx.query<{ n: number }>(query, params)).rows
    })

  it('no app login can end sessions, not even Akiva', async () => {
    await db.exec(`insert into auth.sessions (user_id) values ('${U.david}'), ('${U.leo}')`)
    await expect(asRole('authenticated', U.akiva, `select public.owner_end_sessions($1::uuid[]) as n`, [[U.david]])).rejects.toThrow()
    await expect(asRole('anon', '', `select public.owner_end_sessions($1::uuid[]) as n`, [[U.david]])).rejects.toThrow()
  })

  it('the server function (secret key) ends only the sessions it names', async () => {
    const [{ n }] = await asRole('service_role', '', `select public.owner_end_sessions($1::uuid[]) as n`, [[U.david]])
    expect(n).toBe(1)
    const left = (await db.query<{ user_id: string }>(`select user_id from auth.sessions`)).rows.map((r) => r.user_id)
    expect(left).toEqual([U.leo])
  })
})
