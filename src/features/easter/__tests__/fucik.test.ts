import { describe, it, expect } from 'vitest';
import { betaDeFucik, primeiraCurvaDeFucik, nivelDoPasso, DISSERTACAO } from '../fucik';

describe('primeira curva de Fučik (p = 2, 1D)', () => {
  const l1 = 1;
  it('passa pela diagonal em (4λ₁, 4λ₁): duas corcovas iguais de meio-período L/2', () => {
    expect(betaDeFucik(4 * l1, l1)).toBeCloseTo(4 * l1, 9);
  });
  it('é simétrica: (α, β) na curva ⇒ (β, α) na curva', () => {
    const b = betaDeFucik(9, l1)!;
    expect(betaDeFucik(b, l1)).toBeCloseTo(9, 9);
  });
  it('é estritamente decrescente e converge à reta trivial β = λ₁', () => {
    const c = primeiraCurvaDeFucik(l1, 64, 1e6);
    for (let i = 1; i < c.length; i++) expect(c[i][1]).toBeLessThan(c[i - 1][1]);
    expect(c[c.length - 1][1]).toBeCloseTo(l1, 2);
    expect(c[0][1]).toBeGreaterThan(100); // perto de α = λ₁, β explode: a outra reta trivial
  });
  it('não existe para α ≤ λ₁', () => {
    expect(betaDeFucik(1, 1)).toBeNull();
    expect(betaDeFucik(0.5, 1)).toBeNull();
  });
});

describe('nível do passo da montanha', () => {
  it('é o menor, entre os caminhos, do maior custo ao longo do caminho', () => {
    expect(nivelDoPasso([[1, 5, 2], [1, 3, 2], [1, 9, 0]])).toBe(3);
    expect(nivelDoPasso([])).toBeNull();
  });
});

describe('dissertação', () => {
  it('o link é o handle da biblioteca', () => {
    expect(DISSERTACAO.url).toBe('http://hdl.handle.net/11449/242691');
  });
});
