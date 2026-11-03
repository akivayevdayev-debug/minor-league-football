/** Quiet toggle that keeps the screen on during a live game. Hidden where the browser has no Wake Lock. */
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'

export function KeepAwakeButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null
  return (
    <Button size="xl" variant="ghost" aria-pressed={on} onClick={onToggle} className="w-full">
      <Icon name="sun" size="sm" filled={on} /> {on ? 'Screen stays on' : 'Keep screen on'}
    </Button>
  )
}
