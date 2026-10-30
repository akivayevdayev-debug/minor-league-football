import { useState } from 'react'
import { useMember } from '../auth'
import { useSeasonSnapshot } from '../league'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Skeleton } from '../../ui/Skeleton'
import { Segmented, SegmentedPanel } from '../../ui/motion'
import { StandingsTable } from './StandingsTable'

const VIEWS = [
  { value: 'record', label: 'Record' },
  { value: 'points', label: 'Points' },
] as const

/** Read-only table for the current season. Order: win %, then point difference, then points for. */
export default function StandingsPage() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const [view, setView] = useState<'record' | 'points'>('record')

  if (snap.isPending) return <Skeleton rows={4} />
  if (snap.isError) return <ErrorState what="the standings" onRetry={snap.refetch} />
  if (!snap.season || snap.standings.length === 0)
    return <EmptyState icon="trophy" title="No table yet" body="The standings fill in once the first game is final." />

  return (
    <section className="flex flex-col gap-6">
      <header className="rise flex flex-col gap-1">
        <p className="brand-type text-small text-accent">{snap.season.name}</p>
        <h1 className="text-headline">Standings</h1>
      </header>
      <Segmented label="Sort the table by" value={view} onChange={setView} options={VIEWS} className="rise">
        {VIEWS.map((v) => (
          <SegmentedPanel key={v.value} value={v.value}>
            <StandingsTable rows={snap.standings} teamById={snap.teamById} highlightTeamId={snap.myTeam?.id} view={v.value} />
          </SegmentedPanel>
        ))}
      </Segmented>
      <p className="text-small text-text-2">
        Ranked by win percentage, then point difference, then points scored. A tie counts as half a win.
      </p>
    </section>
  )
}
