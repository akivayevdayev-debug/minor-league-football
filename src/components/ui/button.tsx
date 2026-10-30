import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

/* shadcn/ui Button, restyled to MLF tokens. Primary = glowing cyan (one per screen). */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-strong whitespace-nowrap select-none outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'magnetic sheen bg-accent text-accent-ink shadow-glow hover-fine:shadow-glow hover-fine:brightness-110',
        secondary:
          'pressable lit glass-subtle text-text hover-fine:border-border-strong',
        outline: 'pressable border border-border-strong bg-transparent text-text hover-fine:border-accent hover-fine:text-accent',
        ghost: 'pressable bg-transparent text-text-2 hover-fine:bg-(--row-hover) hover-fine:text-text',
        danger: 'pressable border border-transparent bg-transparent text-danger hover-fine:border-danger',
      },
      size: {
        md: 'min-h-(--tap-min) px-4 text-body',
        xl: 'min-h-(--tap-game) px-6 text-body-lg',
        icon: 'size-(--tap-min)',
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
