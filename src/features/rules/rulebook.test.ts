import { describe, expect, it } from 'vitest'
import { RULEBOOK, searchRules } from './rulebook'

describe('rulebook', () => {
  it('has all 16 sections, numbered in order, with unique ids', () => {
    expect(RULEBOOK.map((s) => s.number)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    const ids = RULEBOOK.flatMap((s) => [s.id, ...s.rules.map((r) => r.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the key numbers from the official rulebook', () => {
    const text = JSON.stringify(RULEBOOK)
    for (const fact of ['12-minute halves', '8-minute overtime', '6 points', '10 steps', '20 steps', '2 points', 'once per set of downs']) {
      expect(text).toContain(fact)
    }
  })

  it('finds rules by any word, ignoring case', () => {
    const hits = searchRules('ONSIDE')
    expect(hits[0]!.id).toBe('kickoffs')
    expect(hits[0]!.rules.map((r) => r.id)).toEqual(['onside-kicks'])
    expect(hits.map((s) => s.id)).not.toContain('punting')
  })

  it('matches every word, in any order', () => {
    const hits = searchRules('backup touch')
    expect(hits.flatMap((s) => s.rules.map((r) => r.id))).toContain('legal-touches')
  })

  it('searches penalty lines too', () => {
    expect(searchRules('loss of down').flatMap((s) => s.rules.map((r) => r.id))).toContain('holding')
  })

  it('returns the whole book for an empty search, and nothing for nonsense', () => {
    expect(searchRules('   ')).toBe(RULEBOOK)
    expect(searchRules('zzzqqq')).toEqual([])
  })
})
