/*
 * Who can do what on the roster screens. These only hide buttons; the database checks every action too.
 */
import type { Member } from '../auth/auth-context'
import type { Player, Team } from '../../types/db'

/** True when this player is either captain slot of the team (a team can have two captains). */
export function isCaptainOf(team: Pick<Team, 'captain_player_id' | 'co_captain_player_id'>, playerId: string): boolean {
  return team.captain_player_id === playerId || team.co_captain_player_id === playerId
}

/** Eddie (league manager), Maurice (login name "maurice") and the owner answer trades. */
export function canDecideTrades(member: Member, me: Pick<Player, 'login_name'> | undefined): boolean {
  return member.isOwner || member.isLeagueManager || me?.login_name === 'maurice'
}

/** Only the owner and Eddie move players directly. Captains offer trades instead. */
export function canMovePlayers(member: Member): boolean {
  return member.isOwner || member.isLeagueManager
}

/** The owner, or a captain of that team, can change its name, short name and logo. */
export function canEditTeam(member: Member, team: Pick<Team, 'captain_player_id' | 'co_captain_player_id'>): boolean {
  return member.isOwner || isCaptainOf(team, member.playerId)
}
