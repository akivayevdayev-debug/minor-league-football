import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { displayName, useAddStats, usePlayers, useStatTypes, useTeams, type NewStat } from '../league'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { Stepper } from '../../ui/Stepper'
import type { Game, StatTypeId, Team } from '../../types/db'

/**
 * Add stat lines for one player: for a game they played, or as a season total.
 * `initialPlayerId` preselects someone. Remount (key) to change it.
 */
export function AddStatsSheet({
  open,
  onOpenChange,
  seasonId,
  initialPlayerId,
  games,
  teamOf,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  seasonId: string
  initialPlayerId: string
  games: Game[]
  teamOf: Map<string, Team>
}) {
  const players = usePlayers()
  const teams = useTeams()
  const statTypes = useStatTypes()
  const add = useAddStats()
  const [playerId, setPlayerId] = useState(initialPlayerId)
  const [game, setGame] = useState('')
  const [values, setValues] = useState<Partial<Record<StatTypeId, number>>>({})

  const teamById = useMemo(() => new Map((teams.data ?? []).map((t) => [t.id, t])), [teams.data])
  const player = (players.data ?? []).find((p) => p.id === playerId)
  const teamId = teamOf.get(playerId)?.id ?? null
  const teamGames = teamId ? games.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId) : []
  // A game picked for a previous player may not belong to this one, so fall back to the season total.
  const gameId = teamGames.some((g) => g.id === game) ? game : ''

  const stats = (statTypes.data ?? []).filter((s) => !s.team_level && s.id !== 'conv_old') // the old-sheet conversion is history only
  const entries: NewStat[] = stats
    .map((s) => ({ stat_type_id: s.id, value: values[s.id] ?? 0 }))
    .filter((e) => e.value !== 0)
  const points = stats.reduce((sum, s) => sum + (values[s.id] ?? 0) * (s.fantasy_points ?? 0), 0)

  function gameLabel(g: Game) {
    const opponentId = g.home_team_id === teamId ? g.away_team_id : g.home_team_id
    const opponent = (opponentId && teamById.get(opponentId)?.short_name) || 'TBD'
    return g.week == null ? `Earlier game · vs ${opponent}` : `Week ${g.week} · vs ${opponent}`
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!player || entries.length === 0) return
    try {
      await add.mutateAsync({ seasonId, gameId: gameId || null, teamId, playerId, stats: entries })
      toast.success(`Stats saved for ${displayName(player)}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error && err.message !== 'Request failed'
          ? err.message
          : "Couldn't save the stats. Check your signal and try again.",
      )
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add stats"
      description="Adds to the player's season. Nothing is overwritten; mistakes can be voided later."
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select label="Player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
          <option value="">Choose a player</option>
          {(players.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)}
            </option>
          ))}
        </Select>
        <Select label="Game" value={gameId} onChange={(e) => setGame(e.target.value)}>
          <option value="">No game (season total)</option>
          {teamGames.map((g) => (
            <option key={g.id} value={g.id}>
              {gameLabel(g)}
            </option>
          ))}
        </Select>

        {statTypes.isPending ? (
          <Skeleton rows={3} />
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {stats.map((s) => (
              <Stepper
                key={s.id}
                label={s.label}
                min={0}
                max={99}
                value={values[s.id] ?? 0}
                hint={s.fantasy_points ? `${s.fantasy_points > 0 ? '+' : ''}${s.fantasy_points} pts each` : undefined}
                onChange={(n) => setValues((v) => ({ ...v, [s.id]: n }))}
              />
            ))}
          </div>
        )}

        {points !== 0 && (
          <p className="flex items-center gap-2 text-small text-text-2">
            Worth about {points} points
            <Badge variant="estimate">Estimate</Badge>
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={add.isPending}
          disabled={!player || entries.length === 0}
        >
          Save stats
        </Button>
      </form>
    </Sheet>
  )
}
