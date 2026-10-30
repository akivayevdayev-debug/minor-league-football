import { describe, expect, it } from 'vitest'
import { cellKey, playerTotals, readCell, sheetChanges } from './statSheet'

const line = (player_id: string | null, stat_type_id: 'rec' | 'td', value: number) => ({ player_id, stat_type_id, value })

describe('game stat sheet', () => {
  it('adds up each player, including earlier corrections, and leaves team lines out', () => {
    const t = playerTotals([line('a', 'rec', 3), line('a', 'rec', 2), line('a', 'rec', -1), line('b', 'td', 1), line(null, 'td', 1)])
    expect(t.get('a')?.get('rec')).toBe(4)
    expect(t.get('b')?.get('td')).toBe(1)
    expect(t.size).toBe(2)
  })

  it('reads blank as 0 and refuses anything but 0 to 999', () => {
    expect(readCell('')).toBe(0)
    expect(readCell(' 7 ')).toBe(7)
    expect(readCell('999')).toBe(999)
    expect(readCell('1000')).toBeNull()
    expect(readCell('-2')).toBeNull()
    expect(readCell('2.5')).toBeNull()
  })

  it('saves only the difference from what is there now', () => {
    const current = playerTotals([line('a', 'rec', 3), line('b', 'td', 2)])
    const edits = new Map([
      [cellKey('a', 'rec'), '5'], // 3 → 5
      [cellKey('b', 'td'), ''], // 2 → 0
      [cellKey('c', 'rec'), '1'], // new player
      [cellKey('a', 'td'), '0'], // unchanged
      [cellKey('b', 'rec'), 'x'], // invalid, skipped
    ])
    expect(sheetChanges(current, edits)).toEqual([
      { player_id: 'a', stat_type_id: 'rec', delta: 2 },
      { player_id: 'b', stat_type_id: 'td', delta: -2 },
      { player_id: 'c', stat_type_id: 'rec', delta: 1 },
    ])
  })
})
