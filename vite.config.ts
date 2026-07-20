import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'exercises/placeholder.svg'],
      manifest: {
        name: 'Fitness Tracker — Suivi musculation',
        short_name: 'Muscu',
        description: 'Suivi de musculation : séances, records, programmes et coach IA.',
        lang: 'fr',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Précache l'app (JS/CSS/HTML/SVG) + le JSON de la banque (recherche
        // hors-ligne). Les ~1 700 images (jpg) NE sont PAS précachées — elles
        // viennent du CDN et sont mises en cache à l'usage (runtimeCaching).
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        globIgnores: ['**/exercises/images/**', '**/exercises/thumbs/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*\.(?:jpg|jpeg|png|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    // Port fixe en dev : l'origine (http://localhost:5173) reste stable, ce qui
    // permet de l'autoriser une fois pour toutes dans les « Redirect URLs »
    // Supabase (sinon le lien magique retombe sur la Site URL de prod).
    port: 5173,
    strictPort: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // recharts (~540 Ko) est chargé en différé (mini-graphes du dashboard, pages
    // Progression/Fiche). On l'exclut du modulepreload pour qu'il ne soit
    // téléchargé qu'au moment où un graphe est réellement rendu.
    modulePreload: {
      resolveDependencies: (_url, deps) => deps.filter(dep => !dep.includes('charts-vendor')),
    },
    rollupOptions: {
      output: {
        // Regroupe les grosses libs tierces dans des chunks stables, mis en
        // cache indépendamment du code applicatif.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'charts-vendor': ['recharts'],
        },
      },
    },
  },
})
