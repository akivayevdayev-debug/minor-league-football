import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * tailwind-merge only knows Tailwind's default scale. Our sizes (text-body, text-label...)
 * are custom, so without this it mistakes `text-body` for a colour and drops `text-accent-ink`.
 * Keep these lists in step with the @theme block in src/styles/index.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['label', 'small', 'body', 'body-lg', 'title', 'stat', 'headline', 'score', 'display'],
      radius: ['chip', 'control', 'panel', 'hero', 'pill'],
      font: ['normal', 'medium', 'strong', 'bold', 'black'],
      tracking: ['label', 'brand', 'display', 'tight', 'normal'],
      leading: ['none', 'tight', 'body'],
      shadow: ['glow', 'glow-soft', 'glass'],
    },
  },
})

/** Joins class names and lets later Tailwind classes win (shadcn/ui helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
