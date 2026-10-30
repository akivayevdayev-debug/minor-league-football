import type { CSSProperties } from 'react'

/**
 * A thin bar that grows from the left once (win chance, share of stats).
 * value is 0..1. Colour comes from --team on a parent, else white.
 */
export function Bar({ value, index = 0, className, tone = 'team' }: { value: number; index?: number; className?: string; tone?: 'team' | 'muted' }) {
  const fill = Math.max(0, Math.min(1, value))
  return (
    <span aria-hidden="true" className={`block h-(--bar-height) overflow-hidden rounded-pill bg-(--row-hover) ${className ?? ''}`}>
      <span
        className={`bar-fill block h-full rounded-pill ${tone === 'team' ? 'bg-(--team,var(--primary))' : 'bg-text-3'}`}
        style={{ '--fill': fill, '--i': index } as CSSProperties}
      />
    </span>
  )
}

/** Two teams' chances side by side: home fills from the left in its colour, away from the right in its colour. */
export function SplitBar({ home, homeStyle, awayStyle }: { home: number; homeStyle: CSSProperties; awayStyle: CSSProperties }) {
  const h = Math.max(0, Math.min(1, home))
  return (
    <span aria-hidden="true" className="flex h-(--bar-height) gap-1 overflow-hidden rounded-pill">
      <span className="h-full rounded-pill" style={{ ...homeStyle, flexGrow: h, flexBasis: 0, background: 'var(--team)' }} />
      <span className="h-full rounded-pill" style={{ ...awayStyle, flexGrow: 1 - h, flexBasis: 0, background: 'var(--team)' }} />
    </span>
  )
}
