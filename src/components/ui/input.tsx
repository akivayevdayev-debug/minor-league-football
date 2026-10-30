import * as React from 'react'
import { cn } from '@/lib/utils'

/* shadcn/ui Input, restyled: inset glass field with a cyan focus glow (see .field-control). */
function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input data-slot="input" className={cn('field-control', className)} {...props} />
}

export { Input }
