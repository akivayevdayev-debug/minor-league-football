import type { ReactNode } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'

interface SheetProps {
  open: boolean
  onOpenChange(open: boolean): void
  title: string
  description?: string
  children: ReactNode
  /** Sticky action row at the bottom (e.g. Save). */
  footer?: ReactNode
}

/** Bottom sheet (shadcn Drawer on vaul): strong glass, drag handle, drag to close, sticky footer. */
export function Sheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="flex flex-col gap-1 px-5 pt-4">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className={description ? undefined : 'sr-only'}>{description ?? title}</DrawerDescription>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="flex gap-2 border-t border-divider px-5 py-3">{footer}</div>}
      </DrawerContent>
    </Drawer>
  )
}
