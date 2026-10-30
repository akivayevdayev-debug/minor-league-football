/**
 * Score totals from score lines. The database view does the same sum for standings;
 * this copy lets a screen update the moment a score is added (optimistic update).
 */
export interface ScoreLine {
  teamId: string
  points: number
  voided: boolean
}

export type Result = 'home' | 'away' | 'tie'

export interface GameScore {
  home: number
  away: number
  result: Result
}

export function gameScore(homeId: string, awayId: string, lines: readonly ScoreLine[]): GameScore {
  let home = 0
  let away = 0
  for (const line of lines) {
    if (line.voided) continue
    if (line.teamId === homeId) home += line.points
    else if (line.teamId === awayId) away += line.points
  }
  const result: Result = home > away ? 'home' : away > home ? 'away' : 'tie'
  return { home, away, result }
}
