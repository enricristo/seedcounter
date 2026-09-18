// =============================================================================
// Comparação entre bancadas (C2, Task 5) — testes.
//
// Cobrem os dois pontos que o plano marca como "a regra que não cai":
// (1) calibrações divergentes caem para px², com motivo; (2) série no tempo
// só nasce quando as bancadas são a MESMA placa em datas diferentes.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  compararBancadas,
  decidirEscala,
  serieNoTempo,
  type EntradaDeComparacao,
} from '../comparacao';
import type { Mark, YoloSegmentation } from '../../../types';

/** Cinco marcações com contorno quadrado de lado `ladoPx`, todas viáveis. */
function cenaComArea(ladoPx: number, n = 5): { marks: Mark[]; segmentacoes: YoloSegmentation[] } {
  const marks: Mark[] = [];
  const segmentacoes: YoloSegmentation[] = [];
  for (let i = 0; i < n; i++) {
    const cx = i * 100 + 50;
    const cy = 50;
    marks.push({ id: i + 1, x: cx, y: cy, type: 'viable' });
    const r = ladoPx / 2;
    segmentacoes.push({
      id: i + 1,
      category: 'viable',
      class_name: 'viavel',
      confidence: 0.9,
      marcaId: i + 1,
      polygon_points: [
        [cx - r, cy - r],
        [cx + r, cy - r],
        [cx + r, cy + r],
        [cx - r, cy + r],
      ],
    });
  }
  return { marks, segmentacoes };
}

describe('compararBancadas', () => {
  it('uma linha por entrada, com contagem e área mediana em px', () => {
    const cena1 = cenaComArea(10); // área 100 px² por objeto
    const cena2 = cenaComArea(10, 3); // menos de 5 amostras: mediana não se declara

    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'a.jpg', ...cena1 },
      { bancada: 2, arquivo: 'b.jpg', ...cena2 },
    ]);

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ rotulo: 'a.jpg', bancada: 1, total: 5, viaveis: 5, inviaveis: 0 });
    expect(linhas[0].areaMedianaPx).toBe(100);
    expect(linhas[1].total).toBe(3);
    // Menos de 5 objetos: medianaDaCena recusa declarar (ver aglomerado.ts).
    expect(linhas[1].areaMedianaPx).toBeNull();
  });

  it('não inventa mm² sem calibração', () => {
    const cena = cenaComArea(10);
    const linhas = compararBancadas([{ bancada: 1, arquivo: 'a.jpg', ...cena }]);
    expect(linhas[0].areaMedianaMm2).toBeNull();
  });

  it('calcula mm² quando há calibração', () => {
    const cena = cenaComArea(10); // 100 px²
    const linhas = compararBancadas([{ bancada: 1, arquivo: 'a.jpg', umPerPixel: 2, ...cena }]);
    // 100 px² * (2 µm/px)² = 400 µm² = 0,0004 mm²
    expect(linhas[0].areaMedianaMm2).toBeCloseTo(0.0004, 6);
  });

  it('rotula por dia (D0/D7) só quando todas são a mesma placa E têm data', () => {
    const cena = cenaComArea(10);
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'seg.jpg', placa: 'Placa 1', data: '2026-09-01T00:00:00.000Z', ...cena },
      { bancada: 2, arquivo: 'seg2.jpg', placa: ' placa 1 ', data: '2026-09-08T00:00:00.000Z', ...cena },
    ]);
    expect(linhas[0].rotulo).toBe('D0');
    expect(linhas[1].rotulo).toBe('D7');
  });

  it('usa o nome do arquivo quando as placas divergem, mesmo com data', () => {
    const cena = cenaComArea(10);
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'placa-a.jpg', placa: 'Placa 1', data: '2026-09-01', ...cena },
      { bancada: 2, arquivo: 'placa-b.jpg', placa: 'Placa 2', data: '2026-09-08', ...cena },
    ]);
    expect(linhas[0].rotulo).toBe('placa-a.jpg');
    expect(linhas[1].rotulo).toBe('placa-b.jpg');
  });

  it('usa o nome do arquivo quando falta data em alguma bancada', () => {
    const cena = cenaComArea(10);
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'd0.jpg', placa: 'Placa 1', data: '2026-09-01', ...cena },
      { bancada: 2, arquivo: 'd7.jpg', placa: 'Placa 1', ...cena },
    ]);
    expect(linhas[0].rotulo).toBe('d0.jpg');
    expect(linhas[1].rotulo).toBe('d7.jpg');
  });
});

describe('decidirEscala — a regra que não cai', () => {
  it('usa mm² quando as calibrações concordam (dentro de 5%)', () => {
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'a.jpg', umPerPixel: 10, ...cenaComArea(10) },
      { bancada: 2, arquivo: 'b.jpg', umPerPixel: 10.3, ...cenaComArea(10) }, // 3% de diferença
    ]);
    const decisao = decidirEscala(linhas);
    expect(decisao.usarMm2).toBe(true);
    expect(decisao.motivo).toBeUndefined();
  });

  it('cai para px² e explica quando as calibrações divergem mais de 5%', () => {
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'a.jpg', umPerPixel: 10, ...cenaComArea(10) },
      { bancada: 2, arquivo: 'b.jpg', umPerPixel: 21.2, ...cenaComArea(10) }, // scanner diferente
    ]);
    const decisao = decidirEscala(linhas);
    expect(decisao.usarMm2).toBe(false);
    expect(decisao.motivo).toBeTruthy();
    expect(decisao.motivo).toMatch(/µm\/px/);
  });

  it('usa mm² com uma só bancada calibrada — não há o que divergir', () => {
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'a.jpg', umPerPixel: 10, ...cenaComArea(10) },
      { bancada: 2, arquivo: 'b.jpg', ...cenaComArea(10) }, // sem calibração
    ]);
    expect(decidirEscala(linhas).usarMm2).toBe(true);
  });

  it('usa px² quando nenhuma bancada está calibrada', () => {
    const linhas = compararBancadas([
      { bancada: 1, arquivo: 'a.jpg', ...cenaComArea(10) },
      { bancada: 2, arquivo: 'b.jpg', ...cenaComArea(10) },
    ]);
    expect(decidirEscala(linhas).usarMm2).toBe(false);
    expect(decidirEscala(linhas).motivo).toBeUndefined();
  });
});

describe('serieNoTempo', () => {
  const entrada = (bancada: number, arquivo: string, placa: string, data?: string): EntradaDeComparacao => ({
    bancada,
    arquivo,
    placa,
    data,
    ...cenaComArea(10),
  });

  it('devolve a série quando é a mesma placa em datas diferentes', () => {
    const linhas = compararBancadas([
      entrada(1, 'd7.jpg', 'Placa 1', '2026-09-08'),
      entrada(2, 'd0.jpg', 'Placa 1', '2026-09-01'),
    ]);
    const serie = serieNoTempo(linhas, ['2026-09-08', '2026-09-01']);
    expect(serie).not.toBeNull();
    expect(serie?.placa).toBe('placa 1');
    // Ordenado por data crescente, mesmo que as bancadas tenham entrado fora de ordem.
    expect(serie?.pontos.map((p) => p.rotulo)).toEqual(['D0', 'D7']);
  });

  it('devolve null quando as bancadas NÃO são a mesma placa', () => {
    const linhas = compararBancadas([
      entrada(1, 'a.jpg', 'Placa 1', '2026-09-08'),
      entrada(2, 'b.jpg', 'Placa 2', '2026-09-01'),
    ]);
    const serie = serieNoTempo(linhas, ['2026-09-08', '2026-09-01']);
    expect(serie).toBeNull();
  });

  it('devolve null sem placa declarada, mesmo com datas diferentes', () => {
    const linhas = compararBancadas([
      entrada(1, 'a.jpg', '', '2026-09-08'),
      entrada(2, 'b.jpg', '', '2026-09-01'),
    ]);
    expect(serieNoTempo(linhas, ['2026-09-08', '2026-09-01'])).toBeNull();
  });

  it('devolve null quando falta data em alguma bancada', () => {
    const linhas = compararBancadas([
      entrada(1, 'a.jpg', 'Placa 1', '2026-09-08'),
      entrada(2, 'b.jpg', 'Placa 1', undefined),
    ]);
    expect(serieNoTempo(linhas, ['2026-09-08', undefined])).toBeNull();
  });

  it('devolve null com a mesma placa na MESMA data (não é série, é duplicata)', () => {
    const linhas = compararBancadas([
      entrada(1, 'a.jpg', 'Placa 1', '2026-09-08'),
      entrada(2, 'b.jpg', 'Placa 1', '2026-09-08'),
    ]);
    expect(serieNoTempo(linhas, ['2026-09-08', '2026-09-08'])).toBeNull();
  });

  it('devolve null com uma bancada só — comparação lado a lado continua valendo, série não', () => {
    const linhas = compararBancadas([entrada(1, 'a.jpg', 'Placa 1', '2026-09-08')]);
    expect(serieNoTempo(linhas, ['2026-09-08'])).toBeNull();
  });
});
