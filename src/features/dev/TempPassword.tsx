import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { copyText } from './clipboard'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return (
    <Button size="sm" variant="outline" onClick={() => void copyText(text)}>
      <Icon name="copy" size="xs" />
      {label}
    </Button>
  )
}

/** A temporary password, big and easy to read, shown once. Nothing keeps it after the sheet closes. */
export function PasswordOnce({ name, password }: { name: string; password: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-2-strong">Temporary password for {name}</p>
      <p className="nums rounded-panel bg-(--press-fill) px-4 py-4 text-center text-headline font-strong break-all select-all">{password}</p>
      <CopyButton text={password} label="Copy password" />
      <p className="text-small text-text-2">
        Send this to {name} privately, not in the group chat. They'll pick their own when they sign in.
      </p>
    </div>
  )
}
