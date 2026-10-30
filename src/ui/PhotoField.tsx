import { useId, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { usePhotoUrl } from '../lib/photos'
import { Button } from './Button'
import { Icon } from './Icon'

interface Props {
  label: string
  hint?: string
  /** Current storage path, or null when there is no photo yet. */
  path: string | null
  /** round = player photo, shield = team logo, wide = team photo. */
  shape: 'round' | 'shield' | 'wide'
  /** Shrinks, uploads and saves the picked file. Throws a plain-English error on failure. */
  onPick(file: File): Promise<void>
  /** Shown in the frame when there is no photo yet. */
  placeholder?: React.ReactNode
}

const frames = {
  round: 'size-(--badge-xl) rounded-pill',
  shield: 'w-(--badge-xl) aspect-[5/6] rounded-panel',
  wide: 'w-full aspect-video rounded-panel',
}

/**
 * Shows the current photo and a button to choose a new one (camera roll or camera on phones).
 * The photo saves straight away; the old one stays in storage and in the edit history.
 */
export function PhotoField({ label, hint, path, shape, onPick, placeholder }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const src = usePhotoUrl(path)
  const shown = preview ?? src

  async function picked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const local = URL.createObjectURL(file)
    setPreview(local)
    setBusy(true)
    try {
      await onPick(file)
      toast.success(`${label} saved`)
    } catch (err) {
      setPreview(null)
      toast.error(err instanceof Error ? err.message : "Couldn't save the photo.")
    } finally {
      setBusy(false)
      URL.revokeObjectURL(local)
    }
  }

  return (
    <div className={`flex gap-3 ${shape === 'wide' ? 'flex-col' : 'items-center'}`}>
      <div className={`${frames[shape]} relative flex shrink-0 items-center justify-center overflow-hidden bg-panel-2 surface-inset`}>
        {shown ? <img src={shown} alt="" className="size-full object-cover" /> : (placeholder ?? <Icon name="me" size="lg" className="text-text-3" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={id} className="caps-label">
          {label}
        </label>
        {hint && <p className="text-small text-text-2">{hint}</p>}
        <input ref={input} id={id} type="file" accept="image/*" className="sr-only" onChange={picked} />
        <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()} className="self-start">
          <Icon name="camera" size="xs" />
          {path ? 'Change photo' : 'Add photo'}
        </Button>
      </div>
    </div>
  )
}
