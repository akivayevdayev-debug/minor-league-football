import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/*
 * shadcn/ui Button, restyled to MLF tokens.
 * primary = the white capsule (one per screen). team = filled with the team colour (set --team inline).
 * secondary = glass. outline / ghost / danger for quieter actions.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 font-strong whitespace-nowrap select-none outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'pressable sheen rounded-pill bg-primary text-primary-ink shadow-glass hover-fine:brightness-95',
        team: 'pressable rounded-pill bg-(--team,var(--primary)) text-primary-ink shadow-glass hover-fine:brightness-110',
        secondary: 'pressable lit glass-subtle rounded-control text-text hover-fine:border-border-strong',
        outline:
          'pressable rounded-control border border-border-strong bg-transparent text-text hover-fine:border-text-2 hover-fine:bg-(--row-hover)',
        ghost: 'pressable rounded-control bg-transparent text-text-2-strong hover-fine:bg-(--row-hover) hover-fine:text-text',
        danger: 'pressable rounded-control border border-transparent bg-transparent text-danger hover-fine:border-danger',
      },
      size: {
        sm: 'min-h-(--control-h-sm) px-3 text-small',
        md: 'min-h-(--control-h) px-4 text-body',
        xl: 'min-h-(--tap-game) px-6 text-body-lg',
        icon: 'size-(--control-h) rounded-pill',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button }
