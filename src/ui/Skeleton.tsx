import { Skeleton as Block } from '@/components/ui/skeleton'

/** Loading placeholder rows shaped like list rows, so nothing jumps when data arrives. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Block key={i} className="h-(--tap-game)" />
      ))}
    </div>
  )
}
