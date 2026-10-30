import * as React from 'react'
import { cn } from '@/lib/utils'

/* shadcn/ui Skeleton: a calm placeholder block (opacity breathing; still for reduced motion). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-control bg-panel motion-reduce:animate-none', className)} {...props} />
}

export { Skeleton }
