import { describe, expect, it, vi } from 'vitest'

// The score write talks to Supabase; the test swaps in a fake client, so no connection is made.
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { saveScoreLine, StatLimitError } from './api'
import type { supabase } from '../../lib/supabase'

type Err = { message: string; code: string } | null

/** A fake client that records each write in order and refuses a table's write when asked to. */
function fakeDb(refuse: { stat?: Err; score?: Err }) {
  const calls: string[] = []
  const from = (table: 'stat_events' | 'score_events') => ({
    upsert: () => {
      calls.push(`${table}:upsert`)
      return Promise.resolve({ error: table === 'stat_events' ? refuse.stat ?? null : refuse.score ?? null })
    },
    update: () => ({
      eq: () => {
        calls.push(`${table}:update`)
        return Promise.resolve({ error: null })
      },
    }),
  })
  return { calls, db: { from } as unknown as typeof supabase }
}

const game = { id: 'g1', season_id: 's2' }
const td = { id: 'line-1', teamId: 't1', type: 'td' as const, playerId: 'p1', half: 1, clockSeconds: 300 }

describe('saving a score line', () => {
  it('writes the stat line first, then the score line, with the same id', async () => {
    const { calls, db } = fakeDb({})
    await saveScoreLine(db, game, td)
    expect(calls).toEqual(['stat_events:upsert', 'score_events:upsert'])
  })

  it('a stat over its limit saves neither line', async () => {
    const { calls, db } = fakeDb({ stat: { message: 'MLF_LIMIT:Touchdowns:15', code: '23514' } })
    await expect(saveScoreLine(db, game, td)).rejects.toThrow(StatLimitError)
    await expect(saveScoreLine(db, game, td)).rejects.toThrow("That's more than 15 Touchdowns for one game. Check the number.")
    expect(calls).not.toContain('score_events:upsert')
  })

  it('a score line over its limit takes the stat line back out', async () => {
    const { calls, db } = fakeDb({ score: { message: 'MLF_LIMIT:Score lines:30', code: '23514' } })
    await expect(saveScoreLine(db, game, td)).rejects.toThrow("That's more than 30 Score lines for one game. Check the number.")
    expect(calls).toEqual(['stat_events:upsert', 'score_events:upsert', 'stat_events:update'])
  })

  it('without a scorer there is only a score line', async () => {
    const { calls, db } = fakeDb({})
    await saveScoreLine(db, game, { ...td, playerId: null })
    expect(calls).toEqual(['score_events:upsert'])
  })
})
