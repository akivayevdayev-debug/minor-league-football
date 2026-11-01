import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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

/**
 * Segmented control (shadcn/Radix Tabs) with a glass pill that slides to the chosen option.
 * The pill is one element that is measured from the buttons' own positions (not a shared layout
 * animation), so the first press slides from where the pill really is, even while the screen is
 * still sliding in.
 */
export function Segmented<T extends string>({ label, value, onChange, options, children, className }: SegmentedProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const on = list.querySelector<HTMLElement>('[data-state="active"]')
      if (on) setPill((old) => (old && old.x === on.offsetLeft && old.width === on.offsetWidth ? old : { x: on.offsetLeft, width: on.offsetWidth }))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(list)
    return () => watch.disconnect()
  }, [value, options])

  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} className={cn('flex flex-col gap-4', className)}>
      <TabsPrimitive.List
        ref={listRef}
        aria-label={label}
        className="glass-bar relative grid auto-cols-fr grid-flow-col gap-1 rounded-pill p-1"
      >
        {pill && (
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{ transform: `translateX(${pill.x}px)`, width: pill.width }}
            transition={houseSpring()}
            className="absolute inset-y-1 left-0 rounded-pill bg-(--lens-fill) shadow-(--glass-specular) border border-(--glass-edge)"
          />
        )}
        {options.map((o) => (
          <TabsPrimitive.Trigger
            key={o.value}
            value={o.value}
            className={cn(
              'pressable relative min-h-(--tap-min) rounded-pill px-3 text-small font-strong whitespace-nowrap text-text-2-strong',
              o.value === value ? 'text-text' : 'hover-fine:text-text',
            )}
          >
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
