import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Repeats --bg from tokens.css: the manifest cannot read CSS.
const BG = '#050B14'

export default defineConfig({
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // show "New version ready" instead of swapping code mid-game
      injectRegister: false,
      manifest: {
        name: 'Minor League Football',
        short_name: 'MLF',
        description: 'Private league app for friends.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: BG,
        theme_color: BG,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell is cached. Data and logins are never cached (frontend plan, section 9).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
