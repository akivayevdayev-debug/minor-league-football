// Makes the PNG app icons from public/icon.svg. Run once after changing the icon:
//   npx pwa-assets-generator
// The SVG is already full-bleed with the letters inside the maskable safe area, so no padding.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const dark = { padding: 0, resizeOptions: { background: '#050B14', fit: 'contain' } }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: { ...minimal2023Preset, transparent: { ...minimal2023Preset.transparent, ...dark }, maskable: { ...minimal2023Preset.maskable, ...dark }, apple: { ...minimal2023Preset.apple, ...dark } },
  images: ['public/icon.svg'],
})
