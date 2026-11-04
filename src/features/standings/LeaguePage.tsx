import { useMemo, type CSSProperties } from 'react'
import { useMember } from '../auth'
import { SeasonSelect, useGameScores, useSeasonSnapshot } from '../league'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { LeagueLeaders } from './LeagueLeaders'
import { PlayoffsPanel } from './PlayoffsPanel'
import { StandingsTable } from './StandingsTable'
import { streaks } from './streak'

/**
 * League tab: the standings first (tap a team to open it), then the playoff picture, then league leaders.
 * Replaces the old Standings tab.
 */
export default function LeaguePage() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const scores = useGameScores(snap.season?.id)
  const streakOf = useMemo(() => streaks(snap.games, scores.data ?? new Map()), [snap.games, scores.data])

  if (snap.isPending) return <Skeleton rows={4} />
  if (snap.isError) return <ErrorState what="the league" onRetry={snap.refetch} />

  const played = snap.standings.some((r) => r.games_played > 0)

  return (
    <section className="flex flex-col gap-6">
      <SeasonSelect />
      <header className="rise flex flex-col gap-1">
        <p className="brand-type text-small text-accent">{snap.season?.name ?? 'MLF'}</p>
        <h1 className="text-headline">League</h1>
      </header>

      <section aria-labelledby="standings-title" className="rise flex flex-col gap-2" style={{ '--i': 1 } as CSSProperties}>
        <h2 id="standings-title" className="text-body-lg">
          Standings
        </h2>
        {snap.standings.length === 0 ? (
          <EmptyState icon="trophy" title="No teams yet" body="The table appears once this season has teams." />
        ) : (
          <>
            <StandingsTable
              rows={snap.standings}
              teamById={snap.teamById}
              streakOf={streakOf}
              highlightTeamId={snap.myTeam?.id}
              linkTeams={snap.season?.status !== 'finished'}
            />
            <p className="text-small text-text-2">
              {played
                ? 'Ranked by win percentage, then point difference, then points scored. A tie counts as half a win. Tap a team to see its players.'
                : 'Everyone starts at 0-0. The table fills in once the first game is final. Tap a team to see its players.'}
            </p>
          </>
        )}
      </section>

      {played && <PlayoffsPanel snap={snap} />}

      <LeagueLeaders />
    </section>
  )
}
