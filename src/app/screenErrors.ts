/** Messages browsers give when a screen's file can't be downloaded (Chrome, Safari, Firefox). */
const OLD_FILE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i

export function isOldFileError(error: unknown): boolean {
  return error instanceof Error && OLD_FILE.test(error.message)
}

const RELOADED_AT = 'mlf-reloaded-for-update'
/** Not twice within this long, so a phone with no signal doesn't reload over and over. */
const RELOAD_GAP_MS = 30_000

/** Reloads the app once to pick up the new version's files. Returns false if it just did. */
export function reloadOnceForOldFile(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (now - last < RELOAD_GAP_MS) return false
    sessionStorage.setItem(RELOADED_AT, String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
