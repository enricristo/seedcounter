import { describe, it, expect } from 'vitest';
import { enumerarObjetos } from '../objetos';
import { contarObjetos } from '../contagem';
import { buildMeasurements } from '../measurements';
import type { Mark, YoloSegmentation } from '../../types';

const quadrado = (cx: number, cy: number, r = 10): [number, number][] => [
  [cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r],
];
const marca = (id: number, x: number, y: number, type: Mark['type'] = 'viable'): Mark => ({ id, x, y, type });
const contorno = (id: number, cx: number, cy: number, extra: Partial<YoloSegmentation> = {}): YoloSegmentation => ({
  id, category: 'viable', class_name: 'viavel', confidence: 1, polygon_points: quadrado(cx, cy), visible: true, ...extra,
});

describe('enumerarObjetos — a lista que contagem, medidas, canvas e CSV compartilham', () => {
  it('marcação com contorno que a contém vira UM objeto (marca+contorno)', () => {
    const o = enumerarObjetos([marca(1, 100, 100)], [contorno(10, 100, 100, { origem: 'clique', marcaId: 1 })]);
    expect(o).toHaveLength(1);
    expect(o[0].natureza).toBe('marca+contorno');
    expect(o[0].indice).toBe(1);
  });

  it('contorno do modelo sem marcação vale por uma semente e ganha índice depois das marcações', () => {
    const o = enumerarObjetos([marca(1, 100, 100)], [contorno(10, 300, 300, { origem: 'modelo' })]);
    expect(o.map((x) => [x.indice, x.natureza])).toEqual([[1, 'marca'], [2, 'contorno']]);
    expect(o[1].x).toBeCloseTo(300);
  });

  it('contorno de clique órfão NÃO vira objeto; oculto também não', () => {
    const o = enumerarObjetos([], [contorno(10, 1, 1, { origem: 'clique' }), contorno(11, 50, 50, { origem: 'modelo', visible: false })]);
    expect(o).toHaveLength(0);
  });

  it('marcaId declarado vence a geometria', () => {
    const o = enumerarObjetos(
      [marca(1, 100, 100), marca(2, 300, 300)],
      [contorno(10, 300, 300, { marcaId: 1 }), contorno(11, 100, 100, { marcaId: 2 })]
    );
    expect(o[0].contorno?.id).toBe(10);
    expect(o[1].contorno?.id).toBe(11);
  });

  it('contagem, medidas e índices batem: N objetos, N linhas, índices 1..N', () => {
    const marks = [marca(1, 100, 100), marca(2, 200, 200, 'inviable')];
    const segs = [contorno(10, 100, 100, { origem: 'clique', marcaId: 1 }), contorno(11, 400, 400, { origem: 'modelo' })];
    const objetos = enumerarObjetos(marks, segs);
    const contagem = contarObjetos(marks, segs);
    const linhas = buildMeasurements({ marks, segmentations: segs, metadata: {} as never });
    expect(contagem.total).toBe(3);
    expect(objetos).toHaveLength(3);
    expect(linhas.map((l) => l.objectId)).toEqual([1, 2, 3]);
    expect(linhas.map((l) => l.origem)).toEqual(['ia', 'manual', 'modelo']);
    // a semente do modelo tem medida, não só contagem
    expect(linhas[2].areaPx).toBeCloseTo(400, 0);
  });
});
