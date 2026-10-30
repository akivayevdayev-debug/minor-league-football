import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAddGuest } from '../league'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'

/** Guests are subs: name only, no login. */
export function AddGuestSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const [name, setName] = useState('')
  const addGuest = useAddGuest()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await addGuest.mutateAsync(name)
      toast.success(`${name.trim()} added as a guest`)
      setName('')
      onOpenChange(false)
    } catch {
      toast.error("Couldn't add the guest. Check your signal and try again.")
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add guest"
      description="A sub who plays without a login. You only need a name."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" autoComplete="off" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Button type="submit" variant="primary" loading={addGuest.isPending} disabled={!name.trim()}>
          Add guest
        </Button>
      </form>
    </Sheet>
  )
}
