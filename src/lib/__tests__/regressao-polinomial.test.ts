import { describe, it, expect } from 'vitest';
import {
  ajustarGrau,
  pontoDeOtimo,
  regressaoPolinomial,
  equacaoComoTexto,
  avaliarPolinomio,
  type PontoDeRegressao,
} from '../regressao-polinomial';

/** y = a + b·x + c·x² exato, para os testes de recuperação. */
function parabola(a: number, b: number, c: number, xs: number[]): PontoDeRegressao[] {
  return xs.map((x) => ({ x, y: a + b * x + c * x * x }));
}

describe('ajustarGrau — recupera polinômios conhecidos exatamente', () => {
  it('reta y = 2 + 3x', () => {
    const r = ajustarGrau(parabola(2, 3, 0, [0, 1, 2, 3, 4]), 1);
    expect(r).not.toBeNull();
    expect(r!.coeficientes[0]).toBeCloseTo(2, 9);
    expect(r!.coeficientes[1]).toBeCloseTo(3, 9);
    expect(r!.r2).toBeCloseTo(1, 12);
  });

  it('parábola em potencial osmótico: y = 80 + 60x − 60x², ótimo em −0,5 MPa', () => {
    // O desenho real do grupo: 0; −0,3; −0,6; −0,9; −1,2 MPa. Vértice em
    // x = −b/(2a) = −60/(2·(−60)) = 0,5?? — não: com c = −60 e b = 60 o vértice
    // é +0,5. Para o ótimo cair em −0,5 (como no artigo de soja) usa-se b = −60.
    const pontos = parabola(80, -60, -60, [0, -0.3, -0.6, -0.9, -1.2]);
    const r = ajustarGrau(pontos, 2)!;
    expect(r.coeficientes[0]).toBeCloseTo(80, 8);
    expect(r.coeficientes[1]).toBeCloseTo(-60, 8);
    expect(r.coeficientes[2]).toBeCloseTo(-60, 8);
    const o = pontoDeOtimo(r, [-1.2, 0])!;
    expect(o.tipo).toBe('maximo');
    expect(o.x).toBeCloseTo(-0.5, 9);
    expect(o.y).toBeCloseTo(80 + 30 - 15, 8);
    expect(o.dentroDaFaixa).toBe(true);
  });

  it('cúbica em horas (0–504) fica bem condicionada graças ao centrado/escalado', () => {
    const xs = [0, 48, 96, 168, 240, 336, 408, 504];
    const pontos = xs.map((x) => ({ x, y: 5 + 0.2 * x - 0.0008 * x * x + 0.000001 * x ** 3 }));
    const r = ajustarGrau(pontos, 3)!;
    expect(r.coeficientes[3]).toBeCloseTo(0.000001, 10);
    expect(r.coeficientes[2]).toBeCloseTo(-0.0008, 8);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('recusa quando não há graus de liberdade ou x é constante', () => {
    expect(ajustarGrau(parabola(1, 1, 0, [0, 1, 2]), 2)).toBeNull();
    expect(ajustarGrau([{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }], 1)).toBeNull();
  });
});

describe('pontoDeOtimo', () => {
  it('ótimo fora da faixa é dito como tal, nunca devolvido como resposta válida', () => {
    // Vértice em x = 5, mas os níveis testados vão só até 2.
    const r = ajustarGrau(parabola(0, 10, -1, [0, 0.5, 1, 1.5, 2]), 2)!;
    const o = pontoDeOtimo(r, [0, 2])!;
    expect(o.x).toBeCloseTo(5, 8);
    expect(o.dentroDaFaixa).toBe(false);
  });

  it('grau 1 não tem ótimo interior', () => {
    const r = ajustarGrau(parabola(1, 2, 0, [0, 1, 2, 3]), 1)!;
    expect(pontoDeOtimo(r, [0, 3])).toBeNull();
  });
});

describe('regressaoPolinomial — recomendação de grau', () => {
  it('numa parábola limpa recomenda grau 2, e o grau 3 não acrescenta nada', () => {
    // Ruído pequeno e determinístico, para o teste sequencial ter resíduo.
    const xs = [0, -0.3, -0.6, -0.9, -1.2, 0, -0.3, -0.6, -0.9, -1.2];
    const ruido = [0.4, -0.3, 0.2, -0.5, 0.1, -0.2, 0.3, -0.1, 0.5, -0.4];
    const pontos = parabola(80, -60, -60, xs).map((p, i) => ({ x: p.x, y: p.y + ruido[i] }));
    const r = regressaoPolinomial(pontos)!;
    expect(r.recomendado).toBe(2);
    expect(r.ajustes[1].pSequencial!).toBeLessThan(0.05);
    expect(r.ajustes[2].pSequencial!).toBeGreaterThan(0.05);
    expect(r.otimo!.x).toBeCloseTo(-0.5, 1);
    expect(r.motivo).toMatch(/grau 2/);
  });

  it('numa reta limpa recomenda grau 1', () => {
    const xs = [0, 8, 16, 24, 32, 48, 0, 8, 16, 24, 32, 48];
    const ruido = [0.3, -0.2, 0.1, -0.4, 0.2, 0.0, -0.3, 0.4, -0.1, 0.2, -0.2, 0.1];
    const pontos = xs.map((x, i) => ({ x, y: 10 + 0.5 * x + ruido[i] }));
    const r = regressaoPolinomial(pontos)!;
    expect(r.recomendado).toBe(1);
    expect(r.otimo).toBeNull();
  });

  it('quando nem a reta é significativa, diz isso em vez de inventar um ótimo', () => {
    const pontos = [0, 1, 2, 3, 4, 5].map((x, i) => ({ x, y: 50 + [0.5, -0.4, 0.3, -0.5, 0.2, -0.1][i] }));
    const r = regressaoPolinomial(pontos)!;
    expect(r.recomendado).toBe(1);
    expect(r.motivo).toMatch(/não varia/);
    expect(r.otimo).toBeNull();
  });

  it('menos de três pontos não ajusta', () => {
    expect(regressaoPolinomial([{ x: 0, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });
});

describe('equacaoComoTexto', () => {
  it('escreve como num artigo, com sinais', () => {
    const r = ajustarGrau(parabola(80, -60, -60, [0, -0.3, -0.6, -0.9, -1.2]), 2)!;
    expect(equacaoComoTexto(r, 1)).toBe('ŷ = 80.0 − 60.0·x − 60.0·x²');
  });

  it('avaliarPolinomio e a equação concordam', () => {
    const c = [1, -2, 0.5];
    expect(avaliarPolinomio(c, 3)).toBeCloseTo(1 - 6 + 4.5, 12);
  });
});
