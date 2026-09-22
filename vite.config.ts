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
      // Avisa em pedaços > 1,5 MB. O principal ainda passa de 1 MB porque a
      // maior parte da lógica (App, canvas, morfometria) é estática mesmo.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Um pedaço por biblioteca pesada, para que os SETE consumidores do
          // `recharts` (carregados sob demanda, ver `lib/sob-demanda.tsx`)
          // compartilhem um arquivo só em vez de cada um duplicar a
          // biblioteca. Nomear o pedaço aqui NÃO o tira do pré-carregamento:
          // só some do `index.html` quando nenhum import estático o alcança —
          // `lib/__tests__/sob-demanda.test.ts` vigia isso para o recharts.
          // Função, e não objeto: a forma-objeto `{'recharts-charts': ['recharts']}`
          // manda para o pedaço TAMBÉM as dependências do recharts que ninguém
          // mais tinha reivindicado — e o `react-dom` foi parar lá. Como o
          // `index` importa `react-dom`, o HTML passou a pré-carregar o pedaço
          // do recharts inteiro (461 kB) na abertura, e o "sob demanda" ficou
          // derrotado no primeiro byte. Com a função, só o que mora em
          // node_modules/recharts (e nos d3-* e victory-vendor que só ele usa)
          // vai para o pedaço; o resto fica onde o Rollup decidir.
          manualChunks(id: string) {
            // O ajudante de pré-carregamento do próprio Vite é usado por todo
            // pedaço que faz `import()`. Sem lar declarado, o Rollup o pôs
            // dentro do `pdf-export` — e o `index` passou a importar o
            // jsPDF inteiro só para pegar uma função de 20 linhas. Vai para o
            // pedaço que sempre carrega.
            if (id.includes('vite/preload-helper')) return 'react-vendor';
            if (!id.includes('node_modules')) return undefined;
            // React num pedaço próprio, ANTES de tudo: `react-dom` é importado
            // pelo `index` (via react-dom/client) e pelo recharts, e sem esta
            // linha o Rollup o punha dentro do pedaço do recharts — que virava
            // dependência estática do `index`. Medido no dist: `createPortal`
            // e `flushSync` estavam no recharts-charts, e o HTML o pré-carregava.
            if (/[\/]node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'react-vendor';
            if (/[\/]node_modules[\/](recharts|victory-vendor|d3-[a-z-]+|internmap|delaunator|robust-predicates)[\/]/.test(id)) {
              return 'recharts-charts';
            }
            if (/[\/]node_modules[\/](jspdf|html2canvas)[\/]/.test(id)) return 'pdf-export';
            if (/[\/]node_modules[\/](dexie|dexie-react-hooks)[\/]/.test(id)) return 'db-lib';
            return undefined;
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
          //
          // Os EXEMPLOS também ficam fora: eram 63 MB dos 66 MB do precache —
          // toda pessoa baixava 92 imagens de exemplo na primeira visita, e de
          // novo a cada versão que as mudasse, tenha ou não aberto uma. Passam
          // ao cache em tempo de execução (abaixo): a que a pessoa abrir fica
          // guardada e funciona sem rede depois; as outras não custam nada.
          globIgnores: ['**/models/**', '**/*.onnx', '**/exemplos/**'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              // Exemplos reais e o catálogo: sob demanda, e ficam.
              urlPattern: ({ url }) => url.pathname.includes('/exemplos/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'exemplos-cache',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // 90 dias
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
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
