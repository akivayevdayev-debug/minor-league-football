import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* shadcn/ui Badge: small uppercase chips. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-chip border px-2 py-1 text-label font-strong tracking-label uppercase whitespace-nowrap [&>svg]:size-(--icon-xs)',
  {
    variants: {
      variant: {
        outline: 'border-border-strong text-text-2-strong',
        accent: 'border-transparent bg-accent-soft text-accent',
        live: 'border-transparent bg-accent text-accent-ink shadow-glow-soft',
        muted: 'border-transparent bg-(--row-hover) text-text-2',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
