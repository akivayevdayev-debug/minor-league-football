import { toast } from 'sonner'

/** Copies text to the clipboard and says so. Never logs what it copies. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied.')
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.")
  }
}
