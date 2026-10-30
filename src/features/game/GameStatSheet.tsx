/*
 * Fill in a whole game's stats on one screen: one row per player, one box per stat.
 * Works for live and finished games. Saving adds only the differences, so the history keeps every change.
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { displayName, usePlayers, useRosters, useStatTypes } from '../league'
import type { Game, Player, StatTypeId, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { teamStyle } from '../../ui/team'
import { useGameStats } from './api'
import { cellKey, playerTotals, readCell, sheetChanges, useSaveStatSheet } from './statSheet'

const ABBR: Partial<Record<StatTypeId, string>> = {
  rec: 'REC', target: 'TGT', drop: 'DRP', td: 'TD', fumble: 'FUM', int: 'INT', pick6: 'P6', conv1: '1PT', conv2: '2PT', block: 'BLK',
}

interface Props {
  game: Game
  home: Team
  away: Team
  open: boolean
  onOpenChange(open: boolean): void
}

export function GameStatSheet({ game, home, away, open, onOpenChange }: Props) {
  const stats = useGameStats(game.id)
  const players = usePlayers()
  const rosters = useRosters()
  const statTypes = useStatTypes()
  const save = useSaveStatSheet(game)
  const [side, setSide] = useState<'home' | 'away'>('home')
  const [edits, setEdits] = useState<Map<string, string>>(new Map())
  const [added, setAdded] = useState<Map<string, string>>(new Map()) // player id → team id, for subs and traded players

  const team = side === 'home' ? home : away
  const cols = (statTypes.data ?? []).filter((s) => !s.team_level && s.id !== 'conv_old')
  const current = useMemo(() => playerTotals(stats.data ?? []), [stats.data])

  // Which team each player played for in this game: their stat lines first, then players added here, then today's roster.
  const teamOf = useMemo(() => {
    const out = new Map<string, string>()
    for (const r of rosters.data ?? []) if (!r.ends_on && (r.team_id === home.id || r.team_id === away.id)) out.set(r.player_id, r.team_id)
    for (const [pid, tid] of added) out.set(pid, tid)
    for (const s of stats.data ?? []) if (s.player_id && s.team_id) out.set(s.player_id, s.team_id)
    return out
  }, [rosters.data, added, stats.data, home.id, away.id])

  const byId = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])
  const list = [...teamOf.entries()]
    .filter(([, tid]) => tid === team.id)
    .map(([pid]) => byId.get(pid))
    .filter((p): p is Player => !!p && !p.voided_at)
    .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || displayName(a).localeCompare(displayName(b)))
  const others = (players.data ?? []).filter((p) => !p.voided_at && !teamOf.has(p.id)).sort((a, b) => displayName(a).localeCompare(displayName(b)))

  const changes = sheetChanges(current, edits)
  const badCells = [...edits.values()].filter((t) => readCell(t) === null).length
  const loading = stats.isPending || players.isPending || rosters.isPending || statTypes.isPending

  function close(next: boolean) {
    if (!next) {
      setEdits(new Map())
      setAdded(new Map())
    }
    onOpenChange(next)
  }

  async function submit() {
    if (changes.length === 0 || badCells > 0) return
    try {
      await save.mutateAsync({ changes, teamOf: (pid) => teamOf.get(pid) ?? null })
      toast.success(`Saved ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`)
      close(false)
    } catch {
      toast.error("Couldn't save the stats. Nothing was changed. Check your signal and try again.")
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Game stats"
      description="Type each player's totals for this game. Blank means 0. Saving keeps a record of every change."
      footer={
        <Button variant="primary" className="flex-1" disabled={changes.length === 0 || badCells > 0} loading={save.isPending} onClick={submit}>
          {badCells > 0 ? 'Fix the red boxes' : changes.length === 0 ? 'No changes yet' : `Save ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Team" className="grid grid-cols-2 gap-1 rounded-pill surface-inset p-1">
          {([['home', home], ['away', away]] as const).map(([key, t]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={side === key}
              onClick={() => setSide(key)}
              style={teamStyle(t.color_key)}
              className={`pressable min-h-(--tap-min) rounded-pill font-display font-bold uppercase ${side === key ? 'bg-(--team) text-text' : 'text-text-2'}`}
            >
              {t.short_name}
            </button>
          ))}
        </div>

        {loading ? (
          <Skeleton rows={5} />
        ) : stats.isError ? (
          <p className="text-small text-text-2">Couldn't load this game's stats. Close and try again.</p>
        ) : (
          <div className="overflow-x-auto rounded-panel surface-solid" style={teamStyle(team.color_key)}>
            <table className="nums w-full min-w-max border-collapse text-small">
              <thead>
                <tr className="text-text-2">
                  <th scope="col" className="sticky left-0 z-10 bg-panel px-3 py-2 text-left caps-label">Player</th>
                  {cols.map((s) => (
                    <th key={s.id} scope="col" title={s.label} className="px-1 py-2 text-center caps-label">
                      {ABBR[s.id] ?? s.label.slice(0, 3).toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {list.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 1} className="px-3 py-3 text-text-2">No players on {team.short_name} yet. Add one below.</td>
                  </tr>
                )}
                {list.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="sticky left-0 z-10 max-w-32 truncate bg-panel px-3 py-1.5 text-left font-strong">
                      {p.jersey != null && <span className="font-normal text-(--team-light)">#{p.jersey} </span>}
                      {displayName(p)}
                    </th>
                    {cols.map((s) => {
                      const key = cellKey(p.id, s.id)
                      const now = current.get(p.id)?.get(s.id) ?? 0
                      const text = edits.get(key) ?? (now === 0 ? '' : String(now))
                      const typed = readCell(text)
                      const changed = edits.has(key) && typed !== null && typed !== now
                      return (
                        <td key={s.id} className="px-0.5 py-1 text-center">
                          <input
                            inputMode="numeric"
                            aria-label={`${displayName(p)} ${s.label}`}
                            aria-invalid={typed === null}
                            value={text}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEdits((m) => new Map(m).set(key, e.target.value))}
                            className={`field-control w-(--badge-md) px-0 text-center ${typed === null ? 'text-danger ring-2 ring-danger' : changed ? 'font-strong text-accent ring-2 ring-accent' : ''}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && others.length > 0 && (
          <Select
            label={`Add a sub or another player to ${team.short_name}`}
            value=""
            onChange={(e) => e.target.value && setAdded((m) => new Map(m).set(e.target.value, team.id))}
          >
            <option value="">Choose a player</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Sheet>
  )
}
