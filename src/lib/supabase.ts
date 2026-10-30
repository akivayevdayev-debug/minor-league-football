/*
 * The ONLY file that creates the database connection (frontend plan, section 12).
 * Only the public URL and publishable key are ever used here.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing Supabase settings. Copy .env.example to .env.local and fill in both values.')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mlf-auth' },
})

/** Must match app_private.login_domain() in supabase/changes/001_initial_schema.sql. */
export const LOGIN_DOMAIN = 'mlf.invalid'

/** "Leo " → "leo@mlf.invalid". Friends only ever type the login name. */
export function loginEmail(loginName: string): string {
  return `${loginName.trim().toLowerCase()}@${LOGIN_DOMAIN}`
}
