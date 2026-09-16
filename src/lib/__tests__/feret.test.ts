// src/lib/__tests__/feret.test.ts
// =============================================================================
// Diametro de Feret.
//
// E a medida do ImageJ e do paquimetro: a maior e a menor distancia entre dois
// planos paralelos que apertam o objeto. Os dois testes prescritos pela spec —
// circulo e retangulo — sao os que definem a funcao: no circulo min = max; no
// retangulo 10x20 o maximo e a DIAGONAL (22,36), nao o lado (20).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { feret } from '../feret';
import { calculateSeedDimensions } from '../pca-utils';

type P = [number, number];
const circulo = (r: number, n = 90): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [100 + r * Math.cos(t), 100 + r * Math.sin(t)];
  });
const retangulo = (l: number, a: number): P[] => [[0, 0], [l, 0], [l, a], [0, a]];
const elipse = (a: number, b: number, n = 120): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [a * Math.cos(t), b * Math.sin(t)];
  });

describe('feret', () => {
  it('circulo: minimo e maximo iguais ao diametro', () => {
    const f = feret(circulo(30))!;
    expect(f.maximo).toBeCloseTo(60, 0);
    expect(f.minimo).toBeCloseTo(60, 0);
  });

  it('retangulo 10x20: minimo 10, maximo e a diagonal 22,36', () => {
    const f = feret(retangulo(20, 10))!;
    expect(f.minimo).toBeCloseTo(10, 5);
    expect(f.maximo).toBeCloseTo(Math.hypot(20, 10), 5);
  });

  it('o maximo NUNCA e menor que o minimo', () => {
    for (const forma of [circulo(10), retangulo(5, 50), elipse(40, 12)]) {
      const f = feret(forma)!;
      expect(f.maximo).toBeGreaterThanOrEqual(f.minimo);
    }
  });

  it('e invariante a rotacao', () => {
    const base = elipse(40, 12);
    const rot = base.map(([x, y]): P => {
      const t = 0.7;
      return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    });
    const a = feret(base)!;
    const b = feret(rot)!;
    expect(b.maximo).toBeCloseTo(a.maximo, 3);
    expect(b.minimo).toBeCloseTo(a.minimo, 3);
  });

  it('na elipse, Feret bate com a PCA — sao a mesma medida ali', () => {
    // A PCA mede extensao nos eixos principais; numa elipse eles coincidem com
    // os planos de Feret. Diferenca aqui denunciaria erro num dos dois.
    const e = elipse(40, 12);
    const f = feret(e)!;
    const pca = calculateSeedDimensions(e);
    expect(f.maximo).toBeCloseTo(pca.width, 1);
    expect(f.minimo).toBeCloseTo(pca.height, 1);
  });

  it('devolve nulo para menos de tres pontos', () => {
    expect(feret([])).toBeNull();
    expect(feret([[0, 0], [1, 1]])).toBeNull();
  });
});
