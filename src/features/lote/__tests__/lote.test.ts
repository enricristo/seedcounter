// =============================================================================
// Testa o LAÇO de `executarLote` (ordem, cancelamento, isolamento de erro,
// progresso) com um `processar` dublê — a parte real (`processar-imagem.ts`)
// toca canvas/`File`, que não existem no ambiente de teste (node puro, sem
// DOM). Ver o cabeçalho de `lote.ts`.
// =============================================================================
import { describe, it, expect } from 'vitest';
import { executarLote, type ItemDoLote, type ResultadoDeUmaImagem } from '../lote';
import type { Receita } from '../../ensaio/receitas';

const RECEITA_FALSA: Receita = {
  id: 'teste',
  nome: 'Teste',
  quando: 'Só para o teste.',
  localizacao: {},
  onda: {},
};

function itens(n: number): ItemDoLote[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${i}`,
    rotulo: `imagem-${i}.png`,
    obterFile: () => Promise.resolve(new File([], `imagem-${i}.png`)),
  }));
}

function resultado(item: ItemDoLote, contagem: number): ResultadoDeUmaImagem {
  return {
    id: item.id,
    rotulo: item.rotulo,
    contagem,
    viaveis: contagem,
    inviaveis: 0,
    suspeitos: 0,
    escapes: 0,
    duracaoMs: 1,
  };
}

describe('executarLote', () => {
  it('processa cada item, na ordem, e devolve um resultado por imagem', async () => {
    const lista = itens(5);
    const r = await executarLote(lista, RECEITA_FALSA, async (item) => resultado(item, 3));
    expect(r.resultados).toHaveLength(5);
    expect(r.resultados.map((x) => x.id)).toEqual(['0', '1', '2', '3', '4']);
    expect(r.canceladoEm).toBeNull();
  });

  it('uma imagem que lança exceção vira `erro` e o lote segue', async () => {
    const lista = itens(4);
    const r = await executarLote(lista, RECEITA_FALSA, async (item) => {
      if (item.id === '2') throw new Error('TIFF ilegível');
      return resultado(item, 1);
    });
    expect(r.resultados).toHaveLength(4);
    expect(r.resultados[2].erro).toBe('TIFF ilegível');
    expect(r.resultados[2].contagem).toBe(0);
    // as outras três não foram afetadas pela que falhou
    expect(r.resultados.filter((x) => !x.erro)).toHaveLength(3);
  });

  it('um `processar` que devolve `erro` no resultado (sem lançar) também não derruba o lote', async () => {
    const lista = itens(3);
    const r = await executarLote(lista, RECEITA_FALSA, async (item) =>
      item.id === '1' ? { ...resultado(item, 0), erro: 'canvas indisponível' } : resultado(item, 2)
    );
    expect(r.resultados).toHaveLength(3);
    expect(r.resultados[1].erro).toBe('canvas indisponível');
  });

  it('cancelado() para o laço antes do resto, e marca canceladoEm', async () => {
    const lista = itens(10);
    let processadas = 0;
    const r = await executarLote(lista, RECEITA_FALSA, async (item) => {
      processadas++;
      return resultado(item, 1);
    }, {
      cancelado: () => processadas >= 3,
    });
    expect(r.resultados.length).toBe(3);
    expect(r.canceladoEm).toBe(3);
  });

  it('progresso é chamado a cada imagem, com (feito, total) crescente', async () => {
    const lista = itens(3);
    const chamadas: [number, number][] = [];
    await executarLote(lista, RECEITA_FALSA, async (item) => resultado(item, 1), {
      progresso: (feito, total) => chamadas.push([feito, total]),
    });
    expect(chamadas).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('lista vazia devolve resultado vazio, sem erro', async () => {
    const r = await executarLote([], RECEITA_FALSA, async (item) => resultado(item, 1));
    expect(r.resultados).toEqual([]);
    expect(r.canceladoEm).toBeNull();
    expect(r.duracaoTotalMs).toBeGreaterThanOrEqual(0);
  });
});
