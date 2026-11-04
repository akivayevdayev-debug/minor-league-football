import { describe, expect, it } from 'vitest'
import { shouldShine } from './finalShine'

describe('shouldShine', () => {
  it('shines once per game', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const seen = new Set<string>()
    expect(shouldShine('g1', storage, seen)).toBe(true)
    expect(shouldShine('g1', storage, new Set())).toBe(false) // a reload: storage remembers
    expect(shouldShine('g2', storage, seen)).toBe(true)
  })

  it('still shines only once when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('private')
      },
      setItem: () => {
        throw new Error('private')
      },
    }
    const seen = new Set<string>()
    expect(shouldShine('g1', storage, seen)).toBe(true)
    expect(shouldShine('g1', storage, seen)).toBe(false)
  })

  it('uses only the in-memory set when there is no storage', () => {
    const seen = new Set<string>()
    expect(shouldShine('g1', null, seen)).toBe(true)
    expect(shouldShine('g1', null, seen)).toBe(false)
  })
})
