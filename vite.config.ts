import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Repeats --bg from tokens.css: the manifest cannot read CSS.
const BG = '#08090b'

declare const process: { env: Record<string, string | undefined> }

// One id per deploy (the GitHub commit Cloudflare builds; a timestamp for local builds).
// The photo cache is named after it, so every new commit starts with a fresh photo cache.
const BUILD_ID = (process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? String(Date.now())).slice(0, 12)
const PHOTO_CACHE = `mlf-photos-${BUILD_ID}`

/** Tiny script the service worker loads: on activation it deletes the photo caches of older deploys. */
function photoCacheCleanup(): Plugin {
  return {
    name: 'mlf-photo-cache-cleanup',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw-photo-cleanup.js',
        source: `self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((names) =>
  Promise.all(names.filter((n) => n.startsWith('mlf-photos-') && n !== '${PHOTO_CACHE}').map((n) => caches.delete(n))))))\n`,
      })
    },
  }
}

export default defineConfig({
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname) } },
  plugins: [
    react(),
    tailwindcss(),
    photoCacheCleanup(),
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
        // The app shell (code, styles, fonts, icons, stadium pictures) is saved on the phone and replaced on every
        // new deploy. Data and logins are never cached (frontend plan, section 9): stats, scores, the clock and
        // live updates always go to the network, so they stay instant.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webp}'],
        navigateFallback: 'index.html',
        importScripts: ['sw-photo-cleanup.js'],
        runtimeCaching: [
          {
            // Team logos, player photos and team photos. Their links carry a one-hour login token, so the cache
            // key drops the token: the same photo is found again on the next visit. Files are never overwritten
            // (each upload gets a new name), so a saved photo can't go stale.
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/sign/photos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: PHOTO_CACHE,
              expiration: { maxEntries: 150, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Fetch with CORS so the saved copy is a normal response, not an opaque one.
                  requestWillFetch: async ({ request }: { request: Request }) =>
                    new Request(request.url, { mode: 'cors', credentials: 'omit' }),
                  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                    const u = new URL(request.url)
                    u.search = ''
                    return u.href
                  },
                },
              ],
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
