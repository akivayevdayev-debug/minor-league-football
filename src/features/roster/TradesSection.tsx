import { useState } from 'react'
import { toast } from 'sonner'
import { displayName, useDecideTrade, usePlayers, useTrades } from '../league'
import { cn } from '../../lib/utils'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { Sheet } from '../../ui/Sheet'
import type { Player, Team, Trade, TradeStatus } from '../../types/db'

/** Each status has a soft fill and a text label, so colour is never the only signal. */
const STATUS: Record<TradeStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warn-soft text-warn' },
  approved: { label: 'Approved', className: 'bg-ok-soft text-ok' },
  vetoed: { label: 'Vetoed', className: 'bg-danger-soft text-danger' },
}

/** "Ben to Team Sucks, Sam to Shpitzy": who goes where. */
function movesText(trade: Trade, teamById: Map<string, Team>, playerById: Map<string, Player>): string {
  const teamA = teamById.get(trade.team_a_id)?.name ?? 'Team A'
  const teamB = teamById.get(trade.team_b_id)?.name ?? 'Team B'
  const name = (id: string) => {
    const p = playerById.get(id)
    return p ? displayName(p) : 'A player'
  }
  const moves = [...trade.players_a.map((id) => `${name(id)} to ${teamB}`), ...trade.players_b.map((id) => `${name(id)} to ${teamA}`)]
  return moves.join(', ')
}

/** Pending trades (approve or veto for people who can decide) and a short history of approved and vetoed ones. */
export function TradesSection({ seasonId, teams, canDecide }: { seasonId: string | undefined; teams: Team[]; canDecide: boolean }) {
  const trades = useTrades(seasonId)
  const players = usePlayers()
  const decide = useDecideTrade()
  const [vetoing, setVetoing] = useState<Trade | null>(null)

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]))
  const list = trades.data ?? []
  const pending = list.filter((t) => t.status === 'pending')
  // The history is short: the latest decisions only.
  const history = list.filter((t) => t.status !== 'pending').slice(0, 8)
  if (list.length === 0) return null

  async function answer(trade: Trade, approve: boolean) {
    try {
      await decide.mutateAsync({ tradeId: trade.id, approve })
      toast.success(approve ? 'Trade approved. The players have moved.' : 'Trade vetoed. Nobody moves.')
    } catch (err) {
      const plain = err instanceof Error && err.message !== 'Request failed'
      toast.error(plain ? err.message : "Couldn't save the answer. Check your signal and try again.")
    } finally {
      // Close the veto sheet whatever the answer was; the list refreshes so a decided trade stops showing buttons.
      setVetoing(null)
    }
  }

  const row = (t: Trade) => (
    <li key={t.id} className="flex flex-col gap-2 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={cn('rounded-pill px-2 py-0.5 text-label font-strong uppercase tracking-label', STATUS[t.status].className)}>
          {STATUS[t.status].label}
        </span>
        {t.status === 'pending' && t.proposed_by && (
          <span className="min-w-0 truncate text-small text-text-2">
            Offered by {playerById.get(t.proposed_by) ? displayName(playerById.get(t.proposed_by)!) : 'a captain'}
          </span>
        )}
      </div>
      <p className="text-body">{movesText(t, teamById, playerById)}</p>
      {t.note && <p className="text-small text-text-2">{t.note}</p>}
      {t.status === 'pending' && canDecide && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={decide.isPending && decide.variables?.tradeId === t.id && decide.variables.approve === true} disabled={decide.isPending} onClick={() => void answer(t, true)}>
            <Icon name="check" size="xs" />
            Approve
          </Button>
          <Button variant="outline" size="sm" disabled={decide.isPending} onClick={() => setVetoing(t)}>
            Veto
          </Button>
        </div>
      )}
    </li>
  )

  return (
    <section aria-labelledby="trades-title" className="rise flex flex-col gap-2">
      <h2 id="trades-title" className="text-body-lg">
        Trades
      </h2>
      {pending.length > 0 && (
        <ul className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel" aria-label="Pending trades">
          {pending.map(row)}
        </ul>
      )}
      {history.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="caps-label">History</h3>
          <ul className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel" aria-label="Trade history">
            {history.map(row)}
          </ul>
        </div>
      )}

      {/* Veto is final, so it asks first. */}
      <Sheet
        open={!!vetoing}
        onOpenChange={(o) => !o && setVetoing(null)}
        title="Veto this trade?"
        description="Nobody moves. The trade stays in the history as vetoed."
        footer={
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setVetoing(null)}>
              Keep trade
            </Button>
            <Button variant="danger" className="flex-1 bg-danger text-bg hover-fine:border-transparent" loading={decide.isPending} onClick={() => vetoing && void answer(vetoing, false)}>
              Veto trade
            </Button>
          </>
        }
      >
        {vetoing && <p className="text-body">{movesText(vetoing, teamById, playerById)}</p>}
      </Sheet>
    </section>
  )
}
