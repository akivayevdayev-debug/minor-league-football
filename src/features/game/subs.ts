/*
 * Subs and playing time for one game. A sub is a player who came into the game for a team (their
 * stats still count for that team). Minutes can be typed in by hand for a player with no tracked
 * time. Both tables are event-style rows: removing a sub or changing typed minutes never deletes.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { rows } from '../league/api'
import type { Game, GameSub, Player, PlayerMinutes } from '../../types/db'

export const subKeys = {
  subs: (gameId: string) => ['game', gameId, 'subs'] as const,
  minutes: (gameId: string) => ['game', gameId, 'minutes'] as const,
}

/** A write the database refused or failed. The message is ready to show in a plain toast. */
export class SubWriteError extends Error {}

const REFUSED = 'Subs and minutes can only change while the game is live or at halftime. Ask Akiva or Eddie.'

/** Turns a write error from the database into an Error the screen can show. */
export function gameWriteError(error: { message: string; code?: string }): Error {
  console.error(error)
  if (error.code === '42501') return new SubWriteError(error.message.includes('row-level security') ? REFUSED : error.message)
  if (error.code === '23505') return new SubWriteError('That player is already in this game.')
  return new SubWriteError("Couldn't save that. Check your signal and try again.")
}

/**
 * One team's players in this game: its roster, then anyone who came in as a sub (a live sub row, or
 * a player with stat lines for the team, so their stats stay visible after a sub is removed).
 * Roster players keep their guest flag as before; subs are always marked sub.
 * allPlayers is where the names of subs come from (they are not on the roster).
 */
export function teamListWithSubs(
  roster: Player[],
  subs: GameSub[],
  statPlayerIds: string[],
  allPlayers: Player[],
  /** This side's QB for the game (Maurice or Eddie): on no roster, so added first, not as a sub. */
  qbId?: string | null,
): { p: Player; sub: boolean }[] {
  const byId = new Map(allPlayers.map((p) => [p.id, p]))
  const qb = qbId && !roster.some((p) => p.id === qbId) ? byId.get(qbId) : undefined
  const onRoster = new Set([...roster.map((p) => p.id), ...(qb ? [qb.id] : [])])
  const out: { p: Player; sub: boolean }[] = [...(qb ? [{ p: qb, sub: false }] : []), ...roster.map((p) => ({ p, sub: p.is_guest }))]
  const subIds = new Set([...subs.filter((s) => !s.voided_at).map((s) => s.player_id), ...statPlayerIds])
  for (const id of subIds) {
    if (onRoster.has(id)) continue
    const p = byId.get(id)
    if (p) out.push({ p, sub: true })
  }
  return out
}

/** Typed minutes (in minutes, as stored) replace tracked seconds for that player. Result is in seconds. */
export function withTypedMinutes(tracked: Map<string, number>, typed: Map<string, number>): Map<string, number> {
  const out = new Map(tracked)
  for (const [playerId, minutes] of typed) out.set(playerId, minutes * 60)
  return out
}

// ── Subs ────────────────────────────────────────────────────────────────────

/** This game's live subs (voided ones are left out). Live while the page is open. */
export function useGameSubs(gameId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`game-subs-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_subs', filter: `game_id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: subKeys.subs(gameId) }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, qc])
  return useQuery({
    queryKey: subKeys.subs(gameId ?? ''),
    enabled: !!gameId,
    queryFn: () =>
      rows<GameSub[]>(supabase.from('game_subs').select('id, game_id, team_id, player_id, voided_at, created_at').eq('game_id', gameId!).is('voided_at', null)),
  })
}

/**
 * Adds a sub for a team. The caller makes the id on the phone, so a retry can never add the same sub
 * twice, and the row shown straight away has the same id as the saved one (so "Remove sub" works offline).
 */
export function useAddGameSub(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['game-write', 'sub'],
    mutationFn: async ({ id, teamId, playerId }: { id: string; teamId: string; playerId: string }) => {
      if (!game) throw new SubWriteError("Couldn't save that. Check your signal and try again.")
      const { error } = await supabase.from('game_subs').insert({ id, game_id: game.id, team_id: teamId, player_id: playerId })
      if (error) throw gameWriteError(error)
    },
    onMutate: async ({ id, teamId, playerId }) => {
      if (!game) return undefined
      const key = subKeys.subs(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<GameSub[]>(key)
      const row: GameSub = { id, game_id: game.id, team_id: teamId, player_id: playerId, voided_at: null, created_at: new Date().toISOString() }
      qc.setQueryData<GameSub[]>(key, [...(before ?? []), row])
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (game && ctx) qc.setQueryData(subKeys.subs(game.id), ctx.before)
    },
    onSettled: () => {
      if (game) void qc.invalidateQueries({ queryKey: subKeys.subs(game.id) })
    },
  })
}

/** Removes a sub from this game: the row is voided (kept in the edit history). Their stats stay. */
export function useRemoveGameSub(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['game-write', 'void-sub'],
    mutationFn: async (subId: string) => {
      const { error } = await supabase.from('game_subs').update({ voided_at: new Date().toISOString() }).eq('id', subId)
      if (error) throw gameWriteError(error)
    },
    onMutate: async (subId) => {
      if (!game) return undefined
      const key = subKeys.subs(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<GameSub[]>(key)
      qc.setQueryData<GameSub[]>(key, (before ?? []).filter((s) => s.id !== subId))
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (game && ctx) qc.setQueryData(subKeys.subs(game.id), ctx.before)
    },
    onSettled: () => {
      if (game) void qc.invalidateQueries({ queryKey: subKeys.subs(game.id) })
    },
  })
}

// ── Typed minutes ───────────────────────────────────────────────────────────

/** Minutes typed by hand for players in this game. Live while the page is open. */
export function useGameMinutes(gameId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`game-minutes-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_minutes', filter: `game_id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: subKeys.minutes(gameId) }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, qc])
  return useQuery({
    queryKey: subKeys.minutes(gameId ?? ''),
    enabled: !!gameId,
    queryFn: () =>
      rows<PlayerMinutes[]>(
        supabase.from('player_minutes').select('id, game_id, player_id, minutes, voided_at, created_at').eq('game_id', gameId!).is('voided_at', null),
      ),
  })
}

/** One player's typed minutes in every game, as game id → minutes, for the profile's totals. */
export function usePlayerTypedMinutes(playerId: string | undefined) {
  return useQuery({
    queryKey: ['player', playerId ?? '', 'typed-minutes'],
    enabled: !!playerId,
    queryFn: async () => {
      const { data, error } = await supabase.from('player_minutes').select('game_id, minutes').eq('player_id', playerId!).is('voided_at', null)
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.game_id as string, r.minutes as number]))
    },
  })
}

/**
 * Saves typed minutes for one player. A player who already has a live row gets that row changed
 * (its edit history is kept); otherwise a new row is added.
 */
export function useSetGameMinutes(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['game-write', 'minutes'],
    mutationFn: async ({ playerId, minutes, existingId }: { playerId: string; minutes: number; existingId?: string }) => {
      if (!game) throw new SubWriteError("Couldn't save that. Check your signal and try again.")
      const { error } = existingId
        ? await supabase.from('player_minutes').update({ minutes }).eq('id', existingId)
        : await supabase.from('player_minutes').insert({ id: crypto.randomUUID(), game_id: game.id, player_id: playerId, minutes })
      if (error) throw gameWriteError(error)
    },
    onSettled: () => {
      if (game) void qc.invalidateQueries({ queryKey: subKeys.minutes(game.id) })
    },
  })
}
