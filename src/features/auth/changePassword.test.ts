import { describe, expect, it, vi } from 'vitest'
import { changeToNewPassword, type PasswordDeps } from './changePassword'

/** Fake backend: `clearResults` lists what each flag-clear call returns, in order. */
function fakeDeps(opts: { updateError?: { code?: string } | null; clearResults?: boolean[] } = {}) {
  const clears = [...(opts.clearResults ?? [true])]
  const deps = {
    updatePassword: vi.fn(async () => ({ error: opts.updateError ?? null })),
    clearFlag: vi.fn(async () => clears.shift() ?? true),
    wait: vi.fn(async () => {}),
  }
  return deps satisfies PasswordDeps & Record<string, unknown>
}

describe('changing a forced password', () => {
  it('saves, clears the flag, and reports ok on the first try', async () => {
    const deps = fakeDeps()
    const saved = { current: false }
    expect(await changeToNewPassword(deps, 'x'.repeat(8), saved)).toBe('ok')
    expect(deps.updatePassword).toHaveBeenCalledTimes(1)
    expect(deps.clearFlag).toHaveBeenCalledTimes(1)
    expect(saved.current).toBe(false)
  })

  it('quietly retries a failed flag clear and still reports ok', async () => {
    const deps = fakeDeps({ clearResults: [false, false, true] })
    const saved = { current: false }
    expect(await changeToNewPassword(deps, 'x'.repeat(8), saved)).toBe('ok')
    expect(deps.clearFlag).toHaveBeenCalledTimes(3)
    expect(deps.wait).toHaveBeenCalledTimes(2)
  })

  it('reports saved-not-finished when the flag clear keeps failing, and remembers the save', async () => {
    const deps = fakeDeps({ clearResults: [false, false, false] })
    const saved = { current: false }
    expect(await changeToNewPassword(deps, 'x'.repeat(8), saved)).toBe('saved-not-finished')
    expect(saved.current).toBe(true)
  })

  it('on retry after a half-finished change, only clears the flag and never re-sends the password', async () => {
    const deps = fakeDeps({ clearResults: [false, false, false, true] })
    const saved = { current: false }
    await changeToNewPassword(deps, 'x'.repeat(8), saved)
    deps.updatePassword.mockClear()
    expect(await changeToNewPassword(deps, 'x'.repeat(8), saved)).toBe('ok')
    expect(deps.updatePassword).not.toHaveBeenCalled()
    expect(saved.current).toBe(false)
  })

  it('maps a weak password and an unchanged password without clearing anything', async () => {
    const weak = fakeDeps({ updateError: { code: 'weak_password' } })
    expect(await changeToNewPassword(weak, 'x'.repeat(8), { current: false })).toBe('too-weak')
    const same = fakeDeps({ updateError: { code: 'same_password' } })
    const saved = { current: false }
    expect(await changeToNewPassword(same, 'x'.repeat(8), saved)).toBe('same-as-old')
    expect(same.clearFlag).not.toHaveBeenCalled()
    expect(saved.current).toBe(false)
  })

  it('any other update error is a plain failure', async () => {
    const deps = fakeDeps({ updateError: { code: 'unexpected_failure' } })
    expect(await changeToNewPassword(deps, 'x'.repeat(8), { current: false })).toBe('failed')
  })
})
