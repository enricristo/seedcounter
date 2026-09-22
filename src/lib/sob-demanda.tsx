// =============================================================================
// SeedCounter — componentes carregados sob demanda
//
// POR QUE EXISTE.
//
// Todo mundo baixava o `recharts` (≈460 KB) ao abrir o aplicativo, mesmo quem
// só ia contar sementes e nunca abrir um gráfico. Não era um import esquecido:
// eram SETE — o painel e o modal de Analytics, os histogramas da morfometria,
// a comparação de bancadas, o Longitudinal, as Estatísticas e os dois
// gráficos do histórico. Cada um importava a biblioteca de forma estática, e bastava um
// para o empacotador pôr o pedaço inteiro na lista de pré-carregamento do
// `index.html`.
//
// A regra do projeto (ver `App.tsx`, `lerPixelsDaImagem`) é "o que a contagem
// manual não precisa, não custa". Este módulo é a mesma regra aplicada a
// componentes: quem consome uma biblioteca pesada passa a ser carregado na
// hora em que aparece na tela, e o pedaço só sai da rede nesse momento.
//
// COMO.
//
// `React.lazy` + `Suspense` num invólucro só, para que quem monta o componente
// não precise saber que ele é lento: a assinatura de props é a mesma, e o
// arquivo que importa continua importando um nome. O `Suspense` fica DENTRO
// do invólucro de propósito — um `Suspense` no topo da árvore apagaria a tela
// inteira enquanto um gráfico carrega, e o que se quer é o contrário: tudo
// fica, e só o gráfico chega depois.
//
// O QUE ACONTECE OFFLINE.
//
// Os pedaços gerados entram no pré-cache do service worker (`vite.config.ts`,
// `globPatterns` inclui `**/*.js`), então "sob demanda" é sobre QUANDO o
// navegador lê o pedaço, não sobre se ele está disponível. Se ainda assim o
// carregamento falhar (cache limpo, primeira visita sem rede), o `lazy` lança
// e o `ErrorBoundary` de `main.tsx` recebe — o mesmo caminho de qualquer outro
// erro de render.
//
// O teste em `__tests__/sob-demanda.test.ts` percorre o grafo de imports
// estáticos a partir de `main.tsx` e falha se `recharts` voltar a ser
// alcançável sem passar por um `import()`.
// =============================================================================

import { Suspense, lazy, type ComponentType, type ReactNode } from 'react';

/**
 * Embrulha um componente para que o módulo dele só seja baixado no primeiro
 * render.
 *
 * `carregar` recebe o `import()` já resolvido para o componente:
 *
 *     export const AnalyticsModal = sobDemanda(() =>
 *       import('./AnalyticsModal').then((m) => m.AnalyticsModal)
 *     );
 *
 * `fallback` é o que aparece enquanto o pedaço chega. O padrão é nada: para um
 * modal ou um cartão de gráfico, um espaço vazio por algumas dezenas de
 * milissegundos é menos ruído que um indicador que pisca.
 */
export function sobDemanda<P extends object>(
  carregar: () => Promise<ComponentType<P>>,
  fallback: ReactNode = null
): ComponentType<P> {
  const Lento = lazy(() => carregar().then((Componente) => ({ default: Componente })));
  function SobDemanda(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lento {...props} />
      </Suspense>
    );
  }
  return SobDemanda;
}
