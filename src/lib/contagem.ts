// =============================================================================
// SeedCounter — a regra de contagem
//
// POR QUE ISTO SAIU DE DENTRO DO App.
//
// A contagem é o número que o aplicativo existe para produzir. Estava como
// quatro `filter` soltos no meio de um componente de mil linhas, sem teste — e
// já quebrou uma vez: quando a segmentação por clique passou a criar uma
// marcação E um contorno para a mesma semente, doze cliques viraram vinte e
// quatro sementes.
//
// A REGRA.
//
// Cada semente é contada uma vez, pela fonte que a identificou:
//
//   - marcação manual conta sempre;
//   - contorno proposto por MODELO conta, porque ali não existe marcação
//     humana equivalente — foi a máquina que achou a semente;
//   - contorno vindo de CLIQUE não conta, porque o mesmo clique já criou a
//     marcação. O contorno ali é a forma da semente, não uma segunda semente.
//
// Contorno oculto não conta: esconder é a forma de rejeitar uma proposta.
// =============================================================================

import type { Mark, YoloSegmentation } from '../types';

export interface Contagem {
  viaveis: number;
  inviaveis: number;
  total: number;
}

/**
 * Um contorno representa uma semente por si só?
 *
 * Exportado porque a resposta é a parte fácil de errar, e quem precisar da
 * regra em outro lugar deve usar esta, não reescrever o `filter`.
 */
export function contornoRepresentaSemente(seg: YoloSegmentation): boolean {
  return seg.visible !== false && seg.origem !== 'clique';
}

export function contarObjetos(marks: Mark[], segmentacoes: YoloSegmentation[]): Contagem {
  const contornos = segmentacoes.filter(contornoRepresentaSemente);

  const viaveis =
    marks.filter((m) => m.type === 'viable').length +
    contornos.filter((s) => s.category === 'viable').length;

  const inviaveis =
    marks.filter((m) => m.type === 'inviable').length +
    contornos.filter((s) => s.category === 'inviable').length;

  return { viaveis, inviaveis, total: viaveis + inviaveis };
}
