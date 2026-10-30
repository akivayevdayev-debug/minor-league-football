/*
 * Game night: full-screen scoreboard, clock and score buttons for one game.
 * Hard rules: clock and score buttons get a press scale only (no ripple, no other motion),
 * every button here is at least 56 px tall. The .still wrapper switches off ripple, lean and sheen. The clock stores only state changes.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { currentTeams, displayName, usePlayers, useRosters, useSettings, useStatTypes, useTeams } from '../league'
import { remainingMs } from '../../lib/clock'
import { gameScore } from '../../lib/score'
import type { ScoreEvent, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { Segmented } from '../../ui/motion'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import {
  useAddScore, useCreditScorer, useFinishGame, useGame, useGameClock, useGameStats, useLiveGame, useScoreEvents, useServerOffset, useSetClock, useVoidScore,
} from './api'
import { BoxScorePanel } from './BoxScorePanel'
import { LiveStatsPanel } from './LiveStatsPanel'
import { EnterScoreSheet } from './EnterScoreSheet'
import { KickoffSheet } from './KickoffSheet'
import { ON_FIELD, currentLineup, useGameLineups, useSetLineup } from './lineup'

const SCORES = [
  { type: 'td', label: 'TD', points: 6 },
  { type: 'conv1', label: 'PAT', points: 1 },
  { type: 'conv2', label: '2-PT', points: 2 },
] as const

const TYPE_LABEL: Record<string, string> = { td: 'Touchdown', conv1: '1-point conversion', conv2: '2-point conversion', final_manual: 'Final score' }

/** Ticks every quarter second while the clock runs, so the display stays in step. */
function useNow(running: boolean, offset: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 250)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [running])
  return now + offset
}

/** Now on the server's clock, as a timestamp. */
const serverNowIso = (offset: number) => new Date(Date.now() + offset).toISOString()

function mmss(ms: number) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const TABS = [
  { value: 'score', label: 'Score & clock' },
  { value: 'stats', label: 'Live stats' },
  { value: 'box', label: 'Box score' },
] as const
type Tab = (typeof TABS)[number]['value']

export default function LiveGamePage() {
  const { id } = useParams()
  return <GameScreen id={id} />
}

/**
 * The game screen. Full screen from the Schedule (/game/:id), or inside the Game tab (`embedded`:
 * no back link, and `picker` sits in the header to switch games).
 */
export function GameScreen({ id, embedded, picker }: { id: string | undefined; embedded?: boolean; picker?: ReactNode }) {
  const game = useGame(id)
  const stats = useGameStats(id)
  const statTypes = useStatTypes()
  const [tab, setTab] = useState<Tab>('score')
  const lines = useScoreEvents(id)
  const clock = useGameClock(id)
  const settings = useSettings()
  const teams = useTeams()
  const players = usePlayers()
  const rosters = useRosters()
  const offset = useServerOffset()
  const lineups = useGameLineups(id)
  useLiveGame(id)

  const g = game.data
  const addScore = useAddScore(g)
  const voidScore = useVoidScore(g)
  const credit = useCreditScorer(g)
  const setClock = useSetClock(g)
  const finish = useFinishGame(g)
  const [askScorer, setAskScorer] = useState<ScoreEvent | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [typing, setTyping] = useState(false)
  const setLineup = useSetLineup(g)
  const [kickoff, setKickoff] = useState(false)
  const [benchPicks, setBenchPicks] = useState<Record<string, string>>({})

  const c = clock.data
  // If the clock could not load, show no time and no clock controls, so Resume can't overwrite the real time.
  const clockDown = clock.isError
  const now = useNow(!!c?.running, offset)
  const halfSeconds = (settings.data?.half_minutes ?? 10) * 60
  const left = c ? remainingMs({ running: c.running, secondsLeft: c.seconds_left, startedAt: c.started_at ? Date.parse(c.started_at) : null }, now) : halfSeconds * 1000

  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const home = g?.home_team_id ? teamById.get(g.home_team_id) : undefined
  const away = g?.away_team_id ? teamById.get(g.away_team_id) : undefined
  const score = g && home && away ? gameScore(home.id, away.id, (lines.data ?? []).map((l) => ({ teamId: l.team_id, points: l.points, voided: false }))) : { home: 0, away: 0 }

  const onTeam = useMemo(() => currentTeams(rosters.data ?? [], teams.data ?? []), [rosters.data, teams.data])
  const rosterOf = useMemo(
    () => (teamId: string) => (players.data ?? []).filter((p) => onTeam.get(p.id)?.id === teamId),
    [onTeam, players.data],
  )

  // A clock that fails to load (e.g. change 003 not in the database yet) just means a fresh clock.
  if (game.isError) return <ErrorState what="this game" onRetry={() => void game.refetch()} />
  if (!g || teams.isPending || clock.isPending) return <div className="p-4"><Skeleton rows={5} /></div>
  if (!home || !away)
    return <EmptyState icon="games" title="This game needs both teams first" body="Pick the two teams on the Schedule, then come back." />

  const status = g.status
  const half = c?.half ?? 1
  const busy = setClock.isPending || finish.isPending
  const fail = () => toast.error("Couldn't save that. Check your signal and try again.")

  const clockSecondsNow = c ? Math.ceil(left / 1000) : halfSeconds
  /** Teams with a sub that have no lineup yet: they pick who sits first. */
  const needLineup = [home, away]
    .map((team) => ({ team, roster: rosterOf(team.id) }))
    .filter(({ team, roster }) => roster.length > ON_FIELD && !currentLineup(lineups.data ?? [], team.id, halfSeconds))
  /** Saves who is on the field for a team from this clock moment on (kickoff or a sub). */
  const saveLineup = (teamId: string, onField: string[]) =>
    setLineup.mutate({ id: crypto.randomUUID(), team_id: teamId, on_field: onField, half, clock_seconds: clockSecondsNow }, { onError: fail })

  const start = () => {
    if (status === 'scheduled' && needLineup.length > 0 && !kickoff) {
      setKickoff(true)
      return
    }
    if (kickoff) {
      for (const { team, roster } of needLineup) {
        const sits = benchPicks[team.id]
        if (sits) saveLineup(team.id, roster.filter((p) => p.id !== sits).map((p) => p.id))
      }
      setKickoff(false)
    }
    setClock.mutate(
      { clock: { running: true, started_at: serverNowIso(offset), seconds_left: c ? Math.ceil(left / 1000) : halfSeconds, half }, status: 'live' },
      { onError: fail },
    )
  }
  const pause = () => setClock.mutate({ clock: { running: false, started_at: null, seconds_left: Math.ceil(left / 1000), half } }, { onError: fail })
  const halftime = () => setClock.mutate({ clock: { running: false, started_at: null, seconds_left: halfSeconds, half: 2 }, status: 'halftime' }, { onError: fail })
  const end = () =>
    finish.mutate(Math.ceil(left / 1000), {
      onSuccess: () => {
        setConfirmEnd(false)
        toast.success(`Final: ${home.short_name} ${score.home}, ${away.short_name} ${score.away}`)
      },
      onError: fail,
    })

  const add = (team: Team, type: (typeof SCORES)[number]['type']) => {
    const lineId = crypto.randomUUID()
    addScore.mutate({ id: lineId, teamId: team.id, type, playerId: null, half }, { onError: fail })
    setAskScorer({ id: lineId, game_id: g.id, team_id: team.id, scoring_type_id: type, points: 0, player_id: null, voided_at: null, created_at: '' })
  }

  const last = lines.data?.at(-1)
  const undo = () => {
    if (!last) return
    voidScore.mutate(last, {
      onSuccess: () => toast.success(`Removed: ${TYPE_LABEL[last.scoring_type_id]} for ${teamById.get(last.team_id)?.short_name ?? 'team'}`),
      onError: fail,
    })
    if (askScorer?.id === last.id) setAskScorer(null)
  }

  const statusLabel = status === 'final' ? 'Final' : status === 'halftime' ? 'Halftime' : status === 'live' ? (half === 3 ? 'Overtime' : `${half === 1 ? '1st' : '2nd'} half`) : 'Not started'

  return (
    <main className={`still mx-auto flex w-full max-w-(--content-max) flex-col gap-4 ${embedded ? '' : 'safe-top min-h-dvh px-4 pb-8'}`}>
      <header className="flex min-h-(--header-height) items-center justify-between gap-2">
        {embedded ? (
          picker
        ) : (
          <Link to="/schedule" className="pressable flex min-h-(--tap-min) items-center gap-1 text-text-2-strong hover-fine:text-text">
            <Icon name="back" size="sm" /> Schedule
          </Link>
        )}
        {!embedded && <span className="caps-label">{g.week ? `Week ${g.week}` : 'Game'}</span>}
        {status === 'live' ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-live px-3 py-1 caps-label text-text">
            <span aria-hidden="true" className="live-dot size-(--dot) rounded-pill bg-text" /> Live
          </span>
        ) : (
          <span className="rounded-pill surface-inset px-3 py-1 caps-label text-text-2-strong">{statusLabel}</span>
        )}
      </header>

      {/* Scoreboard */}
      <section aria-label="Score" className="relative isolate overflow-hidden rounded-hero glass-panel px-4 pt-6 pb-5">
        <StadiumBackdrop photo="lights" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          {[{ t: home, pts: score.home }, null, { t: away, pts: score.away }].map((side, i) =>
            side ? (
              <div key={i} style={teamStyle(side.t.color_key)} className="flex flex-col items-center gap-2 text-center">
                <TeamBadge team={side.t} size="lg" />
                <span className="display-caps text-body-lg text-(--team-light)">{side.t.name}</span>
                <span className="numeral text-score text-text" aria-live="polite">{side.pts}</span>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-center gap-1 pt-6">
                <span className="caps-label">{statusLabel}</span>
                <span role="timer" aria-label={clockDown ? 'Clock unavailable' : `${mmss(left)} left`} className={`numeral text-headline ${left === 0 ? 'text-danger' : 'text-text'}`}>
                  {clockDown ? '--:--' : mmss(left)}
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      <Segmented<Tab> label="Game screen" value={tab} onChange={setTab} options={TABS} />

      {tab === 'stats' && (
        <LiveStatsPanel
          game={g}
          home={home}
          away={away}
          half={half}
          players={players.data ?? []}
          statTypes={statTypes.data ?? []}
          stats={stats.data ?? []}
          rosterOf={rosterOf}
          onTeam={onTeam}
          lineups={lineups.data ?? []}
          halfSeconds={halfSeconds}
          onLineup={saveLineup}
        />
      )}

      {tab === 'box' && (
        <BoxScorePanel
          game={g}
          home={home}
          away={away}
          stats={stats.data ?? []}
          lines={lines.data ?? []}
          players={players.data ?? []}
          statTypes={statTypes.data ?? []}
        />
      )}

      {tab === 'score' && <>
      {/* Clock controls */}
      {status !== 'final' && clockDown && <ErrorState what="the clock" onRetry={() => void clock.refetch()} />}
      {status !== 'final' && !clockDown && (
        <div className="grid grid-cols-2 gap-2">
          {c?.running ? (
            <Button size="xl" variant="primary" onClick={pause} disabled={busy} className="col-span-2">
              <Icon name="pause" size="sm" filled /> Pause clock
            </Button>
          ) : (
            <Button size="xl" variant="primary" onClick={start} disabled={busy} className="col-span-2">
              <Icon name="play" size="sm" filled />
              {status === 'scheduled' ? 'Start game' : status === 'halftime' ? 'Start 2nd half' : 'Resume clock'}
            </Button>
          )}
          {half === 1 && status !== 'halftime' && (
            <Button size="xl" variant="secondary" onClick={halftime} disabled={busy || status === 'scheduled'}>
              <Icon name="clock" size="sm" /> Halftime
            </Button>
          )}
          <Button size="xl" variant="secondary" onClick={() => setConfirmEnd(true)} disabled={busy} className={half === 1 && status !== 'halftime' ? '' : 'col-span-2'}>
            <Icon name="finish" size="sm" /> End game
          </Button>
        </div>
      )}

      {/* Score buttons: one column per team */}
      {status !== 'final' ? (
        <div className="grid grid-cols-2 gap-3">
          {[home, away].map((t) => (
            <div key={t.id} style={teamStyle(t.color_key)} className="flex flex-col gap-2">
              <span className="truncate text-center caps-label text-(--team-light)">{t.short_name}</span>
              {SCORES.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => add(t, s.type)}
                  className="pressable flex min-h-(--tap-score) items-center justify-between rounded-panel bg-(--team) px-4 text-primary-ink"
                >
                  <span className="display-caps text-title">{s.label}</span>
                  <span className="numeral text-stat">+{s.points}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button size="xl" variant="secondary" onClick={() => setTyping(true)}>
            <Icon name="edit" size="sm" /> Fix the final score
          </Button>
        </div>
      )}

      {/* Who scored? */}
      {askScorer && status !== 'final' && (
        <section aria-label="Who scored?" style={teamStyle(teamById.get(askScorer.team_id)?.color_key)} className="glass-subtle flex flex-col gap-3 rounded-panel p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-body">
              Who scored the {TYPE_LABEL[askScorer.scoring_type_id]?.toLowerCase()} for {teamById.get(askScorer.team_id)?.short_name}?
            </h2>
            <button type="button" onClick={() => setAskScorer(null)} className="pressable min-h-(--tap-min) px-2 text-small text-text-2-strong">
              Skip
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {rosterOf(askScorer.team_id).map((p) => (
              <button
                key={p.id}
                type="button"
                className="pressable min-h-(--tap-game) rounded-pill surface-inset px-4 font-strong hover-fine:bg-(--row-hover)"
                onClick={() => {
                  const line = askScorer
                  setAskScorer(null)
                  credit.mutate({ line, playerId: p.id, half }, { onSuccess: () => toast.success(`${displayName(p)} credited`), onError: fail })
                }}
              >
                {p.jersey !== null && <span className="nums text-(--team-light)">#{p.jersey} </span>}
                {displayName(p)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Score log */}
      <section aria-label="Scoring" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-body-lg">Scoring</h2>
          {last && status !== 'final' && (
            <Button variant="ghost" onClick={undo} disabled={voidScore.isPending}>
              <Icon name="undo" size="sm" /> Undo last
            </Button>
          )}
        </div>
        {(lines.data ?? []).length === 0 ? (
          <p className="text-small text-text-2">No scores yet. Tap a score button to add one.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-divider rounded-panel surface-solid">
            {[...(lines.data ?? [])].reverse().map((l) => {
              const t = teamById.get(l.team_id)
              const who = l.player_id ? players.data?.find((p) => p.id === l.player_id) : undefined
              return (
                <li key={l.id} style={teamStyle(t?.color_key)} className="flex items-center gap-3 px-3 py-2.5">
                  <span aria-hidden="true" className="h-(--icon-md) w-(--stripe) rounded-pill bg-(--team)" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-strong">{t?.short_name}</span> {TYPE_LABEL[l.scoring_type_id]}
                    {who && <span className="text-text-2"> · {displayName(who)}</span>}
                  </span>
                  <span className="numeral text-title">+{l.points}</span>
                </li>
              )
            })}
          </ol>
        )}
        {status !== 'final' && (
          <button type="button" onClick={() => setTyping(true)} className="pressable self-start min-h-(--tap-min) text-small text-text-2-strong underline underline-offset-4 hover-fine:text-text">
            Type the final score instead
          </button>
        )}
      </section>
      </>}

      <Sheet
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End this game?"
        description={`The final score will be ${home.short_name} ${score.home}, ${away.short_name} ${score.away}. You can still fix it afterwards.`}
        footer={
          <>
            <Button size="xl" variant="ghost" className="flex-1" onClick={() => setConfirmEnd(false)}>
              Keep playing
            </Button>
            <Button size="xl" variant="primary" className="flex-1" loading={finish.isPending} onClick={end}>
              End game
            </Button>
          </>
        }
      >
        <span />
      </Sheet>

      <KickoffSheet
        open={kickoff}
        onOpenChange={setKickoff}
        gameId={g.id}
        teams={needLineup}
        picks={benchPicks}
        onPick={(teamId, pid) => setBenchPicks((b) => (b[teamId] === pid ? b : { ...b, [teamId]: pid }))}
        onStart={start}
        busy={busy}
      />

      <EnterScoreSheet open={typing} onOpenChange={setTyping} game={g} home={home} away={away} current={score} />
    </main>
  )
}
