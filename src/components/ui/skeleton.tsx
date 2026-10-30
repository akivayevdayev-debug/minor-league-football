import * as React from 'react'
import { cn } from '@/lib/utils'

/* shadcn/ui Skeleton: a placeholder block with a slow light sweep (slower still for reduced motion). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('shimmer rounded-control', className)} {...props} />
}

export { Skeleton }
