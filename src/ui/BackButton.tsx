import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

/**
 * "Back" for sub-pages. Goes back in history when there is somewhere in the app to go back to;
 * a page opened straight from a link goes to `fallback` (its tab) instead of leaving the app.
 */
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0
  return (
    <button
      type="button"
      onClick={() => (canGoBack ? navigate(-1) : navigate(fallback, { replace: true }))}
      className="pressable -ml-2 flex min-h-(--tap-min) w-fit items-center gap-1 bg-transparent px-2 caps-label hover-fine:text-accent"
    >
      <Icon name="back" size="xs" />
      Back
    </button>
  )
}
