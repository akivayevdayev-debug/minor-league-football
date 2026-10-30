import { useState } from 'react'
import { toast } from 'sonner'
import { useRescheduleGame } from '../league'
import { formatGameTime, fromZonedInput, shiftDays, shiftMinutes, toZonedInput, ZONE_LABEL } from '../../lib/time'
import type { Game } from '../../types/db'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'

const QUICK: { label: string; apply(iso: string): string }[] = [
  { label: '+15 min', apply: (t) => shiftMinutes(t, 15) },
  { label: '+1 hr', apply: (t) => shiftMinutes(t, 60) },
  { label: 'Tomorrow, same time', apply: (t) => shiftDays(t, 1) },
  { label: 'Next week, same time', apply: (t) => shiftDays(t, 7) },
]

/** The phone's own date/time picker plus quick buttons. Saves with an Undo toast (frontend plan, 7.4). */
export function TimeSheet({ game, onClose }: { game: Game; onClose(): void }) {
  const reschedule = useRescheduleGame()
  const [value, setValue] = useState(() => (game.starts_at ? toZonedInput(game.starts_at) : ''))
  const draft = value ? fromZonedInput(value) : null

  async function save() {
    const before = game.starts_at
    try {
      const saved = await reschedule.mutateAsync({ game, startsAt: draft })
      onClose()
      toast.success(draft ? `Moved to ${formatGameTime(draft)}` : 'Time cleared', {
        action: {
          label: 'Undo',
          onClick: () =>
            reschedule.mutate(
              { game: saved, startsAt: before },
              { onError: () => toast.error("Couldn't undo. Change the time again by hand.") },
            ),
        },
      })
    } catch {
      toast.error("Couldn't save the time. Check your signal and try again.")
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Change time"
      description={`New York time (${ZONE_LABEL}).`}
      footer={
        <Button variant="primary" className="flex-1" onClick={save} loading={reschedule.isPending} disabled={draft === game.starts_at}>
          Save time
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Date and time" type="datetime-local" className="nums" value={value} onChange={(e) => setValue(e.target.value)} />
        {draft && (
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((q) => (
              <Button key={q.label} size="sm" onClick={() => setValue(toZonedInput(q.apply(draft)))}>
                {q.label}
              </Button>
            ))}
          </div>
        )}
        {draft && <p className="numeral text-title text-accent">{formatGameTime(draft)} {ZONE_LABEL}</p>}
      </div>
    </Sheet>
  )
}
