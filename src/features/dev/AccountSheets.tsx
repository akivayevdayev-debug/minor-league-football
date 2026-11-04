import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { copyText } from './clipboard'
import { CopyButton } from './TempPassword'
import { useResetEveryone, useSignOutEveryone } from './devApi'
import { formatCopyAll, isResetConfirmed, resetProblemText, type ResetResult } from './devLogic'

/**
 * Every login except the owner gets a temporary password at once. Passwords show here once; the sheet
 * refuses to close while the server is working, so they can't be lost in the middle.
 */
export function AllResetSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const reset = useResetEveryone()
  const [typed, setTyped] = useState('')
  const [results, setResults] = useState<ResetResult[] | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next && reset.isPending) return
    if (!next) {
      setTyped('')
      setResults(null)
      reset.reset()
    }
    onOpenChange(next)
  }

  async function run() {
    try {
      setResults(await reset.mutateAsync())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reach the Developer tools. Try again.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title="Reset everyone's password" description="Gives every login a new temporary password.">
      {results ? (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-body font-strong text-danger">These show only once. Copy them now.</p>
          <ul className="flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.player_id} className="surface-inset flex flex-col gap-2 rounded-control p-3">
                <span className="text-body font-medium">
                  {r.full_name} <span className="text-text-2">({r.login_name})</span>
                </span>
                {r.ok && r.temp_password ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="nums text-body font-strong break-all select-all">{r.temp_password}</span>
                    <CopyButton text={r.temp_password} />
                  </div>
                ) : null}
                {r.ok && resetProblemText(r.problem) && <span className="text-small text-warn">{resetProblemText(r.problem)}</span>}
                {!(r.ok && r.temp_password) && (
                  <span className="text-small text-danger">Failed, try Set a new password for this one.</span>
                )}
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => void copyText(formatCopyAll(results))}>Copy all</Button>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-2-strong">
            This gives every login except yours a new temporary password, and signs everyone else out. Their old passwords stop
            working. Use it only after a leak.
          </p>
          <Field
            label="Type RESET to confirm"
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={reset.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={reset.isPending}
              disabled={!isResetConfirmed(typed)}
              onClick={() => void run()}
            >
              Reset everyone's password
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function SignOutEveryoneSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const signOut = useSignOutEveryone()

  async function run() {
    try {
      await signOut.mutateAsync()
      toast('Everyone else was signed out.')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reach the Developer tools. Try again.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Sign everyone out" description="Ends every other phone's session.">
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-2-strong">
          Everyone else will have to sign in again. Your own phone stays signed in.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={signOut.isPending}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" loading={signOut.isPending} onClick={() => void run()}>
            Sign everyone out
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
