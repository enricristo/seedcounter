// =============================================================================
// SeedCounter — testes do resumo de morfometria
//
// O que mais importa provar aqui NÃO é a mediana em si — é que a razão C/L é
// calculada por objeto. median(comprimento)/median(largura) e
// median(comprimento_i/largura_i) são contas diferentes, e só a segunda
// denuncia o contorno que engoliu a vizinha (ver header de resumo.ts).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { estatistica, resumir } from '../resumo';
import type { SeedMeasurement } from '../../../lib/measurements';

/** Linha mínima de SeedMeasurement, com contorno por padrão (origem 'ia'). */
function linha(parcial: Partial<SeedMeasurement>): SeedMeasurement {
  return {
    objectId: 1,
    classe: 'viavel',
    origem: 'ia',
    x: 0,
    y: 0,
    ...parcial,
  };
}

describe('estatistica', () => {
  it('vetor vazio dá null', () => {
    expect(estatistica([])).toBeNull();
  });

  it('mediana com n ímpar é o valor central', () => {
    const r = estatistica([5, 1, 3]);
    expect(r?.n).toBe(3);
    expect(r?.mediana).toBe(3);
  });

  it('mediana com n par é a média dos dois do meio', () => {
    const r = estatistica([1, 2, 3, 4]);
    expect(r?.mediana).toBe(2.5);
  });

  it('p5 e p95 num vetor conhecido, por interpolação linear', () => {
    const valores = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10
    const r = estatistica(valores)!;
    // índice = (p/100)*(n-1): p5 -> 0.45 entre 1 e 2; p95 -> 8.55 entre 9 e 10.
    expect(r.p5).toBeCloseTo(1.45, 9);
    expect(r.p95).toBeCloseTo(9.55, 9);
    expect(r.minimo).toBe(1);
    expect(r.maximo).toBe(10);
    expect(r.media).toBeCloseTo(5.5, 9);
  });

  it('ignora valores não finitos sem quebrar', () => {
    const r = estatistica([1, NaN, 2, Infinity, 3, -Infinity]);
    expect(r?.n).toBe(3);
    expect(r?.mediana).toBe(2);
  });

  it('com um único valor, todo percentil é o próprio valor', () => {
    const r = estatistica([42]);
    expect(r).toEqual({ n: 1, mediana: 42, media: 42, p5: 42, p95: 42, minimo: 42, maximo: 42 });
  });
});

describe('resumir', () => {
  it('sem calibração: px preenchido, mm nulo', () => {
    const rows = [
      linha({ classe: 'viavel', comprimentoPx: 100, larguraPx: 50, areaPx: 4000 }),
      linha({ classe: 'inviavel', comprimentoPx: 120, larguraPx: 60, areaPx: 5000 }),
    ];

    const r = resumir(rows);

    expect(r.calibrado).toBe(false);
    expect(r.umPerPixel).toBeUndefined();
    expect(r.comprimentoMm).toBeNull();
    expect(r.larguraMm).toBeNull();
    expect(r.areaMm2).toBeNull();

    expect(r.total).toBe(2);
    expect(r.viaveis).toBe(1);
    expect(r.inviaveis).toBe(1);
    expect(r.percentViaveis).toBe(50);
    expect(r.comContorno).toBe(2);
    expect(r.semContorno).toBe(0);
    expect(r.comprimentoPx?.mediana).toBe(110);
  });

  it('com calibração: mm coerente com px × µm/px ÷ 1000 (área ÷ 1e6)', () => {
    const umPerPixel = 7.06;
    const rows = [linha({ comprimentoPx: 100, larguraPx: 50, areaPx: 4000 })];

    const r = resumir(rows, umPerPixel);

    expect(r.calibrado).toBe(true);
    expect(r.umPerPixel).toBe(umPerPixel);
    expect(r.comprimentoMm?.mediana).toBeCloseTo((100 * umPerPixel) / 1000, 9);
    expect(r.larguraMm?.mediana).toBeCloseTo((50 * umPerPixel) / 1000, 9);
    expect(r.areaMm2?.mediana).toBeCloseTo((4000 * umPerPixel * umPerPixel) / 1e6, 9);
  });

  it('razão C/L é calculada por objeto, não a razão das medianas', () => {
    const rows = [
      linha({ comprimentoPx: 10, larguraPx: 1 }), // razão 10
      linha({ comprimentoPx: 1, larguraPx: 10 }), // razão 0,1
    ];

    const r = resumir(rows);

    // Mediana das razões POR OBJETO: (10 + 0,1) / 2 = 5,05.
    expect(r.razaoCL?.mediana).toBeCloseTo(5.05, 9);
    // A razão das medianas (median(comp)=5.5 / median(larg)=5.5 = 1) seria bem
    // diferente — é exatamente essa conta errada que o teste rejeita.
    expect(r.razaoCL?.mediana).not.toBeCloseTo(1, 1);
  });

  it('objetos sem contorno contam no total mas não em comContorno', () => {
    const rows = [
      linha({ comprimentoPx: 100, larguraPx: 50, areaPx: 4000 }),
      linha({ origem: 'manual' }), // marcação ainda sem contorno associado
    ];

    const r = resumir(rows);

    expect(r.total).toBe(2);
    expect(r.comContorno).toBe(1);
    expect(r.semContorno).toBe(1);
  });

  it('ignora valores não finitos nas medidas sem quebrar o resumo', () => {
    const rows = [
      linha({ comprimentoPx: NaN, larguraPx: 50, areaPx: 4000 }),
      linha({ comprimentoPx: 100, larguraPx: 50, areaPx: 4000 }),
    ];

    expect(() => resumir(rows)).not.toThrow();
    const r = resumir(rows);
    expect(r.comprimentoPx?.n).toBe(1);
    expect(r.comprimentoPx?.mediana).toBe(100);
  });

  it('sem nenhuma linha, tudo fica vazio e nada quebra', () => {
    const r = resumir([]);
    expect(r.total).toBe(0);
    expect(r.percentViaveis).toBe(0);
    expect(r.comprimentoPx).toBeNull();
    expect(r.razaoCL).toBeNull();
  });
});
