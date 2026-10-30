import { useMemo } from 'react'
import { useCurrentSeason, useGames, useRosters, useStandings, useTeams } from './api'
import { currentTeams } from './derive'
import type { Game, Season, StandingRow, Team } from '../../types/db'

export interface SeasonSnapshot {
  season: Season | null
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

/** Everything the Roster, Standings and Me screens show about the current season, in one place. */
export function useSeasonSnapshot(playerId: string): SeasonSnapshot {
  const season = useCurrentSeason()
  const teams = useTeams()
  const rosters = useRosters()
  const standings = useStandings(season.data?.id)
  const games = useGames(season.data?.id)

  return useMemo(() => {
    const teamList = teams.data ?? []
    const table = standings.data ?? []
    const gameList = games.data ?? []
    const myTeam = currentTeams(rosters.data ?? [], teamList).get(playerId)
    const open = gameList.filter((g) => g.status !== 'final' && g.week !== null).map((g) => g.week as number)
    return {
      season: season.data ?? null,
      teams: teamList,
      teamById: new Map(teamList.map((t) => [t.id, t])),
      standings: table,
      games: gameList,
      played: Math.round(table.reduce((n, r) => n + r.games_played, 0) / 2),
      nextWeek: open.length ? Math.min(...open) : null,
      myTeam,
      myRow: myTeam ? table.find((r) => r.team_id === myTeam.id) : undefined,
      isPending: season.isPending || teams.isPending || rosters.isPending || (!!season.data && (standings.isPending || games.isPending)),
      isError: season.isError || teams.isError || rosters.isError || standings.isError || games.isError,
      refetch: () => void (season.refetch(), teams.refetch(), rosters.refetch(), standings.refetch(), games.refetch()),
    }
  }, [season, teams, rosters, standings, games, playerId])
}
