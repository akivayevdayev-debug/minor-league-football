import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { rows, usePlayerProjections, useSettings } from '../league/api'
import { currentLineup, useGameLineups } from '../game/lineup'
import { useGameStats } from '../game/api'
import { lastQbFor } from '../game/qb'
import { useGamePoints } from '../mvp/api'
import type { Game, Player, Team } from '../../types/db'
import { gamePoints, qbOf, teamWeek, type TeamWeek } from './week'

export interface StatInfo {
  label: string
  points: number
}

/** Every stat type (old ones too) with its label and fantasy points, for scoring breakdowns. */
export function useStatPoints() {
  return useQuery({
    queryKey: ['stat-points'],
    staleTime: 5 * 60_000,
    queryFn: () => rows<{ id: string; label: string; fantasy_points: number }[]>(supabase.from('stat_types').select('id, label, fantasy_points')),
    select: (list) => new Map<string, StatInfo>(list.map((s) => [s.id, { label: s.label, points: Number(s.fantasy_points) }])),
  })
}

/** "Right guard" → "RG", "WR" stays "WR": a player's first position, short enough for a chip. */
export function primaryPosition(p: Pick<Player, 'positions'>): string {
  const first = (p.positions[0] ?? '').trim()
  if (!first) return '—'
  return first.includes(' ') ? first.split(/\s+/).map((w) => w[0]).join('').toUpperCase() : first.toUpperCase().slice(0, 4)
}

interface Input {
  game: Game | null
  seasonId: string | undefined
  games: Game[]
  players: Player[]
  teamOf: Map<string, Team>
}

export interface TeamSide extends TeamWeek {
  teamId: string
  /** Players on the field right now (live games with a tracked lineup only). */
  onField: Set<string>
}

/**
 * Projected and actual points for both teams of one game (or one team with no game).
 * Live updates come from useLiveGame, which the screen opens once.
 */
export function useGameWeek({ game, seasonId, games, players, teamOf }: Input) {
  const projections = usePlayerProjections()
  const seasonPoints = useGamePoints(seasonId)
  const statPoints = useStatPoints()
  const started = !!game && game.status !== 'scheduled'
  const stats = useGameStats(started ? game.id : undefined)
  const lineups = useGameLineups(game && (game.status === 'live' || game.status === 'halftime') ? game.id : undefined)
  const settings = useSettings()
  const statRows = stats.data
  const lineupRows = lineups.data

  const side = useMemo(() => {
    // Estimates: per-game points from the projections; a QB (no team) uses their average this season.
    const projected = new Map<string, number>()
    for (const [id, p] of projections.data ?? []) projected.set(id, Number(p.points_per_game))
    const qbTotals = new Map<string, { points: number; games: number }>()
    for (const r of seasonPoints.data ?? []) {
      const t = qbTotals.get(r.player_id) ?? { points: 0, games: 0 }
      qbTotals.set(r.player_id, { points: t.points + r.points, games: t.games + 1 })
    }
    const pointsPer = new Map([...(statPoints.data ?? [])].map(([id, s]) => [id, s.points]))
    const scored = started && statRows ? gamePoints(statRows, pointsPer) : null
    const halfSeconds = (settings.data?.half_minutes ?? 20) * 60

    return (teamId: string): TeamSide => {
      const qbId = (game && qbOf(game, teamId)) ?? lastQbFor(teamId, games)
      const qbProjection = new Map(projected)
      if (qbId && !projected.has(qbId)) {
        const t = qbTotals.get(qbId)
        if (t && t.games > 0) qbProjection.set(qbId, t.points / t.games)
      }
      // Today's roster, plus anyone who logged stats for this team in this game (an old game's players).
      const playedHere = new Set((statRows ?? []).filter((r) => r.team_id === teamId && r.player_id).map((r) => r.player_id!))
      const roster = players
        .filter((p) => teamOf.get(p.id)?.id === teamId || playedHere.has(p.id))
        .map((p) => ({ id: p.id, position: primaryPosition(p) }))
      const week = teamWeek({ roster, qbId, game, projected: qbProjection, scored })
      return { ...week, teamId, onField: new Set(currentLineup(lineupRows ?? [], teamId, halfSeconds) ?? []) }
    }
  }, [projections.data, seasonPoints.data, statPoints.data, started, statRows, settings.data, game, games, players, teamOf, lineupRows])

  return {
    side,
    statPoints: statPoints.data,
    isPending: projections.isPending || statPoints.isPending || (started && stats.isPending),
  }
}
