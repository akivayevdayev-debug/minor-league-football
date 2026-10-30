import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '@/lib/utils'

/* shadcn/ui Drawer (vaul), restyled to MLF tokens: strong glass, drag handle, scrim. */
const Drawer = (props: React.ComponentProps<typeof DrawerPrimitive.Root>) => <DrawerPrimitive.Root data-slot="drawer" {...props} />
const DrawerPortal = DrawerPrimitive.Portal
const DrawerClose = DrawerPrimitive.Close

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return <DrawerPrimitive.Overlay data-slot="drawer-overlay" className={cn('fixed inset-0 z-(--z-sheet) bg-(--scrim) backdrop-blur-[var(--glass-subtle-blur)]', className)} {...props} />
}

function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          'glass-strong safe-bottom fixed inset-x-0 bottom-0 z-(--z-sheet) mx-auto flex max-h-(--sheet-max) max-w-(--content-max) flex-col rounded-t-hero border-b-0 outline-none md:bottom-(--nav-inset) md:rounded-hero md:border-b',
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-text-3" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title data-slot="drawer-title" className={cn('text-title font-strong tracking-tight', className)} {...props} />
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description data-slot="drawer-description" className={cn('text-small text-text-2-strong', className)} {...props} />
}

export { Drawer, DrawerPortal, DrawerOverlay, DrawerClose, DrawerContent, DrawerTitle, DrawerDescription }
