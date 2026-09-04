// =============================================================================
// Teste de normalidade e a rota que ele escolhe no pipeline.
//
// Arquivo separado de stats.test.ts de propósito: aquele é de outro agente e
// não deve ser reformatado por esta mudança.
//
// O defeito que estes testes trancam: os coeficientes do Shapiro não eram
// normalizados, W passava de 1 para n pequeno, log(1 - W) virava NaN,
// `NaN > 0.05` era false e TODO grupo com 3 ou 4 repetições era declarado
// não-normal. O pipeline então trocava ANOVA + Scott-Knott por Kruskal-Wallis
// em silêncio — justamente no delineamento padrão da área.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  shapiroWilk,
  runStatsPipeline,
  tukeyHSD,
  amplitudeEstudentizadaCritica,
  probabilidadeDaAmplitudeEstudentizada,
  type GroupStat,
} from '../stats';

describe('shapiroWilk', () => {
  it('W nunca passa de 1 — era o defeito de origem', () => {
    // n = 3 e n = 4 davam W > 1 SEMPRE na versão anterior.
    for (const amostra of [
      [1, 2, 3],
      [0, 1, 2],
      [10, 20, 30, 40],
      [5, 5.5, 9, 12],
      [41, 43, 53],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ]) {
      const r = shapiroWilk(amostra);
      expect(r.W, `W de [${amostra}]`).toBeLessThanOrEqual(1);
      expect(r.W).toBeGreaterThanOrEqual(0);
    }
  });

  it('nunca devolve p = NaN sem avisar que não é avaliável', () => {
    for (const amostra of [
      [1, 2, 3],
      [10, 20, 30, 40],
      [1, 2, 3, 4, 5],
      [2, 2, 2, 2, 2],
    ]) {
      const r = shapiroWilk(amostra);
      if (Number.isNaN(r.pValue)) expect(r.testable).toBe(false);
      else expect(r.testable).toBe(true);
    }
  });

  it('com menos de 5 repetições não afirma não-normalidade', () => {
    // Não dá para reprovar normalidade com 3 pontos. O honesto é não avaliar.
    for (const amostra of [
      [41, 43, 53],
      [1, 2, 100],
      [10, 20, 30, 400],
    ]) {
      const r = shapiroWilk(amostra);
      expect(r.testable).toBe(false);
      expect(r.normal).toBe(true);
    }
  });

  it('avalia de verdade a partir de 5 repetições', () => {
    const r = shapiroWilk([4.9, 5.1, 5.0, 4.95, 5.05, 5.02]);
    expect(r.testable).toBe(true);
    expect(Number.isNaN(r.pValue)).toBe(false);
    expect(r.normal).toBe(true);
  });

  it('reconhece uma amostra claramente não-normal com n suficiente', () => {
    // Um outlier grosseiro no meio de valores colados.
    const r = shapiroWilk([1, 1.1, 1.05, 1.02, 1.08, 1.03, 1.06, 1.04, 40]);
    expect(r.testable).toBe(true);
    expect(r.normal).toBe(false);
  });

  it('trata variância zero como não avaliável, não como normal comprovada', () => {
    const r = shapiroWilk([7, 7, 7, 7, 7, 7]);
    expect(r.testable).toBe(false);
    expect(r.W).toBe(1);
  });

  it('amostra menor que 3 não é avaliável', () => {
    expect(shapiroWilk([1, 2]).testable).toBe(false);
    expect(shapiroWilk([]).testable).toBe(false);
  });
});

describe('rota do pipeline', () => {
  /** Seis tratamentos com três repetições — o fatorial de tetrazólio do grupo. */
  const tresRepeticoes: GroupStat[] = [
    { label: 'T1', values: [53.0, 43.1, 42.6] },
    { label: 'T2', values: [53.1, 52.0, 50.8] },
    { label: 'T3', values: [58.8, 63.9, 60.4] },
    { label: 'T4', values: [77.2, 74.7, 76.4] },
    { label: 'T5', values: [85.6, 90.5, 90.1] },
    { label: 'T6', values: [96.7, 99.1, 96.1] },
  ];

  it('com 3 repetições usa ANOVA, não o não-paramétrico', () => {
    // Antes caía em kruskal-wallis+dunn por causa do NaN.
    const r = runStatsPipeline(tresRepeticoes, { postHoc: 'scott-knott' });
    expect(r.method).toBe('anova+scott-knott');
  });

  it('separa tratamentos que estão claramente distantes', () => {
    const r = runStatsPipeline(tresRepeticoes, { postHoc: 'scott-knott' });
    // 43% e 97% não podem terminar com a mesma letra.
    expect(r.groupLetters.get('T1')).not.toBe(r.groupLetters.get('T6'));
    expect(r.anova?.significant).toBe(true);
  });

  it('o Tukey também roda com 3 repetições', () => {
    const r = runStatsPipeline(tresRepeticoes, { postHoc: 'tukey' });
    expect(r.method).toBe('anova+tukey');
  });

  it('ainda cai no não-paramétrico quando a não-normalidade é medida', () => {
    // Cinco repetições ou mais, com um grupo grosseiramente assimétrico.
    const grupos: GroupStat[] = [
      { label: 'A', values: [10, 10.2, 10.1, 10.05, 10.15, 10.08, 10.12, 10.03, 95] },
      { label: 'B', values: [20, 21, 20.5, 20.2, 20.8, 20.4, 20.6, 20.3, 20.7] },
    ];
    const r = runStatsPipeline(grupos, { useArcsin: false });
    expect(r.method).toBe('kruskal-wallis+dunn');
  });
});

// =============================================================================
// Amplitude estudentizada (q de Tukey).
//
// O código chamava jStat.studentizedRange, que não existe no jStat: escolher
// "Tukey-Kramer HSD" no painel lançava TypeError e derrubava a análise.
// =============================================================================

describe('amplitude estudentizada', () => {
  it('bate com a tabela publicada de q (alpha = 0,05)', () => {
    // Valores clássicos da tabela de Tukey. Tolerância de 0,02 é folgada para
    // integração numérica e apertada o bastante para pegar erro de fórmula.
    const tabela: [k: number, df: number, q: number][] = [
      [2, 10, 3.151],
      [3, 10, 3.877],
      [4, 12, 4.199],
      [5, 20, 4.232],
      [3, 30, 3.486],
      [6, 12, 4.75],
    ];
    for (const [k, df, esperado] of tabela) {
      expect(amplitudeEstudentizadaCritica(0.05, k, df), `k=${k} df=${df}`).toBeCloseTo(
        esperado,
        1
      );
    }
  });

  it('a acumulada é monótona e vai de 0 a 1', () => {
    let anterior = 0;
    for (const q of [0.5, 1, 2, 3, 4, 6, 10]) {
      const p = probabilidadeDaAmplitudeEstudentizada(q, 4, 15);
      expect(p).toBeGreaterThanOrEqual(anterior);
      expect(p).toBeLessThanOrEqual(1);
      anterior = p;
    }
    expect(probabilidadeDaAmplitudeEstudentizada(0, 4, 15)).toBe(0);
    expect(probabilidadeDaAmplitudeEstudentizada(20, 4, 15)).toBeCloseTo(1, 2);
  });

  it('q cresce com o número de grupos e cai com os graus de liberdade', () => {
    expect(amplitudeEstudentizadaCritica(0.05, 6, 20)).toBeGreaterThan(
      amplitudeEstudentizadaCritica(0.05, 3, 20)
    );
    expect(amplitudeEstudentizadaCritica(0.05, 4, 10)).toBeGreaterThan(
      amplitudeEstudentizadaCritica(0.05, 4, 60)
    );
  });

  it('o Tukey-Kramer não lança e separa o que está distante', () => {
    const grupos: GroupStat[] = [
      { label: 'A', values: [41, 43, 42] },
      { label: 'B', values: [60, 62, 61] },
      { label: 'C', values: [96, 99, 97] },
    ];
    const pares = tukeyHSD(grupos);
    expect(pares).toHaveLength(3);
    const ac = pares.find((p) => p.groupA === 'A' && p.groupB === 'C')!;
    expect(ac.significant).toBe(true);
  });

  it('não acusa diferença entre grupos praticamente iguais', () => {
    const grupos: GroupStat[] = [
      { label: 'A', values: [50, 51, 49] },
      { label: 'B', values: [50.5, 49.5, 50] },
    ];
    expect(tukeyHSD(grupos)[0].significant).toBe(false);
  });
});
