import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approxAge, displayName, formatHeight, STAT_LABELS, usePlayers, useRosters, useStatTotals, useTeams } from '../league'
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
import { EditPlayerSheet } from './EditPlayerSheet'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const formatDay = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`))
const rise = (i: number) => ({ '--i': i }) as CSSProperties

/** Player profile: hero, headline numbers, every career stat, facts, achievements and team history. */
export default function PlayerProfile() {
  const { id } = useParams()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const totals = useStatTotals()
  const [editing, setEditing] = useState(false)

  const player = players.data?.find((p) => p.id === id)
  const history = useMemo(() => (rosters.data ?? []).filter((r) => r.player_id === id), [rosters.data, id])
  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const current = history.find((r) => r.ends_on === null)
  const currentTeam = current ? teamById.get(current.team_id) : undefined

  if (players.isPending) return <Skeleton rows={4} />
  if (players.isError) return <ErrorState what="this player" onRetry={() => players.refetch()} />
  if (!player) return <EmptyState icon="players" title="Player not found" body="They may have been removed. Go back to the list." />

  const stats = totals.data?.get(player.id) ?? {}
  const facts: [string, string | null][] = [
    ['Age', approxAge(player.birth_year)?.toString() ?? null],
    ['Height', formatHeight(player.height_in)],
    ['Weight', player.weight_lb ? `${player.weight_lb} lb` : null],
  ]
  const tiles = STAT_LABELS.filter(([key]) => (stats[key] ?? 0) > 0)

  return (
    <article className="flex flex-col gap-6">
      <Link to="/players" className="pressable -ml-2 flex min-h-(--tap-min) w-fit items-center gap-1 px-2 caps-label hover-fine:text-accent">
        <Icon name="back" size="xs" />
        Players
      </Link>

      <header className="rise relative isolate flex flex-col gap-5 overflow-hidden rounded-hero p-5 pt-8">
        <StadiumBackdrop team={currentTeam?.color_key} />
        <div className="flex items-end gap-4">
          <PlayerBadge jersey={player.jersey} team={currentTeam?.color_key} size="xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pb-1">
            <p className="text-text-2-strong">
              {currentTeam ? <TeamName name={currentTeam.name} color={currentTeam.color_key} /> : player.is_guest ? 'Guest' : 'No team'}
            </p>
            <h1 className="text-headline leading-none break-words">{displayName(player)}</h1>
            {player.nickname && <p className="truncate text-small text-text-2">{player.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label="Edit player" onClick={() => setEditing(true)} className="self-start">
            <Icon name="edit" size="sm" />
          </Button>
        </div>
        {player.positions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Positions">
            {player.positions.map((pos) => (
              <li key={pos}>
                <Badge variant="accent">{pos}</Badge>
              </li>
            ))}
          </ul>
        )}
      </header>

      <dl className="rise glass-panel grid grid-cols-3 gap-4 rounded-panel p-5" style={rise(1)}>
        <StatBox label="Catches" value={stats.rec ?? 0} count accent />
        <StatBox label="TDs" value={stats.td ?? 0} count />
        <StatBox label="Picks" value={stats.int ?? 0} count />
      </dl>

      {tiles.length > 0 && (
        <section className="rise flex flex-col gap-3" style={rise(2)}>
          <h2 className="text-title">Career stats</h2>
          <dl className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {tiles.map(([key, short, long]) => (
              <div key={key} className="lit surface-inset flex flex-col gap-1 rounded-control p-3" title={long}>
                <dt className="caps-label">{short}</dt>
                <dd className="numeral text-title">{stats[key]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <dl className="rise grid grid-cols-3 gap-2" style={rise(3)}>
        {facts.map(([label, value]) => (
          <div key={label} className="surface-inset flex flex-col gap-1 rounded-control p-3">
            <dt className="caps-label">{label}</dt>
            <dd className="nums text-body-lg">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>

      {player.achievements && (
        <section className="rise flex flex-col gap-2" style={rise(4)}>
          <h2 className="text-title">Achievements</h2>
          {/* Plain text only: user-written. */}
          <p className="surface-inset rounded-panel p-4 whitespace-pre-line">{player.achievements}</p>
        </section>
      )}

      <section className="rise flex flex-col gap-3" style={rise(5)}>
        <h2 className="text-title">Team history</h2>
        {history.length === 0 ? (
          <p className="text-text-2">No team yet.</p>
        ) : (
          <ol className="flex flex-col border-l border-divider pl-4">
            {history.map((r) => {
              const team = teamById.get(r.team_id)
              return (
                <li key={r.id} className="relative flex items-center justify-between gap-3 py-2">
                  <span aria-hidden="true" className={`absolute -left-4 size-(--dot) -translate-x-1/2 rounded-pill ${r.ends_on ? 'bg-text-3' : 'bg-accent shadow-glow-soft'}`} />
                  {team ? <TeamName name={team.name} color={team.color_key} /> : <span>Unknown team</span>}
                  <span className="nums text-small text-text-2">
                    {formatDay(r.starts_on)} – {r.ends_on ? formatDay(r.ends_on) : 'now'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <EditPlayerSheet player={player} open={editing} onOpenChange={setEditing} />
    </article>
  )
}
