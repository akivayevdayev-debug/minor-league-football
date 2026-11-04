import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { KEEP_PASSWORD_LOGINS, TEMP_ALPHABET, isResetTarget, makeTempPassword, parseAction } from './logic'

const realBytes = (n: number) => new Uint8Array(randomBytes(n))

describe('makeTempPassword', () => {
  it('makes 3 groups of 4 easy-to-read characters', () => {
    for (let i = 0; i < 200; i++) {
      const pw = makeTempPassword(realBytes)
      expect(pw).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
      expect(pw).not.toMatch(/[01ilo]/)
      expect(pw.length).toBeGreaterThanOrEqual(8)
    }
  })

  it('gives a different password each time', () => {
    const seen = new Set(Array.from({ length: 500 }, () => makeTempPassword(realBytes)))
    expect(seen.size).toBe(500)
  })

  it('skips biased bytes instead of favouring some characters', () => {
    // Bytes 248..255 would favour the first 8 characters; they must be skipped, not used.
    let call = 0
    const fake = (n: number) => new Uint8Array(n).fill(call++ === 0 ? 255 : 0)
    expect(makeTempPassword(fake)).toBe(`${TEMP_ALPHABET[0]!.repeat(4)}-${TEMP_ALPHABET[0]!.repeat(4)}-${TEMP_ALPHABET[0]!.repeat(4)}`)
    expect(call).toBeGreaterThan(1)
  })
})

describe('parseAction', () => {
  const id = '30000000-0000-0000-0000-000000000001'
  it('accepts the four actions', () => {
    expect(parseAction({ action: 'list_logins' })).toEqual({ action: 'list_logins' })
    expect(parseAction({ action: 'set_password', playerId: id })).toEqual({ action: 'set_password', playerId: id })
    expect(parseAction({ action: 'reset_everyone', confirm: 'RESET' })).toEqual({ action: 'reset_everyone', confirm: 'RESET' })
    expect(parseAction({ action: 'sign_out_everyone', confirm: 'SIGN OUT' })).toEqual({ action: 'sign_out_everyone', confirm: 'SIGN OUT' })
  })

  it('refuses the risky actions without their confirm word', () => {
    expect(parseAction({ action: 'reset_everyone' })).toBeNull()
    expect(parseAction({ action: 'reset_everyone', confirm: 'yes' })).toBeNull()
    expect(parseAction({ action: 'sign_out_everyone' })).toBeNull()
  })

  it('refuses anything else', () => {
    expect(parseAction(null)).toBeNull()
    expect(parseAction('list_logins')).toBeNull()
    expect(parseAction({ action: 'delete_everything' })).toBeNull()
    expect(parseAction({ action: 'set_password', playerId: "1' or 1=1" })).toBeNull()
  })
})

describe('isResetTarget', () => {
  it('skips the owner and Leo, resets everyone else', () => {
    expect(KEEP_PASSWORD_LOGINS).toEqual(['leo'])
    expect(isResetTarget({ is_owner: true, login_name: 'akiva' })).toBe(false)
    expect(isResetTarget({ is_owner: false, login_name: 'leo' })).toBe(false)
    expect(isResetTarget({ is_owner: false, login_name: ' Leo ' })).toBe(false)
    expect(isResetTarget({ is_owner: false, login_name: 'david' })).toBe(true)
    expect(isResetTarget({ is_owner: false, login_name: 'leonard' })).toBe(true)
  })
})
