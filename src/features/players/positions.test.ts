import { describe, expect, it } from 'vitest'
import { splitPositions } from './positions'

describe('typing positions', () => {
  it('splits short codes typed with spaces', () => {
    expect(splitPositions(['WR CB HB'])).toEqual(['WR', 'CB', 'HB'])
  })
  it('splits on commas and keeps written-out names whole', () => {
    expect(splitPositions(['Corner, Right guard, WR'])).toEqual(['Corner', 'Right guard', 'WR'])
    expect(splitPositions(['Right guard'])).toEqual(['Right guard'])
  })
  it('leaves an already clean list alone and drops blanks', () => {
    expect(splitPositions(['WR', 'DB', ' ', ''])).toEqual(['WR', 'DB'])
  })
})
