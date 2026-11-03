import { useMemo } from 'react'
import { useGames, useRosters, useSeasons, useStandings, useTeams } from './api'
import { currentTeams } from './derive'
import { seasonTeams, useViewedSeason } from './season'
import type { Game, Season, StandingRow, Team } from '../../types/db'

export interface SeasonSnapshot {
  season: Season | null
  /** Only the viewed season's teams. */
  teams: Team[]
  teamById: Map<string, Team>
  standings: StandingRow[]
  games: Game[]
  /** Games played league-wide (each game counted once, including record adjustments). */
  played: number
  /** Lowest week that still has an unfinished game, or null. */
  nextWeek: number | null
  /** The given player's current team and its table row. */
  myTeam: Team | undefined
  myRow: StandingRow | undefined
  isPending: boolean
  isError: boolean
  refetch(): void
}

/**
 * Everything the Roster, Standings, Me and game screens show about the viewed season (default: the active one),
 * in one place. The viewed season comes from ?season= in the URL.
 */
export function useSeasonSnapshot(playerId: string): SeasonSnapshot {
  const seasons = useSeasons()
  const [season] = useViewedSeason()
  const teams = useTeams()
  const rosters = useRosters()
  const standings = useStandings(season?.id)
  const games = useGames(season?.id)

  return useMemo(() => {
    const teamList = seasonTeams(teams.data ?? [], season?.id ?? '')
    const table = standings.data ?? []
    const gameList = games.data ?? []
    const myTeam = currentTeams(rosters.data ?? [], teamList).get(playerId)
    const open = gameList.filter((g) => g.status !== 'final' && g.week !== null).map((g) => g.week as number)
    return {
      season: season ?? null,
      teams: teamList,
      teamById: new Map(teamList.map((t) => [t.id, t])),
      standings: table,
      games: gameList,
      played: Math.round(table.reduce((n, r) => n + r.games_played, 0) / 2),
      nextWeek: open.length ? Math.min(...open) : null,
      myTeam,
      myRow: myTeam ? table.find((r) => r.team_id === myTeam.id) : undefined,
      isPending: seasons.isPending || teams.isPending || rosters.isPending || (!!season && (standings.isPending || games.isPending)),
      isError: seasons.isError || teams.isError || rosters.isError || standings.isError || games.isError,
      refetch: () => void (seasons.refetch(), teams.refetch(), rosters.refetch(), standings.refetch(), games.refetch()),
    }
  }, [seasons, season, teams, rosters, standings, games, playerId])
}
