import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentSeason, useGameProjections, useGameScores, useGames, useTeams } from '../league'
import { formatGameTime, ZONE_LABEL } from '../../lib/time'
import type { Game, GameProjection, Team } from '../../types/db'
import { Badge } from '@/components/ui/badge'
import { Button as LinkButton } from '@/components/ui/button'
import { SplitBar } from '../../ui/Bar'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { EnterScoreSheet } from '../game/EnterScoreSheet'
import { GameStatSheet } from '../game/GameStatSheet'
import { AddGameSheet } from './AddGameSheet'
import { TimeSheet } from './TimeSheet'

type Score = { home_points: number; away_points: number } | undefined

/**
 * Next up as a short photo hero, then each week as one compact list of game rows.
 * Changing a time: tap the time, pick, Save. Scores: Live opens the game, Enter score types the final.
 */
export default function SchedulePage() {
  const season = useCurrentSeason()
  const games = useGames(season.data?.id)
  const scores = useGameScores(season.data?.id)
  const projections = useGameProjections(season.data?.id)
  const teams = useTeams()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Game | null>(null)
  const [scoring, setScoring] = useState<Game | null>(null)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [statsFor, setStatsFor] = useState<Game | null>(null)
  const [statsOpen, setStatsOpen] = useState(false)

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

  const rowProps = (g: Game): GameProps => ({
    game: g,
    teamById,
    score: scores.data?.get(g.id),
    projection: projections.data?.get(g.id),
    onEditTime: () => setEditing(g),
    onScore: () => {
      setScoring(g)
      setScoreOpen(true)
    },
    onStats: () => {
      setStatsFor(g)
      setStatsOpen(true)
    },
  })

  const scoringTeams = scoring ? teamsOf(scoring, teamById) : null
  const scoringScore = scoring ? scores.data?.get(scoring.id) : undefined
  const statsTeams = statsFor ? teamsOf(statsFor, teamById) : null

  return (
    <section className="flex flex-col gap-6">
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

      {next && <NextUp {...rowProps(next)} />}

      {weeks.length === 0 && !next ? (
        <EmptyState icon="schedule" title="No games yet" body="Add the first game to start the schedule." />
      ) : (
        weeks.map(([week, list], wi) => (
          <section key={week ?? 'none'} className="rise flex flex-col gap-3" style={{ '--i': wi + 1 } as CSSProperties}>
            <h2 className="flex items-center gap-3 text-body-lg">
              {week === null ? 'Played earlier' : `Week ${week}`}
              <span aria-hidden="true" className="h-px flex-1 bg-divider" />
            </h2>
            <ul className="glass-list divide-y divide-divider overflow-hidden rounded-panel">
              {list.map((g, i) => (
                <li key={g.id} className="rise px-3 py-2" style={{ '--i': Math.min(i, 8) } as CSSProperties}>
                  <GameRow {...rowProps(g)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <AddGameSheet open={adding} onOpenChange={setAdding} seasonId={season.data.id} defaultWeek={lastWeek || 1} />
      {editing && <TimeSheet game={editing} onClose={() => setEditing(null)} />}
      {scoring && scoringTeams && (
        <EnterScoreSheet
          open={scoreOpen}
          onOpenChange={setScoreOpen}
          game={scoring}
          home={scoringTeams.home}
          away={scoringTeams.away}
          current={scoringScore ? { home: scoringScore.home_points, away: scoringScore.away_points } : undefined}
        />
      )}
      {statsFor && statsTeams?.home && statsTeams.away && (
        <GameStatSheet key={statsFor.id} game={statsFor} home={statsTeams.home} away={statsTeams.away} open={statsOpen} onOpenChange={setStatsOpen} />
      )}
    </section>
  )
}

interface GameProps {
  game: Game
  teamById: Map<string, Team>
  score: Score
  projection: GameProjection | undefined
  onEditTime(): void
  onScore(): void
  /** Opens the game's stat sheet (finished games). */
  onStats(): void
}

function teamsOf(game: Game, teamById: Map<string, Team>) {
  return {
    home: game.home_team_id ? teamById.get(game.home_team_id) : undefined,
    away: game.away_team_id ? teamById.get(game.away_team_id) : undefined,
  }
}

/** The photo hero for the next game: crests, a short centre column, the estimate, then actions. */
function NextUp({ game, teamById, score, projection, onEditTime, onScore }: GameProps) {
  const { home, away } = teamsOf(game, teamById)
  const live = game.status === 'live' || game.status === 'halftime'

  return (
    <section
      aria-label="Next up"
      className="rise relative isolate flex flex-col gap-4 overflow-hidden rounded-hero px-4 pt-5 pb-4"
      style={{ '--i': 0 } as CSSProperties}
    >
      <StadiumBackdrop photo="field" team={home?.color_key} />
      <p className="caps-label text-center text-accent">Next up{game.week !== null ? ` · Week ${game.week}` : ''}</p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <HeroSide team={home} />
        <div className="flex flex-col items-center gap-1">
          {live ? (
            <>
              <Badge variant="live">{game.status === 'live' ? 'Live' : 'Halftime'}</Badge>
              {score && (
                <span className="numeral nums text-headline">
                  {score.home_points}–{score.away_points}
                </span>
              )}
            </>
          ) : (
            <span className="brand-type text-title text-text-3">VS</span>
          )}
        </div>
        <HeroSide team={away} />
      </div>

      <Projection projection={projection} home={home} away={away} className="items-center" />

      <div className="flex flex-col items-center gap-1">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <GameActions game={game} live={live} onScore={onScore} />
        </div>
        <TimeButton game={game} onEditTime={onEditTime} />
      </div>
    </section>
  )
}

function HeroSide({ team }: { team: Team | undefined }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center" style={teamStyle(team?.color_key)}>
      <TeamBadge team={team} size="md" />
      <span className="w-full text-balance font-display text-title leading-tight font-bold uppercase">{team?.name ?? 'To be decided'}</span>
    </div>
  )
}

/**
 * One scoreboard line, ESPN style: home crest, name and score on the left, away on the right,
 * the status in the middle. Upcoming games add the estimate and the score actions underneath.
 */
function GameRow({ game, teamById, score, projection, onEditTime, onScore, onStats }: GameProps) {
  const { home, away } = teamsOf(game, teamById)
  const final = game.status === 'final'
  const live = game.status === 'live' || game.status === 'halftime'
  const hp = score?.home_points ?? 0
  const ap = score?.away_points ?? 0
  const showScore = score !== undefined && (final || live)
  const canScore = !final && !!home && !!away

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Side team={home} points={showScore ? hp : undefined} loser={final && hp < ap} />
        <div className="flex min-w-16 flex-col items-center">
          {final ? (
            <button
              type="button"
              onClick={onScore}
              aria-label="Fix the final score"
              className="pressable flex min-h-(--tap-min) flex-col items-center justify-center gap-0.5 rounded-control bg-transparent px-2 hover-fine:bg-(--row-hover)"
            >
              <span className="caps-label">Final</span>
              <Icon name="edit" size="xs" className="text-text-3" />
            </button>
          ) : live ? (
            <Badge variant="live">{game.status === 'live' ? 'Live' : 'Half'}</Badge>
          ) : (
            <TimeButton game={game} onEditTime={onEditTime} />
          )}
        </div>
        <Side team={away} points={showScore ? ap : undefined} loser={final && ap < hp} away />
      </div>
      {!final && <Projection projection={projection} home={home} away={away} />}
      {final && home && away && (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" onClick={onStats}>
            <Icon name="edit" size="xs" />
            Stats
          </Button>
        </div>
      )}
      {canScore && (
        <div className="flex items-center justify-center gap-2">
          <GameActions game={game} live={live} onScore={onScore} />
        </div>
      )}
    </div>
  )
}

function Side({ team, points, loser, away }: { team: Team | undefined; points: number | undefined; loser: boolean; away?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${away ? 'flex-row-reverse text-right' : ''}`} style={teamStyle(team?.color_key)}>
      <TeamBadge team={team} size="sm" />
      <span className={`min-w-0 truncate font-display text-body uppercase ${loser ? 'font-medium text-text-2' : 'font-bold text-text'}`}>
        {team?.short_name ?? 'TBD'}
      </span>
      {points !== undefined && (
        <span className={`numeral nums text-stat ${away ? 'mr-auto' : 'ml-auto'} ${loser ? 'text-text-3' : 'text-text'}`}>{points}</span>
      )}
    </div>
  )
}

/** Estimate line: a tiny score guess and the win chance bar. Shows nothing when there is no projection. */
function Projection({
  projection,
  home,
  away,
  className,
}: {
  projection: GameProjection | undefined
  home: Team | undefined
  away: Team | undefined
  className?: string
}) {
  if (!projection || !home || !away) return null
  const pct = Math.round(projection.home_win_chance * 100)
  return (
    <div className={`flex flex-col gap-1.5 text-small text-text-2 ${className ?? ''}`}>
      <p className="flex items-center gap-2 nums">
        <Badge variant="estimate">Estimate</Badge>
        <span>
          {Math.round(projection.home_points)}–{Math.round(projection.away_points)}
        </span>
      </p>
      <div className="flex w-full items-center gap-2 nums">
        <span className="w-9 text-right">{pct}%</span>
        <div className="min-w-0 flex-1">
          <SplitBar home={projection.home_win_chance} homeStyle={teamStyle(home.color_key)} awayStyle={teamStyle(away.color_key)} />
        </div>
        <span className="w-9">{100 - pct}%</span>
      </div>
    </div>
  )
}

/** Live (or Open game once it is on) links to the game screen; Enter score types the final in a sheet. */
function GameActions({ game, live, onScore }: { game: Game; live: boolean; onScore(): void }) {
  return (
    <>
      <LinkButton asChild variant="outline" size="sm" className="text-accent">
        <Link to={`/game/${game.id}`}>
          <Icon name="live" size="xs" />
          {live ? 'Open game' : 'Live'}
        </Link>
      </LinkButton>
      <Button variant="ghost" size="sm" onClick={onScore}>
        Enter score
      </Button>
    </>
  )
}

function TimeButton({ game, onEditTime }: { game: Game; onEditTime(): void }) {
  const time = game.starts_at ? `${formatGameTime(game.starts_at)} ${ZONE_LABEL}` : 'Set time'
  return (
    <button
      type="button"
      onClick={onEditTime}
      aria-label={`Change time${game.starts_at ? `, now ${time}` : ''}`}
      className="pressable flex min-h-(--tap-min) flex-col items-center justify-center gap-0.5 caps-label hover-fine:text-accent"
    >
      <span className="nums">{time}</span>
      <Icon name="edit" size="xs" className="text-text-3" />
    </button>
  )
}
