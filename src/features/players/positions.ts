/**
 * Positions are a list. People type them with commas ("Corner, WR") or just spaces ("WR CB HB"),
 * so a run of short codes is split into separate positions, while a written-out name like
 * "Right guard" stays one position.
 */
const CODE = /^[A-Za-z0-9]{1,3}$/

export function splitPositions(list: string[]): string[] {
  return list
    .flatMap((entry) => entry.split(','))
    .flatMap((entry) => {
      const words = entry.trim().split(/\s+/).filter(Boolean)
      return words.length > 1 && words.every((w) => CODE.test(w)) ? words : [words.join(' ')]
    })
    .filter(Boolean)
}
