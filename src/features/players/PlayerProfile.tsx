import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMember } from '../auth'
import { approxAge, displayName, formatHeight, seasonRules, selectableSeasons, STAT_LABELS, useActiveSeason, useGames, usePlayerProjections, usePlayers, useRosters, useSeasons, useTeams, useViewedSeason } from '../league'
import { minutesText, playerMinutes, useAllLineups, usePlayerStatsIn } from '../game/lineup'
import { usePlayerTypedMinutes } from '../game/subs'
import { Badge } from '@/components/ui/badge'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'
import { StatBox } from '../../ui/StatBox'
import { TeamName } from '../../ui/TeamStripe'
import { teamStyle } from '../../ui/team'
import { EditPlayerSheet } from './EditPlayerSheet'
import { MovePlayerSheet } from './MovePlayerSheet'
import { canMovePlayers } from '../roster/permissions'
import { Segmented } from '../../ui/motion'
import { TeamBadge } from '../../ui/TeamBadge'
import { formatGameTime, ZONE_LABEL } from '../../lib/time'
import { fmtPoints, weekGame } from '../team/week'
import { cardTotals, gameLine, nextAsQb, opponentIn, recentGames } from './card'
import { useGameLog } from './useGameLog'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const formatDay = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`))
const rise = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * Player card: photo hero, a Season 1 / Season 2 / Career switch, totals and fantasy points, the last
 * nine games, next game's estimate, achievements and team history.
 */
export default function PlayerProfile() {
  const { id } = useParams()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const seasons = useSeasons()
  const projections = usePlayerProjections()
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const allLineups = useAllLineups()
  const member = useMember()
  // Stats, minutes and the half length all follow the viewed season (no fallback while seasons load).
  const [season, setSeason] = useViewedSeason()
  const [career, setCareer] = useState(false)
  const seasonGames = useGames(season?.id)
  const log = useGameLog(id)
  const active = useActiveSeason()
  const activeGames = useGames(active?.id)
  const typedMinutes = usePlayerTypedMinutes(id)
  const [now] = useState(() => Date.now())
  const halfSeconds = season ? seasonRules(season).halfSeconds : null
  const played = useMemo(() => {
    if (!allLineups.data || !id || halfSeconds === null) return { seconds: 0, gameIds: [] as string[] }
    const inSeason = new Set((seasonGames.data ?? []).map((g) => g.id))
    return playerMinutes(
      allLineups.data.lineups.filter((l) => inSeason.has(l.game_id)),
      allLineups.data.clocks.filter((c) => inSeason.has(c.game_id)),
      id,
      halfSeconds,
      now,
      // Typed-in minutes (box score) replace the tracked time for that game.
      new Map([...(typedMinutes.data ?? new Map<string, number>())].filter(([gameId]) => inSeason.has(gameId))),
    )
  }, [allLineups.data, seasonGames.data, id, halfSeconds, now, typedMinutes.data])
  const trackedStats = usePlayerStatsIn(id, played.gameIds)

  const player = players.data?.find((p) => p.id === id)
  const history = useMemo(() => (rosters.data ?? []).filter((r) => r.player_id === id), [rosters.data, id])
  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const current = history.find((r) => r.ends_on === null)
  const currentTeam = current ? teamById.get(current.team_id) : undefined

  const seasonById = new Map((seasons.data ?? []).map((s) => [s.id, s]))

  if (players.isPending) return <Skeleton rows={4} />
  if (players.isError) return <ErrorState what="this player" onRetry={() => players.refetch()} />
  if (!player) return <EmptyState icon="players" title="Player not found" body="They may have been removed. Go back to the list." />

  const proj = projections.data?.get(player.id)
  // Everything below the hero follows the switch: one season, or the whole career.
  const scopeId = career ? null : (season?.id ?? null)
  const scopeName = career ? 'Career' : (season?.name ?? 'Season')
  const logRows = log.data ?? []
  const totals = cardTotals(logRows, scopeId)
  const tiles = STAT_LABELS.filter(([key]) => (totals.stats[key] ?? 0) > 0)
  const recent = recentGames(logRows, scopeId)
  const switchOptions = [...selectableSeasons(seasons.data ?? [])].reverse().map((s) => ({ value: s.id, label: s.name }))

  // Next game, in the season being played now: their team's next game, or (for a QB with no team) the next game they are set to throw in.
  const nowSeason = !career && !!season && season.id === active?.id
  const asQb = nowSeason ? nextAsQb(activeGames.data ?? [], player.id) : null
  const teamNext = nowSeason && currentTeam ? weekGame(currentTeam.id, activeGames.data ?? []) : null
  const upcoming = teamNext && teamNext.status !== 'final' ? teamNext : asQb
  const sideId = upcoming && currentTeam && (upcoming.home_team_id === currentTeam.id || upcoming.away_team_id === currentTeam.id) ? currentTeam.id : null
  const qbNext = !!upcoming && (upcoming.home_qb_id === player.id || upcoming.away_qb_id === player.id)
  const nextLabel = !upcoming
    ? ''
    : sideId
      ? `vs ${teamById.get(upcoming.home_team_id === sideId ? upcoming.away_team_id! : upcoming.home_team_id!)?.name ?? 'TBD'}`
      : `${teamById.get(upcoming.home_team_id ?? '')?.short_name ?? 'TBD'} vs ${teamById.get(upcoming.away_team_id ?? '')?.short_name ?? 'TBD'}`
  // A QB this week is estimated by their average points; everyone else by their projection.
  const estimate = qbNext ? (cardTotals(logRows, active?.id ?? null).perGame ?? cardTotals(logRows, null).perGame) : (proj?.points_per_game ?? null)
  const age = approxAge(player.birth_year)
  const facts = [age != null && `Age ${age}`, formatHeight(player.height_in), player.weight_lb ? `${player.weight_lb} lb` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="flex flex-col gap-5">
      <Link to="/team" className="pressable -ml-2 flex min-h-(--tap-min) w-fit items-center gap-1 px-2 caps-label hover-fine:text-accent">
        <Icon name="back" size="xs" />
        Team
      </Link>

      <header
        style={teamStyle(currentTeam?.color_key)}
        className="rise relative isolate flex items-center gap-4 overflow-hidden rounded-hero p-4 pt-8"
      >
        <StadiumBackdrop photo="sunset" team={currentTeam?.color_key} />
        <PlayerBadge jersey={player.jersey} team={currentTeam?.color_key} photo={player.photo_path} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-headline leading-none break-words">{displayName(player)}</h1>
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-text-2-strong">
            {currentTeam ? (
              <span className="font-strong text-(--team-light)">
                <TeamName name={currentTeam.name} color={currentTeam.color_key} />
              </span>
            ) : (
              <span>{player.is_guest ? 'Guest' : 'No team'}</span>
            )}
            {player.positions.length > 0 && <span className="caps-label">{player.positions.join(' · ')}</span>}
          </p>
          {player.nickname && <p className="truncate text-small text-text-2">{player.full_name}</p>}
          {facts && <p className="nums text-small text-text-2">{facts}</p>}
        </div>
      </header>

      <div className="rise flex flex-wrap gap-2" style={rise(1)}>
        {(member.isOwner || player.id === member.playerId) && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size="xs" />
            Edit
          </Button>
        )}
        {!player.is_guest && canMovePlayers(member) && (
          <Button variant="outline" size="sm" onClick={() => setMoving(true)}>
            <Icon name="history" size="xs" />
            Move
          </Button>
        )}
      </div>

      {switchOptions.length > 0 && (
        <Segmented
          label="Stats for"
          value={career ? 'career' : (season?.id ?? 'career')}
          onChange={(v) => {
            if (v === 'career') return setCareer(true)
            setCareer(false)
            setSeason(v)
          }}
          options={[...switchOptions, { value: 'career', label: 'Career' }]}
        />
      )}

      {upcoming && (
        <section className="rise glass-panel flex items-center justify-between gap-3 rounded-panel p-3" style={rise(2)}>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-body-lg">Next game</h2>
              <Badge variant="estimate">Estimate</Badge>
            </div>
            <p className="flex min-w-0 items-center gap-2 text-small text-text-2-strong">
              {upcoming.week != null && <span className="caps-label nums">Wk {upcoming.week}</span>}
              <span className="truncate">{nextLabel}</span>
            </p>
            <p className="caps-label nums">
              {upcoming.status === 'scheduled' ? (upcoming.starts_at ? `${formatGameTime(upcoming.starts_at)} ${ZONE_LABEL}` : 'Time not set') : 'Playing now'}
              {qbNext ? ' · QB this week' : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="numeral text-stat">{estimate != null ? estimate.toFixed(1) : '–'}</span>
            <span className="caps-label">proj pts</span>
          </div>
        </section>
      )}

      <section className="rise flex flex-col gap-2" style={rise(2)} aria-busy={log.isPending}>
        <h2 className="text-body-lg">{scopeName} totals</h2>
        {log.isPending ? (
          <Skeleton rows={2} />
        ) : log.isError ? (
          <ErrorState what="their games" onRetry={() => log.refetch()} />
        ) : totals.games === 0 ? (
          <p className="text-small text-text-2">{career ? 'No games played yet.' : `No games played in ${scopeName} yet.`}</p>
        ) : (
          <div className="glass-panel flex flex-col gap-3 rounded-panel p-3">
            <dl className="grid grid-cols-3 gap-2">
              <StatBox label="Fantasy pts" value={fmtPoints(Math.round(totals.points * 10) / 10)} accent title="Fantasy points from final games" />
              <StatBox label="Games" value={totals.games} count title="Final games played" />
              <StatBox label="Pts/game" value={totals.perGame != null ? totals.perGame.toFixed(1) : '–'} title="Fantasy points per game" />
            </dl>
            {tiles.length > 0 && (
              <dl className="grid grid-cols-4 gap-x-2 gap-y-3 border-t border-divider pt-3 sm:grid-cols-6">
                {tiles.map(([key, short, long]) => (
                  <StatBox key={key} label={short} value={totals.stats[key] ?? 0} count title={long} />
                ))}
              </dl>
            )}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="rise flex flex-col gap-2" style={rise(3)}>
          <h2 className="text-body-lg">{recent.length === 1 ? 'Last game' : `Last ${recent.length} games`}</h2>
          <ul className="glass-list divide-y divide-divider overflow-hidden rounded-panel">
            {recent.map((g) => {
              const opp = teamById.get(opponentIn(g, history) ?? '')
              const line = gameLine(g.stats)
              return (
                <li key={g.game_id}>
                  <Link
                    to={`/matchup/${g.game_id}`}
                    aria-label={`${g.week != null ? `Week ${g.week}` : 'Game'} against ${opp?.name ?? 'unknown team'}: ${fmtPoints(g.points)} points. Open the matchup`}
                    className="pressable lit flex min-h-(--tap-min) items-center gap-3 px-3 py-2 hover-fine:bg-(--row-hover)"
                  >
                    <span className="w-10 shrink-0 caps-label nums">
                      {career && <span className="block">{seasonById.get(g.season_id)?.name.replace('Season ', 'S') ?? ''}</span>}
                      {g.week != null ? `Wk ${g.week}` : '–'}
                    </span>
                    <TeamBadge team={opp} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-strong">vs {opp?.short_name ?? 'TBD'}</span>
                      <span className="truncate text-small text-text-2">{line || 'No stats'}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end leading-tight">
                      <span className={`numeral text-body-lg nums ${g.points < 0 ? 'text-danger' : ''}`}>{fmtPoints(g.points)}</span>
                      <span className="caps-label">pts</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {seasons.isPending && <Skeleton rows={2} />}
      {!career && played.seconds > 0 && (
        <section className="rise flex flex-col gap-2" style={rise(2)}>
          <h2 className="text-body-lg">Playing time</h2>
          <dl className="glass-panel grid grid-cols-4 gap-x-2 gap-y-3 rounded-panel p-3">
            <StatBox label="MIN" value={Math.round(played.seconds / 60)} count title={`${minutesText(played.seconds)} on the field in ${played.gameIds.length} tracked ${played.gameIds.length === 1 ? 'game' : 'games'}`} />
            {(['rec', 'td', 'int'] as const).map((k) => (
              <StatBox
                key={k}
                label={`${k.toUpperCase()}/10`}
                value={(((trackedStats.data?.[k] ?? 0) / played.seconds) * 600).toFixed(1)}
                title={`${k === 'rec' ? 'Catches' : k === 'td' ? 'Touchdowns' : 'Interceptions'} per 10 minutes on the field`}
              />
            ))}
          </dl>
          <p className="text-small text-text-2">
            {played.gameIds.length} tracked {played.gameIds.length === 1 ? 'game' : 'games'}. Games before subs were tracked are not counted here.
          </p>
        </section>
      )}

      {player.achievements && (
        <section className="rise flex flex-col gap-2" style={rise(4)}>
          <h2 className="text-body-lg">Achievements</h2>
          {/* Plain text only: user-written. */}
          <p className="surface-inset rounded-control p-3 text-small whitespace-pre-line">{player.achievements}</p>
        </section>
      )}

      <section className="rise flex flex-col gap-2" style={rise(5)}>
        <h2 className="text-body-lg">Team history</h2>
        {history.length === 0 ? (
          <p className="text-small text-text-2">No team yet.</p>
        ) : (
          <ol className="flex flex-col border-l border-divider pl-4">
            {history.map((r) => {
              const team = teamById.get(r.team_id)
              return (
                <li key={r.id} className="relative flex items-center justify-between gap-3 py-1.5 text-small">
                  <span aria-hidden="true" className={`absolute -left-4 size-(--dot) -translate-x-1/2 rounded-pill ${r.ends_on ? 'bg-text-3' : 'bg-accent shadow-glow-soft'}`} />
                  {team ? <TeamName name={team.name} color={team.color_key} /> : <span>Unknown team</span>}
                  <span className="nums text-text-2">
                    {formatDay(r.starts_on)} – {r.ends_on ? formatDay(r.ends_on) : 'now'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <EditPlayerSheet player={player} open={editing} onOpenChange={setEditing} />
      <MovePlayerSheet key={player.id} open={moving} onOpenChange={setMoving} initialPlayerId={player.id} />
    </article>
  )
}
