import type { Player, StatTypeId } from '../../types/db'
import type { StatTotals } from '../league'

export interface Ranked {
  player: Player
  value: number
  rank: number
}

/** Everyone with at least one, most first. Players on the same number share a rank (1, 2, 2, 4). */
export function rankPlayers(players: readonly Player[], totals: StatTotals | undefined, stat: StatTypeId): Ranked[] {
  const sorted = players
    .map((player) => ({ player, value: totals?.get(player.id)?.[stat] ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const out: Ranked[] = []
  sorted.forEach((r, i) => {
    const above = out[i - 1]
    out.push({ ...r, rank: above && above.value === r.value ? above.rank : i + 1 })
  })
  return out
}
