/*
 * Who plays quarterback for each team, asked once before a game's first start. Each team's last
 * quarterback is filled in, so most nights it is one tap per team. Game-screen buttons: at least
 * 56 px, press scale only.
 */
import { displayName } from '../league'
import type { Player, Team } from '../../types/db'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { teamStyle } from '../../ui/team'

export interface QbPicks {
  home?: string
  away?: string
}

export function QbPickSheet({ open, onOpenChange, home, away, candidates, defaults, picks, onPick, onConfirm, busy }: {
  open: boolean
  onOpenChange(open: boolean): void
  home: Team
  away: Team
  candidates: Player[]
  /** Each side's last quarterback, filled in until the user picks. */
  defaults: QbPicks
  picks: QbPicks
  onPick(side: keyof QbPicks, playerId: string): void
  onConfirm(home: string, away: string): void
  busy: boolean
}) {
  const sides = [
    { side: 'home' as const, team: home },
    { side: 'away' as const, team: away },
  ]
  const value = (side: keyof QbPicks) => picks[side] ?? defaults[side]
  const homeQb = value('home')
  const awayQb = value('away')
  const ready = !!homeQb && !!awayQb
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Who plays QB?"
      description="Maurice and Eddie play for no team. Pick one for each side."
      footer={
        <Button variant="primary" size="xl" className="flex-1" disabled={!ready} loading={busy} onClick={() => ready && onConfirm(homeQb, awayQb)}>
          {ready ? 'Go live' : 'Pick a QB for each team'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {sides.map(({ side, team }) => {
          const current = value(side)
          return (
            <fieldset key={side} style={teamStyle(team.color_key)} className="flex flex-col gap-2">
              <legend className="mb-2 display-caps text-body-lg text-(--team-light)">Who plays QB for {team.name}?</legend>
              <div role="radiogroup" aria-label={`${team.name}: quarterback`} className="grid grid-cols-2 gap-2">
                {candidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={current === p.id}
                    onClick={() => onPick(side, p.id)}
                    className={`pressable min-h-(--tap-game) truncate rounded-panel px-2 font-strong ${current === p.id ? 'bg-(--team) text-primary-ink' : 'surface-inset'}`}
                  >
                    {displayName(p)}
                  </button>
                ))}
              </div>
            </fieldset>
          )
        })}
      </div>
    </Sheet>
  )
}
