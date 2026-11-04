import { useMemo, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import { usePhotoUrl } from '../../lib/photos'
import { useNow } from '../../lib/useNow'
import { secondsLeftAt, type ClockState } from '../../lib/clock'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMember } from '../auth'
import {
  currentTeams,
  displayName,
  ordinal,
  recordText,
  useGameScores,
  usePlayerProjections,
  usePlayers,
  useRosters,
  useSeasonRules,
  useSeasonSnapshot,
  useSettings,
} from '../league'
import { formatGameTime, ZONE_LABEL } from '../../lib/time'
import type { Game, Player, Team } from '../../types/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon, type IconName } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { Segmented } from '../../ui/motion'
import { EnterScoreSheet } from '../game/EnterScoreSheet'
import { AddGuestSheet } from '../players/AddGuestSheet'
import { EditPlayerSheet } from '../players/EditPlayerSheet'
import { MovePlayerSheet } from '../players/MovePlayerSheet'
import { AddStatsSheet } from './AddStatsSheet'
import { TeamPhotosSheet } from './TeamPhotosSheet'
import { TradeSheet } from './TradeSheet'
import { TradesSection } from './TradesSection'
import { useGameClock, useLiveGame, useServerOffset } from '../game/api'
import { TeamStatsTable } from '../team/TeamStatsTable'
import { useGameWeek, type TeamSide } from '../team/useTeamWeek'
import { fmtPoints, opponentOf, weekGame } from '../team/week'
import { remainingShare, winChance } from '../team/winChance'
import { canDecideTrades, canEditTeam, canMovePlayers, isCaptainOf } from './permissions'

/** How often the win chance catches up with the running clock. */
const WIN_CHANCE_REFRESH_MS = 30_000

type Open = 'stats' | 'trade' | 'guest' | 'move' | 'score' | 'edit' | 'photos' | null

/**
 * Team tab, fantasy style: pick a team (yours first), see its record, this week's game with projected
 * and actual points, and every player's points (live during games). Tap points to see how they were
 * scored. Everything you can put in is here too: enter a score, add stats, trade, add a guest, move or edit.
 */
export default function TeamPage() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const players = usePlayers()
  const rosters = useRosters()
  const projections = usePlayerProjections()
  const scores = useGameScores(snap.season?.id)
  const navigate = useNavigate()

  // ?team= opens a given team (the League tab links here); otherwise your own team.
  const [params] = useSearchParams()
  const [picked, setPicked] = useState<string | null>(() => params.get('team'))
  const [open, setOpen] = useState<Open>(null)
  const [focus, setFocus] = useState<Player | null>(null)
  const [actionsFor, setActionsFor] = useState<Player | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  const teamOf = useMemo(() => currentTeams(rosters.data ?? [], snap.teams), [rosters.data, snap.teams])
  const teamId = (picked && snap.teamById.has(picked) ? picked : null) ?? snap.myTeam?.id ?? snap.teams[0]?.id ?? ''
  const team = snap.teamById.get(teamId)
  const row = snap.standings.find((r) => r.team_id === teamId)

  const lineup = useMemo(() => {
    const list = (players.data ?? []).filter((p) => teamOf.get(p.id)?.id === teamId)
    const ppg = (p: Player) => projections.data?.get(p.id)?.points_per_game ?? -1
    return list.sort((a, b) => ppg(b) - ppg(a) || displayName(a).localeCompare(displayName(b)))
  }, [players.data, teamOf, teamId, projections.data])
  const playerById = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])
  const freeAgents = useMemo(() => (players.data ?? []).filter((p) => !p.is_guest && !teamOf.get(p.id)), [players.data, teamOf])
  // Players on no team: the league QBs (they play for any team) and everyone else (backups who sub in).
  const leagueQbs = useMemo(() => freeAgents.filter(isQb), [freeAgents])
  const backups = useMemo(() => freeAgents.filter((p) => !isQb(p)), [freeAgents])

  const teamGames = snap.games.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId)
  const next = teamGames.find((g) => g.status !== 'final' && g.home_team_id && g.away_team_id)
  // This week's game: being played now, else the next one, else the last one played.
  const week = weekGame(teamId, snap.games)
  const weekLive = week?.status === 'live' || week?.status === 'halftime'
  useLiveGame(weekLive ? week.id : undefined, null, false)
  const gw = useGameWeek({ game: week, seasonId: snap.season?.id, games: snap.games, players: players.data ?? [], teamOf })
  const mine = gw.side(teamId)
  const recent = teamGames.filter((g) => g.status === 'final').slice(-3).reverse()
  const teamPhoto = usePhotoUrl(team?.photo_path)

  // Matchup card: the other side, and the chance each side wins. The clock is read only while the game is live.
  const oppId = week ? opponentOf(week, teamId) : null
  const oppTeam = oppId ? snap.teamById.get(oppId) : undefined
  const opp = oppId ? gw.side(oppId) : null
  const clock = useGameClock(week?.status === 'live' ? week.id : undefined)
  const offset = useServerOffset()
  const rules = useSeasonRules(week?.season_id)
  const settings = useSettings()
  // While the clock runs, the win chance catches up with the time left every 30 seconds (nothing ticks every second).
  const readAt = useNow(week?.status === 'live' && !!clock.data?.running, WIN_CHANCE_REFRESH_MS)
  const halfSecondsRaw = rules?.halfSeconds ?? (settings.data?.half_minutes ?? 20) * 60
  const halfMinutes = (halfSecondsRaw > 0 ? halfSecondsRaw : 20 * 60) / 60
  const c = clock.data
  const clockState: ClockState | null = c
    ? { running: c.running, secondsLeft: c.seconds_left, startedAt: c.started_at ? Date.parse(c.started_at) : null }
    : null
  const share = week
    ? remainingShare({
        status: week.status,
        half: c?.half ?? null,
        secondsLeft: clockState ? secondsLeftAt(clockState, readAt + offset) : null,
        halfMinutes,
      })
    : 1
  const chance = mine && opp ? winChance(mine, opp, share) : 0.5

  if (snap.isPending || players.isPending) return <Skeleton rows={6} />
  if (snap.isError || players.isError) return <ErrorState what="the roster" onRetry={() => void (snap.refetch(), players.refetch())} />
  if (!team) return <EmptyState icon="roster" title="No teams yet" body="Teams appear here once the league data is imported." />

  const show = (o: Open, p: Player | null = null) => {
    setFocus(p)
    setActionsFor(null)
    setSheetKey((k) => k + 1)
    setOpen(o)
  }
  const nextTeams = next ? { home: snap.teamById.get(next.home_team_id!), away: snap.teamById.get(next.away_team_id!) } : null
  const nextScore = next ? scores.data?.get(next.id) : undefined
  const weekTeams = week ? { home: snap.teamById.get(week.home_team_id!), away: snap.teamById.get(week.away_team_id!) } : null
  const weekScore = week ? scores.data?.get(week.id) : undefined
  const weekLabel = week?.status === 'final' ? 'Last game' : weekLive ? 'Now' : 'Next'

  // Who can do what. The database checks each action too; these only hide buttons.
  const me = players.data?.find((p) => p.id === member.playerId)
  const captainTeam = snap.teams.find((t) => isCaptainOf(t, member.playerId))
  const canTrade = member.isOwner || !!captainTeam
  const canEdit = canEditTeam(member, team)
  const canDecide = canDecideTrades(member, me)
  const canMove = canMovePlayers(member)

  const ACTIONS: { id: Exclude<Open, 'edit' | null>; label: string; icon: IconName; hidden?: boolean }[] = [
    { id: 'score', label: 'Enter score', icon: 'finish', hidden: !next },
    { id: 'stats', label: 'Add stats', icon: 'stats' },
    { id: 'trade', label: 'Make a trade', icon: 'trade', hidden: !canTrade },
    { id: 'move', label: 'Move player', icon: 'players', hidden: !canMove },
    { id: 'guest', label: 'Add guest', icon: 'add-guest' },
    { id: 'photos', label: 'Edit team', icon: 'edit', hidden: !canEdit },
  ]

  return (
    <div className="flex flex-col gap-5" style={teamStyle(team.color_key)}>
      <header className="rise flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="brand-type text-small text-accent">{team.id === snap.myTeam?.id ? 'Your team' : snap.season?.name}</p>
          <h1 className="text-headline">Team</h1>
        </div>
        {snap.teams.length > 1 && (
          <Segmented
            label="Team"
            value={teamId}
            onChange={(v) => setPicked(v)}
            options={snap.teams.map((t) => ({ value: t.id, label: t.short_name, mark: t.id === snap.myTeam?.id ? 'your team' : undefined }))}
          />
        )}
      </header>

      {/* Hero: crest, record, points for and against, then this week's game with projected vs actual. */}
      <section aria-label={`${team.name} summary`} className="rise hero-photo glass-appear relative isolate flex flex-col gap-3 overflow-hidden rounded-hero p-4" style={{ '--i': 1 } as CSSProperties}>
        <StadiumBackdrop photo="lights" team={team.color_key} src={teamPhoto} />
        <div className="flex items-center gap-3">
          <TeamBadge team={team} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate font-display text-title font-bold uppercase leading-tight">{team.name}</h2>
            <p className="text-small text-text-2-strong nums">
              {row && row.games_played > 0 ? `${ordinal(row.rank)} place · ${row.points_for} PF · ${row.points_against} PA` : 'No games yet'}
            </p>
          </div>
          {row && <span className="numeral text-headline nums">{recordText(row)}</span>}
        </div>

        {week && weekTeams && (
          <div className="glass-score flex flex-col gap-3 rounded-panel p-3">
            <div className="flex items-center gap-2">
              <span className="caps-label">
                {weekLabel}
                {week.week !== null ? ` · Week ${week.week}` : ''}
              </span>
              <span className="flex-1" />
              {weekLive ? (
                <Badge variant="live">{week.status === 'live' ? 'Live' : 'Half'}</Badge>
              ) : week.status === 'final' ? (
                <span className="caps-label">Final</span>
              ) : (
                <span className="caps-label nums">{week.starts_at ? `${formatGameTime(week.starts_at)} ${ZONE_LABEL}` : 'Time not set'}</span>
              )}
            </div>
            {/* One matchup row: each side's crest, name and big number, "vs" (or the live score) between. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <MatchupSide team={team} side={mine} align="start" />
              <span className="pb-2 font-display text-small font-bold uppercase text-text-3 nums">
                {weekLive && weekScore
                  ? week.home_team_id === teamId
                    ? `${weekScore.home_points}–${weekScore.away_points}`
                    : `${weekScore.away_points}–${weekScore.home_points}`
                  : 'vs'}
              </span>
              <MatchupSide team={oppTeam} side={opp} align="end" />
            </div>
            {opp && (
              <WinBar
                chance={chance}
                final={week.status === 'final'}
                leftName={team.short_name}
                rightName={oppTeam?.short_name ?? 'Opponent'}
                rightColor={oppTeam?.color_key}
                leftColor={team.color_key}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate(`/matchup/${week.id}`)}>
                <Icon name="trade" size="xs" />
                Matchup
              </Button>
              {week.status !== 'final' && (
                <Button variant="primary" size="sm" onClick={() => navigate(`/game?id=${week.id}`)}>
                  <Icon name="live" size="xs" />
                  {week.status === 'scheduled' ? 'Start live game' : 'Open game'}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Quick actions: everything you can put in, one tap away. */}
      <nav aria-label="Roster actions" className="rise no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" style={{ '--i': 2 } as CSSProperties}>
        {ACTIONS.filter((a) => !a.hidden).map((a) => (
          <Button key={a.id} variant="secondary" size="sm" className="shrink-0" onClick={() => show(a.id)}>
            <Icon name={a.icon} size="xs" />
            {a.label}
          </Button>
        ))}
      </nav>

      {/* Players: this week's QB on top, then the roster, with this week's or the season's stats. */}
      <section aria-labelledby="lineup-title" className="rise flex flex-col gap-3" style={{ '--i': 3 } as CSSProperties}>
        <header className="flex items-center gap-2 px-1">
          <h2 id="lineup-title" className="flex-1 text-body font-strong">
            Players <span className="text-text-2 nums">· {lineup.length}</span>
          </h2>
        </header>
        {mine.rows.length === 0 ? (
          <p className="glass-list rounded-panel px-3 py-4 text-small text-text-2">No one on this team yet. Use Move player to add someone.</p>
        ) : (
          <TeamStatsTable
            side={mine}
            team={team}
            seasonId={snap.season?.id}
            playerById={playerById}
            onOpenPlayer={(p) => setActionsFor(p)}
          />
        )}
      </section>

      <FreeAgentList
        id="league-qbs"
        title="League QBs"
        hint="Play for any team"
        players={leagueQbs}
        projections={projections.data}
        onOpen={setActionsFor}
        index={4}
      />
      <FreeAgentList
        id="backups"
        title="Backups"
        hint="Not on a team"
        players={backups}
        projections={projections.data}
        onOpen={setActionsFor}
        index={4}
      />

      <TradesSection seasonId={snap.season?.id} teams={snap.teams} canDecide={canDecide} />

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="rise flex flex-col gap-2" style={{ '--i': 5 } as CSSProperties}>
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-body-lg">
              Recent results
            </h2>
            <Link to="/schedule" className="pressable text-small text-accent">
              Schedule
            </Link>
          </div>
          <ul className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel">
            {recent.map((g) => (
              <ResultRow key={g.id} game={g} teamId={teamId} teamById={snap.teamById} score={scores.data?.get(g.id)} />
            ))}
          </ul>
        </section>
      )}

      {/* Player actions */}
      <Sheet open={!!actionsFor} onOpenChange={(o) => !o && setActionsFor(null)} title={actionsFor ? displayName(actionsFor) : 'Player'}>
        {actionsFor && (
          <ul className="surface-inset divide-y divide-divider overflow-hidden rounded-panel">
            <ActionRow icon="me" label="View profile" onClick={() => navigate(`/players/${actionsFor.id}`)} />
            <ActionRow icon="stats" label="Add stats" onClick={() => show('stats', actionsFor)} />
            <ActionRow icon="edit" label="Edit details" onClick={() => show('edit', actionsFor)} />
            {!actionsFor.is_guest && canMove && <ActionRow icon="players" label="Move to another team" onClick={() => show('move', actionsFor)} />}
          </ul>
        )}
      </Sheet>

      {snap.season && (
        <AddStatsSheet
          key={`stats-${sheetKey}`}
          open={open === 'stats'}
          onOpenChange={(o) => !o && setOpen(null)}
          seasonId={snap.season.id}
          initialPlayerId={focus?.id ?? lineup[0]?.id ?? ''}
          games={snap.games}
          teamOf={teamOf}
        />
      )}
      {/* A captain offers trades for their own team only; the owner picks any team and can trade now. */}
      {canTrade && (
        <TradeSheet
          key={`trade-${sheetKey}`}
          open={open === 'trade'}
          onOpenChange={(o) => !o && setOpen(null)}
          initialTeamId={teamId}
          lockedTeamId={member.isOwner ? undefined : captainTeam?.id}
          canTradeNow={member.isOwner}
        />
      )}
      <MovePlayerSheet key={`move-${sheetKey}`} open={open === 'move'} onOpenChange={(o) => !o && setOpen(null)} initialPlayerId={focus?.id} />
      <AddGuestSheet open={open === 'guest'} onOpenChange={(o) => !o && setOpen(null)} />
      <TeamPhotosSheet key={`photos-${team.id}`} team={team} open={open === 'photos'} onOpenChange={(o) => !o && setOpen(null)} />
      {focus && <EditPlayerSheet key={`edit-${sheetKey}`} player={focus} open={open === 'edit'} onOpenChange={(o) => !o && setOpen(null)} />}
      {next && nextTeams && (
        <EnterScoreSheet
          open={open === 'score'}
          onOpenChange={(o) => !o && setOpen(null)}
          game={next}
          home={nextTeams.home}
          away={nextTeams.away}
          current={nextScore ? { home: nextScore.home_points, away: nextScore.away_points } : undefined}
        />
      )}
    </div>
  )
}

function PlayerRow({ player, team, ppg, onOpen }: { player: Player; team: Team | undefined; ppg: number | undefined; onOpen(): void }) {
  const slot = player.positions[0] ?? '—'
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="pressable lit flex min-h-(--tap-min) w-full items-center gap-3 bg-transparent px-3 py-2 text-left hover-fine:bg-(--row-hover)"
      >
        <span className="w-10 shrink-0 rounded-chip bg-(--press-fill) py-0.5 text-center caps-label text-text">{slot.slice(0, 4)}</span>
        <PlayerBadge jersey={player.jersey} team={team?.color_key} photo={player.photo_path} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-strong">{displayName(player)}</span>
          <span className="truncate caps-label">{player.positions.slice(1).map(shortPosition).join(' · ') || (player.is_guest ? 'Guest' : ' ')}</span>
        </span>
        {ppg !== undefined && (
          <span className="flex shrink-0 flex-col items-end leading-tight">
            <span className="numeral text-body-lg nums">{ppg.toFixed(1)}</span>
            <span className="caps-label">est/gm</span>
          </span>
        )}
        <Icon name="chevron" size="xs" className="shrink-0 text-text-3" />
      </button>
    </li>
  )
}

/** A QB on no team plays for whichever side needs one. */
function isQb(p: Player) {
  return p.positions.some((pos) => pos.trim().toUpperCase() === 'QB')
}

/** Players who belong to no team, as one titled list (hidden when empty). */
function FreeAgentList({
  id,
  title,
  hint,
  players,
  projections,
  onOpen,
  index,
}: {
  id: string
  title: string
  hint: string
  players: Player[]
  projections: Map<string, { points_per_game: number }> | undefined
  onOpen(p: Player): void
  index: number
}) {
  if (players.length === 0) return null
  return (
    <section aria-labelledby={`${id}-title`} className="rise glass-list overflow-hidden rounded-panel" style={{ '--i': index } as CSSProperties}>
      <header className="flex items-center gap-2 px-3 py-2">
        <h2 id={`${id}-title`} className="flex-1 text-body font-strong">
          {title}
        </h2>
        <span className="caps-label">{hint}</span>
      </header>
      <ul className="divide-y divide-(--glass-groove) border-t border-(--glass-groove)">
        {players.map((p) => (
          <PlayerRow key={p.id} player={p} team={undefined} ppg={projections?.get(p.id)?.points_per_game} onOpen={() => onOpen(p)} />
        ))}
      </ul>
    </section>
  )
}

function ResultRow({
  game,
  teamId,
  teamById,
  score,
}: {
  game: Game
  teamId: string
  teamById: Map<string, Team>
  score?: { home_points: number; away_points: number }
}) {
  const isHome = game.home_team_id === teamId
  const opp = teamById.get((isHome ? game.away_team_id : game.home_team_id) ?? '')
  const us = score ? (isHome ? score.home_points : score.away_points) : 0
  const them = score ? (isHome ? score.away_points : score.home_points) : 0
  const result = us > them ? 'W' : us < them ? 'L' : 'T'
  return (
    <li className="flex min-h-(--tap-min) items-center gap-3 px-3 py-2">
      <span className={`numeral w-5 text-title ${result === 'W' ? 'text-accent' : result === 'L' ? 'text-text-3' : 'text-text-2'}`}>{result}</span>
      <span className="numeral text-body-lg nums">
        {us}–{them}
      </span>
      <span className="flex-1" />
      <span className="caps-label">{isHome ? 'vs' : 'at'}</span>
      <span className="flex items-center gap-2" style={teamStyle(opp?.color_key)}>
        <span className="font-display font-bold uppercase">{opp?.short_name ?? 'TBD'}</span>
        <TeamBadge team={opp} size="sm" />
      </span>
    </li>
  )
}

function ActionRow({ icon, label, onClick }: { icon: IconName; label: string; onClick(): void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="pressable flex min-h-(--tap-min) w-full items-center gap-3 bg-transparent px-3 py-2 text-left hover-fine:bg-(--row-hover)">
        <span className="flex size-(--badge-sm) shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
          <Icon name={icon} size="sm" />
        </span>
        <span className="flex-1 font-strong">{label}</span>
        <Icon name="chevron" size="xs" className="text-text-3" />
      </button>
    </li>
  )
}

/** One side of the matchup card: crest and name on one line, then the big number (projected before kickoff, points after). */
function MatchupSide({ team, side, align }: { team: Team | undefined; side: TeamSide | null; align: 'start' | 'end' }) {
  const started = side?.actual != null
  const proj = side && side.projected > 0 ? side.projected.toFixed(1) : '—'
  const end = align === 'end'
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${end ? 'items-end text-right' : 'items-start text-left'}`} style={teamStyle(team?.color_key)}>
      <span className={`flex max-w-full min-w-0 items-center gap-2 ${end ? 'flex-row-reverse' : ''}`}>
        <TeamBadge team={team} size="sm" />
        <span className="truncate font-display font-bold uppercase">{team?.short_name ?? 'TBD'}</span>
      </span>
      <span className="numeral-xl nums leading-none">{started ? fmtPoints(side?.actual ?? 0) : proj}</span>
      <span className="caps-label nums">{started ? `Proj ${proj}` : 'Projected'}</span>
    </div>
  )
}

/** The middle of the matchup card: both win percentages (summing to 100) above a bar split in the two teams' colours. */
function WinBar({
  chance,
  final,
  leftName,
  rightName,
  rightColor,
  leftColor,
}: {
  chance: number
  /** Before the final whistle nothing is certain, so the labels stay between 1% and 99%. */
  final: boolean
  leftName: string
  rightName: string
  rightColor: Team['color_key'] | undefined
  leftColor: Team['color_key'] | undefined
}) {
  const reduce = useReducedMotion()
  const raw = Math.round(chance * 100)
  const left = final ? raw : Math.min(99, Math.max(1, raw))
  const right = 100 - left
  // Only transform animates; the bar width is a scaleX. No transition when reduced motion is on.
  const motion = reduce ? undefined : { transition: 'transform var(--dur-base) var(--ease-out)' }
  return (
    <div role="img" aria-label={`Win chance: ${leftName} ${left}%, ${rightName} ${right}%`} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 nums">
        <span className="numeral text-body-lg">{left}%</span>
        <span className="caps-label">Win chance</span>
        <span className="numeral text-body-lg">{right}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-chip bg-(--press-fill)">
        <div className="absolute inset-0 origin-left bg-(--team)" style={{ ...teamStyle(leftColor), transform: `scaleX(${chance})`, ...motion }} />
        <div className="absolute inset-0 origin-right bg-(--team)" style={{ ...teamStyle(rightColor), transform: `scaleX(${1 - chance})`, ...motion }} />
      </div>
    </div>
  )
}

/** "Right guard" → "RG": long position names shortened so a row never cuts off. */
function shortPosition(p: string): string {
  return p.trim().includes(' ') ? p.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase() : p
}
