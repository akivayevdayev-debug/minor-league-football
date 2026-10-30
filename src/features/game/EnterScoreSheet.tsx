import { useState } from 'react'
import { toast } from 'sonner'
import { useSetFinalScore } from '../league'
import type { Game, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { Stepper } from '../../ui/Stepper'
import { TeamBadge } from '../../ui/TeamBadge'

interface Props {
  open: boolean
  onOpenChange(open: boolean): void
  game: Game
  home: Team | undefined
  away: Team | undefined
  /** Current score, to start the steppers from. */
  current?: { home: number; away: number }
}

/** Type in a final score without running the live game. Earlier score lines are voided and kept in history. */
export function EnterScoreSheet({ open, onOpenChange, game, home, away, current }: Props) {
  const save = useSetFinalScore()
  const [h, setH] = useState(current?.home ?? 0)
  const [a, setA] = useState(current?.away ?? 0)

  // Start from the current score each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setH(current?.home ?? 0)
      setA(current?.away ?? 0)
    }
  }

  async function submit() {
    try {
      await save.mutateAsync({ game, home: h, away: a })
      toast.success(`Final score saved: ${home?.short_name ?? 'Home'} ${h}, ${away?.short_name ?? 'Away'} ${a}`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error && e.message !== 'Request failed' ? e.message : "Couldn't save the score. Check your signal and try again.")
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Enter final score"
      description={game.status === 'final' ? 'This replaces the score saved now. The old one stays in the edit history.' : 'The game is marked final when you save.'}
      footer={
        <Button variant="primary" size="xl" className="flex-1" loading={save.isPending} onClick={submit}>
          Save final score
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {[
          { team: home, value: h, set: setH },
          { team: away, value: a, set: setA },
        ].map(({ team, value, set }, i) => (
          <div key={i} className="surface-inset flex flex-wrap items-center gap-3 rounded-panel p-3">
            <TeamBadge team={team} size="md" />
            <span className="min-w-0 flex-1 truncate font-strong">{team?.name ?? 'Team'}</span>
            <Stepper label={`${team?.name ?? 'Team'} points`} value={value} onChange={set} max={200} big labelHidden />
          </div>
        ))}
      </div>
    </Sheet>
  )
}
