import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const { clockChangeMessage } = await import('./api')

const ME = 'user-eddie'
const OTHER = 'user-david'
const base = { game_id: 'g', started_at: null, half: 2 as const }

// Bug seen on 2026-11-01: a second phone paused the clock at 1:07 and the scorer's screen
// just showed it stopped. Other phones are now told the clock changed elsewhere.
describe('clockChangeMessage', () => {
  it('tells this phone when another phone pauses the clock', () => {
    expect(clockChangeMessage({ ...base, running: true, seconds_left: 75 }, { running: false, seconds_left: 67, updated_by: OTHER }, ME)).toBe(
      'Clock paused on another phone',
    )
  })
  it('tells this phone when another phone starts the clock', () => {
    expect(clockChangeMessage({ ...base, running: false, seconds_left: 75 }, { running: true, seconds_left: 75, updated_by: OTHER }, ME)).toBe(
      'Clock started on another phone',
    )
  })
  it('says nothing for this phone’s own changes', () => {
    expect(clockChangeMessage({ ...base, running: true, seconds_left: 75 }, { running: false, seconds_left: 67, updated_by: ME }, ME)).toBeNull()
  })
  it('says nothing for the automatic stop at 0:00', () => {
    expect(clockChangeMessage({ ...base, running: true, seconds_left: 5 }, { running: false, seconds_left: 0, updated_by: OTHER }, ME)).toBeNull()
  })
  it('says nothing when running did not change', () => {
    expect(clockChangeMessage({ ...base, running: false, seconds_left: 75 }, { running: false, seconds_left: 600, updated_by: OTHER }, ME)).toBeNull()
  })
  it('names the phone that made the first Start (the row is new, so only created_by is set)', () => {
    expect(clockChangeMessage(null, { running: true, seconds_left: 1500, updated_by: null, created_by: OTHER }, ME)).toBe('Clock started on another phone')
  })
  it('stays quiet about my own first Start', () => {
    expect(clockChangeMessage(null, { running: true, seconds_left: 1500, updated_by: null, created_by: ME }, ME)).toBeNull()
  })
})
