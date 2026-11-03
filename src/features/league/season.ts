/*
 * Seasons: each season carries its own rules (half length, halftime, overtime, players on the field)
 * and its own teams. The viewed season is kept in the URL (?season=), defaulting to the active one.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Season, Team } from '../../types/db'
import { useSeasons } from './api'

export interface SeasonRules {
  halfSeconds: number
  halftimeSeconds: number
  /** null when the season has no overtime. */
  overtimeSeconds: number | null
  /** Players from one team on the field at once (the rest sub in). */
  onField: number
}

/** Season 1 rules, used only if a season row is missing its rules (migration 008 sets them for both seasons). */
const FALLBACK = { half: 10, halftime: 7, onField: 2 } as const

export function seasonRules(s: Season): SeasonRules {
  return {
    halfSeconds: (s.half_minutes ?? FALLBACK.half) * 60,
    halftimeSeconds: (s.halftime_minutes ?? FALLBACK.halftime) * 60,
    overtimeSeconds: s.overtime_minutes ? s.overtime_minutes * 60 : null,
    onField: s.on_field ?? FALLBACK.onField,
  }
}

/** The one season that is not finished (the one games are played in now). */
export function activeSeason(seasons: Season[]): Season | undefined {
  return seasons.find((s) => s.status !== 'finished')
}

/** Seasons a person can pick to view: those that count for standings, newest first. */
export function selectableSeasons(seasons: Season[]): Season[] {
  return seasons
    .filter((s) => s.counts_for_standings)
    .sort((a, b) => (b.starts_on ?? '').localeCompare(a.starts_on ?? ''))
}

/** The season asked for by id, or the active season when the id is missing or unknown. */
export function pickViewedSeason(seasons: Season[], id: string | null): Season | undefined {
  return seasons.find((s) => s.id === id) ?? activeSeason(seasons)
}

/** The rules of one season, or null while the seasons are still loading. */
export function useSeasonRules(seasonId: string | undefined): SeasonRules | null {
  const seasons = useSeasons()
  return useMemo(() => {
    const s = seasons.data?.find((x) => x.id === seasonId)
    return s ? seasonRules(s) : null
  }, [seasons.data, seasonId])
}

/** Only the teams that belong to one season. */
export function seasonTeams(teams: Team[], seasonId: string): Team[] {
  return teams.filter((t) => t.season_id === seasonId)
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useActiveSeason(): Season | undefined {
  const seasons = useSeasons()
  return useMemo(() => activeSeason(seasons.data ?? []), [seasons.data])
}

/** The season being viewed: ?season= in the URL, else the active season. */
export function useViewedSeason(): [Season | undefined, (id: string) => void] {
  const seasons = useSeasons()
  const [params, setParams] = useSearchParams()
  const requested = params.get('season')
  const season = useMemo(() => pickViewedSeason(seasons.data ?? [], requested), [seasons.data, requested])
  const setSeason = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      next.set('season', id)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )
  return [season, setSeason]
}
