import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { displayName, useMovePlayer, usePlayers, useTeams } from '../league'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { LEAGUE_ZONE } from '../../lib/time'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: LEAGUE_ZONE }) // YYYY-MM-DD

/**
 * Move a player to another team (or no team) from a date. The old line stays as history.
 * `initialPlayerId` preselects someone (the profile page passes its player). Remount to change it.
 */
export function MovePlayerSheet({
  open,
  onOpenChange,
  initialPlayerId = '',
}: {
  open: boolean
  onOpenChange(open: boolean): void
  initialPlayerId?: string
}) {
  const players = usePlayers()
  const teams = useTeams()
  const move = useMovePlayer()
  const [playerId, setPlayerId] = useState(initialPlayerId)
  const [teamId, setTeamId] = useState('')
  const [on, setOn] = useState(today)

  const members = (players.data ?? []).filter((p) => !p.is_guest)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!playerId) return
    try {
      await move.mutateAsync({ playerId, teamId: teamId || null, on })
      const team = teams.data?.find((t) => t.id === teamId)
      const player = members.find((p) => p.id === playerId)
      toast.success(`${player ? displayName(player) : 'Player'} moved to ${team?.name ?? 'no team'}`)
      onOpenChange(false)
    } catch {
      toast.error("Couldn't move the player. Check your signal and try again.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Move a player" description="Their old team stays in their history.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
          <option value="">Choose a player</option>
          {members.map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)}
            </option>
          ))}
        </Select>
        <Select label="New team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">No team</option>
          {(teams.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Field label="From" type="date" className="gap-1" value={on} onChange={(e) => setOn(e.target.value)} required />
        <Button type="submit" variant="primary" className="w-full" loading={move.isPending} disabled={!playerId}>
          Move player
        </Button>
      </form>
    </Sheet>
  )
}
