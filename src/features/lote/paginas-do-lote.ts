// =============================================================================
// SeedCounter — um TIFF de várias páginas vira várias linhas do lote
//
// POR QUE ESTE MÓDULO EXISTE.
//
// O lote abria `decodificarTiff(buffer, 0)` e processava a primeira página,
// sem dizer nada sobre as outras. Sete dos doze TIFF do laboratório guardam
// várias varreduras: o `10 espécies.tif` tem dez páginas — uma por espécie —
// e virava UMA linha. Nove espécies sumiam em silêncio, e a linha que sobrava
// parecia um resultado completo.
//
// A abertura de uma imagem avulsa sempre soube escolher a página (há seletor
// no cabeçalho). O lote não sabia. Aqui ele aprende.
//
// A ESCOLHA: EXPANDIR, NÃO AVISAR.
//
// Avisar "este TIFF tem 10 páginas, processei 1" seria honesto e inútil — a
// pessoa teria de abrir as dez à mão. Expandir dá dez linhas, cada uma com o
// rótulo `arquivo.tif#2`, e a tabela do lote passa a dizer a verdade sobre o
// arquivo inteiro.
//
// O CUSTO, E POR QUE ELE É ACEITÁVEL.
//
// Contar páginas exige ler o arquivo inteiro para a memória (o `UTIF.decode`
// lê os IFDs, não os pixels) — um TIFF de 100 MB custa 100 MB por um instante.
// O buffer sai de escopo na mesma função; o que é caro é decodificar pixels,
// e isso continua acontecendo uma página por vez, dentro do laço.
// =============================================================================

import type { ItemDoLote } from './lote';

/** Quantas páginas um arquivo tem. Devolve 1 para o que não é TIFF. */
export type ContarPaginas = (file: File) => Promise<number>;

/** O rótulo de uma página: `arquivo.tif#3`. A primeira não leva sufixo. */
export function rotuloDaPagina(rotulo: string, pagina: number): string {
  return pagina === 0 ? rotulo : `${rotulo}#${pagina + 1}`;
}

/**
 * Expande cada item em uma linha por página.
 *
 * Item de uma página só (ou qualquer coisa que não seja TIFF) passa
 * INALTERADO — mesmo `id`, mesmo rótulo, sem `pagina`. Isso importa: o id é a
 * chave do mapa de itens do painel, e trocá-lo sem necessidade quebraria a
 * miniatura de quem já tinha resultado.
 *
 * Arquivo que não abre não vira erro aqui: devolve uma linha só, e a falha
 * aparece onde ela já aparecia — no processamento, com mensagem. Contar
 * páginas é conveniência; não pode ser um segundo lugar onde o lote falha.
 */
export async function expandirPaginas(
  itens: ItemDoLote[],
  contarPaginas: ContarPaginas
): Promise<ItemDoLote[]> {
  const saida: ItemDoLote[] = [];
  for (const item of itens) {
    let paginas = 1;
    try {
      const file = await item.obterFile();
      paginas = await contarPaginas(file);
    } catch {
      paginas = 1;
    }
    if (!Number.isFinite(paginas) || paginas <= 1) {
      saida.push(item);
      continue;
    }
    for (let p = 0; p < paginas; p++) {
      saida.push({
        ...item,
        id: `${item.id}#${p}`,
        rotulo: rotuloDaPagina(item.rotulo, p),
        pagina: p,
      });
    }
  }
  return saida;
}

/** Quantas linhas a mais a expansão produziu — para a frase do painel. */
export function paginasExtras(antes: ItemDoLote[], depois: ItemDoLote[]): number {
  return Math.max(0, depois.length - antes.length);
}
