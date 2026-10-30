import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* shadcn/ui Badge: small uppercase chips. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-pill border px-2.5 py-1 text-label font-strong tracking-label uppercase whitespace-nowrap [&>svg]:size-(--icon-xs)',
  {
    variants: {
      variant: {
        outline: 'border-border-strong text-text-2-strong',
        accent: 'border-transparent bg-accent-soft text-accent',
        live: 'border-transparent bg-live text-text',
        gold: 'border-transparent bg-gold-soft text-gold',
        estimate: 'border-dashed border-border-strong text-text-2-strong normal-case tracking-normal font-medium',
        muted: 'border-transparent bg-(--row-hover) text-text-2-strong',
        team: 'border-transparent bg-[color-mix(in_srgb,var(--team)_22%,transparent)] text-(--team-light)',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
