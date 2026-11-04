/*
 * Win chance for the Team tab's matchup card. Each side's expected final score is the points so far
 * plus its projection for the time left; the chance is the normal curve over the gap between them.
 * Pure functions, tested without a database.
 */

/** Points of standard deviation for a full game: a 10-point projected gap gives about a 75% chance. */
export const WIN_SPREAD = 15

/**
 * Share of the game still to play, from 1 (not started) to 0 (final). Halftime counts as half.
 * Live: the second half is always to come, plus whatever is left of the first half.
 */
export function remainingShare(input: { status: string; half: number | null; secondsLeft: number | null; halfMinutes: number }): number {
  const { status, half, secondsLeft, halfMinutes } = input
  if (status === 'scheduled') return 1
  if (status === 'final') return 0
  if (status === 'halftime') return 0.5
  if (secondsLeft === null) return 0.5
  const halfSec = halfMinutes * 60
  const share = half === 1 ? (secondsLeft + halfSec) / (2 * halfSec) : secondsLeft / (2 * halfSec)
  return clamp01(share)
}

/** Chance (0 to 1) that `mine` finishes ahead of `theirs`, given the share of the game still to play. */
export function winChance(
  mine: { projected: number; actual: number | null },
  theirs: { projected: number; actual: number | null },
  share: number,
): number {
  const expMine = (mine.actual ?? 0) + mine.projected * share
  const expTheirs = (theirs.actual ?? 0) + theirs.projected * share
  if (share === 0) return expMine > expTheirs ? 1 : expMine < expTheirs ? 0 : 0.5
  const sigma = WIN_SPREAD * Math.sqrt(share)
  return clamp01(phi((expMine - expTheirs) / sigma))
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Standard normal CDF, via erf (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
function phi(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-ax * ax))
}
