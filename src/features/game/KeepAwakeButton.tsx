/** Quiet toggle that keeps the screen on during a live game. Hidden where the browser has no Wake Lock. */
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { keepAwakeLabel, type KeepAwakeState } from './wakeLock'

export function KeepAwakeButton({ on, state, onToggle }: { on: boolean; state: KeepAwakeState; onToggle: () => void }) {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null
  return (
    <Button size="xl" variant="ghost" aria-pressed={on} onClick={onToggle} className="w-full">
      <Icon name="sun" size="sm" filled={on && state !== 'refused'} /> {keepAwakeLabel(on, state)}
    </Button>
  )
}
