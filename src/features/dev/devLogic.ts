/*
 * Pure helpers for the Developer tools screen (owner only). No React, no Supabase here, so they can be tested alone.
 */

export type Row = Record<string, unknown>

/** What owner-tools returns for one login's reset. temp_password exists only in the reply, never stored. */
export interface ResetResult {
  full_name: string
  login_name: string
  player_id: string
  ok: boolean
  temp_password?: string
  /** The password changed, but a later step failed: 'flag' (not asked to pick their own) or 'sign_out' (still signed in). */
  problem?: 'flag' | 'sign_out'
}

/** Tables the record editor and the history filter can work with, in menu order. */
export const EDITABLE_TABLES = [
  'players',
  'teams',
  'games',
  'score_events',
  'stat_events',
  'roster_memberships',
  'trades',
  'seasons',
] as const
export type EditableTable = (typeof EDITABLE_TABLES)[number]

const TABLE_LABELS: Record<string, string> = {
  players: 'Player',
  teams: 'Team',
  games: 'Game',
  score_events: 'Score line',
  stat_events: 'Stat line',
  roster_memberships: 'Roster spot',
  trades: 'Trade',
  seasons: 'Season',
  member_logins: 'Login',
  settings: 'Settings',
  game_clocks: 'Game clock',
}

/** Plain words for a table name; unknown tables show their name with spaces. */
export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table.replace(/_/g, ' ')
}

/** Columns nobody edits by hand: the database sets them. */
const PROTECTED = new Set(['id', 'created_at', 'created_by', 'updated_at', 'updated_by'])
/** Stamps that change on every write; they are not shown as changes. */
const STAMPS = new Set(['updated_at', 'updated_by'])

export function editableFields(row: Row): string[] {
  return Object.keys(row).filter((key) => !PROTECTED.has(key))
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface FieldChange {
  field: string
  /** undefined for a new row (there was no earlier value). */
  from: unknown
  to: unknown
}

/** The fields that differ between two versions of a row. A new row (before = null) lists every field. */
export function changedFields(before: Row | null, after: Row | null): FieldChange[] {
  if (!after) return []
  if (!before) {
    return Object.keys(after)
      .filter((key) => !STAMPS.has(key))
      .map((field) => ({ field, from: undefined, to: after[field] }))
  }
  const keys = [...Object.keys(after), ...Object.keys(before).filter((k) => !(k in after))]
  return keys
    .filter((key) => !STAMPS.has(key) && !same(before[key], after[key]))
    .map((field) => ({ field, from: before[field], to: after[field] }))
}

const MAX_SHOWN = 60

/** Short text for a value on screen. */
export function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'empty'
  const text = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}…` : text
}

/** The text for the edit box: empty for null, JSON for lists. */
export function toEditText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Reads the edit box back into the type the column already has. Throws a plain sentence when it can't. */
export function parseEditedValue(original: unknown, text: string): unknown {
  if (typeof original === 'number') {
    if (text.trim() === '') return null
    const n = Number(text)
    if (!Number.isFinite(n)) throw new Error('That needs to be a number.')
    return n
  }
  if (typeof original === 'boolean') {
    if (text === 'true') return true
    if (text === 'false') return false
    throw new Error('Type true or false.')
  }
  if (original !== null && typeof original === 'object') {
    if (text.trim() === '') return null
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('That list is not in the right form.')
    }
  }
  if (original === null || original === undefined) {
    if (text === '') return null
    // An empty column can't say its type. Text that looks like a list or object is saved as one,
    // so a JSON column gets real JSON; numbers and true/false the database converts by itself.
    const t = text.trim()
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return JSON.parse(t)
      } catch {
        throw new Error('That list is not in the right form.')
      }
    }
  }
  return text
}

/** Only the fields that really changed, parsed and ready for an update. Throws if a value can't be read. */
export function buildChanges(original: Row, edited: Record<string, string>): Row {
  const changes: Row = {}
  for (const key of editableFields(original)) {
    const text = edited[key] ?? toEditText(original[key])
    const parsed = parseEditedValue(original[key], text)
    if (!same(parsed, original[key])) changes[key] = parsed
  }
  return changes
}

/** One line per login that got a password: "Name (login): password". Failures are left out. */
export function formatCopyAll(results: ResetResult[]): string {
  return results
    .filter((r) => r.ok && r.temp_password)
    .map((r) => `${r.full_name} (${r.login_name}): ${r.temp_password}`)
    .join('\n')
}

/** Only RESET (in capitals, spaces around it ignored) unlocks the reset. */
export function isResetConfirmed(text: string): boolean {
  return text.trim() === 'RESET'
}

export function lastSignInText(iso: string | null, now: number): string {
  if (!iso) return 'Never'
  const diff = now - Date.parse(iso)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A readable name for one row in the record picker. names maps a player or team id to its name. */
export function rowLabel(table: string, row: Row, names: Map<string, string>): string {
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : '')
  const name = (key: string) => names.get(text(key)) ?? 'Unknown'
  switch (table) {
    case 'players':
      return text('nickname').trim() || text('full_name')
    case 'teams':
    case 'seasons':
      return text('name')
    case 'roster_memberships':
      return `${name('player_id')} · ${name('team_id')}`
    case 'stat_events':
      return `${name('player_id')} · ${text('stat_type_id')} ${String(row.value ?? '')}`.trim()
    case 'score_events':
      return `${name('team_id')} · ${String(row.points ?? '')} pts`
    case 'trades':
      return `${text('traded_on')} · ${text('status')}`
    case 'games':
      return `Week ${String(row.week ?? '?')} · ${text('status')}`
    default:
      return text('id')
  }
}

/** Plain words for a step that failed after the password changed, or null when everything worked. */
export function resetProblemText(problem: ResetResult['problem']): string | null {
  if (problem === 'sign_out') return 'Password changed, but they may still be signed in. Press Sign everyone out.'
  if (problem === 'flag') return "Password changed, but they won't be asked to pick their own. Try Set a new password again."
  return null
}
