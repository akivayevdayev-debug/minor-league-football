import type { Game } from '../../types/db'

/**
 * Each team's current streak from its final games, newest last: "W3", "L1", "T1".
 * Teams with no final game are left out. Voided games and games with no score don't count.
 */
export function streaks(games: Game[], scores: Map<string, { home_points: number; away_points: number }>): Map<string, string> {
  const finals = games
    .filter((g) => g.status === 'final' && !g.voided_at && g.home_team_id && g.away_team_id && scores.has(g.id))
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  const results = new Map<string, ('W' | 'L' | 'T')[]>()
  for (const g of finals) {
    const s = scores.get(g.id)!
    const home = s.home_points > s.away_points ? 'W' : s.home_points < s.away_points ? 'L' : 'T'
    const away = home === 'W' ? 'L' : home === 'L' ? 'W' : 'T'
    results.set(g.home_team_id!, [...(results.get(g.home_team_id!) ?? []), home])
    results.set(g.away_team_id!, [...(results.get(g.away_team_id!) ?? []), away])
  }
  const out = new Map<string, string>()
  for (const [team, list] of results) {
    const last = list.at(-1)!
    let n = 0
    for (let i = list.length - 1; i >= 0 && list[i] === last; i--) n++
    out.set(team, `${last}${n}`)
  }
  return out
}
