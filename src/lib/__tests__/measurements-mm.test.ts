// =============================================================================
// Medidas em milímetros.
//
// Arquivo separado de propósito: measurements.ts não tinha teste, e criar um
// novo evita tocar nos arquivos que outro agente mantém.
//
// A escala usada é a real do laboratório: 3600 DPI ⇒ 25400/3600 = 7,0556 µm/px.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildMeasurements } from '../measurements';
import { dpiToUmPerPixel } from '../calibration';
import type { Mark, YoloSegmentation, Metadata } from '../../types';

const UM_POR_PX = dpiToUmPerPixel(3600);

/** Retângulo de lado a×b centrado em (cx, cy). */
const retangulo = (id: number, cx: number, cy: number, a: number, b: number): YoloSegmentation => ({
  id,
  category: 'viable',
  class_name: 'viavel',
  confidence: 0.9,
  polygon_points: [
    [cx - a / 2, cy - b / 2],
    [cx + a / 2, cy - b / 2],
    [cx + a / 2, cy + b / 2],
    [cx - a / 2, cy + b / 2],
  ],
  visible: true,
});

const metadados = (umPerPixel?: number): Metadata => ({
  researcher: '',
  project: '',
  treatment: '',
  plate: '',
  quadrant: '',
  notes: '',
  umPerPixel,
});

const marca = (x: number, y: number): Mark => ({ id: 1, x, y, type: 'viable' });

describe('medidas em milímetros', () => {
  it('converte a partir do DPI real do laboratório', () => {
    // 165 x 48 px é o tamanho médio do lote de referência do protótipo, que
    // corresponde a ~1,17 x 0,34 mm.
    const [linha] = buildMeasurements({
      marks: [marca(500, 500)],
      segmentations: [retangulo(1, 500, 500, 165, 48)],
      metadata: metadados(UM_POR_PX),
    });

    expect(linha.comprimentoMm).toBeCloseTo(1.16, 2);
    expect(linha.larguraMm).toBeCloseTo(0.34, 2);
  });

  it('mm é exatamente µm dividido por mil', () => {
    const [linha] = buildMeasurements({
      marks: [marca(300, 300)],
      segmentations: [retangulo(1, 300, 300, 200, 80)],
      metadata: metadados(UM_POR_PX),
    });

    expect(linha.comprimentoMm).toBeCloseTo(linha.comprimentoUm! / 1000, 3);
    expect(linha.larguraMm).toBeCloseTo(linha.larguraUm! / 1000, 3);
    expect(linha.areaMm2).toBeCloseTo(linha.areaUm2! / 1e6, 4);
  });

  it('mantém três casas: a 7,06 µm/px um pixel vale 0,007 mm', () => {
    // Arredondar para duas casas jogaria fora resolução que a imagem tem.
    const [linha] = buildMeasurements({
      marks: [marca(100, 100)],
      segmentations: [retangulo(1, 100, 100, 10, 4)],
      metadata: metadados(UM_POR_PX),
    });

    // 10 px * 7,0556 = 70,6 µm = 0,071 mm — some com duas casas.
    expect(linha.comprimentoMm).toBeCloseTo(0.071, 3);
    expect(linha.comprimentoMm).toBeGreaterThan(0);
  });

  it('fica vazio sem calibração, como as colunas em µm', () => {
    const [linha] = buildMeasurements({
      marks: [marca(500, 500)],
      segmentations: [retangulo(1, 500, 500, 165, 48)],
      metadata: metadados(undefined),
    });

    expect(linha.comprimentoPx).toBeGreaterThan(0);
    expect(linha.comprimentoUm).toBeUndefined();
    expect(linha.comprimentoMm).toBeUndefined();
    expect(linha.areaMm2).toBeUndefined();
  });

  it('não inventa medida quando não há contorno casado', () => {
    // Marca longe de qualquer segmentação: só posição e classe.
    const [linha] = buildMeasurements({
      marks: [marca(50, 50)],
      segmentations: [retangulo(1, 900, 900, 100, 40)],
      metadata: metadados(UM_POR_PX),
    });

    expect(linha.origem).toBe('manual');
    expect(linha.comprimentoMm).toBeUndefined();
  });
});

describe('casamento entre marcação e contorno', () => {
  // Semente de orquídea a 3600 DPI: ~165 px de comprimento. O raio fixo de
  // 25 px da versão anterior era menor que 1/6 do objeto, então marcar a ponta
  // não casava com nada — e a linha saía sem morfometria nenhuma.
  const semente = retangulo(1, 500, 500, 165, 48);

  it('casa quando a marcação está na PONTA da semente, longe do centroide', () => {
    // 70 px do centro: quase três vezes o antigo raio de 25 px.
    const [linha] = buildMeasurements({
      marks: [marca(570, 500)],
      segmentations: [semente],
      metadata: metadados(UM_POR_PX),
    });

    expect(linha.origem).toBe('ia');
    expect(linha.comprimentoMm).toBeCloseTo(1.16, 2);
  });

  it('casa em qualquer ponto dentro do contorno', () => {
    for (const [x, y] of [
      [425, 490],
      [500, 520],
      [575, 505],
    ]) {
      const [linha] = buildMeasurements({
        marks: [marca(x, y)],
        segmentations: [semente],
        metadata: metadados(UM_POR_PX),
      });
      expect(linha.origem, `marcação em ${x},${y}`).toBe('ia');
    }
  });

  it('não casa com contorno distante', () => {
    const [linha] = buildMeasurements({
      marks: [marca(2000, 2000)],
      segmentations: [semente],
      metadata: metadados(UM_POR_PX),
    });
    expect(linha.origem).toBe('manual');
    expect(linha.comprimentoMm).toBeUndefined();
  });

  it('cada contorno é usado por uma marcação só', () => {
    const linhas = buildMeasurements({
      marks: [
        { id: 1, x: 500, y: 500, type: 'viable' },
        { id: 2, x: 505, y: 502, type: 'viable' },
      ],
      segmentations: [semente],
      metadata: metadados(UM_POR_PX),
    });

    expect(linhas.filter((l) => l.origem === 'ia')).toHaveLength(1);
    expect(linhas.filter((l) => l.origem === 'manual')).toHaveLength(1);
  });

  it('escala com o tamanho do objeto, não com uma constante', () => {
    // O mesmo teste com um ladrilho pequeno: semente de 20 px. A marcação a
    // 9 px do centro tem de casar, e a 200 px não.
    const pequena = retangulo(2, 100, 100, 20, 8);
    const perto = buildMeasurements({
      marks: [marca(109, 100)],
      segmentations: [pequena],
      metadata: metadados(UM_POR_PX),
    });
    const longe = buildMeasurements({
      marks: [marca(300, 100)],
      segmentations: [pequena],
      metadata: metadados(UM_POR_PX),
    });

    expect(perto[0].origem).toBe('ia');
    expect(longe[0].origem).toBe('manual');
  });
});
