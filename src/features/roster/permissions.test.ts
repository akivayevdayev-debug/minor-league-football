import { describe, expect, it } from 'vitest'
import type { Member } from '../auth/auth-context'
import type { Player, Team } from '../../types/db'
import { canDecideTrades, canEditPlayer, canEditTeam, canMovePlayers, isCaptainOf } from './permissions'

const member = (over: Partial<Member> = {}): Member => ({
  playerId: 'me',
  isLeagueManager: false,
  isOwner: false,
  mustChangePassword: false,
  ...over,
})

const team = (over: Partial<Pick<Team, 'captain_player_id' | 'co_captain_player_id'>> = {}) => ({
  captain_player_id: 'cap',
  co_captain_player_id: 'co',
  ...over,
})

const asPlayer = (login_name: string | null): Pick<Player, 'login_name'> => ({ login_name })

describe('isCaptainOf', () => {
  it('is true for either captain slot', () => {
    expect(isCaptainOf(team(), 'cap')).toBe(true)
    expect(isCaptainOf(team(), 'co')).toBe(true)
  })

  it('is false for anyone else', () => {
    expect(isCaptainOf(team(), 'someone')).toBe(false)
  })

  it('is false when the team has no co-captain and the player is not the captain', () => {
    expect(isCaptainOf(team({ co_captain_player_id: null }), 'co')).toBe(false)
  })
})

describe('canDecideTrades', () => {
  it('allows Eddie (league manager)', () => {
    expect(canDecideTrades(member({ isLeagueManager: true }), asPlayer('eddie'))).toBe(true)
  })

  it('allows Maurice by login name', () => {
    expect(canDecideTrades(member(), asPlayer('maurice'))).toBe(true)
  })

  it('allows the owner', () => {
    expect(canDecideTrades(member({ isOwner: true }), asPlayer('akiva'))).toBe(true)
  })

  it('refuses a captain who is not Eddie, Maurice or the owner', () => {
    expect(canDecideTrades(member(), asPlayer('ben'))).toBe(false)
  })

  it('refuses when the player record is missing', () => {
    expect(canDecideTrades(member(), undefined)).toBe(false)
  })
})

describe('canMovePlayers', () => {
  it('allows the owner and the league manager', () => {
    expect(canMovePlayers(member({ isOwner: true }))).toBe(true)
    expect(canMovePlayers(member({ isLeagueManager: true }))).toBe(true)
  })

  it('refuses a captain', () => {
    expect(canMovePlayers(member())).toBe(false)
  })
})

describe('canEditTeam', () => {
  const t = { id: 't1', ...team() } as Team

  it('allows the owner for any team', () => {
    expect(canEditTeam(member({ isOwner: true, playerId: 'x' }), t)).toBe(true)
  })

  it('allows the team captains', () => {
    expect(canEditTeam(member({ playerId: 'cap' }), t)).toBe(true)
    expect(canEditTeam(member({ playerId: 'co' }), t)).toBe(true)
  })

  it('refuses the league manager who is not a captain', () => {
    expect(canEditTeam(member({ isLeagueManager: true, playerId: 'x' }), t)).toBe(false)
  })

  it('refuses a captain of a different team', () => {
    expect(canEditTeam(member({ playerId: 'other' }), t)).toBe(false)
  })
})

describe('canEditPlayer', () => {
  it('lets a player edit only their own details', () => {
    expect(canEditPlayer(member(), 'me')).toBe(true)
    expect(canEditPlayer(member(), 'someone')).toBe(false)
  })

  it('lets the owner and Eddie edit anyone', () => {
    expect(canEditPlayer(member({ isOwner: true }), 'someone')).toBe(true)
    expect(canEditPlayer(member({ isLeagueManager: true }), 'someone')).toBe(true)
  })
})
