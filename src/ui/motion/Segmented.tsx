import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { houseSpring } from './spring'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  onChange(value: NoInfer<T>): void
  options: readonly Option<NoInfer<T>>[]
  /** <SegmentedPanel value=...> children. */
  children?: ReactNode
  className?: string
}

/** Segmented control (shadcn/Radix Tabs) with a white pill that slides to the chosen option. */
export function Segmented<T extends string>({ label, value, onChange, options, children, className }: SegmentedProps<T>) {
  const pillId = useId()
  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} className={cn('flex flex-col gap-4', className)}>
      <TabsPrimitive.List
        aria-label={label}
        className="glass-subtle grid auto-cols-fr grid-flow-col gap-1 rounded-pill p-1"
      >
        {options.map((o) => (
          <TabsPrimitive.Trigger
            key={o.value}
            value={o.value}
            className={cn(
              'pressable relative min-h-(--tap-min) rounded-pill px-3 text-small font-strong whitespace-nowrap text-text-2-strong',
              o.value === value ? 'text-text' : 'hover-fine:text-text',
            )}
          >
            {o.value === value && (
              <motion.span
                layoutId={pillId}
                transition={houseSpring()}
                aria-hidden="true"
                className="absolute inset-0 rounded-pill bg-(--press-fill) shadow-(--glass-specular) border border-(--glass-edge)"
              />
            )}
            <span className={cn('relative', o.value === value && 'text-text font-strong')}>{o.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function SegmentedPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className="outline-none">
      {children}
    </TabsPrimitive.Content>
  )
}
