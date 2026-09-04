// =============================================================================
// Statistics Engine — SeedCounter
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Tests implemented:
//   - Wilson Score CI (proportions)
//   - IVG / GSI — Maguire (1962)
//   - MGT — Mean Germination Time
//   - arcsin√x data transformation (for ANOVA of percentages)
//   - Shapiro-Wilk normality test (n < 50)
//   - One-way ANOVA
//   - Tukey-Kramer HSD (post-hoc after ANOVA, handles unequal n)
//   - Scott-Knott recursive clustering (standard in Brazilian agronomy)
//   - Kruskal-Wallis H-test
//   - Dunn's test with Holm correction (post-hoc after Kruskal-Wallis)
// =============================================================================

import jStat from 'jstat';
import { mean as ssMean, standardDeviation as ssSd, quantile } from 'simple-statistics';
import type {
  ConfidenceInterval,
  GerminationReading,
  ANOVAResult,
  ComparisonPair,
  TreatmentStats,
} from '../types';

// ---------------------------------------------------------------------------
// GroupStat — input type for multi-group tests
// ---------------------------------------------------------------------------

export interface GroupStat {
  label: string;
  values: number[]; // germination % values (0–100) per replicate
}

// ---------------------------------------------------------------------------
// Wilson Score CI — for binomial proportions
// Preferred over Wald for small n or extreme proportions (0% or 100%)
// ---------------------------------------------------------------------------

/**
 * Wilson Score Interval for binomial proportion.
 * Returns bounds in the [0, 1] range (multiply by 100 for %).
 *
 * @param successes - number of germinated seeds
 * @param total     - total seeds tested
 * @param alpha     - significance level (default 0.05 → 95% CI)
 */
export function wilsonCI(successes: number, total: number, alpha = 0.05): ConfidenceInterval {
  if (total === 0) return { lower: 0, upper: 0, center: 0 };

  const p = successes / total;
  const z = alpha === 0.05 ? 1.96 : alpha === 0.01 ? 2.576 : 1.645;
  const n = total;
  const z2n = (z * z) / n;
  const denom = 1 + z2n;
  const center = (p + z2n / 2) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2n / (4 * n))) / denom;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  };
}

// ---------------------------------------------------------------------------
// IVG — Índice de Velocidade de Germinação (Maguire, 1962)
// International equivalent: GSI (Germination Speed Index)
// ---------------------------------------------------------------------------

/**
 * Calculates IVG (Maguire, 1962).
 * IVG = Σ(Gi / Ni)
 *   Gi = seeds germinated ON day i (NOT cumulative)
 *   Ni = number of days after sowing
 *
 * Higher IVG → faster, more vigorous seed lot.
 */
export function calculateIVG(readings: GerminationReading[]): number {
  return readings.reduce((sum, { day, germinated }) => {
    if (day <= 0 || germinated <= 0) return sum;
    return sum + germinated / day;
  }, 0);
}

/**
 * MGT — Mean Germination Time (days)
 * MGT = Σ(Gi × Ni) / ΣGi
 */
export function calculateMGT(readings: GerminationReading[]): number {
  const totalGerminated = readings.reduce((s, r) => s + r.germinated, 0);
  if (totalGerminated === 0) return 0;
  const weightedDays = readings.reduce((s, r) => s + r.germinated * r.day, 0);
  return weightedDays / totalGerminated;
}

/**
 * CVG — Coefficient of Velocity of Germination (%)
 * CVG = (ΣGi / Σ(Gi×Ni)) × 100
 */
export function calculateCVG(readings: GerminationReading[]): number {
  const mgt = calculateMGT(readings);
  return mgt > 0 ? (1 / mgt) * 100 : 0;
}

/**
 * t50 — time to 50% germination (linear interpolation)
 */
export function calculateT50(readings: GerminationReading[], totalSeeds: number): number | null {
  if (totalSeeds === 0) return null;
  const target = totalSeeds * 0.5;

  // Build cumulative curve sorted by day
  let cumulative = 0;
  const curve = readings
    .sort((a, b) => a.day - b.day)
    .map((r) => {
      cumulative += r.germinated;
      return { day: r.day, cum: cumulative };
    });

  for (let i = 1; i < curve.length; i++) {
    if (curve[i].cum >= target) {
      // Linear interpolation
      const slope = (curve[i].day - curve[i - 1].day) / (curve[i].cum - curve[i - 1].cum);
      return curve[i - 1].day + slope * (target - curve[i - 1].cum);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Data Transformation
// ---------------------------------------------------------------------------

/**
 * arcsin√x transformation for percentage data before ANOVA.
 * Standard practice in Brazilian agricultural statistics (SISVAR, etc.)
 *
 * @param p - proportion [0, 1]
 * @returns transformed value in radians
 */
export function arcsinTransform(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  return Math.asin(Math.sqrt(clamped));
}

/** Transform an array of percentage values (0–100) for ANOVA */
export function transformPercentages(values: number[]): number[] {
  return values.map((v) => arcsinTransform(v / 100));
}

// ---------------------------------------------------------------------------
// Normality Test — Shapiro-Wilk (n < 50)
// ---------------------------------------------------------------------------

export interface NormalityResult {
  W: number;
  pValue: number;
  normal: boolean;
  /** false quando n é pequeno demais para o teste dizer alguma coisa. */
  testable: boolean;
}

/**
 * Estatística W de Shapiro-Francia (a variante do Shapiro-Wilk que usa os
 * escores normais normalizados), com o valor-p pela aproximação de Royston.
 *
 * POR QUE FOI REESCRITA.
 *
 * A versão anterior somava os coeficientes a_i SEM dividir pela norma do vetor
 * de escores normais. Sem essa divisão a desigualdade de Cauchy-Schwarz não
 * limita W, e para n pequeno W passava de 1 — em n = 3 e n = 4, SEMPRE.
 * Aí `Math.log(1 - W)` de um W maior que 1 é NaN, `NaN > 0.05` é false, e o
 * grupo era declarado NÃO-NORMAL.
 *
 * O efeito era silencioso e grave: todo ensaio com 3 ou 4 repetições — que é o
 * delineamento padrão em tecnologia de sementes, e é o dos trabalhos do grupo —
 * reprovava na normalidade e o pipeline trocava ANOVA + Scott-Knott por
 * Kruskal-Wallis + Dunn sem que ninguém percebesse. A tela mostrava
 * "W = 1,000 · p = NaN · Não-normal".
 *
 * A segunda correção é de honestidade: abaixo de n = 5 a aproximação de Royston
 * não vale e o teste não tem poder nenhum. Não dá para AFIRMAR não-normalidade
 * com 3 pontos. Nesse caso o resultado volta como não avaliável (`testable:
 * false`) e não bloqueia o caminho paramétrico — que é o que a área faz na
 * prática com 3 ou 4 repetições.
 *
 * Royston, P. (1993). A Toolkit for Testing for Non-Normality in Complete and
 * Censored Samples. The Statistician 42(1):37-43.
 */
export function shapiroWilk(values: number[]): NormalityResult {
  const n = values.length;
  if (n < 3) return { W: 1, pValue: NaN, normal: true, testable: false };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = ssMean(sorted);
  const SS = sorted.reduce((s, v) => s + (v - mean) ** 2, 0);

  // Variância zero: todas as repetições iguais. Não há o que testar.
  if (SS === 0) return { W: 1, pValue: NaN, normal: true, testable: false };

  // Escores normais esperados, normalizados: a = m / ||m||. É a normalização
  // que garante W ≤ 1.
  const m: number[] = [];
  for (let i = 1; i <= n; i++) m.push(jStat.normal.inv((i - 0.375) / (n + 0.25), 0, 1));
  const norma = Math.sqrt(m.reduce((s, v) => s + v * v, 0));

  let b = 0;
  for (let i = 0; i < n; i++) b += (m[i] / norma) * sorted[i];

  const W = Math.min(1, Math.max(0, (b * b) / SS));

  if (n < 5) return { W, pValue: NaN, normal: true, testable: false };

  const u = Math.log(n);
  const v = Math.log(u);
  const mu = -1.2725 + 1.0521 * (v - u);
  const sigma = Math.max(0.01, 1.0308 - 0.26758 * (v + 2 / u));
  // W === 1 dá log(0) = -Infinity, z = -Infinity e p = 1 — que é o certo para
  // uma amostra perfeitamente alinhada com a normal.
  const z = (Math.log(1 - W) - mu) / sigma;
  const pValue = 1 - jStat.normal.cdf(z, 0, 1);

  return { W, pValue, normal: pValue > 0.05, testable: true };
}

// ---------------------------------------------------------------------------
// One-Way ANOVA
// ---------------------------------------------------------------------------

export function oneWayANOVA(groups: GroupStat[]): ANOVAResult {
  const k = groups.length;
  const allValues = groups.flatMap((g) => g.values);
  const N = allValues.length;
  const grandMean = ssMean(allValues);

  const SSB = groups.reduce((s, g) => {
    const gm = ssMean(g.values);
    return s + g.values.length * (gm - grandMean) ** 2;
  }, 0);

  const SSW = groups.reduce((s, g) => {
    const gm = ssMean(g.values);
    return s + g.values.reduce((gs, v) => gs + (v - gm) ** 2, 0);
  }, 0);

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = SSB / dfBetween;
  const msWithin = SSW / dfWithin;
  const fStat = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = 1 - jStat.centralF.cdf(fStat, dfBetween, dfWithin);

  return {
    fStat,
    pValue,
    dfBetween,
    dfWithin,
    msBetween,
    msWithin,
    significant: pValue < 0.05,
  };
}

// ---------------------------------------------------------------------------
// Distribuição da amplitude estudentizada (q de Tukey)
//
// POR QUE ESTÁ IMPLEMENTADA AQUI.
//
// O código chamava `jStat.studentizedRange.inv(...)`. Essa distribuição NÃO
// existe no jStat: a chamada lançava `Cannot read properties of undefined`, e
// escolher "Tukey-Kramer HSD" no painel quebrava a análise inteira. O erro só
// não aparecia sempre porque o pipeline caía no Scott-Knott na maioria dos
// casos — e, com o bug do Shapiro, no Kruskal-Wallis.
//
// A distribuição é uma integral dupla e não tem forma fechada; abaixo ela é
// integrada por Simpson e invertida por bisseção. Aproximar q por
// sqrt(2)·t_Bonferroni seria mais curto e daria HSD conservador demais — em
// comparação de médias isso vira diferença declarada como não significativa
// que na verdade é significativa.
// ---------------------------------------------------------------------------

/** log Γ(x) por Lanczos. Escrito aqui para não depender de mais uma API do jStat. */
function logGama(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGama(1 - x);
  const z = x - 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) a += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Simpson composto em [a, b] com `n` subintervalos (n par). */
function simpson(f: (x: number) => number, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (s * h) / 3;
}

const densidadeNormal = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

/**
 * Acumulada da normal padrão por Abramowitz & Stegun 7.1.26 (erro < 1,5e-7).
 *
 * Existe por velocidade, não por precisão: a integral dupla abaixo avalia esta
 * função centenas de milhares de vezes por valor crítico, e `jStat.normal.cdf`
 * nesse volume levava a análise a segundos de travamento no navegador.
 */
function acumuladaNormal(x: number): number {
  const sinal = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sinal * y);
}

/**
 * P(amplitude de k normais padrão independentes < w).
 *
 * = k ∫ φ(z) [Φ(z) − Φ(z − w)]^(k−1) dz
 */
function probabilidadeDaAmplitude(w: number, k: number): number {
  if (w <= 0) return 0;
  const f = (z: number) => {
    const d = acumuladaNormal(z) - acumuladaNormal(z - w);
    return d <= 0 ? 0 : densidadeNormal(z) * Math.pow(d, k - 1);
  };
  return Math.min(1, k * simpson(f, -7.5, 7.5, 140));
}

/**
 * P(q < Q) para a amplitude estudentizada com k grupos e `df` graus de
 * liberdade do resíduo — a amplitude dividida pelo desvio estimado.
 */
export function probabilidadeDaAmplitudeEstudentizada(Q: number, k: number, df: number): number {
  if (Q <= 0) return 0;
  // Com muitos graus de liberdade o denominador vira 1 e sobra a amplitude pura.
  if (!Number.isFinite(df) || df > 3000) return probabilidadeDaAmplitude(Q, k);

  // Densidade de s = raiz(qui-quadrado_df / df), o desvio padrão estimado.
  const logC = (df / 2) * Math.log(df) - logGama(df / 2) - (df / 2 - 1) * Math.LN2;
  const densidade = (s: number) =>
    s <= 0 ? 0 : Math.exp(logC + (df - 1) * Math.log(s) - (df * s * s) / 2);

  // s se concentra em torno de 1; fora desta janela a densidade é desprezível.
  const meio = Math.max(0, 1 - 8 / Math.sqrt(df));
  const fim = 1 + 8 / Math.sqrt(df);
  return Math.min(1, simpson((s) => densidade(s) * probabilidadeDaAmplitude(Q * s, k), meio, fim, 40));
}

/**
 * Valor crítico q de Tukey: o Q tal que P(q < Q) = 1 − alpha.
 *
 * Memorizado porque é integral dupla invertida por bisseção: sem cache, mexer
 * num controle do painel refaria centenas de milhares de avaliações a cada
 * re-renderização.
 */
const cacheDeQ = new Map<string, number>();

export function amplitudeEstudentizadaCritica(alpha: number, k: number, df: number): number {
  const chave = `${alpha}|${k}|${df}`;
  const guardado = cacheDeQ.get(chave);
  if (guardado !== undefined) return guardado;

  const alvo = 1 - alpha;
  let baixo = 0;
  let alto = 30;
  // 30 bisseções em [0, 30] dão ~3e-8, muito abaixo do erro da integração.
  for (let i = 0; i < 30; i++) {
    const meio = (baixo + alto) / 2;
    if (probabilidadeDaAmplitudeEstudentizada(meio, k, df) < alvo) baixo = meio;
    else alto = meio;
  }

  const q = (baixo + alto) / 2;
  cacheDeQ.set(chave, q);
  return q;
}

// ---------------------------------------------------------------------------
// Tukey-Kramer HSD (post-hoc after ANOVA — handles unequal n)
// ---------------------------------------------------------------------------

export function tukeyHSD(groups: GroupStat[], alpha = 0.05): ComparisonPair[] {
  const k = groups.length;
  const means = groups.map((g) => ssMean(g.values));
  const ns = groups.map((g) => g.values.length);
  const N = ns.reduce((a, b) => a + b, 0);
  const dfWithin = N - k;

  const SSW = groups.reduce(
    (s, g, i) => s + g.values.reduce((gs, v) => gs + (v - means[i]) ** 2, 0),
    0
  );
  const MSW = SSW / dfWithin;

  const qCrit = amplitudeEstudentizadaCritica(alpha, k, dfWithin);
  const results: ComparisonPair[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      // Tukey-Kramer SE for unequal sample sizes
      const se = Math.sqrt((MSW / 2) * (1 / ns[i] + 1 / ns[j]));
      const hsd = qCrit * se;
      const diff = Math.abs(means[i] - means[j]);
      results.push({
        groupA: groups[i].label,
        groupB: groups[j].label,
        meanDiff: means[i] - means[j],
        significant: diff > hsd,
        pAdj: diff > hsd ? alpha : 1,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Scott-Knott Recursive Clustering
// Standard post-hoc in Brazilian agronomy publications (SISVAR compatible)
// Produces non-overlapping letter groups — no ambiguity
// ---------------------------------------------------------------------------

export function scottKnott(groups: GroupStat[], alpha = 0.05): Map<string, string> {
  const letterMap = new Map<string, string>();
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  let letterIdx = 0;

  function groupMean(g: GroupStat) {
    return ssMean(g.values);
  }

  function grandSS(grps: GroupStat[]): number {
    const all = grps.flatMap((g) => g.values);
    const gm = ssMean(all);
    return all.reduce((s, v) => s + (v - gm) ** 2, 0);
  }

  function recurse(grps: GroupStat[]) {
    if (grps.length === 0) return;
    if (grps.length === 1) {
      letterMap.set(grps[0].label, LETTERS[letterIdx] ?? '?');
      return;
    }

    // Sort by mean descending (required for SK algorithm)
    const sorted = [...grps].sort((a, b) => groupMean(b) - groupMean(a));

    // Find optimal split (maximises between-group SS)
    let bestSplit = 1;
    let bestBetweenSS = -Infinity;
    const totalSS = grandSS(sorted);

    if (totalSS === 0) {
      sorted.forEach((g) => letterMap.set(g.label, LETTERS[letterIdx] ?? '?'));
      return;
    }

    for (let s = 1; s < sorted.length; s++) {
      const left = sorted.slice(0, s);
      const right = sorted.slice(s);
      const betweenSS = totalSS - grandSS(left) - grandSS(right);
      if (betweenSS > bestBetweenSS) {
        bestBetweenSS = betweenSS;
        bestSplit = s;
      }
    }

    // Chi-square significance test for the split
    const N = sorted.flatMap((g) => g.values).length;
    const chiStat = N * (bestBetweenSS / totalSS);
    const pValue = 1 - jStat.chisquare.cdf(chiStat, 1);

    if (pValue < alpha) {
      // Significant split — recurse each sub-group independently
      recurse(sorted.slice(0, bestSplit));
      letterIdx++;
      recurse(sorted.slice(bestSplit));
    } else {
      // No significant difference — assign same letter to all in group
      sorted.forEach((g) => letterMap.set(g.label, LETTERS[letterIdx] ?? '?'));
    }
  }

  recurse(groups);
  return letterMap;
}

// ---------------------------------------------------------------------------
// Kruskal-Wallis H-test (non-parametric alternative to ANOVA)
// ---------------------------------------------------------------------------

export function kruskalWallis(groups: GroupStat[]): {
  H: number;
  pValue: number;
  significant: boolean;
} {
  const k = groups.length;
  const allValues = groups.flatMap((g, gi) => g.values.map((v) => ({ v, gi })));
  const N = allValues.length;

  // Rank all values
  const sorted = [...allValues].sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(N);

  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && sorted[j].v === sorted[j + 1].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  // Map ranks back to groups
  const groupRankSums = new Array<number>(k).fill(0);
  sorted.forEach((item, idx) => {
    groupRankSums[item.gi] += ranks[idx];
  });

  // H statistic (correction for ties not applied — acceptable for typical data)
  const H =
    (12 / (N * (N + 1))) *
      groups.reduce((s, g, gi) => s + groupRankSums[gi] ** 2 / g.values.length, 0) -
    3 * (N + 1);

  const pValue = 1 - jStat.chisquare.cdf(H, k - 1);

  return { H, pValue, significant: pValue < 0.05 };
}

// ---------------------------------------------------------------------------
// Dunn's Test (post-hoc after Kruskal-Wallis) — Holm correction
// ---------------------------------------------------------------------------

export function dunnTest(
  groups: GroupStat[],
  correction: 'holm' | 'bonferroni' = 'holm'
): Array<ComparisonPair & { z: number }> {
  const k = groups.length;
  const allValues = groups.flatMap((g, gi) => g.values.map((v) => ({ v, gi })));
  const N = allValues.length;

  // Rank
  const sorted = [...allValues].sort((a, b) => a.v - b.v);
  const rankArr = new Array<number>(N);
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N - 1 && sorted[j].v === sorted[j + 1].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rankArr[k] = avgRank;
    i = j + 1;
  }

  const groupRankMeans = groups.map((g, gi) => {
    const groupRanks = sorted
      .map((item, idx) => (item.gi === gi ? rankArr[idx] : null))
      .filter((r): r is number => r !== null);
    return ssMean(groupRanks);
  });

  const pairResults: Array<ComparisonPair & { z: number }> = [];

  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      const se = Math.sqrt(
        ((N * (N + 1)) / 12) * (1 / groups[a].values.length + 1 / groups[b].values.length)
      );
      const z = (groupRankMeans[a] - groupRankMeans[b]) / se;
      const pRaw = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
      pairResults.push({
        groupA: groups[a].label,
        groupB: groups[b].label,
        z,
        meanDiff: groupRankMeans[a] - groupRankMeans[b],
        significant: false,
        pAdj: pRaw,
      });
    }
  }

  // Apply correction
  const m = pairResults.length;
  if (correction === 'bonferroni') {
    pairResults.forEach((r) => (r.pAdj = Math.min(1, r.pAdj * m)));
  } else {
    // Holm step-down
    pairResults.sort((a, b) => a.pAdj - b.pAdj);
    pairResults.forEach((r, idx) => {
      r.pAdj = Math.min(1, r.pAdj * (m - idx));
    });
    // Enforce monotonicity
    for (let i = 1; i < pairResults.length; i++) {
      if (pairResults[i].pAdj < pairResults[i - 1].pAdj) {
        pairResults[i].pAdj = pairResults[i - 1].pAdj;
      }
    }
  }

  pairResults.forEach((r) => (r.significant = r.pAdj < 0.05));
  return pairResults;
}

// ---------------------------------------------------------------------------
// Full Statistical Pipeline — Auto-selects test based on normality
// ---------------------------------------------------------------------------

export interface StatsPipelineResult {
  groups: GroupStat[];
  anova?: ANOVAResult;
  kruskalWallisResult?: ReturnType<typeof kruskalWallis>;
  method: 'anova+scott-knott' | 'anova+tukey' | 'kruskal-wallis+dunn' | 'descriptive-only';
  pairwiseComparisons: ComparisonPair[];
  groupLetters: Map<string, string>;
  normalityResults: ReturnType<typeof shapiroWilk>[];
  transformed: boolean; // true if arcsin√x was applied
  treatmentStats: TreatmentStats[];
}

/**
 * Full automated statistical pipeline:
 * 1. arcsin√x transformation
 * 2. Shapiro-Wilk normality test per group
 * 3. If all groups normal → ANOVA → Scott-Knott (preferred) or Tukey
 * 4. If any non-normal → Kruskal-Wallis → Dunn (Holm)
 */
export function runStatsPipeline(
  groups: GroupStat[],
  options: {
    postHoc?: 'scott-knott' | 'tukey';
    alpha?: number;
    useArcsin?: boolean;
  } = {}
): StatsPipelineResult {
  const { postHoc = 'scott-knott', alpha = 0.05, useArcsin = true } = options;

  if (groups.length === 0 || groups.every((g) => g.values.length === 0)) {
    return {
      groups,
      method: 'descriptive-only',
      pairwiseComparisons: [],
      groupLetters: new Map(),
      normalityResults: [],
      transformed: false,
      treatmentStats: [],
    };
  }

  // Transform data if requested
  const workingGroups: GroupStat[] = useArcsin
    ? groups.map((g) => ({ label: g.label, values: transformPercentages(g.values) }))
    : groups;
  const transformed = useArcsin;

  // Normality check per group
  const normalityResults = workingGroups.map((g) => shapiroWilk(g.values));
  const allNormal = normalityResults.every((r) => r.normal);

  // Need at least 2 values per group for ANOVA
  const hasEnoughData = workingGroups.every((g) => g.values.length >= 2);

  // Treatment descriptive stats (always computed on original scale)
  const treatmentStats: TreatmentStats[] = groups.map((g) => {
    const vals = g.values;
    const n = vals.length;
    const meanVal = ssMean(vals);
    const sd = n > 1 ? ssSd(vals) : 0;
    const ci = wilsonCI(Math.round((meanVal / 100) * n), n, alpha);
    return {
      treatmentId: g.label,
      treatmentCode: g.label,
      treatmentName: g.label,
      n,
      mean: meanVal,
      sd,
      ci,
      ivg: 0, // IVG computed separately (requires time-series readings)
    };
  });

  if (!hasEnoughData || groups.length < 2) {
    return {
      groups,
      method: 'descriptive-only',
      pairwiseComparisons: [],
      groupLetters: new Map(),
      normalityResults,
      transformed,
      treatmentStats,
    };
  }

  if (allNormal) {
    // Parametric path
    const anova = oneWayANOVA(workingGroups);

    if (!anova.significant) {
      // No significant difference — all same letter
      const letters = new Map(groups.map((g) => [g.label, 'a']));
      return {
        groups,
        anova,
        method: postHoc === 'scott-knott' ? 'anova+scott-knott' : 'anova+tukey',
        pairwiseComparisons: [],
        groupLetters: letters,
        normalityResults,
        transformed,
        treatmentStats: treatmentStats.map((t) => ({ ...t, letter: 'a' })),
      };
    }

    let pairwiseComparisons: ComparisonPair[];
    let groupLetters: Map<string, string>;

    if (postHoc === 'scott-knott') {
      groupLetters = scottKnott(workingGroups, alpha);
      pairwiseComparisons = [];
    } else {
      pairwiseComparisons = tukeyHSD(workingGroups, alpha);
      // Derive letters from Tukey results
      groupLetters = deriveLettersFromPairwise(
        groups.map((g) => g.label),
        pairwiseComparisons
      );
    }

    return {
      groups,
      anova,
      method: postHoc === 'scott-knott' ? 'anova+scott-knott' : 'anova+tukey',
      pairwiseComparisons,
      groupLetters,
      normalityResults,
      transformed,
      treatmentStats: treatmentStats.map((t) => ({
        ...t,
        letter: groupLetters.get(t.treatmentId) ?? '?',
      })),
    };
  } else {
    // Non-parametric path
    const kwResult = kruskalWallis(workingGroups);
    const pairwiseComparisons = kwResult.significant ? dunnTest(workingGroups, 'holm') : [];
    const groupLetters = kwResult.significant
      ? deriveLettersFromPairwise(
          groups.map((g) => g.label),
          pairwiseComparisons
        )
      : new Map(groups.map((g) => [g.label, 'a']));

    return {
      groups,
      kruskalWallisResult: kwResult,
      method: 'kruskal-wallis+dunn',
      pairwiseComparisons,
      groupLetters,
      normalityResults,
      transformed,
      treatmentStats: treatmentStats.map((t) => ({
        ...t,
        letter: groupLetters.get(t.treatmentId) ?? '?',
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Helper — Derive letters from pairwise comparison matrix
// ---------------------------------------------------------------------------

function deriveLettersFromPairwise(labels: string[], pairs: ComparisonPair[]): Map<string, string> {
  // Build adjacency: two groups are in the same letter group if NOT significantly different
  const notDifferent = new Set<string>();
  for (const p of pairs) {
    if (!p.significant) {
      const key = [p.groupA, p.groupB].sort().join('|');
      notDifferent.add(key);
    }
  }

  // Simple greedy letter assignment
  const letterMap = new Map<string, string>();
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  let letterIdx = 0;

  for (const label of labels) {
    if (letterMap.has(label)) continue;
    const letter = LETTERS[letterIdx++] ?? '?';
    letterMap.set(label, letter);
    // Share letter with all non-significantly-different peers
    for (const other of labels) {
      if (other === label || letterMap.has(other)) continue;
      const key = [label, other].sort().join('|');
      if (notDifferent.has(key)) {
        letterMap.set(other, letter);
      }
    }
  }

  return letterMap;
}

// ---------------------------------------------------------------------------
// Descriptive Statistics Helpers
// ---------------------------------------------------------------------------

export function describeGroup(values: number[]) {
  if (values.length === 0) return null;
  return {
    n: values.length,
    mean: ssMean(values),
    sd: values.length > 1 ? ssSd(values) : 0,
    min: Math.min(...values),
    max: Math.max(...values),
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    cv: values.length > 1 ? (ssSd(values) / ssMean(values)) * 100 : 0,
  };
}
