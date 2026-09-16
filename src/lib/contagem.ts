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
import { enumerarObjetos, contornoRepresentaSemente } from './objetos';

export { contornoRepresentaSemente };

export interface Contagem {
  viaveis: number;
  inviaveis: number;
  total: number;
}

/**
 * Conta o que `enumerarObjetos` enumera — e só isso. A contagem não tem
 * regra própria: se ela e a tabela de medidas divergissem, o laudo diria um
 * número e o CSV outro. Uma lista, um número.
 */
export function contarObjetos(marks: Mark[], segmentacoes: YoloSegmentation[]): Contagem {
  const objetos = enumerarObjetos(marks, segmentacoes);
  const viaveis = objetos.filter((o) => o.categoria === 'viable').length;
  const inviaveis = objetos.length - viaveis;
  return { viaveis, inviaveis, total: objetos.length };
}
