/*
 * owner-tools: Akiva's Developer tools that need the login system's secret key.
 *   list_logins        every login with its player and last sign-in (no passwords; they can't be read)
 *   set_password       a new temporary password for one player; they must pick their own at next sign-in
 *   reset_everyone     the same for every login except the owner, plus sign-out (after the leak)
 *   sign_out_everyone  ends every session except the owner's
 *   create_logins      accounts for rostered players who have none yet, each with a temporary password
 * Only the owner's login may call it: the caller's token is checked, then member_logins.is_owner.
 * The secret key comes from Supabase's own environment (SUPABASE_SECRET_KEYS); it is never in the
 * app or in git. Temporary passwords are returned once, to the owner's screen, and never stored.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isResetTarget, loginEmail, makeTempPassword, missingLogins, parseAction, type MissingLogin } from './logic.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const secretKey = (): string => {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (keys) return JSON.parse(keys)['default']
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch {
    return reply(500, { error: 'Something went wrong on the server. Check the logins list before trying again.' })
  }
})

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Not allowed.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Who is calling? Only the owner's login gets past here.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who, error: whoError } = token ? await admin.auth.getUser(token) : { data: null, error: true }
  if (whoError || !who?.user) return reply(401, { error: 'Sign in again.' })
  const { data: me } = await admin.from('member_logins').select('is_owner').eq('user_id', who.user.id).maybeSingle()
  if (!me?.is_owner) return reply(403, { error: 'Only Akiva can use the Developer tools.' })

  const action = parseAction(await req.json().catch(() => null))
  if (!action) return reply(400, { error: 'That request was not understood.' })

  // Everyone with a login, with their player.
  const { data: logins, error: loginsError } = await admin
    .from('member_logins')
    .select('user_id, player_id, is_owner, must_change_password, players(full_name, login_name)')
  if (loginsError) return reply(500, { error: 'Could not read the logins. Try again.' })

  type Login = (typeof logins)[number]
  const nameOf = (l: Login) => {
    const p = Array.isArray(l.players) ? l.players[0] : l.players
    return { full_name: p?.full_name ?? '', login_name: p?.login_name ?? '' }
  }

  // Gives one login a temporary password, marks it "must choose a new one", and signs it out.
  // Every step is checked. Once the password has changed, the reply always carries it (otherwise that
  // player is locked out), with `problem` naming any later step that failed so Akiva can redo it.
  const resetOne = async (l: Login) => {
    const base = { ...nameOf(l), player_id: l.player_id }
    const password = makeTempPassword(randomBytes)
    try {
      const { error } = await admin.auth.admin.updateUserById(l.user_id, { password })
      if (error) return { ...base, ok: false as const }
    } catch {
      return { ...base, ok: false as const }
    }
    let problem: 'flag' | 'sign_out' | undefined
    try {
      const { error } = await admin.from('member_logins').update({ must_change_password: true }).eq('user_id', l.user_id)
      if (error) problem = 'flag'
    } catch {
      problem = 'flag'
    }
    try {
      const { error } = await admin.rpc('owner_end_sessions', { p_user_ids: [l.user_id] })
      if (error) problem ??= 'sign_out'
    } catch {
      problem ??= 'sign_out'
    }
    return { ...base, ok: true as const, temp_password: password, ...(problem ? { problem } : {}) }
  }

  // This season's rostered players who have a login name but no account yet.
  const findMissing = async (): Promise<MissingLogin[]> => {
    const { data: season } = await admin.from('current_season').select('id').maybeSingle()
    if (!season) return []
    const { data: teams } = await admin.from('teams').select('id').eq('season_id', season.id).is('voided_at', null)
    const teamIds = (teams ?? []).map((t) => t.id)
    if (teamIds.length === 0) return []
    const { data: lines } = await admin
      .from('roster_memberships')
      .select('player_id')
      .in('team_id', teamIds)
      .is('ends_on', null)
      .is('voided_at', null)
    const ids = [...new Set((lines ?? []).map((l) => l.player_id))]
    if (ids.length === 0) return []
    const { data: players } = await admin
      .from('players')
      .select('id, full_name, login_name, is_guest')
      .in('id', ids)
      .is('voided_at', null)
    return missingLogins(players ?? [], new Set(logins.map((l) => l.player_id)))
  }

  // Makes one account with a temporary password, links it to the player, and marks "must choose a new one".
  // If an unlinked sign-in already exists for that login name, it is taken over with the new password.
  const createOne = async (m: MissingLogin, existing: { id: string; email?: string }[]) => {
    const base = { full_name: m.full_name, login_name: m.login_name, player_id: m.player_id }
    const password = makeTempPassword(randomBytes)
    const email = loginEmail(m.login_name)
    let userId: string | undefined
    try {
      const found = existing.find((u) => (u.email ?? '').toLowerCase() === email)
      // A sign-in that already belongs to someone else is never touched.
      if (found && logins.some((l) => l.user_id === found.id)) return { ...base, ok: false as const }
      if (found) {
        const { error } = await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true })
        if (error) return { ...base, ok: false as const }
        userId = found.id
      } else {
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
        if (error || !data.user) return { ...base, ok: false as const }
        userId = data.user.id
      }
    } catch {
      return { ...base, ok: false as const }
    }
    // The database links new sign-ins to players by itself; this makes sure, without doubling up.
    await admin.from('member_logins').upsert({ user_id: userId, player_id: m.player_id }, { onConflict: 'user_id', ignoreDuplicates: true })
    const { data: linked } = await admin.from('member_logins').select('player_id').eq('user_id', userId).maybeSingle()
    if (linked?.player_id !== m.player_id) return { ...base, ok: false as const }
    const { error: flagError } = await admin.from('member_logins').update({ must_change_password: true }).eq('user_id', userId)
    return { ...base, ok: true as const, temp_password: password, ...(flagError ? { problem: 'flag' as const } : {}) }
  }

  switch (action.action) {
    case 'list_logins': {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const lastSeen = new Map((users?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]))
      return reply(200, {
        logins: logins.map((l) => ({
          ...nameOf(l),
          player_id: l.player_id,
          is_owner: l.is_owner,
          must_change_password: l.must_change_password,
          last_sign_in_at: lastSeen.get(l.user_id) ?? null,
        })),
        without_login: await findMissing(),
      })
    }
    case 'set_password': {
      const login = logins.find((l) => l.player_id === action.playerId)
      if (!login) return reply(404, { error: 'That player has no login yet.' })
      if (login.is_owner) return reply(400, { error: 'Change your own password from the Me page.' })
      return reply(200, { result: await resetOne(login) })
    }
    case 'reset_everyone': {
      const results = []
      for (const l of logins.filter((l) => isResetTarget({ is_owner: l.is_owner, login_name: nameOf(l).login_name }))) {
        results.push(await resetOne(l))
      }
      return reply(200, { results })
    }
    case 'create_logins': {
      const missing = new Map((await findMissing()).map((m) => [m.player_id, m]))
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const results = []
      for (const id of action.playerIds) {
        const m = missing.get(id)
        if (!m) {
          results.push({ full_name: '', login_name: '', player_id: id, ok: false as const })
          continue
        }
        results.push(await createOne(m, users?.users ?? []))
      }
      return reply(200, { results })
    }
    case 'sign_out_everyone': {
      const ids = logins.filter((l) => !l.is_owner).map((l) => l.user_id)
      const { data, error } = await admin.rpc('owner_end_sessions', { p_user_ids: ids })
      if (error) return reply(500, { error: 'Could not sign everyone out. Try again.' })
      return reply(200, { signed_out_sessions: data })
    }
  }
}
