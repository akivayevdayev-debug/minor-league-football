/*
 * owner-tools: Akiva's Developer tools that need the login system's secret key.
 *   list_logins        every login with its player and last sign-in (no passwords; they can't be read)
 *   set_password       a new temporary password for one player; they must pick their own at next sign-in
 *   reset_everyone     the same for every login except the owner, plus sign-out (after the leak)
 *   sign_out_everyone  ends every session except the owner's
 * Only the owner's login may call it: the caller's token is checked, then member_logins.is_owner.
 * The secret key comes from Supabase's own environment (SUPABASE_SECRET_KEYS); it is never in the
 * app or in git. Temporary passwords are returned once, to the owner's screen, and never stored.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isResetTarget, makeTempPassword, parseAction } from './logic.ts'

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
    case 'sign_out_everyone': {
      const ids = logins.filter((l) => !l.is_owner).map((l) => l.user_id)
      const { data, error } = await admin.rpc('owner_end_sessions', { p_user_ids: ids })
      if (error) return reply(500, { error: 'Could not sign everyone out. Try again.' })
      return reply(200, { signed_out_sessions: data })
    }
  }
}
