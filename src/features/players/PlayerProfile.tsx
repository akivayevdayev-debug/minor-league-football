import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approxAge, displayName, formatHeight, STAT_LABELS, usePlayerProjections, usePlayers, useRosters, useSettings, useStatTotals, useTeams } from '../league'
import { minutesText, playerMinutes, useAllLineups, usePlayerStatsIn } from '../game/lineup'
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

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const formatDay = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`))
const rise = (i: number) => ({ '--i': i }) as CSSProperties

/** Player profile: a compact photo hero, career stats, this season's projection, facts, achievements and team history. */
export default function PlayerProfile() {
  const { id } = useParams()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const totals = useStatTotals()
  const projections = usePlayerProjections()
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const allLineups = useAllLineups()
  const settings = useSettings()
  const [now] = useState(() => Date.now())
  const halfSeconds = (settings.data?.half_minutes ?? 10) * 60
  const played = useMemo(
    () => (allLineups.data && id ? playerMinutes(allLineups.data.lineups, allLineups.data.clocks, id, halfSeconds, now) : { seconds: 0, gameIds: [] }),
    [allLineups.data, id, halfSeconds, now],
  )
  const trackedStats = usePlayerStatsIn(id, played.gameIds)

  const player = players.data?.find((p) => p.id === id)
  const history = useMemo(() => (rosters.data ?? []).filter((r) => r.player_id === id), [rosters.data, id])
  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const current = history.find((r) => r.ends_on === null)
  const currentTeam = current ? teamById.get(current.team_id) : undefined

  if (players.isPending) return <Skeleton rows={4} />
  if (players.isError) return <ErrorState what="this player" onRetry={() => players.refetch()} />
  if (!player) return <EmptyState icon="players" title="Player not found" body="They may have been removed. Go back to the list." />

  const stats = totals.data?.get(player.id) ?? {}
  const proj = projections.data?.get(player.id)
  const tiles = STAT_LABELS.filter(([key]) => (stats[key] ?? 0) > 0)
  const age = approxAge(player.birth_year)
  const facts = [age != null && `Age ${age}`, formatHeight(player.height_in), player.weight_lb ? `${player.weight_lb} lb` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="flex flex-col gap-5">
      <Link to="/roster" className="pressable -ml-2 flex min-h-(--tap-min) w-fit items-center gap-1 px-2 caps-label hover-fine:text-accent">
        <Icon name="back" size="xs" />
        Roster
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
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Icon name="edit" size="xs" />
          Edit
        </Button>
        {!player.is_guest && (
          <Button variant="outline" size="sm" onClick={() => setMoving(true)}>
            <Icon name="history" size="xs" />
            Move
          </Button>
        )}
      </div>

      {tiles.length > 0 && (
        <section className="rise flex flex-col gap-2" style={rise(2)}>
          <h2 className="text-body-lg">Career stats</h2>
          <dl className="glass-panel grid grid-cols-4 gap-x-2 gap-y-3 rounded-panel p-3 sm:grid-cols-6">
            {tiles.map(([key, short, long]) => (
              <StatBox key={key} label={short} value={stats[key] ?? 0} count title={long} />
            ))}
          </dl>
        </section>
      )}

      {played.seconds > 0 && (
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

      <section className="rise glass-panel flex items-center justify-between gap-3 rounded-panel p-3" style={rise(3)}>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-body-lg">Projection</h2>
            <Badge variant="estimate">Estimate</Badge>
          </div>
          <p className="nums text-small text-text-2">
            {proj
              ? `TD ${proj.td_per_game.toFixed(2)} · Rec ${proj.rec_per_game.toFixed(1)} · INT ${proj.int_per_game.toFixed(2)} per game`
              : 'No projection yet.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="numeral text-stat">{proj ? proj.points_per_game.toFixed(1) : '–'}</span>
          <span className="caps-label">proj/gm</span>
        </div>
      </section>

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
