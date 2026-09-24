// =============================================================================
// Um TIFF de várias páginas vira várias linhas do lote.
//
// O defeito (laudo de 24/09): o lote decodificava sempre a página 0 e não
// dizia nada sobre as outras. Sete dos doze TIFF do laboratório guardam mais
// de uma varredura; o `10 espécies.tif` tem dez, uma por espécie, e virava uma
// linha só — nove espécies sumindo em silêncio, com a linha restante parecendo
// um resultado completo.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { expandirPaginas, paginasExtras, rotuloDaPagina } from '../paginas-do-lote';
import type { ItemDoLote } from '../lote';

const item = (id: string, rotulo = id): ItemDoLote => ({
  id,
  rotulo,
  obterFile: () => Promise.resolve(new File([], rotulo)),
});

/** Conta páginas pelo nome, para o teste não precisar de TIFF de verdade. */
const contarPorNome = (paginas: Record<string, number>) => async (file: File) =>
  paginas[file.name] ?? 1;

describe('expandir páginas do lote', () => {
  it('arquivo de uma página passa INALTERADO, com o mesmo id', async () => {
    // O id é a chave do mapa de itens do painel: trocá-lo sem necessidade
    // descolaria a miniatura de quem já tinha resultado.
    const itens = [item('a.png'), item('b.jpg')];
    const saida = await expandirPaginas(itens, contarPorNome({}));
    expect(saida).toEqual(itens);
    expect(saida[0].pagina).toBeUndefined();
  });

  it('TIFF de dez páginas vira dez linhas, numeradas a partir de 1 na tela', async () => {
    const saida = await expandirPaginas(
      [item('10 especies.tif')],
      contarPorNome({ '10 especies.tif': 10 })
    );
    expect(saida).toHaveLength(10);
    expect(saida.map((x) => x.pagina)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // A primeira não leva sufixo: o nome do arquivo já é o nome dela.
    expect(saida[0].rotulo).toBe('10 especies.tif');
    expect(saida[1].rotulo).toBe('10 especies.tif#2');
    expect(saida[9].rotulo).toBe('10 especies.tif#10');
    expect(new Set(saida.map((x) => x.id)).size).toBe(10);
  });

  it('mistura: só o TIFF expande, e a ordem da lista se mantém', async () => {
    const saida = await expandirPaginas(
      [item('capa.png'), item('Lcrispa2.tif'), item('fim.jpg')],
      contarPorNome({ 'Lcrispa2.tif': 11 })
    );
    expect(saida).toHaveLength(13);
    expect(saida[0].rotulo).toBe('capa.png');
    expect(saida[1].rotulo).toBe('Lcrispa2.tif');
    expect(saida[12].rotulo).toBe('fim.jpg');
  });

  it('arquivo que não abre não vira erro aqui — vira uma linha só', async () => {
    // Contar páginas é conveniência. Se ela pudesse falhar, o lote ganharia um
    // segundo lugar onde quebra, antes mesmo de processar.
    const ruim: ItemDoLote = {
      id: 'x',
      rotulo: 'corrompido.tif',
      obterFile: () => Promise.reject(new Error('não abre')),
    };
    const saida = await expandirPaginas([ruim], async () => 10);
    expect(saida).toEqual([ruim]);
  });

  it('contagem absurda não multiplica a tabela', async () => {
    const saida = await expandirPaginas([item('x.tif')], async () => NaN);
    expect(saida).toHaveLength(1);
  });

  it('paginasExtras conta o que a expansão acrescentou', async () => {
    const antes = [item('a.tif'), item('b.png')];
    const depois = await expandirPaginas(antes, contarPorNome({ 'a.tif': 4 }));
    expect(paginasExtras(antes, depois)).toBe(3);
    expect(paginasExtras(antes, antes)).toBe(0);
  });

  it('rotuloDaPagina numera para quem lê, não para o índice', () => {
    expect(rotuloDaPagina('x.tif', 0)).toBe('x.tif');
    expect(rotuloDaPagina('x.tif', 1)).toBe('x.tif#2');
  });
});
