import { describe, expect, it } from 'vitest'
import { loginIsGone } from './loginGone'

describe('signing out a deleted login', () => {
  it('signs out when the server says the login or session is gone', () => {
    expect(loginIsGone({ status: 403, code: 'user_not_found' })).toBe(true)
    expect(loginIsGone({ status: 403, code: 'session_not_found' })).toBe(true)
    expect(loginIsGone({ status: 401, code: 'bad_jwt' })).toBe(true)
  })

  it('never signs out for network trouble or no error', () => {
    expect(loginIsGone(null)).toBe(false)
    expect(loginIsGone({ status: 0, code: undefined })).toBe(false)
    expect(loginIsGone({ status: 500, code: 'unexpected_failure' })).toBe(false)
  })
})
