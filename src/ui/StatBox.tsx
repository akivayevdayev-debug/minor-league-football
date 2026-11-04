import { CountUp } from './motion'

/**
 * One small number with a caps label: PF, Rank, Catches... Compact on purpose (a tile in a tight strip).
 * `title` gives the long name on hover and to screen readers when the short label is an abbreviation.
 * `xl` sets the number in the big `numeral-xl` size (a tile that is the hero of its strip).
 * `from` is passed to CountUp: 'previous' counts from the last value shown instead of from zero.
 */
export function StatBox({
  label,
  value,
  count = false,
  accent = false,
  xl = false,
  from,
  title,
  className,
}: {
  label: string
  value: number | string
  count?: boolean
  accent?: boolean
  xl?: boolean
  from?: 'zero' | 'previous'
  title?: string
  className?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className ?? ''}`} title={title}>
      <dt className="caps-label truncate">{label}</dt>
      <dd className={`${xl ? 'numeral-xl' : 'numeral text-title'} ${accent ? 'text-accent' : 'text-text'}`}>
        {count && typeof value === 'number' ? <CountUp value={value} from={from} /> : <span className="nums">{value}</span>}
      </dd>
    </div>
  )
}
