import { Icon } from './Icon'

/**
 * The MLF wordmark: a gold football mark and letter-spaced name. The glow is kept for the large
 * size only, so the small mark stays crisp.
 */
export function BrandMark({ size = 'md', subtitle = false }: { size?: 'md' | 'lg'; subtitle?: boolean }) {
  const lg = size === 'lg'
  return (
    <span className="inline-flex flex-col items-center gap-1.5">
      <span className="inline-flex items-center gap-2">
        <span className={`flex items-center justify-center text-accent ${lg ? 'text-glow' : ''}`}>
          <Icon name="games" size={lg ? 'lg' : 'sm'} filled />
        </span>
        <span className={`brand-type text-text ${lg ? 'text-headline' : 'text-title'} leading-none`}>MLF</span>
      </span>
      {subtitle && <span className="caps-label">Minor League Football</span>}
    </span>
  )
}
