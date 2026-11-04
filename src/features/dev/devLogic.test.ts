import { describe, expect, it } from 'vitest'
import {
  buildChanges,
  choiceReady,
  typedPasswordProblem,
  changedFields,
  editableFields,
  formatCopyAll,
  formatValue,
  isResetConfirmed,
  lastSignInText,
  parseEditedValue,
  resetProblemText,
  rowLabel,
  tableLabel,
  toEditText,
} from './devLogic'

describe('plain-word table names', () => {
  it('turns database table names into plain words', () => {
    expect(tableLabel('score_events')).toBe('Score line')
    expect(tableLabel('stat_events')).toBe('Stat line')
    expect(tableLabel('teams')).toBe('Team')
    expect(tableLabel('roster_memberships')).toBe('Roster spot')
  })

  it('falls back to the table name with spaces for anything unknown', () => {
    expect(tableLabel('some_new_table')).toBe('some new table')
  })
})

describe('changed fields for the edit history', () => {
  it('lists only the fields that changed, ignoring the updated_* stamps', () => {
    const before = { id: 'a', points: 6, status: 'live', updated_at: '1', updated_by: 'x' }
    const after = { id: 'a', points: 7, status: 'live', updated_at: '2', updated_by: 'y' }
    expect(changedFields(before, after)).toEqual([{ field: 'points', from: 6, to: 7 }])
  })

  it('treats a new row as every field appearing, with no "from" value', () => {
    const after = { id: 'a', name: 'Demons', voided_at: null }
    expect(changedFields(null, after)).toEqual([
      { field: 'id', from: undefined, to: 'a' },
      { field: 'name', from: undefined, to: 'Demons' },
      { field: 'voided_at', from: undefined, to: null },
    ])
  })

  it('compares lists by their contents, not by identity', () => {
    const before = { players_a: ['p1', 'p2'] }
    expect(changedFields(before, { players_a: ['p1', 'p2'] })).toEqual([])
    expect(changedFields(before, { players_a: ['p1'] })).toEqual([{ field: 'players_a', from: ['p1', 'p2'], to: ['p1'] }])
  })
})

describe('formatting values for people', () => {
  it('says empty for null and shows text, numbers and yes/no plainly', () => {
    expect(formatValue(null)).toBe('empty')
    expect(formatValue(undefined)).toBe('—')
    expect(formatValue('Demons')).toBe('Demons')
    expect(formatValue(12)).toBe('12')
    expect(formatValue(false)).toBe('false')
  })

  it('shortens long text', () => {
    const long = 'x'.repeat(200)
    expect(formatValue(long).length).toBeLessThanOrEqual(61)
    expect(formatValue(long).endsWith('…')).toBe(true)
  })
})

describe('"Copy all" for reset passwords', () => {
  it('writes one line per login that got a password, and leaves out failures', () => {
    const text = formatCopyAll([
      { full_name: 'Leo Cohen', login_name: 'leo', player_id: '1', ok: true, temp_password: 'Tiger-Moon-42' },
      { full_name: 'Dan Levy', login_name: 'dan', player_id: '2', ok: false },
    ])
    expect(text).toBe('Leo Cohen (leo): Tiger-Moon-42')
  })

  it('puts each login on its own line', () => {
    const text = formatCopyAll([
      { full_name: 'Leo Cohen', login_name: 'leo', player_id: '1', ok: true, temp_password: 'A-1' },
      { full_name: 'Sam Katz', login_name: 'sam', player_id: '3', ok: true, temp_password: 'B-2' },
    ])
    expect(text).toBe('Leo Cohen (leo): A-1\nSam Katz (sam): B-2')
  })
})

describe('the RESET confirmation', () => {
  it('accepts RESET typed exactly, ignoring surrounding spaces', () => {
    expect(isResetConfirmed('RESET')).toBe(true)
    expect(isResetConfirmed('  RESET ')).toBe(true)
  })

  it('refuses anything else, including lower case', () => {
    expect(isResetConfirmed('')).toBe(false)
    expect(isResetConfirmed('reset')).toBe(false)
    expect(isResetConfirmed('RESE')).toBe(false)
  })
})

describe('last sign-in text', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')

  it('says Never when there was no sign-in', () => {
    expect(lastSignInText(null, now)).toBe('Never')
  })

  it('uses relative times for recent sign-ins', () => {
    expect(lastSignInText('2026-11-03T11:59:40Z', now)).toBe('Just now')
    expect(lastSignInText('2026-11-03T11:30:00Z', now)).toBe('30 minutes ago')
    expect(lastSignInText('2026-11-03T09:00:00Z', now)).toBe('3 hours ago')
    expect(lastSignInText('2026-11-01T12:00:00Z', now)).toBe('2 days ago')
  })

  it('shows a date for older sign-ins', () => {
    expect(lastSignInText('2026-10-01T12:00:00Z', now)).toMatch(/Oct/)
  })
})

describe('editing a record', () => {
  it('never offers the protected columns', () => {
    const row = { id: 'x', name: 'A', created_at: 'c', created_by: 'u', updated_at: 'u', updated_by: 'u', nickname: null }
    expect(editableFields(row)).toEqual(['name', 'nickname'])
  })

  it('turns a value into edit text and back', () => {
    expect(toEditText(null)).toBe('')
    expect(toEditText(['p1', 'p2'])).toBe('["p1","p2"]')
    expect(toEditText(5)).toBe('5')
  })

  it('parses edited text into the type the column already has', () => {
    expect(parseEditedValue(5, '7')).toBe(7)
    expect(parseEditedValue(true, 'false')).toBe(false)
    expect(parseEditedValue(null, '')).toBeNull()
    expect(parseEditedValue('Leo', '')).toBe('')
    expect(parseEditedValue(['p1'], '["p1","p2"]')).toEqual(['p1', 'p2'])
  })

  it('refuses a list that is not valid JSON, in plain words', () => {
    expect(() => parseEditedValue(['p1'], '[p1')).toThrow('That list is not in the right form.')
  })

  it('sends only the fields that really changed', () => {
    const original = { id: 'x', name: 'Leo', jersey: 12, players_a: ['p1'] }
    const edited = { id: 'x', name: 'Leo', jersey: '13', players_a: '["p1"]' }
    expect(buildChanges(original, edited)).toEqual({ jersey: 13 })
  })
})

describe('row labels in the record picker', () => {
  const names = new Map([
    ['p1', 'Leo Cohen'],
    ['t1', 'Demons'],
  ])

  it('uses the name for players and teams', () => {
    expect(rowLabel('players', { id: 'p1', full_name: 'Leonard Cohen', nickname: 'Leo' }, names)).toBe('Leo')
    expect(rowLabel('teams', { id: 't1', name: 'Demons' }, names)).toBe('Demons')
  })

  it('names the player and team for roster spots', () => {
    expect(rowLabel('roster_memberships', { id: 'r', player_id: 'p1', team_id: 't1', starts_on: '2026-11-01' }, names)).toBe(
      'Leo Cohen · Demons',
    )
  })
})

describe('resetProblemText', () => {
  it('says nothing when every step worked', () => {
    expect(resetProblemText(undefined)).toBeNull()
  })
  it('warns when the sign-out failed', () => {
    expect(resetProblemText('sign_out')).toMatch(/still be signed in/)
  })
  it('warns when the pick-your-own flag failed', () => {
    expect(resetProblemText('flag')).toMatch(/won't be asked/)
  })
})

describe('parseEditedValue on an empty column', () => {
  it('keeps it empty when nothing is typed', () => {
    expect(parseEditedValue(null, '')).toBeNull()
  })
  it('saves a typed object as real JSON, not as text', () => {
    expect(parseEditedValue(null, '{"a":1}')).toEqual({ a: 1 })
  })
  it('saves ordinary words as text', () => {
    expect(parseEditedValue(null, 'Ben')).toBe('Ben')
  })
})

describe('typed passwords', () => {
  it('accepts 8 to 72 characters with no padding', () => {
    expect(typedPasswordProblem('goodpass', 8)).toBeNull()
    expect(choiceReady('typed', 'goodpass', 8)).toBe(true)
  })
  it('explains what is wrong', () => {
    expect(typedPasswordProblem('short', 8)).toBe('Use at least 8 characters.')
    expect(typedPasswordProblem('x'.repeat(73), 8)).toBe('Use at most 72 characters.')
    expect(typedPasswordProblem(' goodpass', 8)).toBe('Remove the space at the start or end.')
  })
  it('temporary needs nothing typed', () => {
    expect(choiceReady('temp', '', 8)).toBe(true)
    expect(choiceReady('typed', '', 8)).toBe(false)
  })
})
