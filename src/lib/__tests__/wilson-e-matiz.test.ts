// =============================================================================
// Dois números que saíam errados, e nenhum teste pegava.
//
// WILSON. O intervalo é binomial: o `n` dele é o número de SEMENTES. O
// cálculo usava `values.length` — o número de REPETIÇÕES. Quatro repetições
// de 50 sementes viravam `n = 4` em vez de 200, e o intervalo saía cerca de
// sete vezes mais largo do que é. Era a barra desenhada nos gráficos de
// germinação, que é figura de artigo.
//
// MATIZ. É um ÂNGULO. 350° e 10° são dois vermelhos vizinhos, e a média
// aritmética deles dá 180° — ciano. O vermelho do tetrazólio vive em torno do
// zero, que é o pior lugar possível para essa conta: uma semente bem corada
// podia sair descrita como azulada em `h_mean`, no CSV e no SQL.
//
// Achados por uma revisão em 24/09/2026 e conferidos aqui no código.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { wilsonCI, runStatsPipeline, type GroupStat } from '../stats';
import type { TreatmentStats } from '../../types';
import { extrairCaracteristicasDeCor } from '../color-features';

describe('intervalo de Wilson: o n é de sementes', () => {
  it('o n errado alarga o intervalo várias vezes', () => {
    // 80% em quatro repetições de 50 sementes.
    const certo = wilsonCI(160, 200);
    const errado = wilsonCI(3, 4); // o que o código fazia: 75% de 4 "sementes"
    const larguraCerta = certo.upper - certo.lower;
    const larguraErrada = errado.upper - errado.lower;
    expect(larguraErrada / larguraCerta).toBeGreaterThan(5);
  });

  it('compareGroups usa as sementes quando elas vêm junto', () => {
    const grupos: GroupStat[] = [
      { label: 'T0', values: [80, 80, 80, 80], sementesPorRepeticao: [50, 50, 50, 50] },
      { label: 'T8', values: [60, 60, 60, 60], sementesPorRepeticao: [50, 50, 50, 50] },
    ];
    const r = runStatsPipeline(grupos);
    const t0 = r.treatmentStats.find((t: TreatmentStats) => t.treatmentId === 'T0')!;
    expect(t0.ci).not.toBeNull();
    // 160/200 pelo Wilson: aproximadamente [0,739; 0,850].
    expect(t0.ci!.lower).toBeCloseTo(0.739, 2);
    expect(t0.ci!.upper).toBeCloseTo(0.85, 2);
  });

  it('sem o número de sementes, o intervalo fica VAZIO — não inventado', () => {
    const grupos: GroupStat[] = [
      { label: 'T0', values: [80, 80, 80, 80] },
      { label: 'T8', values: [60, 60, 60, 60] },
    ];
    const r = runStatsPipeline(grupos);
    expect(r.treatmentStats.every((t: TreatmentStats) => t.ci === null)).toBe(true);
  });

  it('denominador incompleto ou zerado também não vira intervalo', () => {
    const faltando: GroupStat[] = [
      { label: 'T0', values: [80, 80], sementesPorRepeticao: [50] },
      { label: 'T8', values: [60, 60], sementesPorRepeticao: [50, 0] },
    ];
    const r = runStatsPipeline(faltando);
    expect(r.treatmentStats.every((t: TreatmentStats) => t.ci === null)).toBe(true);
  });
});

/** Uma imagem de 1 pixel com a cor pedida, no formato que a extração espera. */
function pixel(r: number, g: number, b: number) {
  return { data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 };
}

/** Dois pixels lado a lado. */
function doisPixels(a: [number, number, number], b: [number, number, number]) {
  return {
    data: new Uint8ClampedArray([...a, 255, ...b, 255]),
    width: 2,
    height: 1,
  };
}

const QUADRADO: [number, number][] = [
  [0, 0],
  [2, 0],
  [2, 1],
  [0, 1],
];

describe('matiz é ângulo, não número', () => {
  it('dois vermelhos vizinhos dão vermelho — não ciano', () => {
    // Matiz ~350° e ~10°: a média aritmética daria 180° (ciano).
    const a: [number, number, number] = [255, 0, 42]; // ~350°
    const b: [number, number, number] = [255, 42, 0]; // ~10°
    const c = extrairCaracteristicasDeCor(doisPixels(a, b), QUADRADO, 1);
    // O resultado tem de estar perto de 0/360, não perto de 180.
    const distanciaDoVermelho = Math.min(c.hMean, 360 - c.hMean);
    expect(distanciaDoVermelho).toBeLessThan(15);
  });

  it('um matiz só sai exatamente ele, com desvio zero', () => {
    const c = extrairCaracteristicasDeCor(doisPixels([0, 0, 255], [0, 0, 255]), QUADRADO, 1);
    expect(c.hMean).toBeCloseTo(240, 1); // azul
    expect(c.hStd).toBeCloseTo(0, 3);
  });

  it('matizes opostos não têm direção dominante — e o resultado NÃO é a média', () => {
    // Vermelho (0°) e ciano (180°): o vetor resultante é ~zero. Não existe
    // "matiz médio" aqui; o que não pode acontecer é sair 90° (verde-água),
    // que é o que a média aritmética daria.
    const c = extrairCaracteristicasDeCor(doisPixels([255, 0, 0], [0, 255, 255]), QUADRADO, 1);
    expect(Math.abs(c.hMean - 90)).toBeGreaterThan(30);
  });

  it('pixel único continua devolvendo o matiz dele', () => {
    const c = extrairCaracteristicasDeCor(
      pixel(0, 255, 0),
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      1
    );
    expect(c.hMean).toBeCloseTo(120, 1); // verde
  });
});
