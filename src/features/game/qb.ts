/*
 * The league's two quarterbacks (Maurice and Eddie play for no team) and the default pick for each
 * team, taken from the team's last game that has started.
 */
import type { Game, Player } from '../../types/db'

/** Logins of the league's quarterbacks, in the order they are offered. */
export const QB_LOGINS = ['maurice', 'eddie'] as const

/** The players who can be picked as a quarterback. */
export function qbCandidates(players: Player[]): Player[] {
  const rank = (p: Player) => QB_LOGINS.indexOf(p.login_name as (typeof QB_LOGINS)[number])
  return players.filter((p) => !p.voided_at && rank(p) >= 0).sort((a, b) => rank(a) - rank(b))
}

/**
 * The QB a team used most recently: from its latest game that has started (live, halftime or final)
 * and recorded a QB for this team's side. Null when there is none.
 */
export function lastQbFor(teamId: string, games: Game[]): string | null {
  const earlier = games
    .filter((g) => !g.voided_at && g.status !== 'scheduled' && (g.home_team_id === teamId || g.away_team_id === teamId))
    .map((g) => ({ g, qb: g.home_team_id === teamId ? g.home_qb_id : g.away_qb_id }))
    .filter((x): x is { g: Game; qb: string } => !!x.qb)
    .sort((a, b) => (b.g.starts_at ?? '').localeCompare(a.g.starts_at ?? '') || (b.g.week ?? 0) - (a.g.week ?? 0))
  return earlier[0]?.qb ?? null
}
