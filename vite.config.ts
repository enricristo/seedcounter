import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = createRequire(import.meta.url)('./package.json');

/** Commit curto do build. Vazio fora de um repositório git — não é erro. */
function commitCurto(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'sem-git';
  }
}

export default defineConfig(({ mode }) => {
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
          // Grafite-950 do sistema Bancada Optica, alinhado ao --surface-0 escuro.
          theme_color: '#101719',
          background_color: '#101719',
          display: 'standalone',
          orientation: 'portrait',
          // Antes, os tres campos mentiam: apontavam para logo.png, que era um
          // JPEG 525x525 renomeado, declarado como PNG em 192 e 512. Chrome
          // recusa icone assim para o prompt de instalacao. O maskable ainda
          // vinha sem zona de seguranca.
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              // Fundo sangrado: a mascara do sistema recorta os cantos.
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
          // Não faz sentido pré-cachear arquivos enormes (modelos ONNX, imagens
          // de origem). Sem isso o build FALHA quando algum passa de 2 MiB.
          globIgnores: ['**/models/**', '**/*.onnx'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
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
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Identidade do build. Injetada aqui, e não escrita à mão num componente,
      // porque versão que depende de alguém lembrar de atualizar fica errada —
      // e um relatório exportado precisa poder dizer exatamente qual código o
      // produziu, que é requisito de reprodutibilidade, não enfeite.
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_COMMIT__: JSON.stringify(commitCurto()),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
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
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' },
    },
  };
});
