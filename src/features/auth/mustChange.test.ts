import { describe, expect, it } from 'vitest'
import { needsNewPassword } from './mustChange'

describe('when a member must pick a new password', () => {
  it('asks when the typed password is under 8 characters', () => {
    expect(needsNewPassword(7, false)).toBe(true)
  })

  it('does not ask for an 8-character password with no flag', () => {
    expect(needsNewPassword(8, false)).toBe(false)
  })

  it('asks when the database flag is set, even with no typed password (returning user)', () => {
    expect(needsNewPassword(null, true)).toBe(true)
  })

  it('does not ask when there is no flag and no typed password', () => {
    expect(needsNewPassword(null, false)).toBe(false)
  })
})
