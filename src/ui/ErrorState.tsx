import { Button } from './Button'
import { EmptyState } from './EmptyState'

/** Says what happened and the fix; never shows database or code details. */
export function ErrorState({ what, onRetry }: { what: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="error"
      title={`Couldn't load ${what}`}
      body="Check your signal and try again."
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  )
}
