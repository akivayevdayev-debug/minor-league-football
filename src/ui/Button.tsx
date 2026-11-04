import type { ButtonHTMLAttributes } from 'react'
import { Button as ShadButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'team' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'xl' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** sm = 30 px chip, md = 38 px (normal screens), xl = 56 px (game screens), icon = 38 px circle. */
  size?: Size
  loading?: boolean
}

/** One primary (white capsule) button per screen. Built on the shadcn Button. */
export function Button({ variant = 'secondary', size = 'md', loading = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <ShadButton
      type="button"
      variant={variant}
      size={size}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('relative', className)}
    >
      {/* While busy, the label keeps its space (hidden) and a spinner sits centred on top, so the button
          never changes size or shifts its text. */}
      <span className={cn('inline-flex items-center justify-center gap-2', loading && 'invisible')}>{children}</span>
      {loading && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="size-(--icon-xs) animate-spin rounded-pill border-2 border-current border-r-transparent motion-reduce:animate-none" />
        </span>
      )}
    </ShadButton>
  )
}
