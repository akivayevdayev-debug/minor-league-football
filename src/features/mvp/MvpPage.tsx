import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useMember } from '../auth'
import { currentTeams, displayName, SeasonSelect, seasonTeams, useGames, useSeasons, useViewedSeason, usePlayers, useRosters, useStatTypes, useTeams } from '../league'
import { canPinMvp } from '../roster/permissions'
import type { Player, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { teamStyle } from '../../ui/team'
import { LeagueLeaders } from '../standings/LeagueLeaders'
import { StandingsSection } from '../standings/StandingsSection'
import { useGamePoints, useMvpPins, usePinPlayer, useUnpin, type PinRow } from './api'
import { mvpRace, playersOfTheWeek, type RaceRow, type WeekStar } from './race'

const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * MVP tab (it took in the old League tab): the MVP race (leader, player of the week, everyone by
 * points per game), then the standings and the final, then league leaders.
 */
export default function MvpPage() {
  const member = useMember()
  const seasons = useSeasons()
  const [viewed] = useViewedSeason()
  const seasonId = viewed?.id
  const points = useGamePoints(seasonId)
  const pins = useMvpPins(seasonId)
  const games = useGames(seasonId)
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const statTypes = useStatTypes()

  const data = useMemo(() => {
    const teamList = seasonTeams(teams.data ?? [], seasonId ?? '')
    const teamOf = currentTeams(rosters.data ?? [], teamList)
    const finalGames = (games.data ?? []).filter((g) => g.status === 'final')
    const qbs = new Set((games.data ?? []).flatMap((g) => [g.home_qb_id, g.away_qb_id]).filter((id): id is string => !!id))
    const race = mvpRace({
      points: points.data ?? [],
      finalGames,
      teamOf: new Map([...teamOf].map(([p, t]) => [p, t.id])),
      pins: pins.data ?? [],
    })
    const labels = new Map((statTypes.data ?? []).map((s) => [s.id, s.label]))
    return {
      race,
      stars: playersOfTheWeek(points.data ?? [], labels),
      teamOf,
      qbs,
      playerById: new Map((players.data ?? []).map((p) => [p.id, p])),
    }
  }, [teams.data, rosters.data, games.data, points.data, pins.data, statTypes.data, players.data, seasonId])

  const [pinning, setPinning] = useState(false)
  const all = [seasons, points, pins, games, players, rosters, teams]
  if (all.some((q) => q.isPending)) return <Skeleton rows={6} />
  if (all.some((q) => q.isError)) return <ErrorState what="the MVP race" onRetry={() => all.forEach((q) => void q.refetch())} />

  const canPin = canPinMvp(member)
  const { race, stars } = data
  const leader = race.ranked[0]
  const sub = (p: Player) => data.teamOf.get(p.id)?.name ?? (data.qbs.has(p.id) ? 'Quarterback' : p.is_guest ? 'Guest' : 'No team')
  const ctx = { ...data, sub }

  return (
    <section className="flex flex-col gap-6">
      <header className="rise flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline leading-none">MVP race</h1>
          <p className="text-small text-text-2">
            {viewed?.name ?? 'This season'} · ranked by points per game{race.week ? ` · through week ${race.week}` : ''}
          </p>
        </div>
        {canPin && (
          <Button size="sm" variant="secondary" onClick={() => setPinning(true)}>
            <Icon name="pin" size="xs" />
            Pin
          </Button>
        )}
      </header>

      <SeasonSelect />

      {race.ranked.length === 0 && race.waiting.length === 0 ? (
        <EmptyState icon="trophy" title="The race starts after the first game" body="Once a game is final, every player who played shows up here, ranked by points per game." />
      ) : (
        <>
          {leader && <LeaderCard row={leader} ctx={ctx} />}
          {stars.length > 0 && <WeekStars stars={stars} ctx={ctx} />}
          <RaceList rows={race.ranked} ctx={ctx} />
          {race.waiting.length > 0 && <Waiting ctx={ctx} rows={race.waiting} />}
        </>
      )}

      <p className="text-small text-text-3">
        To be ranked, a player needs at least half of their team’s games. Points come from the stat sheet: see the rulebook for how each stat scores.
      </p>

      <StandingsSection />

      <LeagueLeaders />

      {canPin && (
        <PinSheet
          open={pinning}
          onOpenChange={setPinning}
          seasonId={seasonId}
          pins={pins.data ?? []}
          candidates={[...race.ranked.map((r) => r.playerId), ...race.waiting.map((w) => w.playerId)]}
          places={Math.max(race.ranked.length + race.waiting.length, 1)}
          playerById={data.playerById}
        />
      )}
    </section>
  )
}

interface Ctx {
  playerById: Map<string, Player>
  teamOf: Map<string, Team>
  sub(p: Player): string
}

function LeaderCard({ row, ctx }: { row: RaceRow; ctx: Ctx }) {
  const p = ctx.playerById.get(row.playerId)
  if (!p) return null
  const team = ctx.teamOf.get(p.id)
  return (
    <Link
      to={`/players/${p.id}`}
      style={{ ...teamStyle(team?.color_key), '--i': 1 } as CSSProperties}
      className="rise lit pressable glass-hero glass-appear flex items-center gap-4 rounded-hero p-4"
    >
      <PlayerBadge jersey={p.jersey} team={team?.color_key} photo={p.photo_path} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="caps-label flex items-center gap-1 text-gold">
          <Icon name="crown" size="xs" />
          MVP leader
        </span>
        <span className="truncate text-title font-strong">{displayName(p)}</span>
        <span className="truncate text-small text-text-2">
          {ctx.sub(p)} · {plural(row.games, 'game')}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="numeral-xl text-gold nums">{one(row.perGame)}</span>
        <span className="text-label text-text-2">per game</span>
      </span>
    </Link>
  )
}

function WeekStars({ stars, ctx }: { stars: WeekStar[]; ctx: Ctx }) {
  const [week, setWeek] = useState(stars[0]!.week)
  const star = stars.find((s) => s.week === week) ?? stars[0]!
  const p = ctx.playerById.get(star.playerId)
  const team = p ? ctx.teamOf.get(p.id) : undefined
  return (
    <section aria-labelledby="mvp-week" className="rise flex flex-col gap-2" style={{ '--i': 2 } as CSSProperties}>
      <h2 id="mvp-week" className="text-body-lg">Player of the week</h2>
      {p && (
        <Link to={`/players/${p.id}`} style={teamStyle(team?.color_key)} className="pressable glass-list flex items-center gap-3 rounded-panel p-3">
          <PlayerBadge jersey={p.jersey} team={team?.color_key} photo={p.photo_path} size="md" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="caps-label">Week {star.week}</span>
            <span className="truncate text-body font-strong">{displayName(p)}</span>
            <span className="truncate text-small text-text-2">{star.reason || ctx.sub(p)}</span>
          </span>
          <span className="flex flex-col items-end">
            <span className="numeral text-stat nums">{one(star.points)}</span>
            <span className="text-label text-text-2">points</span>
          </span>
        </Link>
      )}
      {stars.length > 1 && (
        <nav aria-label="Pick a week" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {stars.map((s) => (
            <Button key={s.week} size="sm" variant={s.week === star.week ? 'primary' : 'secondary'} className="shrink-0" aria-pressed={s.week === star.week} onClick={() => setWeek(s.week)}>
              Week {s.week}
            </Button>
          ))}
        </nav>
      )}
    </section>
  )
}

function Moved({ moved }: { moved: number | null }) {
  if (moved === null) return <span className="w-8" aria-hidden="true" />
  if (moved === 0) return <span className="w-8 text-center text-label text-text-3" aria-label="No change since last week">–</span>
  const up = moved > 0
  return (
    <span
      className={`flex w-8 items-center justify-center gap-0.5 text-label font-strong nums ${up ? 'text-ok' : 'text-danger'}`}
      aria-label={`${up ? 'Up' : 'Down'} ${plural(Math.abs(moved), 'place')} since last week`}
    >
      <Icon name={up ? 'up' : 'down'} size="xs" />
      {Math.abs(moved)}
    </span>
  )
}

function RaceList({ rows, ctx }: { rows: RaceRow[]; ctx: Ctx }) {
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="mvp-race" className="rise flex flex-col gap-2" style={{ '--i': 3 } as CSSProperties}>
      <h2 id="mvp-race" className="text-body-lg">The race</h2>
      <ol className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel">
        {rows.map((r) => {
          const p = ctx.playerById.get(r.playerId)
          if (!p) return null
          const team = ctx.teamOf.get(p.id)
          const by = r.pinnedBy ? ctx.playerById.get(r.pinnedBy) : undefined
          return (
            <li key={r.playerId}>
              <Link to={`/players/${p.id}`} style={teamStyle(team?.color_key)} className="pressable flex min-h-(--tap-min) items-center gap-3 px-3 py-2">
                <span className={`numeral w-6 text-center text-body-lg nums ${r.place === 1 ? 'text-gold' : 'text-text-2'}`}>{r.place}</span>
                <PlayerBadge jersey={p.jersey} team={team?.color_key} photo={p.photo_path} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-small font-strong">{displayName(p)}</span>
                  <span className="truncate text-label text-text-2">
                    {r.pinnedBy ? (
                      <span className="inline-flex items-center gap-1 text-gold">
                        <Icon name="pin" size="xs" />
                        Set by {by ? displayName(by) : 'the league'}
                      </span>
                    ) : (
                      `${one(r.points)} pts · ${plural(r.games, 'game')}`
                    )}
                  </span>
                </span>
                <Moved moved={r.moved} />
                <span className="flex shrink-0 flex-col items-end">
                  <span className="numeral text-stat leading-none nums">{one(r.perGame)}</span>
                  <span className="text-label whitespace-nowrap text-text-3">per game</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Waiting({ rows, ctx }: { rows: { playerId: string; points: number; games: number; needed: number }[]; ctx: Ctx }) {
  return (
    <section aria-labelledby="mvp-waiting" className="flex flex-col gap-2">
      <h2 id="mvp-waiting" className="caps-label">Not enough games yet</h2>
      <ul className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel">
        {rows.map((w) => {
          const p = ctx.playerById.get(w.playerId)
          if (!p) return null
          return (
            <li key={w.playerId}>
              <Link to={`/players/${p.id}`} className="pressable flex min-h-(--tap-min) items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-small font-strong">{displayName(p)}</span>
                <span className="shrink-0 text-label text-text-2 nums">
                  {plural(w.games, 'game')} of {w.needed} needed · {one(w.points)} pts
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PinSheet({
  open,
  onOpenChange,
  seasonId,
  pins,
  candidates,
  places,
  playerById,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  seasonId: string | undefined
  pins: PinRow[]
  candidates: string[]
  places: number
  playerById: Map<string, Player>
}) {
  const pin = usePinPlayer(seasonId)
  const unpin = useUnpin(seasonId)
  const [playerId, setPlayerId] = useState('')
  const [place, setPlace] = useState('1')
  const name = (id: string) => {
    const p = playerById.get(id)
    return p ? displayName(p) : 'Player'
  }
  const choices = [...new Set([...candidates, ...pins.map((p) => p.player_id)])].sort((a, b) => name(a).localeCompare(name(b)))

  function save() {
    const at = Number(place)
    // Moving someone already pinned, or taking a place someone else has, voids those pins first.
    const replace = pins.filter((p) => p.player_id === playerId || p.place === at).map((p) => p.id)
    pin.mutate(
      { playerId, place: at, replace },
      {
        onSuccess: () => {
          toast.success(`${name(playerId)} pinned to place ${at}`)
          setPlayerId('')
        },
        onError: () => toast.error("Couldn't pin that place. Check your signal and try again."),
      },
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pin an MVP place"
      description="A pinned player stays at that place. Everyone else follows points per game."
      footer={
        <Button variant="primary" className="flex-1" disabled={!playerId} loading={pin.isPending} onClick={save}>
          Pin player
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          <option value="">Choose a player</option>
          {choices.map((id) => (
            <option key={id} value={id}>
              {name(id)}
            </option>
          ))}
        </Select>
        <Select label="Place" value={place} onChange={(e) => setPlace(e.target.value)}>
          {Array.from({ length: Math.min(places, 50) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </Select>
        {pins.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="caps-label">Pinned now</h3>
            <ul className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel">
              {pins.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="numeral w-6 text-center nums">{p.place}</span>
                  <span className="flex-1 truncate text-small font-strong">{name(p.player_id)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={unpin.isPending && unpin.variables === p.id}
                    onClick={() =>
                      unpin.mutate(p.id, {
                        onSuccess: () => toast.success(`${name(p.player_id)} unpinned`),
                        onError: () => toast.error("Couldn't unpin. Check your signal and try again."),
                      })
                    }
                  >
                    Unpin
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
