/*
 * Turns on the liquid-glass lens (SVG refraction in backdrop-filter) where it works: Chromium
 * browsers. Safari and Firefox keep plain frosted glass. Off for reduced transparency.
 */
export function installGlassLens(): void {
  if (typeof window === 'undefined') return
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? []
  const chromium = brands.some((b) => b.brand === 'Chromium')
  if (chromium && !window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
    document.documentElement.classList.add('lg-refract')
  }
}
