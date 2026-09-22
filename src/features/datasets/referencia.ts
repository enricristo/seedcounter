// =============================================================================
// SeedCounter — a anotação de um dataset externo vira contorno e marca
//
// POR QUE EXISTE. "Carregar referência" — o SEGUNDO gesto do explorador de
// datasets; clicar na miniatura já carregou a imagem, isto é que decide virar
// marcação — montava contorno e marca inline, dentro do App. Aqui fica só a
// tradução: pura, sem `Date.now()` do relógio real nem estado do React, para
// provar contra o formato antigo por `toEqual`. Quem chama isto e mexe em
// `addYoloSegmentations`/`setMarks` está em `useExplorador.ts`.
//
// A TAXONOMIA VEM PRIMEIRO. Nome de classe que bate com viável/inviável usa a
// tradução do app (`categoriaDoNome`, `lib/classe-do-modelo.ts` — Lei 1);
// qualquer outro nome (amendoim com mofo, trigo duro…) cai em
// `classeExterna`, cru — forçar uma correspondência que ninguém validou seria
// pior que não ter classe nenhuma (Lei 3). Polígono vira contorno com
// `origem: 'referencia'` (conta como semente, mesma regra de um contorno de
// modelo — ver `types.ts`); caixa vira marca no centro.
//
// OS IDS PODEM COLIDIR — COMPORTAMENTO ANTIGO, REPRODUZIDO DE PROPÓSITO, NÃO
// CONSERTADO AQUI. No App, `Date.now()` era chamado dentro de CADA `.map()` —
// uma vez para os contornos, outra para as marcas — não uma vez só antes dos
// dois. Como os dois laços rodam em sequência síncrona (sem `await` no
// meio), o efeito observável de sempre foi o mesmo que UM `agora` só:
// contorno[i] recebe `agora + i`; marca[i] recebe `agora + i + 1`. Com
// contornos E marcas na mesma anotação esses dois intervalos SE SOBREPÕEM —
// ex.: 2 contornos + 1 marca faz contorno[1] (`agora + 1`) e marca[0]
// (`agora + 0 + 1`) nascerem com o MESMO id. Listado no relatório do PR como
// bug pré-existente, não corrigido aqui: a meta desta extração é
// comportamento idêntico.
// =============================================================================

import type { Mark, YoloSegmentation } from '../../types';
import type { AnotacaoCarregada } from './anotacao';
import { categoriaDoNome, nomeDaCategoria } from '../../lib/classe-do-modelo';
import { calculateSeedDimensions } from '../../lib/pca-utils';

/**
 * Nome de classe externo → taxonomia do app, ou `classeExterna` cru quando o
 * nome não é nem viável nem inviável.
 */
export function normalizarClasseExterna(
  classe: string
): { category: 'viable' | 'inviable'; class_name: string; classeExterna?: string } {
  const category = categoriaDoNome(classe);
  if (category) return { category, class_name: nomeDaCategoria(category) };
  return { category: 'viable', class_name: 'viavel', classeExterna: classe };
}

/**
 * Os contornos e marcas que a anotação de referência produz, prontos para
 * `addYoloSegmentations`/`setMarks`. `agora` substitui os dois `Date.now()`
 * do App — ver o cabeçalho sobre a colisão de ids que isso reproduz.
 * Listas vazias (nunca `undefined`) quando a anotação não tem contorno ou
 * marca — quem chama decide se vale a pena chamar o setter correspondente.
 */
export function objetosDaReferencia(
  anotacao: AnotacaoCarregada,
  agora: number
): { segmentacoes: YoloSegmentation[]; marcas: Mark[] } {
  const segmentacoes: YoloSegmentation[] = (anotacao.contornos ?? []).map((c, i) => {
    const { width, height } = calculateSeedDimensions(c.poligono);
    const { category, class_name, classeExterna } = normalizarClasseExterna(c.classe);
    return {
      id: agora + i,
      category,
      class_name,
      confidence: 1,
      polygon_points: c.poligono,
      visible: true,
      width,
      height,
      origem: 'referencia',
      ...(classeExterna ? { classeExterna } : {}),
    };
  });

  const marcas: Mark[] = (anotacao.marcas ?? []).map((m, i) => {
    const { category } = normalizarClasseExterna(m.classe);
    return {
      id: agora + i + 1,
      x: m.x,
      y: m.y,
      type: category,
      origem: 'referencia' as const,
    };
  });

  return { segmentacoes, marcas };
}

/**
 * Se o botão "Carregar referência" aparece: precisa de imagem aberta, desta
 * cena ainda não ter carregado a referência, e a anotação atual ter pelo
 * menos um contorno ou uma marca.
 */
export function podeCarregarReferencia(
  image: unknown,
  referenciaJaCarregada: boolean,
  anotacaoAtual: AnotacaoCarregada | null
): boolean {
  return (
    !!image &&
    !referenciaJaCarregada &&
    !!anotacaoAtual &&
    ((anotacaoAtual.contornos?.length ?? 0) > 0 || (anotacaoAtual.marcas?.length ?? 0) > 0)
  );
}
