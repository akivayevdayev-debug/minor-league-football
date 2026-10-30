/**
 * All New York time handling (frontend plan, section 12). Times are stored in UTC and always shown
 * and picked as New York wall time, whatever the phone's own time zone is.
 */
export const LEAGUE_ZONE = 'America/New_York'

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LEAGUE_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const gameFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LEAGUE_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

interface Wall {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function wallParts(ms: number): Wall & { second: number } {
  const p = Object.fromEntries(partsFormatter.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]))
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! }
}

/** Offset of New York from UTC at a moment, in ms (e.g. -4 h in summer). */
function zoneOffset(ms: number): number {
  const w = wallParts(ms)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000
}

function wallToUtc(w: Wall): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  const first = guess - zoneOffset(guess)
  return guess - zoneOffset(first) // second pass settles DST edges
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-12-06T16:30" from a datetime-local picker (New York wall time) → ISO UTC. */
export function fromZonedInput(value: string): string {
  const [date, time] = value.split('T')
  const [year, month, day] = (date ?? '').split('-').map(Number)
  const [hour, minute] = (time ?? '').split(':').map(Number)
  return new Date(wallToUtc({ year: year!, month: month!, day: day!, hour: hour!, minute: minute! })).toISOString()
}

/** ISO UTC → "2026-12-06T16:30" for a datetime-local picker, in New York wall time. */
export function toZonedInput(iso: string): string {
  const w = wallParts(Date.parse(iso))
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
}

/** Same New York wall time, `days` later (keeps 4:30 PM across daylight-saving changes). */
export function shiftDays(iso: string, days: number): string {
  const w = wallParts(Date.parse(iso))
  const moved = new Date(Date.UTC(w.year, w.month - 1, w.day + days))
  return new Date(
    wallToUtc({ year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate(), hour: w.hour, minute: w.minute }),
  ).toISOString()
}

export function shiftMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString()
}

/** "Sat, Nov 7, 4:30 PM" (New York time). */
export function formatGameTime(iso: string): string {
  return gameFormatter.format(new Date(iso))
}

/** Short zone label shown next to times, e.g. "ET". */
export const ZONE_LABEL = 'ET'
