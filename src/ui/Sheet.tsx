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
      {/* Sheets keep their blur. glass-strong and sheet-glass (rim and lift) come from DrawerContent, glass-shine adds the highlight.
          glass-appear sits on an inner wrapper, not on DrawerContent: vaul moves DrawerContent with its own transform. */}
      <DrawerContent className="glass-shine">
        <div className="glass-appear flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-1 border-b border-divider px-4 pt-3 pb-3">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className={description ? undefined : 'sr-only'}>{description ?? title}</DrawerDescription>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        </div>
        {footer && <div className="flex gap-2 border-t border-divider px-4 py-3">{footer}</div>}
      </DrawerContent>
    </Drawer>
  )
}
