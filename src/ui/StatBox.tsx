import { CountUp } from './motion'

/** One number with a small label: PF, PA, Record, Rank, REC... */
export function StatBox({ label, value, count = false, accent = false }: { label: string; value: number | string; count?: boolean; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="caps-label truncate">{label}</dt>
      <dd className={`numeral text-stat ${accent ? 'text-accent text-glow' : 'text-text'}`}>
        {count && typeof value === 'number' ? <CountUp value={value} /> : <span className="nums">{value}</span>}
      </dd>
    </div>
  )
}
