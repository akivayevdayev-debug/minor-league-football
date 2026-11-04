import { useMemo, type CSSProperties } from 'react'
import { useMember } from '../auth'
import { useGameScores, useSeasonSnapshot } from '../league'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { PlayoffsPanel } from './PlayoffsPanel'
import { StandingsTable } from './StandingsTable'
import { streaks } from './streak'

/** The standings (tap a team to open it) and the playoff picture, on the MVP tab under the race. */
export function StandingsSection() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const scores = useGameScores(snap.season?.id)
  const streakOf = useMemo(() => streaks(snap.games, scores.data ?? new Map()), [snap.games, scores.data])

  if (snap.isPending) return <Skeleton rows={4} />
  if (snap.isError) return <ErrorState what="the standings" onRetry={snap.refetch} />

  const played = snap.standings.some((r) => r.games_played > 0)

  return (
    <>
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
    </>
  )
}
