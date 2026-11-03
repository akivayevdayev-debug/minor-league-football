/*
 * Sideways phone on game night: the clock fills the middle on a solid surface,
 * each team's score and score buttons sit on its own side. Same handlers as the upright screen.
 * Hard rules: no animation beyond the press scale, every button at least 56 px tall.
 */
import type { ReactNode } from 'react'
import type { Team } from '../../types/db'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'

export interface ScoreKey {
  type: 'td' | 'conv1' | 'conv2' | 'safety'
  label: string
  points: number
}

interface Props {
  home: Team
  away: Team
  score: { home: number; away: number }
  /** Clock text, e.g. "4:12". */
  time: string
  expired: boolean
  statusLabel: string
  scores: readonly ScoreKey[]
  onScore(team: Team, type: ScoreKey['type']): void
  /** Start, pause, halftime and end buttons from the game screen. */
  controls: ReactNode
}

export function LandscapeClock({ home, away, score, time, expired, statusLabel, scores, onScore, controls }: Props) {
  const side = (team: Team, pts: number) => (
    <section aria-label={`${team.name} score`} style={teamStyle(team.color_key)} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <TeamBadge team={team} size="sm" />
        <span className="truncate display-caps text-body-lg text-(--team-light)">{team.short_name}</span>
        <span className="ml-auto numeral text-headline text-text" aria-live="polite">{pts}</span>
      </div>
      {scores.map((s) => (
        <button
          key={s.type}
          type="button"
          onClick={() => onScore(team, s.type)}
          className="pressable score-key flex min-h-(--tap-game) items-center justify-between rounded-panel bg-(--team) px-4 text-primary-ink"
        >
          <span className="display-caps text-title">{s.label}</span>
          <span className="numeral text-stat">+{s.points}</span>
        </button>
      ))}
    </section>
  )

  return (
    <main className="still grid min-h-dvh grid-cols-[1fr_minmax(0,1.2fr)_1fr] items-start gap-3 px-4 py-3">
      {side(home, score.home)}
      <section aria-label="Clock" className="flex flex-col gap-2">
        <div className="flex flex-col items-center gap-1 rounded-panel surface-inset px-3 py-2">
          <span className="caps-label">{statusLabel}</span>
          <span role="timer" aria-label={`${time} left`} className={`numeral text-score ${expired ? 'text-danger' : 'text-text'}`}>
            {time}
          </span>
        </div>
        {controls}
      </section>
      {side(away, score.away)}
    </main>
  )
}
