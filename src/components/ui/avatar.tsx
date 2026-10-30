import * as React from 'react'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/* shadcn/ui Avatar: round frame with a photo, falling back to initials or a number. */
function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex shrink-0 overflow-hidden rounded-pill select-none', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn('aspect-square size-full object-cover', className)} {...props} />
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('flex size-full items-center justify-center rounded-pill bg-panel-2 text-text', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
