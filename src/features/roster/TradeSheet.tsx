import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { currentTeams, displayName, useMakeTrade, usePlayers, useRosters, useTeams } from '../league'
import { cn } from '../../lib/utils'
import { LEAGUE_ZONE } from '../../lib/time'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { teamStyle } from '../../ui/team'
import type { Player, Team } from '../../types/db'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: LEAGUE_ZONE }) // YYYY-MM-DD

/** Players picked on one side, tagged with the team they were picked from. */
interface Picks {
  team: string
  ids: string[]
}

function togglePick(setPicks: Dispatch<SetStateAction<Picks>>, teamId: string, playerId: string) {
  setPicks((prev) => {
    const ids = prev.team === teamId ? prev.ids : []
    return { team: teamId, ids: ids.includes(playerId) ? ids.filter((id) => id !== playerId) : [...ids, playerId] }
  })
}

function PickList({
  team,
  players,
  picked,
  onToggle,
}: {
  team: Team
  players: Player[]
  picked: string[]
  onToggle(playerId: string): void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="caps-label">{team.name} send</h3>
      <div className="glass-list rounded-panel overflow-hidden divide-y divide-divider" style={teamStyle(team.color_key)}>
        {players.length === 0 && <p className="px-3 py-3 text-small text-text-2">No players on this team.</p>}
        {players.map((p) => {
          const on = picked.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(p.id)}
              className={cn(
                'pressable flex min-h-(--tap-min) w-full items-center gap-3 rounded-control px-3 py-2 text-left',
                on && 'surface-accent',
              )}
            >
              <PlayerBadge jersey={p.jersey} team={team.color_key} size="sm" />
              <span className="min-w-0 flex-1 truncate text-body">{displayName(p)}</span>
              {on && <Icon name="check" size="xs" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Swap players between two teams from a date. Old teams stay in history.
 * `initialTeamId` preselects the giving team. Remount (key) to change it.
 */
export function TradeSheet({
  open,
  onOpenChange,
  initialTeamId = '',
}: {
  open: boolean
  onOpenChange(open: boolean): void
  initialTeamId?: string
}) {
  const players = usePlayers()
  const teams = useTeams()
  const rosters = useRosters()
  const trade = useMakeTrade()
  const [teamA, setTeamA] = useState(initialTeamId)
  const [teamB, setTeamB] = useState('')
  const [picksA, setPicksA] = useState<Picks>({ team: '', ids: [] })
  const [picksB, setPicksB] = useState<Picks>({ team: '', ids: [] })
  const [on, setOn] = useState(today)
  const [note, setNote] = useState('')

  const teamList = teams.data ?? []
  const giving = teamList.find((t) => t.id === teamA)
  // The other side defaults to the first team that is not the giving team.
  const effB = teamB && teamB !== teamA ? teamB : (teamList.find((t) => t.id !== teamA)?.id ?? '')
  const receiving = teamList.find((t) => t.id === effB)

  // Current (open-line) members per team, guests excluded. Players list is already sorted by name.
  const teamOf = currentTeams(rosters.data ?? [], teamList)
  const playersByTeam = new Map<string, Player[]>()
  for (const p of players.data ?? []) {
    const t = p.is_guest ? undefined : teamOf.get(p.id)
    if (t) playersByTeam.set(t.id, [...(playersByTeam.get(t.id) ?? []), p])
  }
  const rosterA = giving ? (playersByTeam.get(giving.id) ?? []) : []
  const rosterB = receiving ? (playersByTeam.get(receiving.id) ?? []) : []

  const selA = picksA.team === teamA ? picksA.ids : []
  const selB = picksB.team === effB ? picksB.ids : []
  const nothingPicked = selA.length === 0 && selB.length === 0
  const summary = `${giving?.short_name ?? 'No team'} send ${selA.length} · ${receiving?.short_name ?? 'No team'} send ${selB.length}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!teamA || !effB || nothingPicked) return
    try {
      await trade.mutateAsync({ teamA, playersA: selA, teamB: effB, playersB: selB, on, note: note.trim() })
      toast.success(`Trade done: ${summary}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error && err.message !== 'Request failed'
          ? err.message
          : "Couldn't make the trade. Check your signal and try again.",
      )
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Make a trade"
      description="Players swap teams from the date you pick. Old teams stay in their history."
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select
          label="Team giving"
          value={teamA}
          onChange={(e) => {
            setTeamA(e.target.value)
            setPicksA({ team: '', ids: [] })
          }}
        >
          <option value="">Choose a team</option>
          {teamList
            .filter((t) => t.id !== effB)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
        {giving && (
          <PickList
            team={giving}
            players={rosterA}
            picked={selA}
            onToggle={(id) => togglePick(setPicksA, giving.id, id)}
          />
        )}

        <Select
          label="Trading with"
          value={effB}
          onChange={(e) => {
            setTeamB(e.target.value)
            setPicksB({ team: '', ids: [] })
          }}
        >
          <option value="">Choose a team</option>
          {teamList
            .filter((t) => t.id !== teamA)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
        {receiving && (
          <PickList
            team={receiving}
            players={rosterB}
            picked={selB}
            onToggle={(id) => togglePick(setPicksB, receiving.id, id)}
          />
        )}

        <p className="text-small text-text-2" aria-live="polite">
          {summary}
        </p>
        <Field label="From" type="date" className="gap-1" value={on} onChange={(e) => setOn(e.target.value)} required />
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" variant="primary" className="w-full" loading={trade.isPending} disabled={!teamA || !effB || nothingPicked}>
          Make trade
        </Button>
      </form>
    </Sheet>
  )
}
