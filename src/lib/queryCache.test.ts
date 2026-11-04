import { describe, expect, it } from 'vitest'
import type { Query } from '@tanstack/react-query'
import { shouldSave } from './queryCache'

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
