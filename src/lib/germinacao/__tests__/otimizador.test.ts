import { describe, it, expect } from 'vitest';
import { nelderMead } from '../otimizador';

describe('nelderMead', () => {
  it('parábola em 3 dimensões: chega ao mínimo conhecido', () => {
    const f = (x: readonly number[]) => (x[0] - 1) ** 2 + (x[1] + 2) ** 2 + (x[2] - 0.5) ** 2 + 7;
    const r = nelderMead(f, [10, 10, 10]);
    expect(r.convergiu).toBe(true);
    expect(r.x[0]).toBeCloseTo(1, 6);
    expect(r.x[1]).toBeCloseTo(-2, 6);
    expect(r.x[2]).toBeCloseTo(0.5, 6);
    expect(r.valor).toBeCloseTo(7, 10);
  });

  it('Rosenbrock: o vale curvo, mínimo em (1, 1)', () => {
    const f = (x: readonly number[]) => 100 * (x[1] - x[0] * x[0]) ** 2 + (1 - x[0]) ** 2;
    const r = nelderMead(f, [-1.2, 1]);
    expect(r.convergiu).toBe(true);
    expect(r.x[0]).toBeCloseTo(1, 5);
    expect(r.x[1]).toBeCloseTo(1, 5);
    expect(r.valor).toBeLessThan(1e-12);
  });

  it('ponto de partida com coordenada zero ainda gera simplex não degenerado', () => {
    const f = (x: readonly number[]) => (x[0] - 3) ** 2 + (x[1] - 4) ** 2;
    const r = nelderMead(f, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(4, 6);
  });

  it('+Infinity fora da região viável: o mínimo restrito fica na fronteira', () => {
    // mínimo livre em x = 5; restrito a x ≤ 2 fica em 2
    const f = (x: readonly number[]) => (x[0] > 2 ? Number.POSITIVE_INFINITY : (x[0] - 5) ** 2 + (x[1] - 1) ** 2);
    const r = nelderMead(f, [2, 0]);
    expect(r.x[0]).toBeCloseTo(2, 6);
    expect(r.x[1]).toBeCloseTo(1, 6);
  });

  it('respeita maxIteracoes e avisa que não convergiu', () => {
    const f = (x: readonly number[]) => 100 * (x[1] - x[0] * x[0]) ** 2 + (1 - x[0]) ** 2;
    const r = nelderMead(f, [-1.2, 1], { maxIteracoes: 5 });
    expect(r.iteracoes).toBe(5);
    expect(r.convergiu).toBe(false);
  });

  it('mínimo exatamente zero: a tolerância absoluta encerra sem esgotar as iterações', () => {
    const f = (x: readonly number[]) => x[0] * x[0] + x[1] * x[1];
    const r = nelderMead(f, [1, 1]);
    expect(r.convergiu).toBe(true);
    expect(r.iteracoes).toBeLessThan(10_000);
    expect(r.valor).toBeLessThan(1e-18);
  });

  it('recusa ponto de partida vazio', () => {
    expect(() => nelderMead(() => 0, [])).toThrow();
  });
});
