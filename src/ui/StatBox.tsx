import { CountUp } from './motion'

/**
 * One small number with a caps label: PF, Rank, Catches... Compact on purpose (a tile in a tight strip).
 * `title` gives the long name on hover and to screen readers when the short label is an abbreviation.
 */
export function StatBox({
  label,
  value,
  count = false,
  accent = false,
  title,
}: {
  label: string
  value: number | string
  count?: boolean
  accent?: boolean
  title?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={title}>
      <dt className="caps-label truncate">{label}</dt>
      <dd className={`numeral text-title ${accent ? 'text-accent' : 'text-text'}`}>
        {count && typeof value === 'number' ? <CountUp value={value} /> : <span className="nums">{value}</span>}
      </dd>
    </div>
  )
}
