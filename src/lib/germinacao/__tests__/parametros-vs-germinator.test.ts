// =============================================================================
// Oráculo: 24 amostras reais com a saída da planilha original do Germinator.
//
// Dois grupos de teste, de propósito:
//
//   1. DEFINIÇÕES — cada parâmetro é calculado a partir dos a, b, c DA
//      PLANILHA. Se bate, a fórmula é a mesma; o otimizador não entra.
//   2. AJUSTE — o nosso ajuste contra o da planilha. A planilha (Solver do
//      Excel) só chegou ao mínimo verdadeiro em parte das amostras; o
//      critério é por dados: onde a soma de quadrados da planilha está a
//      0,05 % da nossa, a, b, c têm que bater; nas outras, a nossa tem que
//      ser menor ou igual. Ver a nota em hill.ts.
// =============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ajustarHill,
  fracoesObservadas,
  somaDeQuadrados,
  r2DoAjuste,
  type AjusteDeHill,
  type AmostraDeGerminacao,
} from '../hill';
import {
  aucDaCurva,
  calcularParametros,
  gMaxObservado,
  indiceDeDormencia,
  indiceDeEstresse,
  mgtDaCurva,
  parametrosDoAjuste,
  tXRelativoAoMaximo,
  tXRelativoAoTotal,
  uniformidade7525,
} from '../parametros';

interface SaidaDaPlanilha {
  'gMAX (%)': number;
  a: number;
  b: number;
  't50 maxG (Cs, hr)': number;
  'u7525 (hr)': number;
  r2: number;
  't20 maxG (hr)': number;
  AUC: number;
  't50 totS   (hr)'?: number;
  't20  totS   (hr)'?: number;
  MGT: number;
  't50 maxG / MGT': number;
}
interface Fixture {
  configuracao: { germinacao_minima_sementes: number; tMAX_para_AUC_h: number; pct_para_tx: number; limite_r2: number };
  tempos_h: number[];
  amostras: { codigo: string; sementes: number; contagens: number[]; saida: SaidaDaPlanilha }[];
}

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'germinator-llanero.json'), 'utf8')) as Fixture;
const config = {
  germinacaoMinima: fixture.configuracao.germinacao_minima_sementes,
  tMaxParaAuc: fixture.configuracao.tMAX_para_AUC_h,
  percentualParaTx: fixture.configuracao.pct_para_tx,
  r2Minimo: fixture.configuracao.limite_r2,
};

const casos = fixture.amostras.map((am, i) => {
  const amostra: AmostraDeGerminacao = {
    codigo: `${am.codigo}#${(i % 4) + 1}`,
    sementes: am.sementes,
    leituras: fixture.tempos_h.map((horas, k) => ({ horas, acumulado: am.contagens[k] })),
  };
  const s = am.saida;
  const ajustePlanilha: AjusteDeHill = {
    y0: 0,
    a: s.a,
    b: s.b,
    c: s['t50 maxG (Cs, hr)'],
    somaDeQuadrados: somaDeQuadrados(fixture.tempos_h, fracoesObservadas(amostra), 0, s.a, s.b, s['t50 maxG (Cs, hr)']),
    iteracoes: 0,
    r2: s.r2,
  };
  return { nome: amostra.codigo, amostra, saida: s, ajustePlanilha };
});

const relativo = (v: number, ref: number) => Math.abs(v - ref) / Math.abs(ref);

describe('definições dos parâmetros, com os a, b, c da planilha', () => {
  it.each(casos)('$nome', ({ amostra, saida, ajustePlanilha }) => {
    const horas = fixture.tempos_h;
    const fr = fracoesObservadas(amostra);

    // gMAX — exato
    expect(gMaxObservado(amostra)).toBeCloseTo(saida['gMAX (%)'], 12);

    // t-x maxG e u7525 — fórmulas fechadas, 1e-10 relativo
    expect(relativo(tXRelativoAoMaximo(ajustePlanilha, 20), saida['t20 maxG (hr)'])).toBeLessThan(1e-10);
    expect(relativo(uniformidade7525(ajustePlanilha), saida['u7525 (hr)'])).toBeLessThan(1e-10);

    // t50/t20 totS — null quando a planilha deixa vazio (a ≤ p)
    const t50TotS = tXRelativoAoTotal(ajustePlanilha, 50);
    const t20TotS = tXRelativoAoTotal(ajustePlanilha, 20);
    const t50Plan = saida['t50 totS   (hr)'];
    const t20Plan = saida['t20  totS   (hr)'];
    if (t50Plan === undefined) expect(t50TotS).toBeNull();
    else {
      expect(t50TotS).not.toBeNull();
      if (t50TotS !== null) expect(relativo(t50TotS, t50Plan)).toBeLessThan(1e-10);
    }
    if (t20Plan === undefined) expect(t20TotS).toBeNull();
    else {
      expect(t20TotS).not.toBeNull();
      if (t20TotS !== null) expect(relativo(t20TotS, t20Plan)).toBeLessThan(1e-10);
    }

    // r² — sem o ponto (0,0); a planilha guarda em precisão simples → 1e-6
    expect(Math.abs(r2DoAjuste(horas, fr, ajustePlanilha) - saida.r2)).toBeLessThan(1e-6);

    // AUC — Riemann à direita, passo 0,1 h → 1e-7 relativo
    expect(relativo(aucDaCurva(ajustePlanilha, 504), saida.AUC)).toBeLessThan(1e-7);

    // MGT — ∫ t·dy / a até tMAX; pior caso conhecido 0,0151 h (ver parametros.ts)
    const mgt = mgtDaCurva(ajustePlanilha, 504);
    expect(Math.abs(mgt - saida.MGT)).toBeLessThan(0.02);
    expect(Math.abs(ajustePlanilha.c / mgt - saida['t50 maxG / MGT'])).toBeLessThan(2e-4);
  });

  it('o resíduo do MGT é sistemático: a planilha fica sempre um pouco abaixo', () => {
    // Registro do que não foi recuperado. Se um dia a fórmula exata aparecer,
    // este teste é o que muda.
    for (const { saida, ajustePlanilha } of casos) {
      const d = saida.MGT - mgtDaCurva(ajustePlanilha, 504);
      expect(d).toBeLessThan(0.0005);
      expect(d).toBeGreaterThan(-0.016);
    }
  });

  it('a planilha respeita a ≤ gMAX, e a restrição está ativa em 4 amostras', () => {
    // Contado na fixture: T8#2 (0,38), T16#2 (0,40), T32#4 (0,36), T48#2 (0,42).
    // A primeira versão deste teste dizia 5 — era o número errado, não o código.
    const ativas: string[] = [];
    for (const { nome, saida } of casos) {
      expect(saida.a).toBeLessThanOrEqual(saida['gMAX (%)'] + 1e-12);
      if (Math.abs(saida.a - saida['gMAX (%)']) < 1e-12) ativas.push(nome);
    }
    expect(ativas).toEqual(['T8#2', 'T16#2', 'T32#4', 'T48#2']);
  });
});

describe('ajuste contra a planilha', () => {
  const ajustes = casos.map((caso) => {
    const r = ajustarHill(caso.amostra, config);
    if (r.ajuste === null) throw new Error(`${caso.nome}: ${r.motivo}`);
    return { ...caso, nosso: r.ajuste };
  });
  const convergidos = ajustes.filter((c) => c.ajustePlanilha.somaDeQuadrados <= c.nosso.somaDeQuadrados * 1.0005);
  const naoConvergidos = ajustes.filter((c) => !convergidos.includes(c));

  it('a nossa soma de quadrados nunca é pior que a da planilha (24/24)', () => {
    for (const c of ajustes) {
      expect(c.nosso.somaDeQuadrados).toBeLessThanOrEqual(c.ajustePlanilha.somaDeQuadrados * (1 + 1e-9));
    }
  });

  it('a planilha convergiu de verdade em exatamente 8 amostras', () => {
    expect(convergidos.map((c) => c.nome)).toEqual(['T8#3', 'T16#2', 'T16#4', 'T32#4', 'T48#1', 'T48#2', 'T48#3', 'T48#4']);
  });

  it.each(convergidos)('$nome: a, b, c batem a 0,1 %', ({ nosso, ajustePlanilha }) => {
    expect(relativo(nosso.a, ajustePlanilha.a)).toBeLessThan(1e-3);
    expect(relativo(nosso.b, ajustePlanilha.b)).toBeLessThan(1e-3);
    expect(relativo(nosso.c, ajustePlanilha.c)).toBeLessThan(1e-3);
  });

  it.each(convergidos)('$nome: parâmetros derivados do nosso ajuste batem com a planilha', ({ amostra, nosso, saida }) => {
    const p = parametrosDoAjuste(amostra, nosso, config);
    expect(relativo(p.t50MaxG, saida['t50 maxG (Cs, hr)'])).toBeLessThan(1e-3);
    expect(relativo(p.tXMaxG, saida['t20 maxG (hr)'])).toBeLessThan(2e-3);
    expect(relativo(p.uniformidade, saida['u7525 (hr)'])).toBeLessThan(2e-3);
    expect(relativo(p.auc, saida.AUC)).toBeLessThan(1e-3);
    expect(relativo(p.mgt, saida.MGT)).toBeLessThan(1e-3);
    expect(Math.abs(p.r2 - saida.r2)).toBeLessThan(1e-5);
  });

  // Dois jeitos diferentes de a planilha não ter convergido, e o teste
  // precisa distinguir, porque a garantia é diferente em cada um:
  //
  // (a) PAROU PERTO DO CHUTE: b ficou em ~20 (o valor inicial) e o Solver
  //     declarou vitória cedo. O nosso mínimo é melhor e o t50 (c) fica na
  //     mesma região — mesmo vale, só mais fundo.
  // (b) CAIU EM MÍNIMO LOCAL: c ≈ 151 h com r² < 0,9 (T8#1, T16#3, T32#3).
  //     Aqui c NÃO fica na mesma região — o nosso está em outro vale, e o
  //     critério honesto é que o r² nosso seja claramente maior.
  //
  // A primeira versão deste teste exigia "b desce" para todos: verdadeiro em
  // 15, falso em T8#2 (r² da planilha já era 1). A segunda exigia "c na mesma
  // região" para todos: falso nos três do caso (b). O critério da planilha
  // para separar os dois casos é o próprio r² dela.
  const minimoLocal = naoConvergidos.filter((c) => c.saida.r2 < 0.9);
  const pararamCedo = naoConvergidos.filter((c) => !minimoLocal.includes(c));

  it('os três do mínimo local são os esperados', () => {
    expect(minimoLocal.map((c) => c.nome).sort()).toEqual(['T16#3', 'T32#3', 'T8#1']);
  });

  it.each(pararamCedo)('$nome: a planilha parou perto do chute; o nosso mínimo é melhor e c fica na mesma região', ({ nosso, ajustePlanilha }) => {
    expect(nosso.somaDeQuadrados).toBeLessThan(ajustePlanilha.somaDeQuadrados);
    expect(Math.abs(nosso.c - ajustePlanilha.c) / ajustePlanilha.c).toBeLessThan(0.15);
  });

  it.each(minimoLocal)('$nome: a planilha caiu num mínimo local (c≈151, r²<0,9); o nosso r² é claramente maior', ({ nosso, ajustePlanilha, saida, amostra }) => {
    expect(nosso.somaDeQuadrados).toBeLessThan(ajustePlanilha.somaDeQuadrados);
    const horas = amostra.leituras.map((l) => l.horas);
    const fracoes = amostra.leituras.map((l) => l.acumulado / amostra.sementes);
    const r2Nosso = r2DoAjuste(horas, fracoes, nosso);
    expect(r2Nosso).toBeGreaterThan(saida.r2 + 0.05);
  });

  it('o otimizador converge nas duas passadas e fica bem abaixo das 10 000 iterações', () => {
    for (const c of ajustes) expect(c.nosso.iteracoes).toBeLessThan(2000);
    const media = ajustes.reduce((s, c) => s + c.nosso.iteracoes, 0) / ajustes.length;
    expect(media).toBeLessThan(1000);
  });
});

describe('calcularParametros (ponta a ponta)', () => {
  it('devolve os campos com null onde a planilha deixa vazio', () => {
    const t32 = casos.find((c) => c.nome === 'T32#1');
    if (t32 === undefined) throw new Error('fixture');
    const r = calcularParametros(t32.amostra, config);
    expect(r.parametros).not.toBeNull();
    if (r.parametros === null) return;
    expect(r.parametros.gMax).toBe(0.2);
    expect(r.parametros.t50TotS).toBeNull();
    expect(r.parametros.tXTotS).toBeNull(); // a < 0,2
    expect(r.parametros.r2AbaixoDoLimite).toBe(false);
    expect(r.parametros.assimetria).toBeCloseTo(r.parametros.t50MaxG / r.parametros.mgt, 12);
  });

  it('recusa com motivo quando germinam menos de 3', () => {
    const r = calcularParametros({ codigo: 'q', sementes: 50, leituras: [{ horas: 48, acumulado: 0 }, { horas: 96, acumulado: 1 }, { horas: 168, acumulado: 2 }] }, config);
    expect(r.parametros).toBeNull();
    expect(r.motivo).toMatch(/mínimo/);
  });
});

describe('índices de dormência e de estresse (sem oráculo: coerência)', () => {
  it('sinal e simetria', () => {
    expect(indiceDeDormencia(250, 250)).toBe(0);
    expect(indiceDeDormencia(250, 180)).toBeCloseTo(70, 12);
    expect(indiceDeDormencia(180, 250)).toBeCloseTo(-70, 12);
    expect(indiceDeEstresse(250, 180)).toBeCloseTo(70, 12);
    expect(indiceDeEstresse(250, 250)).toBe(0);
  });
  it('com AUCs reais: T0 (sem priming) contra T48', () => {
    const t0 = casos[0];
    const t48 = casos[20];
    expect(indiceDeEstresse(t0.saida.AUC, t48.saida.AUC)).toBeGreaterThan(0);
  });
});
