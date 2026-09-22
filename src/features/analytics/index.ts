// =============================================================================
// SeedCounter — Analytics, sob demanda
//
// `App.tsx` importa daqui, não dos arquivos. Os dois componentes dependem de
// `recharts` (e o modal ainda de `jspdf` + `html2canvas` para o PDF): são as
// bibliotecas mais pesadas do aplicativo, e a contagem não usa nenhuma. Ver
// `lib/sob-demanda.tsx` para o porquê e o teste que vigia.
//
// O painel é montado como conteúdo de uma aba da lateral direita: o elemento
// é criado a cada render de `App`, mas o módulo só é baixado quando a aba
// Analytics de fato aparece — criar um elemento de componente `lazy` não
// dispara o `import()`, renderizá-lo dispara.
// =============================================================================

import { sobDemanda } from '../../lib/sob-demanda';

export const AnalyticsPanel = sobDemanda(() => import('./AnalyticsPanel').then((m) => m.AnalyticsPanel));

export const AnalyticsModal = sobDemanda(() => import('./AnalyticsModal').then((m) => m.AnalyticsModal));
