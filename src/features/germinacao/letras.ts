// =============================================================================
// SeedCounter — letras de comparação múltipla (compact letter display)
//
// POR QUE NÃO USAR O QUE `lib/stats.ts` JÁ TEM.
//
// O `runStatsPipeline` deriva letras de Tukey com um passe guloso que dá UMA
// letra por grupo. Isso erra o caso mais comum de três tratamentos: A ≠ C
// mas A = B e B = C. A resposta certa é A:a, B:ab, C:b — B compartilha letra
// com os dois — e o passe guloso dá A:a, B:a, C:b, afirmando que B ≠ C sem
// que o teste tenha dito isso. Numa tabela de artigo, é uma conclusão a mais.
//
// O ALGORITMO (Piepho, 2004, "An algorithm for a letter-based representation
// of all-pairwise comparisons", J. Comput. Graph. Stat. 13:456–466):
//
//   1. Ordena os grupos pela média, decrescente. Uma coluna só, com todos.
//   2. Para cada par significativamente diferente (i, j): toda coluna que
//      contém os dois é duplicada — uma cópia sem i, outra sem j. ("Insert.")
//   3. Remove toda coluna contida em outra. ("Absorb.")
//   4. Cada coluna vira uma letra; o grupo recebe as letras das colunas em
//      que está.
//
// Dois grupos compartilham uma letra SE E SOMENTE SE não diferem — é a
// propriedade que a tabela promete ao leitor.
//
// CONVENÇÃO: 'a' é a MAIOR média. É a da agronomia brasileira (SISVAR,
// ExpDes) e a do `scottKnott` deste projeto. Para t50, em que menor é mais
// rápido, 'a' fica com o mais LENTO — a letra diz "difere", não "é melhor".
// =============================================================================

import type { ComparisonPair } from '../../types';

export interface GrupoComMedia {
  rotulo: string;
  media: number;
}

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

export function letrasDeComparacao(
  grupos: readonly GrupoComMedia[],
  pares: readonly ComparisonPair[]
): Map<string, string> {
  const ordenados = [...grupos].sort((x, y) => y.media - x.media).map((g) => g.rotulo);
  const posicao = new Map(ordenados.map((r, i) => [r, i]));

  // Colunas como conjuntos de posições (na ordem por média).
  let colunas: Set<number>[] = [new Set(ordenados.map((_, i) => i))];

  for (const par of pares) {
    if (!par.significant) continue;
    const i = posicao.get(par.groupA);
    const j = posicao.get(par.groupB);
    if (i === undefined || j === undefined) continue;
    const proximas: Set<number>[] = [];
    for (const coluna of colunas) {
      if (coluna.has(i) && coluna.has(j)) {
        const semI = new Set(coluna);
        semI.delete(i);
        const semJ = new Set(coluna);
        semJ.delete(j);
        proximas.push(semI, semJ);
      } else {
        proximas.push(coluna);
      }
    }
    colunas = proximas;
  }

  // Absorb: uma coluna contida em outra não diz nada que a maior não diga.
  // Duas colunas iguais: fica a primeira.
  const subconjunto = (a: Set<number>, b: Set<number>) => [...a].every((x) => b.has(x));
  colunas = colunas.filter(
    (a, ia) =>
      !colunas.some((b, ib) => {
        if (ia === ib || !subconjunto(a, b)) return false;
        return a.size < b.size || ib < ia;
      })
  );

  // Letras na ordem em que as colunas começam (pela maior média que contêm).
  colunas.sort((a, b) => Math.min(...a) - Math.min(...b) || Math.max(...a) - Math.max(...b));

  const resultado = new Map<string, string>();
  ordenados.forEach((rotulo, i) => {
    let letras = '';
    colunas.forEach((coluna, k) => {
      if (coluna.has(i)) letras += LETRAS[k] ?? '?';
    });
    resultado.set(rotulo, letras);
  });
  return resultado;
}
