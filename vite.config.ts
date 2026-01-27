import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Avactu - Actualité géopolitique',
        short_name: 'Avactu',
        description: 'Comprendre l\'actualité mondiale en 15 minutes',
        theme_color: '#05070A',
        background_color: '#05070A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // Precache all assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache stories.json with network-first (always fetch fresh content)
            urlPattern: /\/data\/stories\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stories-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 2, // 2 days
              },
            },
          },
          {
            // Cache images with cache-first (Unsplash, Le Monde, Courrier International, Al Jazeera)
            urlPattern: /^https:\/\/(images\.unsplash\.com|img\.lemde\.fr|focus\.courrierinternational\.com|www\.aljazeera\.com\/wp-content)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache map data
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
