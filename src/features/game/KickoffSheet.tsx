/*
 * Who sits first. Two play at once, so a team of three picks one to start on the bench.
 * The pick from the team's last game is filled in, so most nights it is one tap.
 */
import { useEffect } from 'react'
import { displayName } from '../league'
import type { Player, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { teamStyle } from '../../ui/team'
import { useLastBench } from './lineup'

/** One team's "who sits?" buttons. Game-screen buttons: at least 56 px, press scale only. */
export function BenchPicker({ team, roster, gameId, value, onChange }: {
  team: Team
  roster: Player[]
  gameId: string
  value: string | undefined
  onChange(playerId: string): void
}) {
  const last = useLastBench(team.id, gameId, roster.map((p) => p.id))
  useEffect(() => {
    if (!value && last.data) onChange(last.data)
  }, [last.data, value, onChange])

  return (
    <fieldset style={teamStyle(team.color_key)} className="flex flex-col gap-2">
      <legend className="mb-2 display-caps text-body-lg text-(--team-light)">{team.name} · who sits?</legend>
      <div role="radiogroup" aria-label={`${team.name}: who sits`} className="grid grid-cols-3 gap-2">
        {roster.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            onClick={() => onChange(p.id)}
            className={`pressable min-h-(--tap-game) truncate rounded-panel px-2 font-strong ${value === p.id ? 'bg-(--team) text-primary-ink' : 'surface-inset'}`}
          >
            {displayName(p)}
          </button>
        ))}
      </div>
      {last.data && value === last.data && <p className="text-small text-text-2">Same as last game.</p>}
    </fieldset>
  )
}

export function KickoffSheet({ open, onOpenChange, gameId, teams, picks, onPick, onStart, busy }: {
  open: boolean
  onOpenChange(open: boolean): void
  gameId: string
  teams: { team: Team; roster: Player[] }[]
  picks: Record<string, string>
  onPick(teamId: string, playerId: string): void
  onStart(): void
  busy: boolean
}) {
  const ready = teams.every(({ team }) => picks[team.id])
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Who sits first?"
      description="Two from each team play at once. Pick who starts on the bench; you can sub any time."
      footer={
        <Button variant="primary" size="xl" className="flex-1" disabled={!ready} loading={busy} onClick={onStart}>
          {ready ? 'Start game' : 'Pick who sits for each team'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {teams.map(({ team, roster }) => (
          <BenchPicker key={team.id} team={team} roster={roster} gameId={gameId} value={picks[team.id]} onChange={(pid) => onPick(team.id, pid)} />
        ))}
      </div>
    </Sheet>
  )
}
