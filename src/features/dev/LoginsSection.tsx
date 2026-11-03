import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Sheet } from '../../ui/Sheet'
import { Skeleton } from '../../ui/Skeleton'
import { PasswordOnce } from './TempPassword'
import { AllResetSheet, SignOutEveryoneSheet } from './AccountSheets'
import { useLogins, useNow, useSetPassword, type Login } from './devApi'
import { lastSignInText } from './devLogic'

/** Every login: who, when they last signed in, and a new temporary password for each (not the owner). */
export function LoginsSection() {
  const logins = useLogins()
  const now = useNow()
  const [target, setTarget] = useState<Login | null>(null)
  const [setOpen, setSetOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  return (
    <section aria-labelledby="logins-title" className="flex flex-col gap-2">
      <h2 id="logins-title" className="caps-label px-3">Logins</h2>

      {logins.isPending && <Skeleton rows={3} />}
      {logins.isError && (
        <EmptyState icon="error" title="Couldn't load the logins" body={logins.error.message} action={<Button size="sm" variant="outline" onClick={() => void logins.refetch()}>Try again</Button>} />
      )}

      {logins.data && (
        <ul className="glass-panel flex flex-col overflow-hidden rounded-panel">
          {logins.data.map((login) => (
            <li key={login.player_id} className="flex items-center gap-3 border-t border-divider px-3 py-2.5 first:border-t-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-body font-medium">
                  {login.full_name}
                  {login.is_owner && <span className="text-text-2"> (you)</span>}
                </span>
                <span className="text-small text-text-2">
                  {login.login_name} · Last signed in: {lastSignInText(login.last_sign_in_at, now)}
                </span>
                {login.must_change_password && <span><Badge variant="muted">Must pick a new password</Badge></span>}
              </div>
              {!login.is_owner && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setTarget(login)
                    setSetOpen(true)
                  }}
                >
                  Set a new password
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <Button variant="danger" onClick={() => setResetOpen(true)}>Reset everyone's password</Button>
        <Button variant="danger" onClick={() => setSignOutOpen(true)}>Sign everyone out</Button>
      </div>

      <SetPasswordSheet login={target} open={setOpen} onOpenChange={setSetOpen} />
      <AllResetSheet open={resetOpen} onOpenChange={setResetOpen} />
      <SignOutEveryoneSheet open={signOutOpen} onOpenChange={setSignOutOpen} />
    </section>
  )
}

/**
 * Confirm, then show the temporary password once. The password lives only in this component's state,
 * and is cleared the moment the sheet closes.
 */
function SetPasswordSheet({ login, open, onOpenChange }: { login: Login | null; open: boolean; onOpenChange(open: boolean): void }) {
  const setPassword = useSetPassword()
  const [shown, setShown] = useState<{ name: string; password: string } | null>(null)
  const name = login?.full_name ?? 'this player'

  function handleOpenChange(next: boolean) {
    // While the server is working, the sheet stays open so the new password can't be lost.
    if (!next && setPassword.isPending) return
    if (!next) {
      setShown(null)
      setPassword.reset()
    }
    onOpenChange(next)
  }

  async function makePassword() {
    if (!login) return
    try {
      const result = await setPassword.mutateAsync(login.player_id)
      if (result.ok && result.temp_password) {
        setShown({ name: result.full_name, password: result.temp_password })
      } else {
        toast.error(`Couldn't set a new password for ${name}. Try again.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reach the Developer tools. Try again.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title={`Set a new password for ${name}`} description="Gives a temporary password once.">
      {shown ? (
        <div className="flex flex-col gap-4">
          <PasswordOnce name={shown.name} password={shown.password} />
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-2-strong">
            Give {name} a new temporary password? Their old password stops working.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={setPassword.isPending}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" loading={setPassword.isPending} onClick={() => void makePassword()}>
              Make a new password
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
