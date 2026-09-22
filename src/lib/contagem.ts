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
import { CLASSES } from './normas/classes-de-semente';

export { contornoRepresentaSemente };

export interface Contagem {
  /** Sementes viáveis. Inerte declarado NÃO entra aqui nem em `inviaveis`. */
  viaveis: number;
  /** Sementes inviáveis — semente de verdade, não detrito. */
  inviaveis: number;
  /** Todos os objetos enumerados, inertes inclusive. Nunca mudou de sentido. */
  total: number;
  /**
   * Objetos declarados como NÃO-semente: hoje só `vazia` (unidade de dispersão
   * sem semente dentro), que a RAS classifica como material inerte.
   *
   * Zero até alguém classificar — ninguém é inerte por omissão.
   */
  inertes: number;
  /**
   * O denominador honesto: `total` menos os inertes.
   *
   * POR QUE ISTO EXISTE. Contar 400 espiguetas, das quais 80 são vazias, e
   * declarar germinação sobre 400 dá um número MENOR que a verdade — o
   * denominador é 320. Numa forrageira com muita espigueta vazia, a diferença
   * entre os dois denominadores é a diferença entre aprovar e reprovar o lote.
   * Enquanto ninguém classificar nada como inerte, `sementes === total` e nada
   * no aplicativo muda.
   */
  sementes: number;
}

/**
 * O objeto foi declarado como não-semente?
 *
 * A classe fina mora na MARCA (`subclasse`). Contorno de modelo sem marca não
 * tem onde carregá-la, e por isso conta como semente — que é o que ele sempre
 * foi. Omissão nunca vira "inerte": só uma declaração explícita tira algo do
 * denominador.
 */
function ehInerte(marca: Mark | undefined): boolean {
  const chave = marca?.subclasse;
  if (!chave) return false;
  const descricao = CLASSES[chave];
  return descricao ? !descricao.ehSemente : false;
}

/**
 * Conta o que `enumerarObjetos` enumera — e só isso. A contagem não tem
 * regra própria: se ela e a tabela de medidas divergissem, o laudo diria um
 * número e o CSV outro. Uma lista, um número.
 */
export function contarObjetos(marks: Mark[], segmentacoes: YoloSegmentation[]): Contagem {
  const objetos = enumerarObjetos(marks, segmentacoes);
  // Os três grupos somam o total, sempre: viáveis + inviáveis + inertes. Um
  // detrito declarado não é semente inviável — dizer que é seria afirmar que
  // a amostra tem uma semente ruim onde há um pedaço de palha.
  const sementes = objetos.filter((o) => !ehInerte(o.marca));
  const viaveis = sementes.filter((o) => o.categoria === 'viable').length;
  const inviaveis = sementes.length - viaveis;
  return {
    viaveis,
    inviaveis,
    total: objetos.length,
    inertes: objetos.length - sementes.length,
    sementes: sementes.length,
  };
}
