import { useRef, type ReactNode } from 'react'
import { houseSpring, numberToken } from './spring'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

/** A hero card that tilts gently under the mouse (decorative; mouse only, off for reduced motion). */
export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const { duration, bounce } = houseSpring()
  const sx = useSpring(x, { duration, bounce })
  const sy = useSpring(y, { duration, bounce })
  const max = numberToken('--tilt-max')
  const depth = numberToken('--tilt-perspective')
  const transform = useTransform(
    [sx, sy],
    ([a, b]) => `perspective(${depth}px) rotateX(${(b as number) * -max}deg) rotateY(${(a as number) * max}deg)`,
  )

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ transform }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - r.left) / r.width - 0.5)
        y.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}
