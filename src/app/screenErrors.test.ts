import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isOldFileError, reloadOnceForOldFile } from './screenErrors'

describe('isOldFileError', () => {
  it('spots a screen file that failed to download', () => {
    expect(isOldFileError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
    expect(isOldFileError(new TypeError('Importing a module script failed.'))).toBe(true)
  })
  it('leaves other errors alone', () => {
    expect(isOldFileError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isOldFileError('oops')).toBe(false)
  })
})

describe('reloadOnceForOldFile', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memoryStorage()))

  it('reloads once, then not again straight away', () => {
    const reload = vi.fn()
    vi.stubGlobal('window', { location: { reload } })
    expect(reloadOnceForOldFile(100_000)).toBe(true)
    expect(reloadOnceForOldFile(110_000)).toBe(false)
    expect(reloadOnceForOldFile(140_001)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })
})

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}
