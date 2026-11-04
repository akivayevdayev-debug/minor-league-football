import { describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { KEEP_PASSWORD_LOGINS, TEMP_ALPHABET, isResetTarget, loginEmail, makeTempPassword, missingLogins, parseAction } from './logic'

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
  it('skips only the owner, resets everyone else (Leo too)', () => {
    expect(KEEP_PASSWORD_LOGINS).toEqual([])
    expect(isResetTarget({ is_owner: true, login_name: 'akiva' })).toBe(false)
    expect(isResetTarget({ is_owner: false, login_name: 'leo' })).toBe(true)
    expect(isResetTarget({ is_owner: false, login_name: 'david' })).toBe(true)
  })
})

describe('create_logins', () => {
  const a = '30000000-0000-0000-0000-000000000001'
  const b = '30000000-0000-0000-0000-000000000002'
  it('accepts 1 to 50 player ids, without repeats', () => {
    expect(parseAction({ action: 'create_logins', playerIds: [a, b] })).toEqual({ action: 'create_logins', playerIds: [a, b] })
    expect(parseAction({ action: 'create_logins', playerIds: [a, a] })).toEqual({ action: 'create_logins', playerIds: [a] })
  })
  it('refuses an empty, oversized or bad list', () => {
    expect(parseAction({ action: 'create_logins', playerIds: [] })).toBeNull()
    expect(parseAction({ action: 'create_logins' })).toBeNull()
    expect(parseAction({ action: 'create_logins', playerIds: ['nope'] })).toBeNull()
    expect(parseAction({ action: 'create_logins', playerIds: Array.from({ length: 51 }, (_, i) => `30000000-0000-0000-0000-${String(i).padStart(12, '0')}`) })).toBeNull()
  })
  it('turns a login name into the sign-in address', () => {
    expect(loginEmail(' Aaron ')).toBe('aaron@mlf.invalid')
  })
  it('lists rostered players with a login name and no account, by name', () => {
    const players = [
      { id: a, full_name: 'Zed', login_name: 'zed', is_guest: false },
      { id: b, full_name: 'Aaron', login_name: 'aaron', is_guest: false },
      { id: 'g', full_name: 'Guest', login_name: null, is_guest: true },
      { id: 'n', full_name: 'No name', login_name: '  ', is_guest: false },
      { id: 'x', full_name: 'Has one', login_name: 'has', is_guest: false },
    ]
    expect(missingLogins(players, new Set(['x']))).toEqual([
      { player_id: b, full_name: 'Aaron', login_name: 'aaron' },
      { player_id: a, full_name: 'Zed', login_name: 'zed' },
    ])
  })
})
