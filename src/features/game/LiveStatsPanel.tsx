/*
 * Live stats: tap a player, then tap stats on the pad. Each tap is one saved stat line (never a
 * running total). TD and conversions also add the points to the score, with the same id, so Undo
 * takes back both. Game-screen rule: press scale only, every button at least 56 px tall.
 */
import { Fragment, useMemo, useState, type FormEvent } from 'react'
import { useMutationState } from '@tanstack/react-query'
import { toast } from 'sonner'
import { displayName, useAddGuest } from '../league'
import type { Game, Player, ScoreEvent, StatGroup, StatType, StatTypeId, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Icon, type IconName } from '../../ui/Icon'
import { Sheet } from '../../ui/Sheet'
import { teamStyle } from '../../ui/team'
import { type GameStat, StatLimitError, useAddScore, useLogStat, useVoidScore, useVoidStat } from './api'
import { BenchPicker } from './KickoffSheet'
import { currentLineup, type Lineup } from './lineup'
import { groupsFor } from './statGroups'

const ICONS: Partial<Record<StatTypeId, IconName>> = {
  rec: 'check', target: 'target', drop: 'minus', td: 'games', fumble: 'error',
  int: 'shield', pick6: 'bolt', conv1: 'add', conv2: 'add', block: 'hide',
}
/** Short names that fit the pad's buttons at phone width. */
const SHORT: Partial<Record<StatTypeId, string>> = {
  rec: 'Catches', target: 'Targets', drop: 'Drops', td: 'TD', fumble: 'Fumbles',
  int: 'INT', pick6: 'Pick 6', conv1: '1-point', conv2: '2-point', block: 'Blocks',
}
/** Pad order: the player's own groups first, then every other group in a fixed order. */
const GROUP_ORDER: StatGroup[] = ['qb', 'receiving', 'line', 'defense', 'kicks', 'team', 'legacy']
const GROUP_NAME: Partial<Record<StatGroup, string>> = {
  qb: 'Quarterback', receiving: 'Receiving', line: 'Line', defense: 'Defense', kicks: 'Kicks', team: 'Team', legacy: 'Older stats',
}
/** These also put points on the scoreboard. */
const SCORING = new Set<StatTypeId>(['td', 'conv1', 'conv2'])

interface LastAction { id: string; who: string; label: string; scoring: boolean; teamId: string; playerId: string | null }

export function LiveStatsPanel({
  game, home, away, half, players, statTypes, stats, rosterOf, onTeam, lineups, halfSeconds, onField, onLineup, clockNow,
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
  lineups: Lineup[]
  halfSeconds: number
  /** Players per team on the field at once, from the game's season. */
  onField: number
  /** Save who is on the field for a team from now on. */
  onLineup(teamId: string, onField: string[]): void
  /** Seconds left in the half at this moment while the game is live, else null (read at the tap). */
  clockNow(): number | null
}) {
  const [subIn, setSubIn] = useState<{ team: Team; player: Player } | null>(null)
  const [nowSits, setNowSits] = useState<Record<string, string>>({})
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

  const fail = (e: unknown) =>
    toast.error(e instanceof StatLimitError ? e.message : "Couldn't save that. Check your signal; it will try again.")

  function record(team: Team, player: Player | null, type: StatType, value = 1) {
    const id = crypto.randomUUID()
    const who = player ? displayName(player) : team.short_name
    // A final game's score is typed by hand, so its TD/conversion taps are plain stat lines.
    const scoring = SCORING.has(type.id) && value === 1 && !!player && game.status !== 'final'
    // The game time of this tap, read now (null when the game is not running).
    const clock_seconds = clockNow()
    // A refused save takes its line back out of Undo, so Undo never points at a stat that did not save.
    const failed = (e: unknown) => {
      fail(e)
      setLast((l) => (l?.id === id ? null : l))
    }
    if (scoring) {
      addScore.mutate({ id, teamId: team.id, type: type.id as 'td' | 'conv1' | 'conv2', playerId: player.id, half, clockSeconds: clock_seconds }, { onError: failed })
    } else {
      logStat.mutate({ id, team_id: team.id, player_id: player?.id ?? null, stat_type_id: type.id, value, half, clock_seconds }, { onError: failed })
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

  // No team picker: both teams always show (spec C2.3).
  const teams = [home, away]
  /** A QB is the game's QB for their own side. */
  const isQb = (team: Team, player: Player) => player.id === (team.id === game.home_team_id ? game.home_qb_id : game.away_qb_id)

  return (
    <div className="flex flex-col gap-4">
      {waiting > 0 && (
        <p role="status" className="inline-flex items-center gap-2 self-start rounded-pill surface-inset px-3 py-1 text-small text-text-2-strong">
          <Icon name="offline" size="xs" /> {waiting} waiting to send
        </p>
      )}

      {teams.map((team) => {
        const list = lineup(team)
        const on = currentLineup(lineups, team.id, halfSeconds)
        const field = on ? list.filter(({ p }) => on.includes(p.id)) : list
        const bench = on ? list.filter(({ p }) => !on.includes(p.id)) : []
        const needsPick = (game.status === 'live' || game.status === 'halftime') && rosterOf(team.id).length > onField
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
            {!on && needsPick && (
              <div className="flex flex-col gap-2 rounded-panel surface-inset p-3">
                <BenchPicker team={team} roster={rosterOf(team.id)} gameId={game.id} value={nowSits[team.id]} onChange={(pid) => setNowSits((m) => (m[team.id] === pid ? m : { ...m, [team.id]: pid }))} />
                <Button
                  variant="primary"
                  size="xl"
                  disabled={!nowSits[team.id]}
                  onClick={() => onLineup(team.id, rosterOf(team.id).filter((p) => p.id !== nowSits[team.id]).map((p) => p.id))}
                >
                  Save who's on the field
                </Button>
              </div>
            )}
            {on && <span className="caps-label text-text-2">On the field</span>}
            <ul className="grid grid-cols-2 gap-2">
              {field.map(({ p, sub }) => {
                const t = totals.get(p.id) ?? {}
                const n = Object.values(t).reduce((a, b) => a + (b ?? 0), 0)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPadFor({ player: p, team })}
                      className="pressable team-stripe glass-list flex min-h-(--tap-score) w-full items-center gap-2 rounded-panel px-3 py-2 pl-4 text-left"
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
            {on && bench.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="caps-label text-text-2">Bench</span>
                {bench.map(({ p }) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPadFor({ player: p, team })}
                      className="pressable flex min-h-(--tap-game) min-w-0 flex-1 items-center gap-2 rounded-panel surface-inset px-3 text-left"
                    >
                      <span className="nums text-(--team-light)">{p.jersey ?? '–'}</span>
                      <span className="truncate font-strong">{displayName(p)}</span>
                    </button>
                    {game.status !== 'final' && (
                      <button
                        type="button"
                        onClick={() => setSubIn({ team, player: p })}
                        className="pressable inline-flex min-h-(--tap-game) items-center gap-1 rounded-panel bg-(--team) px-4 font-strong text-primary-ink"
                      >
                        <Icon name="trade" size="xs" /> Sub in
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {subIn?.team.id === team.id && on && (
              <div role="group" aria-label="Who comes off?" className="flex flex-col gap-2 rounded-panel surface-inset p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body">{displayName(subIn.player)} comes in for…</span>
                  <button type="button" onClick={() => setSubIn(null)} className="pressable min-h-(--tap-min) px-2 text-small text-text-2-strong">
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {on.map((pid) => playerById.get(pid)).filter((p): p is Player => !!p).map((out) => (
                    <button
                      key={out.id}
                      type="button"
                      onClick={() => {
                        onLineup(team.id, [...on.filter((id) => id !== out.id), subIn.player.id])
                        toast.success(`${displayName(subIn.player)} in, ${displayName(out)} out`)
                        setSubIn(null)
                      }}
                      className="pressable min-h-(--tap-game) truncate rounded-panel bg-(--team) px-3 font-strong text-primary-ink"
                    >
                      {displayName(out)}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
        groups={padFor ? groupsFor(padFor.player.positions, isQb(padFor.team, padFor.player)) : []}
        totals={padFor ? totals.get(padFor.player.id) ?? {} : {}}
        last={last}
        onRecord={(type, value) => padFor && record(padFor.team, padFor.player, type, value)}
        onUndo={undo}
        final={game.status === 'final'}
      />

      <AddSubSheet
        key={subFor?.id ?? 'no-team'}
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
  target, onClose, types, groups, totals, last, onRecord, onUndo, final,
}: {
  target: { player: Player; team: Team } | null
  /** The game is over: stat taps never change its typed final score. */
  final: boolean
  onClose(): void
  types: StatType[]
  /** The player's own stat groups, shown first. */
  groups: StatGroup[]
  totals: Partial<Record<StatTypeId, number>>
  last: LastAction | null
  onRecord(type: StatType, value?: number): void
  onUndo(): void
}) {
  const [typing, setTyping] = useState<StatType | null>(null)
  const [draft, setDraft] = useState('')
  const [showAll, setShowAll] = useState(false)
  const groupOrder = [...groups, ...GROUP_ORDER]

  // The player's own groups first (in group order), then the rest; the legacy touchdown and
  // pick-six stay on the pad because they are still scored. "All stats" shows everything.
  const rank = (s: StatType) => groupOrder.indexOf(s.stat_group)
  const own = (s: StatType) => groups.includes(s.stat_group) || s.stat_group === 'legacy'
  const shown = types.filter((s) => showAll || own(s)).sort((a, b) => rank(a) - rank(b))

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
            {shown.map((s, i) => {
              const n = totals[s.id] ?? 0
              const canType = !SCORING.has(s.id)
              const before = shown[i - 1]
              const newGroup = showAll && !own(s) && (!before || before.stat_group !== s.stat_group)
              return (
                <Fragment key={s.id}>
                  {newGroup && <p className="col-span-2 caps-label text-text-2">{GROUP_NAME[s.stat_group] ?? s.stat_group}</p>}
                  <div className="flex min-h-(--tap-score) overflow-hidden rounded-panel glass-list">
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
                </Fragment>
              )
            })}
            <button
              type="button"
              aria-pressed={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="pressable col-span-2 min-h-(--tap-game) rounded-panel surface-inset px-3 font-strong"
            >
              All stats
            </button>
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
