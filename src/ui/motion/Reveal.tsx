import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { durationToken, easeToken, numberToken } from './spring'

/** Fades and rises into view the first time it scrolls on screen (once per visit). */
export function Reveal({ children, className, index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  const reduce = useReducedMotion()
  const rise = numberToken('--rise')
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, transform: reduce ? 'none' : `translateY(${rise}px)` }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: durationToken('--dur-rise'), ease: easeToken('--ease-out'), delay: index * durationToken('--stagger') }}
    >
      {children}
    </motion.div>
  )
}
