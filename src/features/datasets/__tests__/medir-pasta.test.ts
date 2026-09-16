// =============================================================================
// Testa o LAÇO de `medirPasta` (cancelamento, lotes, contagem de descartadas)
// com um dublê de `medirImagem` — a parte real (`medirUmaFoto`) toca canvas e
// `document`, que não existem no ambiente de teste (node puro, sem DOM). Ver
// o cabeçalho de `medir-pasta.ts`.
// =============================================================================
import { describe, it, expect } from 'vitest';
import { medirPasta, type ImagemParaMedir } from '../medir-pasta';
import type { MedidaDeUmObjeto } from '../../../lib/perfil-medido';
import type { ArquivoDoDataset } from '../fonte';

function arquivoFalso(nome: string): ArquivoDoDataset {
  return { caminho: nome, obterFile: () => Promise.resolve(new File([], nome)) };
}

function imagens(n: number, classe = 'viavel'): ImagemParaMedir[] {
  return Array.from({ length: n }, (_, i) => ({
    caminho: `${i}.jpg`,
    classe,
    arquivo: arquivoFalso(`${i}.jpg`),
  }));
}

function medida(caminho: string, classe: string): MedidaDeUmObjeto {
  return { caminho, classe, areaPx: 100, feretMaxPx: 12, feretMinPx: 8, solidez: 0.95, razaoDeAspecto: 1.5 };
}

describe('medirPasta', () => {
  it('mede cada imagem e devolve uma medida por foto', async () => {
    const lista = imagens(5);
    const r = await medirPasta(lista, {
      medirImagem: async (item) => medida(item.caminho, item.classe),
    });
    expect(r.medidas).toHaveLength(5);
    expect(r.descartadas).toBe(0);
    expect(r.medidas.map((m) => m.caminho)).toEqual(['0.jpg', '1.jpg', '2.jpg', '3.jpg', '4.jpg']);
  });

  it('uma foto que devolve null conta como descartada e o lote segue', async () => {
    const lista = imagens(4);
    const r = await medirPasta(lista, {
      medirImagem: async (item) => (item.caminho === '1.jpg' ? null : medida(item.caminho, item.classe)),
    });
    expect(r.medidas).toHaveLength(3);
    expect(r.descartadas).toBe(1);
  });

  it('uma foto que lança exceção também conta como descartada, sem derrubar o lote', async () => {
    const lista = imagens(4);
    const r = await medirPasta(lista, {
      medirImagem: async (item) => {
        if (item.caminho === '2.jpg') throw new Error('arquivo corrompido');
        return medida(item.caminho, item.classe);
      },
    });
    expect(r.medidas).toHaveLength(3);
    expect(r.descartadas).toBe(1);
  });

  it('cancelado() para o laço antes de processar o resto', async () => {
    const lista = imagens(10);
    let processadas = 0;
    const r = await medirPasta(lista, {
      cancelado: () => processadas >= 3,
      medirImagem: async (item) => {
        processadas++;
        return medida(item.caminho, item.classe);
      },
    });
    expect(r.medidas.length).toBeLessThanOrEqual(3);
  });

  it('progresso é chamado a cada foto, com (feito, total) crescente', async () => {
    const lista = imagens(3);
    const chamadas: [number, number][] = [];
    await medirPasta(lista, {
      progresso: (feito, total) => chamadas.push([feito, total]),
      medirImagem: async (item) => medida(item.caminho, item.classe),
    });
    expect(chamadas).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('lista vazia devolve resultado vazio, sem erro', async () => {
    const r = await medirPasta([], { medirImagem: async () => null });
    expect(r.medidas).toEqual([]);
    expect(r.descartadas).toBe(0);
  });
});
