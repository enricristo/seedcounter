// =============================================================================
// SeedCounter — regressão polinomial e ponto de ótimo, para fator QUANTITATIVO
//
// POR QUE ESTE MÓDULO EXISTE.
//
// `stats.ts` compara médias: ANOVA, Tukey, Scott-Knott, Kruskal-Wallis. Tudo
// isso serve a fator QUALITATIVO — cultivar A contra B, tratamento X contra Y.
// Mas o desenho típico dos ensaios do grupo tem fator QUANTITATIVO: potencial
// osmótico em MPa (0; −0,3; −0,6; −0,9; −1,2), horas de embebição (0 a 48),
// meses de armazenamento (0 a 44). Para fator quantitativo, separar médias por
// letras é a análise errada: a pergunta não é "quais níveis diferem", é
// "como a resposta varia com o nível, e onde está o ótimo". A resposta
// publicada é do tipo "o potencial calculado de −0,52 MPa permitiu a máxima
// germinação" — e isso é o vértice de uma parábola ajustada, não uma letra.
//
// Esta lacuna estava registrada desde 03/09 como a mais específica e
// corrigível do produto. Este módulo a fecha.
//
// O QUE ELE FAZ, E O QUE NÃO FAZ.
//
// Ajusta polinômios de grau 1, 2 e 3 por mínimos quadrados, dá R², R²
// ajustado, o teste F de cada grau, o teste sequencial (o grau k acrescenta
// algo ao grau k−1?), e o ponto de ótimo: máximo ou mínimo dentro da faixa
// observada. Recomenda o grau pela regra usual — o maior grau cujo termo
// adicional é significativo a 5 % — e diz o porquê.
//
// NÃO extrapola: um ótimo fora da faixa dos níveis testados é reportado como
// "fora da faixa", nunca como resposta. Extrapolar polinômio é a forma mais
// rápida de publicar um número que não existe.
//
// A CONTA É FEITA EM x CENTRADO E ESCALADO.
//
// Horas até 504 elevadas ao cubo dão 1,3·10⁸; ao sexto (na matriz normal),
// 1,6·10¹⁶ — e a solução do sistema vira ruído de ponto flutuante. Centrar
// (x − média) e dividir pelo desvio deixa a matriz bem condicionada. Os
// coeficientes devolvidos são convertidos de volta para a escala original,
// para poderem ser escritos no artigo como estão.
// =============================================================================

import { fCdf } from './stats';

export interface PontoDeRegressao {
  /** O nível do fator: MPa, horas, meses. */
  x: number;
  /** A resposta observada: germinação, IVG, comprimento. */
  y: number;
}

export type GrauDoPolinomio = 1 | 2 | 3;

export interface AjustePolinomial {
  grau: GrauDoPolinomio;
  /** Coeficientes na escala ORIGINAL de x, do termo constante ao de maior grau. */
  coeficientes: number[];
  r2: number;
  r2Ajustado: number;
  somaDeQuadradosResidual: number;
  somaDeQuadradosRegressao: number;
  /** F da regressão inteira contra o modelo só com média, e seu p. */
  f: number;
  p: number;
  /** F do termo de maior grau contra o ajuste de grau k−1 (sequencial), e p. No grau 1 é o próprio F da reta. */
  fSequencial: number | null;
  pSequencial: number | null;
  /** Graus de liberdade do resíduo. */
  glResiduo: number;
  /** y previsto para um x qualquer, na escala original. */
  prever: (x: number) => number;
}

export interface PontoDeOtimo {
  tipo: 'maximo' | 'minimo';
  x: number;
  y: number;
  /** Se o ótimo caiu dentro da faixa observada de x. Fora, é extrapolação e não vale. */
  dentroDaFaixa: boolean;
}

export interface ResultadoDaRegressao {
  ajustes: AjustePolinomial[];
  /** O grau que a regra recomenda, com a razão em uma frase. */
  recomendado: GrauDoPolinomio;
  motivo: string;
  /** Ótimo do grau recomendado, quando ele existe (grau ≥ 2). */
  otimo: PontoDeOtimo | null;
  n: number;
  faixaDeX: [number, number];
}

/** Média aritmética. */
function media(v: readonly number[]): number {
  return v.reduce((s, a) => s + a, 0) / v.length;
}

/**
 * Resolve A·b = c por eliminação de Gauss com pivotamento parcial.
 *
 * Sistema pequeno (até 4 × 4): não vale uma biblioteca. O pivotamento existe
 * porque, mesmo centrado, um grau 3 com poucos pontos pode ter pivô pequeno.
 */
function resolver(A: number[][], c: number[]): number[] | null {
  const n = c.length;
  const M = A.map((linha, i) => [...linha, c[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(M[i][col]) > Math.abs(M[piv][col])) piv = i;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let i = col + 1; i < n; i++) {
      const f = M[i][col] / M[col][col];
      for (let j = col; j <= n; j++) M[i][j] -= f * M[col][j];
    }
  }
  const b = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * b[j];
    b[i] = s / M[i][i];
  }
  return b;
}

/**
 * Coeficientes de um polinômio em z = (x − m)/s reescritos em x.
 *
 * p(z) = Σ aₖ zᵏ com z = (x − m)/s. Expandir o binômio dá os coeficientes em
 * x. É a única parte com álgebra de verdade no módulo, e por isso tem teste
 * próprio: recuperar exatamente um polinômio conhecido.
 */
function desescalar(a: readonly number[], m: number, s: number): number[] {
  const grau = a.length - 1;
  const saida = new Array<number>(grau + 1).fill(0);
  // zᵏ = (x − m)ᵏ / sᵏ = Σⱼ C(k, j) x^j (−m)^(k−j) / sᵏ
  for (let k = 0; k <= grau; k++) {
    const ak = a[k] / s ** k;
    for (let j = 0; j <= k; j++) {
      saida[j] += ak * binomial(k, j) * (-m) ** (k - j);
    }
  }
  return saida;
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Avalia um polinômio (coeficientes do constante ao maior grau) em x. */
export function avaliarPolinomio(coeficientes: readonly number[], x: number): number {
  let y = 0;
  for (let k = coeficientes.length - 1; k >= 0; k--) y = y * x + coeficientes[k];
  return y;
}

/**
 * Ajusta um grau só. `null` quando não há graus de liberdade (n ≤ grau + 1)
 * ou quando o sistema é singular (todos os x iguais).
 */
export function ajustarGrau(pontos: readonly PontoDeRegressao[], grau: GrauDoPolinomio): AjustePolinomial | null {
  const n = pontos.length;
  if (n < grau + 2) return null;
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  const m = media(xs);
  const desvio = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / n);
  if (desvio === 0) return null;
  const zs = xs.map((x) => (x - m) / desvio);

  // Equações normais em z: (ZᵀZ) a = Zᵀy.
  const k = grau + 1;
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const c = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const pot = Array.from({ length: 2 * grau + 1 }, (_, e) => zs[i] ** e);
    for (let r = 0; r < k; r++) {
      c[r] += pot[r] * ys[i];
      for (let q = 0; q < k; q++) A[r][q] += pot[r + q];
    }
  }
  const aZ = resolver(A, c);
  if (aZ === null) return null;

  const coeficientes = desescalar(aZ, m, desvio);
  const prever = (x: number) => avaliarPolinomio(coeficientes, x);

  const yMedia = media(ys);
  const sqTotal = ys.reduce((s, y) => s + (y - yMedia) ** 2, 0);
  const sqResidual = pontos.reduce((s, p) => s + (p.y - prever(p.x)) ** 2, 0);
  const sqRegressao = Math.max(0, sqTotal - sqResidual);
  const glResiduo = n - k;
  const r2 = sqTotal > 0 ? 1 - sqResidual / sqTotal : 1;
  const r2Ajustado = sqTotal > 0 ? 1 - (sqResidual / glResiduo) / (sqTotal / (n - 1)) : 1;
  const qmResidual = sqResidual / glResiduo;
  const f = qmResidual > 0 ? sqRegressao / grau / qmResidual : Number.POSITIVE_INFINITY;
  const p = Number.isFinite(f) ? 1 - fCdf(f, grau, glResiduo) : 0;

  return {
    grau,
    coeficientes,
    r2,
    r2Ajustado,
    somaDeQuadradosResidual: sqResidual,
    somaDeQuadradosRegressao: sqRegressao,
    f,
    p,
    fSequencial: null,
    pSequencial: null,
    glResiduo,
    prever,
  };
}

/**
 * Ponto de ótimo do polinômio dentro da faixa [xMin, xMax].
 *
 * Grau 2: o vértice, −b/(2a), analiticamente. Grau 3: as raízes da derivada
 * (uma quadrática), avaliadas — fica a que estiver dentro da faixa com o maior
 * (ou menor) y; se as duas estiverem dentro, devolve o máximo global na faixa,
 * que é a pergunta que o ensaio faz. Grau 1 não tem ótimo interior.
 */
export function pontoDeOtimo(ajuste: AjustePolinomial, faixa: [number, number]): PontoDeOtimo | null {
  const c = ajuste.coeficientes;
  const [xMin, xMax] = faixa;
  const candidatos: number[] = [];

  if (ajuste.grau === 2) {
    const [, b, a] = c;
    if (a === 0) return null;
    candidatos.push(-b / (2 * a));
  } else if (ajuste.grau === 3) {
    // p'(x) = 3d x² + 2c x + b
    const [, b, c2, d] = c;
    if (d === 0) {
      if (c2 === 0) return null;
      candidatos.push(-b / (2 * c2));
    } else {
      const disc = (2 * c2) ** 2 - 4 * (3 * d) * b;
      if (disc < 0) return null;
      const r = Math.sqrt(disc);
      candidatos.push((-2 * c2 + r) / (6 * d), (-2 * c2 - r) / (6 * d));
    }
  } else {
    return null;
  }

  // Segunda derivada decide máximo/mínimo em cada candidato.
  const segunda = (x: number): number => {
    if (ajuste.grau === 2) return 2 * c[2];
    return 2 * c[2] + 6 * c[3] * x;
  };

  const dentro = candidatos.filter((x) => x >= xMin && x <= xMax);
  const escolhidos = dentro.length > 0 ? dentro : candidatos;
  // Entre os candidatos, prefere o máximo (é a pergunta usual: "onde a
  // germinação é máxima"); se só houver mínimo, devolve o mínimo.
  let melhor: PontoDeOtimo | null = null;
  for (const x of escolhidos) {
    const tipo: PontoDeOtimo['tipo'] = segunda(x) < 0 ? 'maximo' : 'minimo';
    const ponto: PontoDeOtimo = { tipo, x, y: ajuste.prever(x), dentroDaFaixa: x >= xMin && x <= xMax };
    if (melhor === null) melhor = ponto;
    else if (tipo === 'maximo' && (melhor.tipo !== 'maximo' || ponto.y > melhor.y)) melhor = ponto;
  }
  return melhor;
}

/**
 * Ajusta graus 1 a 3, testa sequencialmente e recomenda um.
 *
 * A regra é a usual dos manuais de experimentação agrícola: sobe o grau
 * enquanto o termo acrescentado for significativo a `alfa`, e para no último
 * significativo. Com R² igual entre dois graus, fica o menor — parcimônia.
 * O teste sequencial compara a redução da soma de quadrados residual do grau
 * k para o k+1 contra o quadrado médio residual do k+1.
 */
export function regressaoPolinomial(
  pontos: readonly PontoDeRegressao[],
  opcoes: { grauMaximo?: GrauDoPolinomio; alfa?: number } = {}
): ResultadoDaRegressao | null {
  const alfa = opcoes.alfa ?? 0.05;
  const grauMaximo = opcoes.grauMaximo ?? 3;
  const validos = pontos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (validos.length < 3) return null;

  const xs = validos.map((p) => p.x);
  const faixa: [number, number] = [Math.min(...xs), Math.max(...xs)];

  const ajustes: AjustePolinomial[] = [];
  for (const grau of [1, 2, 3] as const) {
    if (grau > grauMaximo) break;
    const a = ajustarGrau(validos, grau);
    if (a === null) break;
    if (ajustes.length > 0) {
      const anterior = ajustes[ajustes.length - 1];
      const reducao = anterior.somaDeQuadradosResidual - a.somaDeQuadradosResidual;
      const qm = a.somaDeQuadradosResidual / a.glResiduo;
      const fSeq = qm > 0 ? Math.max(0, reducao) / qm : Number.POSITIVE_INFINITY;
      a.fSequencial = fSeq;
      a.pSequencial = Number.isFinite(fSeq) ? 1 - fCdf(fSeq, 1, a.glResiduo) : 0;
    }
    ajustes.push(a);
  }
  if (ajustes.length === 0) return null;

  // Recomendação: o MAIOR grau cujo termo é significativo, olhando do maior
  // para o menor. Um teste vermelho ensinou por que não pode ser "sobe
  // enquanto for significativo": uma resposta em parábola centrada — germinação
  // máxima no meio da faixa de potencial, igual nas pontas — tem termo linear
  // NÃO significativo e termo quadrático muito significativo. Parar na reta
  // seria concluir "não varia" de um ensaio que varia, e muito.
  const grau1 = ajustes[0];
  grau1.fSequencial = grau1.f;
  grau1.pSequencial = grau1.p;
  let recomendado: GrauDoPolinomio | null = null;
  let motivo = '';
  for (const a of [...ajustes].reverse()) {
    if (a.pSequencial !== null && a.pSequencial < alfa) {
      recomendado = a.grau;
      motivo =
        a.grau === 1
          ? `A reta é significativa (p = ${a.p.toFixed(3)}) e nenhum termo acima dela acrescenta ajuste.`
          : `O termo de grau ${a.grau} acrescenta ajuste (p = ${a.pSequencial.toFixed(3)}); R² ajustado ${a.r2Ajustado.toFixed(3)}.`;
      break;
    }
  }
  if (recomendado === null) {
    recomendado = 1;
    motivo = `Nenhum termo é significativo a ${(alfa * 100).toFixed(0)} % (reta: p = ${grau1.p.toFixed(3)}): a resposta não varia com o fator nesta faixa.`;
  }

  const escolhido = ajustes.find((a) => a.grau === recomendado) ?? ajustes[0];
  const otimo = recomendado >= 2 ? pontoDeOtimo(escolhido, faixa) : null;

  return { ajustes, recomendado, motivo, otimo, n: validos.length, faixaDeX: faixa };
}

/**
 * A equação como se escreve num artigo: ŷ = a + b·x + c·x², com sinais e
 * algarismos. Coeficiente zero (a menos de 1e-12) é omitido.
 */
export function equacaoComoTexto(ajuste: AjustePolinomial, casas = 4): string {
  const partes: string[] = [];
  ajuste.coeficientes.forEach((coef, k) => {
    if (Math.abs(coef) < 1e-12) return;
    const valor = Math.abs(coef).toFixed(casas);
    const termo = k === 0 ? '' : k === 1 ? '·x' : `·x${k === 2 ? '²' : '³'}`;
    const sinal = coef < 0 ? ' − ' : partes.length === 0 ? '' : ' + ';
    partes.push(`${sinal}${valor}${termo}`);
  });
  return `ŷ = ${partes.join('') || '0'}`;
}
