import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { copyText } from './clipboard'
import { CopyButton } from './TempPassword'
import { useCreateLogins, useResetEveryone, useSignOutEveryone, type MissingLogin } from './devApi'
import { choiceReady, formatCopyAll, isResetConfirmed, resetProblemText, type PasswordMode, type ResetResult } from './devLogic'
import { PasswordChoice } from './PasswordChoice'
import { MIN_PASSWORD_LENGTH } from '../auth/mustChange'

/**
 * Every login except the owner's gets a temporary password at once. Passwords show here once; the sheet
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
    <Sheet open={open} onOpenChange={handleOpenChange} title="Reset everyone's password" description="Everyone except you gets a new temporary password.">
      {results ? (
        <PasswordResults results={results} onDone={() => handleOpenChange(false)} failedText="Failed, try Set a new password for this one." />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-2-strong">
            This gives every login except yours a new temporary password, and signs those people out. Their old passwords stop
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

/** New temporary passwords, shown once, with Copy for each and Copy all. */
function PasswordResults({ results, onDone, failedText }: { results: ResetResult[]; onDone(): void; failedText: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="text-body font-strong text-danger">These show only once. Copy them now.</p>
      <ul className="flex flex-col gap-2">
        {results.map((r) => (
          <li key={r.player_id} className="surface-inset flex flex-col gap-2 rounded-control p-3">
            <span className="text-body font-medium">
              {r.full_name || 'Unknown player'} {r.login_name && <span className="text-text-2">({r.login_name})</span>}
            </span>
            {r.ok && r.temp_password ? (
              <div className="flex items-center justify-between gap-2">
                <span className="nums text-body font-strong break-all select-all">{r.temp_password}</span>
                <CopyButton text={r.temp_password} />
              </div>
            ) : null}
            {r.ok && resetProblemText(r.problem) && <span className="text-small text-warn">{resetProblemText(r.problem)}</span>}
            {!(r.ok && r.temp_password) && <span className="text-small text-danger">{failedText}</span>}
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={() => void copyText(formatCopyAll(results))}>Copy all</Button>
      <Button variant="secondary" onClick={onDone}>Done</Button>
    </div>
  )
}

/**
 * Accounts for players who have none yet (one, or all of them). Each gets a temporary password, shown
 * once here, and picks their own at first sign-in. A single account can instead get a password Akiva
 * types, kept as theirs. The sheet stays open while the server is working.
 */
export function CreateAccountsSheet({ players, open, onOpenChange }: { players: MissingLogin[]; open: boolean; onOpenChange(open: boolean): void }) {
  const create = useCreateLogins()
  const [results, setResults] = useState<ResetResult[] | null>(null)
  const [mode, setMode] = useState<PasswordMode>('temp')
  const [typed, setTyped] = useState('')
  const one = players.length === 1 ? players[0] : undefined
  const typing = !!one && mode === 'typed'

  function handleOpenChange(next: boolean) {
    if (!next && create.isPending) return
    if (!next) {
      setResults(null)
      setMode('temp')
      setTyped('')
      create.reset()
    }
    onOpenChange(next)
  }

  async function run() {
    if (typing && !choiceReady(mode, typed, MIN_PASSWORD_LENGTH)) return
    try {
      const made = await create.mutateAsync({ playerIds: players.map((p) => p.player_id), password: typing ? typed : undefined })
      if (typing && one) {
        if (made[0]?.ok) {
          toast.success(`Account made. ${one.full_name} signs in with "${one.login_name}" and the password you typed.`)
          const problem = resetProblemText(made[0].problem)
          if (problem) toast.warning(problem)
          handleOpenChange(false)
        } else {
          toast.error("Couldn't create this account. Try again.")
        }
        return
      }
      setResults(made)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reach the Developer tools. Try again.")
    }
  }

  const title = one ? `Create an account for ${one.full_name}` : `Create ${players.length} accounts`
  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title={title} description={one ? 'A temporary password, or one you type.' : 'Each new account gets a temporary password once.'}>
      {results ? (
        <PasswordResults results={results} onDone={() => handleOpenChange(false)} failedText="Couldn't create this account. Try again." />
      ) : (
        <div className="flex flex-col gap-4">
          {one && <PasswordChoice name={one.full_name} mode={mode} onModeChange={setMode} password={typed} onPasswordChange={setTyped} />}
          <p className="text-body text-text-2-strong">
            {one
              ? typing
                ? `${one.full_name} signs in with the login name "${one.login_name}" and the password you typed.`
                : `${one.full_name} signs in with the login name "${one.login_name}" and a temporary password, then picks their own.`
              : `Each player signs in with their login name and a temporary password, then picks their own: ${players.map((p) => p.full_name).join(', ')}.`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" loading={create.isPending} disabled={players.length === 0 || (typing && !choiceReady(mode, typed, MIN_PASSWORD_LENGTH))} onClick={() => void run()}>
              {one ? 'Create account' : 'Create accounts'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
