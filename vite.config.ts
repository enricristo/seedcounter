import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    build: {
      // Warn on chunks > 1.5MB (was 500KB, now increased for gradual optimization)
      // TODO: Optimize with dynamic imports and code-splitting
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            'recharts-charts': ['recharts'],
            'pdf-export': ['jspdf', 'html2canvas'],
            'db-lib': ['dexie', 'dexie-react-hooks'],
          },
        },
      },
    },
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Contador de Sementes GPEOrq',
          short_name: 'SeedCounter',
          description: 'Análise de viabilidade de sementes offline - GPEOrq',
          theme_color: '#10b981',
          background_color: '#18181b',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Inside Docker, usePolling is required for file changes to be detected
      // (set via CHOKIDAR_USEPOLLING in docker-compose.yml).
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' },
    },
  };
});
