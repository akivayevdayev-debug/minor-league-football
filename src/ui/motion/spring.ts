/** The house spring, read from tokens.css (--spring-duration, --spring-bounce). */
export function houseSpring() {
  const css = getComputedStyle(document.documentElement)
  return {
    type: 'spring' as const,
    duration: parseFloat(css.getPropertyValue('--spring-duration')) || 0.45,
    bounce: parseFloat(css.getPropertyValue('--spring-bounce')) || 0,
  }
}

/** A CSS duration token (e.g. --dur-count) in seconds. */
export function durationToken(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw.endsWith('ms') ? parseFloat(raw) / 1000 : parseFloat(raw) || 0
}

/** A cubic-bezier easing token (e.g. --ease-out) as the 4-number list Motion expects. */
export function easeToken(name: string): [number, number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  const n = raw.match(/-?[\d.]+/g)?.map(Number) ?? []
  const [a, b, c, d] = n
  return a !== undefined && b !== undefined && c !== undefined && d !== undefined ? [a, b, c, d] : [0.23, 1, 0.32, 1]
}

/** A plain-number token (e.g. --tilt-max). */
export function numberToken(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}
