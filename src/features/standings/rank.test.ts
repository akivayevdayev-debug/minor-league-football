import { describe, expect, it } from 'vitest'
import type { Player } from '../../types/db'
import { rankPlayers } from './rank'

const p = (id: string) => ({ id }) as Player
const totals = new Map([
  ['a', { td: 5 }],
  ['b', { td: 3 }],
  ['c', { td: 3 }],
  ['d', { td: 1 }],
  ['e', { rec: 9 }],
])

describe('rankPlayers', () => {
  const ranked = rankPlayers([p('d'), p('b'), p('a'), p('c'), p('e'), p('f')], totals, 'td')
  it('puts the most first and leaves out anyone with none', () => {
    expect(ranked.map((r) => r.player.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('gives tied players the same rank and skips the next one', () => {
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4])
  })
  it('is empty when nobody has the stat', () => {
    expect(rankPlayers([p('a')], totals, 'int')).toEqual([])
  })
})
