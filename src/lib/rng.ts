// =============================================================================
// SeedCounter — gerador pseudoaleatório determinístico
//
// POR QUE ISTO É UM MÓDULO SEPARADO.
//
// São dez linhas que caberiam em qualquer lugar, e por isso mesmo estavam
// dentro de `synthetic-data.ts`. Isso quebrou a build de produção.
//
// `synthetic-data.ts` é alcançado a partir do `demo-store`, que importa o
// Dexie — então o Rollup colocou os dois no mesmo pedaço (`db-lib`). Já
// `synthetic-scene.ts`, que só queria o sorteador, ficou no pedaço principal.
// O principal passou a precisar do `db-lib` durante a AVALIAÇÃO do módulo, e o
// `db-lib` precisava do principal: ciclo entre pedaços, e a página caía com
// "Cannot access 'uo' before initialization" — tela branca, sem mais nada.
//
// O modo de desenvolvimento não mostrava: ele carrega cada módulo por conta
// própria e tolera o ciclo. Só o pacote de produção agrupa, e só ele quebra.
//
// A regra que fica: utilitário-folha não pode morar dentro de um módulo que
// carrega dependência pesada junto. Quem importa o sorteador não deveria estar
// importando um banco de dados sem saber.
// =============================================================================

/**
 * mulberry32 — gerador pequeno, rápido e com estado de 32 bits.
 *
 * O ponto não é qualidade criptográfica, é reprodutibilidade: a mesma semente
 * tem que dar a mesma sequência em qualquer navegador e no vitest.
 */
export function criarRng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
