import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/* shadcn/ui Label: small caps with wide tracking. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn('caps-label select-none', className)} {...props} />
}

export { Label }
