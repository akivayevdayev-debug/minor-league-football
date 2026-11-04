/** Storage is optional: private mode and blocked storage can make reads and writes throw. */
type ShineStorage = Pick<Storage, 'getItem' | 'setItem'> | null

/**
 * True the first time a game's final whistle is seen on this phone, false after that.
 * The `seen` set covers the screen's lifetime; storage keeps the answer across reloads.
 */
export function shouldShine(gameId: string, storage: ShineStorage, seen: Set<string>): boolean {
  if (seen.has(gameId)) return false
  seen.add(gameId)
  const key = `mlf-final-shine:${gameId}`
  try {
    if (storage?.getItem(key)) return false
  } catch {
    // Unreadable storage: fall back to the in-memory set alone.
  }
  try {
    storage?.setItem(key, '1')
  } catch {
    // Unwritable storage: the in-memory set still keeps this to one shine per visit.
  }
  return true
}
