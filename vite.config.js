import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite konfiguráció: React plugin + PWA + helyi hálózati elérés.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['questions.json', 'favicon.ico'],
      manifest: {
        name: 'Spanna — Vizsgatanuló',
        short_name: 'Spanna',
        description: 'Modern tanulóalkalmazás vizsgára készülőknek.',
        lang: 'hu',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // A questions.json nagy (1.3MB) — fontos, hogy offline is elérhető legyen
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: true, // dev módban is működik a service worker (teszteléshez)
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
