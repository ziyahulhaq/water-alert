import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ── Use injectManifest so our custom src/sw.ts (with push handler) is used ──
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Municipal Water Monitoring System',
        short_name: 'Water Monitor',
        description: 'Real-time municipal water supply monitoring and notifications',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        categories: ['utilities', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            url: '/',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Notifications',
            url: '/notifications',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      // injectManifest: globPatterns for precache list injection into sw.ts
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    allowedHosts: ['either-presuming-deduce.ngrok-free.dev', '*'],
  },
})
