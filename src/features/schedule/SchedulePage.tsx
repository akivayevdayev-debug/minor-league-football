import { useMemo, useState, type CSSProperties } from 'react'
import { useCurrentSeason, useGameScores, useGames, useTeams } from '../league'
import { formatGameTime, ZONE_LABEL } from '../../lib/time'
import type { Game, Team } from '../../types/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { TeamBadge } from '../../ui/TeamBadge'
import { AddGameSheet } from './AddGameSheet'
import { TimeSheet } from './TimeSheet'

type Score = { home_points: number; away_points: number } | undefined

/** Games grouped by week as matchup cards. Changing a time: tap the time chip → quick button or picker → Save. */
export default function SchedulePage() {
  const season = useCurrentSeason()
  const games = useGames(season.data?.id)
  const scores = useGameScores(season.data?.id)
  const teams = useTeams()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Game | null>(null)

  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const next = useMemo(() => (games.data ?? []).find((g) => g.status !== 'final' && g.home_team_id && g.away_team_id), [games.data])
  const weeks = useMemo(() => {
    const groups = new Map<number | null, Game[]>()
    for (const g of games.data ?? []) if (g !== next) groups.set(g.week, [...(groups.get(g.week) ?? []), g])
    return [...groups.entries()]
  }, [games.data, next])
  const lastWeek = (games.data ?? []).reduce((max, g) => (g.week !== null && g.week > max ? g.week : max), 0)

  if (season.isPending || (season.data && games.isPending)) return <Skeleton rows={5} />
  if (season.isError || games.isError) return <ErrorState what="the schedule" onRetry={() => void (season.refetch(), games.refetch())} />
  if (!season.data) return <EmptyState icon="schedule" title="No season yet" body="The schedule appears once the league data is imported." />

  return (
    <section className="flex flex-col gap-8">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="brand-type text-small text-accent">{season.data.name}</p>
          <h1 className="text-headline">Schedule</h1>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Icon name="add" size="sm" />
          Add game
        </Button>
      </header>

      {next && (
        <section aria-label="Next up" className="rise relative isolate overflow-hidden rounded-hero px-4 pt-6 pb-5" style={{ '--i': 1 } as CSSProperties}>
          <StadiumBackdrop />
          <p className="caps-label mb-4 text-center text-accent">Next up{next.week !== null && ` · Week ${next.week}`}</p>
          <Matchup game={next} teamById={teamById} score={undefined} big onEditTime={() => setEditing(next)} />
        </section>
      )}

      {weeks.length === 0 && !next ? (
        <EmptyState icon="schedule" title="No games yet" body="Add the first game to start the schedule." />
      ) : (
        weeks.map(([week, list], wi) => (
          <section key={week ?? 'none'} className="rise flex flex-col gap-3" style={{ '--i': wi + 2 } as CSSProperties}>
            <h2 className="flex items-center gap-3 text-title">
              {week === null ? 'Played earlier' : `Week ${week}`}
              <span aria-hidden="true" className="h-px flex-1 bg-divider" />
            </h2>
            <ul className="flex flex-col gap-3">
              {list.map((g) => (
                <li key={g.id} className="lit lift surface-inset rounded-panel p-4">
                  <Matchup game={g} teamById={teamById} score={scores.data?.get(g.id)} onEditTime={() => setEditing(g)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <AddGameSheet open={adding} onOpenChange={setAdding} seasonId={season.data.id} defaultWeek={lastWeek || 1} />
      {editing && <TimeSheet game={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

interface MatchupProps {
  game: Game
  teamById: Map<string, Team>
  score: Score
  big?: boolean
  onEditTime(): void
}

function Matchup({ game, teamById, score, big = false, onEditTime }: MatchupProps) {
  const home = game.home_team_id ? teamById.get(game.home_team_id) : undefined
  const away = game.away_team_id ? teamById.get(game.away_team_id) : undefined
  const final = game.status === 'final'
  const live = game.status === 'live' || game.status === 'halftime'
  const hp = score?.home_points ?? 0
  const ap = score?.away_points ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side team={home} big={big} dim={final && hp < ap} />
        <div className="flex flex-col items-center gap-2">
          {final ? (
            <>
              <span className={`numeral flex items-center gap-2 ${big ? 'text-score' : 'text-headline'}`}>
                <span className={hp >= ap ? 'text-text' : 'text-text-3'}>{hp}</span>
                <span className="text-title text-text-3">–</span>
                <span className={ap >= hp ? 'text-text' : 'text-text-3'}>{ap}</span>
              </span>
              <Badge variant="muted">Final</Badge>
            </>
          ) : live ? (
            <Badge variant="live">{game.status === 'live' ? 'Live' : 'Halftime'}</Badge>
          ) : (
            <span className={`brand-type text-text-3 ${big ? 'text-headline' : 'text-title'}`}>VS</span>
          )}
        </div>
        <Side team={away} big={big} dim={final && ap < hp} />
      </div>
      {!final && (
        <button
          type="button"
          onClick={onEditTime}
          aria-label={`Change time${game.starts_at ? `, now ${formatGameTime(game.starts_at)}` : ''}`}
          className="pressable mx-auto flex min-h-(--tap-min) items-center gap-2 rounded-pill border border-border-strong px-4 text-small text-text hover-fine:border-accent hover-fine:text-accent"
        >
          <Icon name="schedule" size="xs" />
          <span className="nums">{game.starts_at ? `${formatGameTime(game.starts_at)} ${ZONE_LABEL}` : 'Set time'}</span>
          <Icon name="edit" size="xs" className="text-text-2" />
        </button>
      )}
    </div>
  )
}

function Side({ team, big, dim }: { team: Team | undefined; big: boolean; dim: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2 text-center ${dim ? 'opacity-60' : ''}`}>
      <TeamBadge team={team} size={big ? 'lg' : 'md'} />
      <span className={`w-full font-display leading-tight font-bold text-balance uppercase ${big ? 'text-title' : 'text-body'}`}>
        {team?.name ?? 'To be decided'}
      </span>
    </div>
  )
}
