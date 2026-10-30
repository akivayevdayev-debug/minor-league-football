/*
 * Live stats: tap a player, then tap stats on the pad. Each tap is one saved stat line (never a
 * running total). TD and conversions also add the points to the score, with the same id, so Undo
 * takes back both. Game-screen rule: press scale only, every button at least 56 px tall.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useMutationState } from '@tanstack/react-query'
import { toast } from 'sonner'
import { displayName, useAddGuest } from '../league'
import type { Game, Player, ScoreEvent, StatType, StatTypeId, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Icon, type IconName } from '../../ui/Icon'
import { Segmented } from '../../ui/motion'
import { Sheet } from '../../ui/Sheet'
import { teamStyle } from '../../ui/team'
import { type GameStat, useAddScore, useLogStat, useVoidScore, useVoidStat } from './api'

const ICONS: Partial<Record<StatTypeId, IconName>> = {
  rec: 'check', target: 'target', drop: 'minus', td: 'games', fumble: 'error',
  int: 'shield', pick6: 'bolt', conv1: 'add', conv2: 'add', block: 'hide',
}
/** Short names that fit the pad's buttons at phone width. */
const SHORT: Partial<Record<StatTypeId, string>> = {
  rec: 'Catches', target: 'Targets', drop: 'Drops', td: 'TD', fumble: 'Fumbles',
  int: 'INT', pick6: 'Pick 6', conv1: '1-point', conv2: '2-point', block: 'Blocks',
}
/** These also put points on the scoreboard. */
const SCORING = new Set<StatTypeId>(['td', 'conv1', 'conv2'])

type Side = 'home' | 'away' | 'both'
interface LastAction { id: string; who: string; label: string; scoring: boolean; teamId: string; playerId: string | null }

export function LiveStatsPanel({
  game, home, away, half, players, statTypes, stats, rosterOf, onTeam,
}: {
  game: Game
  home: Team
  away: Team
  half: number
  players: Player[]
  statTypes: StatType[]
  stats: GameStat[]
  rosterOf(teamId: string): Player[]
  onTeam: Map<string, Team>
}) {
  const [side, setSide] = useState<Side>('both')
  const [padFor, setPadFor] = useState<{ player: Player; team: Team } | null>(null)
  const [subFor, setSubFor] = useState<Team | null>(null)
  const [addedSubs, setAddedSubs] = useState<Record<string, string[]>>({})
  const [last, setLast] = useState<LastAction | null>(null)

  const logStat = useLogStat(game)
  const voidStat = useVoidStat(game)
  const addScore = useAddScore(game)
  const voidScore = useVoidScore(game)
  const waiting = useMutationState({ filters: { mutationKey: ['game-write'], predicate: (m) => m.state.isPaused } }).length

  const padTypes = statTypes.filter((s) => !s.team_level && s.id !== 'conv_old')
  const teamTypes = statTypes.filter((s) => s.team_level)
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  /** totals[playerId or `team:${id}`][statType] for this game */
  const totals = useMemo(() => {
    const out = new Map<string, Partial<Record<StatTypeId, number>>>()
    for (const s of stats) {
      const k = s.player_id ?? `team:${s.team_id}`
      const t = out.get(k) ?? {}
      t[s.stat_type_id] = (t[s.stat_type_id] ?? 0) + s.value
      out.set(k, t)
    }
    return out
  }, [stats])

  /** The team's roster, plus anyone who has played for it in this game as a sub. */
  const lineup = (team: Team) => {
    const roster = rosterOf(team.id)
    const ids = new Set(roster.map((p) => p.id))
    const subIds = new Set([
      ...stats.filter((s) => s.team_id === team.id && s.player_id && !ids.has(s.player_id)).map((s) => s.player_id!),
      ...(addedSubs[team.id] ?? []),
    ])
    const subs = [...subIds].filter((id) => !ids.has(id)).map((id) => playerById.get(id)).filter((p): p is Player => !!p)
    return [...roster.map((p) => ({ p, sub: p.is_guest })), ...subs.map((p) => ({ p, sub: true }))]
  }

  const fail = () => toast.error("Couldn't save that. Check your signal; it will try again.")

  function record(team: Team, player: Player | null, type: StatType, value = 1) {
    const id = crypto.randomUUID()
    const who = player ? displayName(player) : team.short_name
    // A final game's score is typed by hand, so its TD/conversion taps are plain stat lines.
    const scoring = SCORING.has(type.id) && value === 1 && !!player && game.status !== 'final'
    if (scoring) {
      addScore.mutate({ id, teamId: team.id, type: type.id as 'td' | 'conv1' | 'conv2', playerId: player.id, half }, { onError: fail })
    } else {
      logStat.mutate({ id, team_id: team.id, player_id: player?.id ?? null, stat_type_id: type.id, value, half }, { onError: fail })
    }
    setLast({ id, who, label: `${type.label} ${value > 0 ? '+' : ''}${value}`, scoring, teamId: team.id, playerId: player?.id ?? null })
  }

  function undo() {
    if (!last) return
    if (last.scoring) {
      const line: ScoreEvent = { id: last.id, game_id: game.id, team_id: last.teamId, scoring_type_id: 'td', points: 0, player_id: last.playerId, voided_at: null, created_at: '' }
      voidScore.mutate(line, { onError: fail })
    } else {
      voidStat.mutate(last.id, { onError: fail })
    }
    toast.success(`Undone: ${last.who} · ${last.label}`)
    setLast(null)
  }

  const teams = side === 'home' ? [home] : side === 'away' ? [away] : [home, away]

  return (
    <div className="flex flex-col gap-4">
      <Segmented<Side>
        label="Which team"
        value={side}
        onChange={setSide}
        options={[
          { value: 'home', label: home.short_name },
          { value: 'both', label: 'Both' },
          { value: 'away', label: away.short_name },
        ]}
      />

      {waiting > 0 && (
        <p role="status" className="inline-flex items-center gap-2 self-start rounded-pill surface-inset px-3 py-1 text-small text-text-2-strong">
          <Icon name="offline" size="xs" /> {waiting} waiting to send
        </p>
      )}

      {teams.map((team) => {
        const list = lineup(team)
        const teamTotal = teamTypes.length ? totals.get(`team:${team.id}`) ?? {} : null
        return (
          <section key={team.id} aria-label={`${team.name} players`} style={teamStyle(team.color_key)} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="display-caps text-body-lg text-(--team-light)">{team.name}</h2>
              <button
                type="button"
                onClick={() => setSubFor(team)}
                className="pressable inline-flex min-h-(--tap-game) items-center gap-1 rounded-pill px-3 text-small font-strong text-text-2-strong hover-fine:text-text"
              >
                <Icon name="add" size="xs" /> Add sub
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {list.map(({ p, sub }) => {
                const t = totals.get(p.id) ?? {}
                const n = Object.values(t).reduce((a, b) => a + (b ?? 0), 0)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPadFor({ player: p, team })}
                      className="pressable glass-list flex min-h-(--tap-score) w-full items-center gap-2 rounded-panel px-3 py-2 text-left"
                    >
                      <span className="numeral w-(--badge-sm) shrink-0 text-center text-title text-(--team-light)">{p.jersey ?? '–'}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-strong">{displayName(p)}</span>
                        <span className="caps-label">
                          {sub && <span className="text-accent">Sub · </span>}
                          <span className="nums">{n}</span> {n === 1 ? 'stat' : 'stats'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {list.length === 0 && <p className="text-small text-text-2">No players on {team.short_name} yet. Tap Add sub to add one.</p>}

            {teamTotal && (
              <div className="grid grid-cols-2 gap-2">
                {teamTypes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => record(team, null, s)}
                    className="pressable flex min-h-(--tap-game) items-center justify-between rounded-panel surface-inset px-3"
                  >
                    <span className="text-small font-strong">Team · {s.label}</span>
                    <span className="numeral text-title">{teamTotal[s.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <StatPad
        key={padFor?.player.id ?? 'none'}
        target={padFor}
        onClose={() => setPadFor(null)}
        types={padTypes}
        totals={padFor ? totals.get(padFor.player.id) ?? {} : {}}
        last={last}
        onRecord={(type, value) => padFor && record(padFor.team, padFor.player, type, value)}
        onUndo={undo}
        final={game.status === 'final'}
      />

      <AddSubSheet
        key={subFor?.id ?? 'none'}
        team={subFor}
        onClose={() => setSubFor(null)}
        players={players}
        onTeam={onTeam}
        onPick={(p) => {
          const team = subFor
          if (!team) return
          setAddedSubs((s) => ({ ...s, [team.id]: [...(s[team.id] ?? []), p.id] }))
          setSubFor(null)
          setPadFor({ player: p, team })
        }}
      />
    </div>
  )
}

/** The stat pad: stays open while you tap. Tap a count to type a new total instead. */
function StatPad({
  target, onClose, types, totals, last, onRecord, onUndo, final,
}: {
  target: { player: Player; team: Team } | null
  /** The game is over: stat taps never change its typed final score. */
  final: boolean
  onClose(): void
  types: StatType[]
  totals: Partial<Record<StatTypeId, number>>
  last: LastAction | null
  onRecord(type: StatType, value?: number): void
  onUndo(): void
}) {
  const [typing, setTyping] = useState<StatType | null>(null)
  const [draft, setDraft] = useState('')

  function saveTotal(e: FormEvent) {
    e.preventDefault()
    if (!typing) return
    const want = Number(draft)
    if (draft === '' || !Number.isInteger(want) || want < 0 || want > 999) {
      toast.error('Type a whole number from 0 to 999.')
      return
    }
    const diff = want - (totals[typing.id] ?? 0)
    if (diff !== 0) onRecord(typing, diff)
    setTyping(null)
  }

  const p = target?.player
  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={p ? `${p.jersey !== null ? `#${p.jersey} ` : ''}${displayName(p)}` : 'Stats'}
      description={target ? `${target.team.name} · tap a stat to add 1` : undefined}
    >
      <div className="still flex flex-col gap-3" style={teamStyle(target?.team.color_key)}>
        <div className="flex min-h-(--tap-game) items-center gap-2 rounded-panel surface-inset px-3">
          <span className="min-w-0 flex-1 truncate text-small">
            {last ? (
              <>
                <span className="text-text-2">Last: </span>
                <span className="font-strong">{last.who}</span> · {last.label}
              </>
            ) : (
              <span className="text-text-2">Nothing added yet</span>
            )}
          </span>
          {last && (
            <Button variant="ghost" onClick={onUndo} className="min-h-(--tap-game)">
              <Icon name="undo" size="sm" /> Undo
            </Button>
          )}
        </div>

        {typing ? (
          <form onSubmit={saveTotal} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-small text-text-2-strong">New total for {typing.label}</span>
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
                className="min-h-(--tap-game) rounded-control surface-inset px-3 numeral text-title"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button size="xl" variant="ghost" type="button" onClick={() => setTyping(null)}>Cancel</Button>
              <Button size="xl" variant="primary" type="submit">Save total</Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {types.map((s) => {
              const n = totals[s.id] ?? 0
              const canType = !SCORING.has(s.id)
              return (
                <div key={s.id} className="flex min-h-(--tap-score) overflow-hidden rounded-panel glass-list">
                  <button
                    type="button"
                    onClick={() => onRecord(s)}
                    className="pressable flex min-w-0 flex-1 items-center gap-1.5 pl-2.5 pr-1 text-left"
                    aria-label={`${s.label}, add 1`}
                  >
                    <Icon name={ICONS[s.id] ?? 'stats'} size="sm" className="shrink-0 text-(--team-light)" />
                    <span className="min-w-0 truncate font-strong">{SHORT[s.id] ?? s.label}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canType}
                    onClick={() => {
                      setDraft(String(n))
                      setTyping(s)
                    }}
                    aria-label={canType ? `${s.label}: ${n}. Type a new total` : `${s.label}: ${n}`}
                    className="pressable min-w-(--tap-min) border-l border-divider px-2 numeral text-title disabled:opacity-100"
                  >
                    {n}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-small text-text-2">
          {final ? 'This game is final, so stats here never change the score.' : 'TD, 1-point and 2-point also add the points to the score.'}
        </p>
      </div>
    </Sheet>
  )
}

/** Add a sub for one team: pick a guest or a player from another team, or make a new guest. */
function AddSubSheet({
  team, onClose, players, onTeam, onPick,
}: {
  team: Team | null
  onClose(): void
  players: Player[]
  onTeam: Map<string, Team>
  onPick(p: Player): void
}) {
  const addGuest = useAddGuest()
  const [name, setName] = useState('')
  const options = players.filter((p) => onTeam.get(p.id)?.id !== team?.id)

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const p = await addGuest.mutateAsync(name)
      toast.success(`${displayName(p)} added as a guest`)
      onPick(p)
    } catch {
      toast.error("Couldn't add the guest. Check your signal and try again.")
    }
  }

  return (
    <Sheet open={!!team} onOpenChange={(o) => !o && onClose()} title={`Add a sub for ${team?.short_name ?? ''}`} description="Their stats count for this team in this game only.">
      <div className="flex flex-col gap-4">
        <form onSubmit={create} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New guest's name"
            aria-label="New guest's name"
            className="min-h-(--tap-game) min-w-0 flex-1 rounded-control surface-inset px-3"
          />
          <Button size="xl" variant="primary" type="submit" loading={addGuest.isPending} disabled={!name.trim()}>
            Add
          </Button>
        </form>
        <ul className="flex flex-col divide-y divide-divider rounded-panel glass-list">
          {options.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} className="pressable flex min-h-(--tap-game) w-full items-center gap-3 px-3 text-left">
                <span className="numeral w-(--badge-sm) text-center text-text-2">{p.jersey ?? '–'}</span>
                <span className="min-w-0 flex-1 truncate font-strong">{displayName(p)}</span>
                <span className="caps-label">{p.is_guest ? 'Guest' : onTeam.get(p.id)?.short_name ?? 'No team'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
