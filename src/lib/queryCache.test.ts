import { describe, expect, it } from 'vitest'
import type { Query } from '@tanstack/react-query'
import { savesCleanly, shouldSave } from './queryCache'

const q = (queryKey: unknown[], status = 'success') => ({ queryKey, state: { status } }) as unknown as Query

describe('shouldSave', () => {
  it('saves normal league data', () => {
    expect(shouldSave(q(['standings', 's1']))).toBe(true)
    expect(shouldSave(q(['game', 'g1']))).toBe(true)
  })
  it('never saves expiring photo links or the live clock', () => {
    expect(shouldSave(q(['photo-url', 'p1']))).toBe(false)
    expect(shouldSave(q(['game', 'g1', 'clock']))).toBe(false)
  })
  it('never saves failed or loading reads', () => {
    expect(shouldSave(q(['standings'], 'error'))).toBe(false)
    expect(shouldSave(q(['standings'], 'pending'))).toBe(false)
  })
})

describe('savesCleanly', () => {
  it('keeps plain lists and objects', () => {
    expect(savesCleanly([{ id: 'a', n: 1, ok: true, note: null }])).toBe(true)
    expect(savesCleanly({ lineups: [], clocks: [{ at: '2026-11-04' }] })).toBe(true)
  })
  it('refuses data holding a Map, Set or Date, which come back broken', () => {
    expect(savesCleanly(new Map([['g1', 12]]))).toBe(false)
    expect(savesCleanly({ ids: new Set(['a']) })).toBe(false)
    expect(savesCleanly([{ when: new Date() }])).toBe(false)
  })
  it('is checked before saving a query', () => {
    const withMap = { queryKey: ['typed-minutes', 'p1'], state: { status: 'success', data: new Map() } } as unknown as Query
    expect(shouldSave(withMap)).toBe(false)
  })
})
