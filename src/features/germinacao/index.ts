// =============================================================================
// SeedCounter — Germinação (Germinator), sob demanda
//
// `App.tsx` importa daqui, não dos arquivos. O painel inteiro é uma aba que
// quem só conta nunca abre; o gráfico, dentro dele, ainda carrega o
// `recharts` num segundo passo (ver `PainelDeGerminacao.tsx`). Ver
// `lib/sob-demanda.tsx` para o porquê e o teste que vigia o pacote inicial.
// =============================================================================

import { sobDemanda } from '../../lib/sob-demanda';

export const PainelDeGerminacao = sobDemanda(() =>
  import('./PainelDeGerminacao').then((m) => m.PainelDeGerminacao)
);
