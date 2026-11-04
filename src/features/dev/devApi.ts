/*
 * Data door for the Developer tools screen (owner only). Screens call these hooks; the owner-only
 * server work goes through the owner-tools function, and the database checks the owner for everything else.
 * Temporary passwords are only ever in a mutation's reply: they are never put in a query key or cached data.
 */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { rows, usePlayers, useTeams } from '../league'
import type { Row, ResetResult } from './devLogic'

const OWNER_FALLBACK = "Couldn't reach the Developer tools. Try again."

/** The server's own message when it refused (e.g. "Only Akiva can use the Developer tools."), else a plain fallback. */
async function readFailure(error: unknown): Promise<string> {
  try {
    const context = (error as { context?: Response } | null)?.context
    const body = (await context?.json()) as { error?: unknown } | undefined
    if (typeof body?.error === 'string' && body.error) return body.error
  } catch {
    // Not JSON or no reply at all: use the fallback.
  }
  return OWNER_FALLBACK
}

export async function callOwnerTools<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('owner-tools', { body })
  if (error) throw new Error(await readFailure(error))
  const reply = data as { error?: unknown } | null
  if (typeof reply?.error === 'string') throw new Error(reply.error)
  return data as T
}

export interface Login {
  full_name: string
  login_name: string
  player_id: string
  is_owner: boolean
  must_change_password: boolean
  last_sign_in_at: string | null
}

export interface HistoryRow {
  id: string
  table_name: string
  row_id: string
  action: 'insert' | 'update'
  before: Row | null
  after: Row | null
  changed_by: string | null
  changed_at: string
}

export const devKeys = {
  logins: ['dev', 'logins'] as const,
  history: (table: string) => ['dev', 'history', table] as const,
  memberLogins: ['dev', 'member-logins'] as const,
  records: (table: string) => ['dev', 'records', table] as const,
  dbCheck: ['dev', 'db-check'] as const,
}

/** A player on this season's roster who has a login name but no account yet. */
export interface MissingLogin {
  player_id: string
  full_name: string
  login_name: string
}

export function useLogins() {
  return useQuery({
    queryKey: devKeys.logins,
    queryFn: async () => {
      const reply = await callOwnerTools<{ logins: Login[]; without_login?: MissingLogin[] }>({ action: 'list_logins' })
      return { logins: reply.logins, withoutLogin: reply.without_login ?? [] }
    },
  })
}

/** Makes accounts with temporary passwords. The results go to the caller only (never cached). */
export function useCreateLogins() {
  const queryClient = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: async (playerIds: string[]) =>
      (await callOwnerTools<{ results: ResetResult[] }>({ action: 'create_logins', playerIds })).results,
    onSettled: () => queryClient.invalidateQueries({ queryKey: devKeys.logins }),
  })
}

/** Gives one player a temporary password. The result is returned to the caller only (never cached). */
export function useSetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: async (playerId: string) =>
      (await callOwnerTools<{ result: ResetResult }>({ action: 'set_password', playerId })).result,
    onSettled: () => queryClient.invalidateQueries({ queryKey: devKeys.logins }),
  })
}

/** Gives every login except the owner a temporary password, and signs them out. */
export function useResetEveryone() {
  const queryClient = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: async () =>
      (await callOwnerTools<{ results: ResetResult[] }>({ action: 'reset_everyone', confirm: 'RESET' })).results,
    onSettled: () => queryClient.invalidateQueries({ queryKey: devKeys.logins }),
  })
}

export function useSignOutEveryone() {
  return useMutation({
    mutationFn: () => callOwnerTools<{ signed_out_sessions: number }>({ action: 'sign_out_everyone', confirm: 'SIGN OUT' }),
  })
}

/** The latest 50 changes, newest first, optionally for one table. */
export function useEditHistory(table: string) {
  return useQuery({
    queryKey: devKeys.history(table),
    queryFn: () => {
      let query = supabase.from('edit_history').select('*').order('changed_at', { ascending: false }).limit(50)
      if (table) query = query.eq('table_name', table)
      return rows<HistoryRow[]>(query)
    },
  })
}

/** Which login (user id) belongs to which player, so a change can be shown with a name. */
export function useMemberLogins() {
  return useQuery({
    queryKey: devKeys.memberLogins,
    queryFn: () => rows<{ user_id: string; player_id: string }[]>(supabase.from('member_logins').select('user_id, player_id')),
  })
}

export function useUndoChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (historyId: string) => {
      const { error } = await supabase.rpc('owner_undo_change', { p_history_id: historyId })
      if (error) throw new Error(error.message)
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

/** Rows of one table for the record picker (up to 500). */
export function useRecords(table: string) {
  return useQuery({
    queryKey: devKeys.records(table),
    enabled: table !== '',
    queryFn: () => rows<Row[]>(supabase.from(table).select('*').limit(500)),
  })
}

export function useSaveRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, id, changes }: { table: string; id: string; changes: Row }) => {
      const { error } = await supabase.from(table).update(changes).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

/** Names for players and teams, by id (for labels in the record picker and history). */
export function useNameIndex() {
  const players = usePlayers()
  const teams = useTeams()
  return useMemo(() => {
    const names = new Map<string, string>()
    for (const p of players.data ?? []) names.set(p.id, p.nickname?.trim() || p.full_name)
    for (const t of teams.data ?? []) names.set(t.id, t.name)
    return names
  }, [players.data, teams.data])
}

/** The current time, refreshed every minute, for "3 hours ago" text. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Times one small read of the database, to show whether it answers and how fast. */
export function useDatabaseCheck() {
  return useQuery({
    queryKey: devKeys.dbCheck,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const started = performance.now()
      const { error } = await supabase.from('settings').select('*').limit(1)
      if (error) throw new Error(error.message)
      return { ms: Math.round(performance.now() - started) }
    },
  })
}
