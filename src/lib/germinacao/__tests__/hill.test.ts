import { describe, it, expect } from 'vitest';
import {
  ajustarHill,
  cInicial,
  derivadaDeHill,
  hill,
  r2DoAjuste,
  tempoNaFracaoDeA,
  type AmostraDeGerminacao,
} from '../hill';

function amostra(contagens: number[], sementes = 50, horas = [48, 96, 168, 240, 336, 408, 504]): AmostraDeGerminacao {
  return { codigo: 'x', sementes, leituras: contagens.map((acumulado, i) => ({ horas: horas[i], acumulado })) };
}

describe('hill (a função)', () => {
  it('vale y0 em x ≤ 0, a/2 em x = c, e tende a y0 + a', () => {
    expect(hill(0, 0.6, 20, 90, 0)).toBe(0);
    expect(hill(0.1, 0.6, 20, 90, -5)).toBe(0.1);
    expect(hill(0, 0.6, 20, 90, 90)).toBeCloseTo(0.3, 12);
    expect(hill(0.1, 0.6, 20, 90, 90)).toBeCloseTo(0.4, 12);
    expect(hill(0, 0.6, 20, 90, 1e6)).toBeCloseTo(0.6, 12);
  });

  it('não estoura para b grande: (x/c)^b em vez de x^b / c^b', () => {
    expect(Number.isFinite(hill(0, 0.5, 200, 90, 504))).toBe(true);
    expect(hill(0, 0.5, 200, 90, 504)).toBeCloseTo(0.5, 12);
  });

  it('a derivada bate com diferenças finitas', () => {
    const h = 1e-4;
    for (const x of [30, 90, 150]) {
      const numerica = (hill(0, 0.6, 5, 90, x + h) - hill(0, 0.6, 5, 90, x - h)) / (2 * h);
      expect(derivadaDeHill(0.6, 5, 90, x)).toBeCloseTo(numerica, 8);
    }
    expect(derivadaDeHill(0.6, 5, 90, 0)).toBe(0);
  });

  it('tempoNaFracaoDeA é o inverso da curva', () => {
    const t = tempoNaFracaoDeA(5, 90, 0.2);
    expect(hill(0, 1, 5, 90, t)).toBeCloseTo(0.2, 12);
    expect(tempoNaFracaoDeA(5, 90, 0.5)).toBeCloseTo(90, 12);
  });
});

describe('cInicial', () => {
  it('interpola o tempo em que a fração cruza metade do gMAX', () => {
    // gMAX 0,62 → alvo 0,31; entre 48 h (0) e 96 h (0,42): 48 + 48·0,31/0,42
    expect(cInicial([48, 96, 168], [0, 0.42, 0.62])).toBeCloseTo(48 + (48 * 0.31) / 0.42, 10);
  });
  it('cruzamento na primeira leitura parte de (0, 0)', () => {
    expect(cInicial([48, 96], [0.5, 0.5])).toBeCloseTo(24, 10);
  });
});

describe('r2DoAjuste', () => {
  it('ajuste exato dá 1; leituras constantes sem ajuste exato dão 0', () => {
    const horas = [48, 96, 168];
    const fr = horas.map((h) => hill(0, 0.5, 5, 90, h));
    expect(r2DoAjuste(horas, fr, { y0: 0, a: 0.5, b: 5, c: 90 })).toBeCloseTo(1, 12);
    expect(r2DoAjuste(horas, [0.4, 0.4, 0.4], { y0: 0, a: 0.5, b: 5, c: 90 })).toBe(0);
  });
});

describe('ajustarHill', () => {
  it('recupera parâmetros de uma curva sintética sem ruído', () => {
    const horas = [24, 48, 72, 96, 120, 168, 240, 336];
    const sementes = 100;
    const contagens = horas.map((h) => Math.round(sementes * hill(0, 0.8, 4, 80, h)));
    const r = ajustarHill(amostra(contagens, sementes, horas));
    expect(r.ajuste).not.toBeNull();
    if (r.ajuste === null) return;
    expect(r.ajuste.a).toBeCloseTo(0.8, 2);
    expect(r.ajuste.b).toBeCloseTo(4, 1);
    expect(r.ajuste.c).toBeCloseTo(80, 0);
    expect(r.ajuste.r2).toBeGreaterThan(0.999);
    expect(r.ajuste.y0).toBe(0);
  });

  it('respeita a ≤ gMAX', () => {
    const r = ajustarHill(amostra([0, 8, 16, 19, 20, 20, 20]));
    expect(r.ajuste).not.toBeNull();
    if (r.ajuste === null) return;
    expect(r.ajuste.a).toBeLessThanOrEqual(0.4 + 1e-12);
  });

  it('recusa com menos de germinacaoMinima germinadas ao fim', () => {
    const r = ajustarHill(amostra([0, 0, 1, 2, 2, 2, 2]));
    expect(r.ajuste).toBeNull();
    expect(r.motivo).toMatch(/mínimo para ajustar é 3/);
    const r2 = ajustarHill(amostra([0, 0, 1, 2, 2, 2, 2]), { germinacaoMinima: 2 });
    expect(r2.ajuste).not.toBeNull();
  });

  it('recusa amostras malformadas com motivo', () => {
    expect(ajustarHill(amostra([0, 5, 4, 6, 6, 6, 6])).motivo).toMatch(/não pode diminuir/);
    expect(ajustarHill(amostra([0, 5, 60, 60, 60, 60, 60])).motivo).toMatch(/fora de 0\.\.sementes/);
    expect(ajustarHill(amostra([5, 10], 50, [48, 48])).motivo).toMatch(/três leituras/);
    expect(ajustarHill(amostra([5, 10, 12], 50, [48, 48, 96])).motivo).toMatch(/crescentes/);
    expect(ajustarHill(amostra([5, 10, 12], 0, [48, 96, 168])).motivo).toMatch(/sem sementes/);
  });
});
