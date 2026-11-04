import { QueryClient, type Query } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

const DAY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'mlf-saved-data'

/** Bump when the shape of saved data changes, so old copies are thrown away. */
const SAVED_DATA_VERSION = '1'

export const queryClient = new QueryClient({
  // gcTime must be at least maxAge, or saved data is dropped before it can be reused.
  defaultOptions: { queries: { staleTime: 30_000, gcTime: DAY_MS, retry: 1 } },
})

/** Private mode or a full disk can make storage throw; the app then just runs without saving. */
function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage
    const probe = `${STORAGE_KEY}-probe`
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return undefined
  }
}

const persister = createSyncStoragePersister({ storage: safeStorage(), key: STORAGE_KEY, throttleTime: 1000 })

/** Photo links expire and the live clock must always come fresh, so neither is saved. */
export function shouldSave(query: Query): boolean {
  if (query.state.status !== 'success') return false
  const key = query.queryKey
  if (key[0] === 'photo-url') return false
  if (key[key.length - 1] === 'clock') return false
  return true
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: DAY_MS,
  buster: SAVED_DATA_VERSION,
  dehydrateOptions: { shouldDehydrateQuery: shouldSave },
}

/** On sign-out: forget everything this phone saved, so the next person sees nothing of it. */
export function clearSavedData() {
  queryClient.clear()
  void persister.removeClient()
}
