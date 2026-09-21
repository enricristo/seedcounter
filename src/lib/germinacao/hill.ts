// =============================================================================
// SeedCounter — a curva de germinação (Hill de quatro parâmetros) e o ajuste
//
// REFERÊNCIAS.
//
//   JOOSEN, R. V. L.; KODDE, J.; WILLEMS, L. A. J.; LIGTERINK, W.; VAN DER
//   PLAS, L. H. W.; HILHORST, H. W. M. GERMINATOR: a software package for
//   high-throughput scoring and curve fitting of Arabidopsis seed germination.
//   The Plant Journal, v. 62, p. 148–159, 2010.
//
//   EL-KASSABY, Y. A.; MOSS, I.; KOLOTELO, D.; STOEHR, M. Seed germination:
//   mathematical representation and parameters extraction. Forest Science,
//   v. 54, p. 220–227, 2008. (Apud Joosen et al., 2010.)
//
// O MODELO (Joosen et al., 2010, p. 151).
//
//   y = y0 + a·x^b / (c^b + x^b)
//
//   y  — germinação acumulada como FRAÇÃO das sementes (0–1). Na planilha
//        original `a` vale 0,612 para gMAX 0,62: a escala é 0–1, não 0–100.
//   x  — tempo, em horas.
//   y0 — germinação no tempo zero. A planilha fixa o máximo em 0 e aqui é 0.
//   a  — assíntota: a fração que a curva atinge. Limitada a gMAX (a fração
//        observada ao fim): a planilha traz várias amostras com `a` igual ao
//        gMAX exato, o que só acontece se a restrição existe e está ativa.
//   b  — inclinação (adimensional). Quanto maior, mais degrau é a curva.
//   c  — tempo em que a curva atinge metade de `a`: o t50 relativo ao máximo.
//
// O AJUSTE, COMO O ARTIGO DESCREVE.
//
// Mínimos quadrados: valores iniciais de `a` (o gMAX) e `c` (o tempo em que a
// contagem cruza metade do gMAX, interpolado) tirados dos dados, `b = 20`,
// iterar até a soma de quadrados não diminuir (máx. 10 000 iterações) e uma
// SEGUNDA passada partindo do resultado da primeira. Aqui o otimizador é
// Nelder-Mead (otimizador.ts); a segunda passada recomeça o simplex do ponto
// encontrado, que é o que dá ao método a chance de sair de uma parada precoce.
//
// O QUE A PLANILHA FAZ E ESTE MÓDULO NÃO REPRODUZ — DE PROPÓSITO.
//
// A planilha original usa o Solver do Excel (GRG, gradiente com diferenças
// finitas). Conferido contra 24 amostras reais com a saída da planilha:
//
//   • em 8 amostras a planilha chegou ao mínimo verdadeiro — este módulo
//     reproduz a, b e c com erro < 0,1 %;
//   • em 14 amostras a planilha PAROU perto do chute inicial (b entre 17 e
//     23, quase sempre 20,0x): a soma de quadrados na direção de `b` é um
//     vale tão plano que a variação relativa caiu abaixo da tolerância do
//     Solver antes de `b` andar. O mínimo verdadeiro tem b entre 2 e 9 e soma
//     de quadrados 10–50 % menor;
//   • em 2 amostras a planilha caiu num mínimo local ruim (c ≈ 151 h com
//     b ≈ 26, soma de quadrados 60–100× maior que a do mínimo verdadeiro).
//
// Tentou-se reproduzir a parada precoce com critérios de parada mais frouxos
// (Nelder-Mead com tolerância 1e-4, parada por "k iterações sem melhora",
// descida de gradiente com a convergência padrão do Solver): nenhum critério
// reproduz o padrão da planilha, porque onde o Solver para depende da
// trajetória dele, não de uma tolerância — cada critério acerta um
// subconjunto diferente e erra o resto, inclusive amostras em que a planilha
// convergiu de verdade. Escolha: convergir sempre. As 8 amostras convergidas
// da planilha são o oráculo do ajuste; nas outras 16 o teste exige que a
// nossa soma de quadrados seja menor ou igual à da planilha.
// =============================================================================

import { nelderMead } from './otimizador';

/** Uma leitura da contagem acumulada. */
export interface LeituraDeGerminacao {
  /** Horas desde a semeadura. */
  horas: number;
  /** Sementes germinadas ATÉ este instante (acumulado, não por intervalo). */
  acumulado: number;
}

export interface AmostraDeGerminacao {
  /** Identificação livre (tratamento, repetição). */
  codigo: string;
  /** Total de sementes semeadas. */
  sementes: number;
  /** Leituras em ordem crescente de tempo. */
  leituras: LeituraDeGerminacao[];
}

export interface AjusteDeHill {
  /** Germinação no tempo zero. Fixo em 0 nesta versão. */
  y0: number;
  /** Assíntota (fração 0–1). */
  a: number;
  /** Inclinação. */
  b: number;
  /** t50 relativo a `a`, em horas. */
  c: number;
  /** Soma dos quadrados dos resíduos nos pontos observados, em fração². */
  somaDeQuadrados: number;
  /** Iterações do otimizador, somadas as duas passadas. */
  iteracoes: number;
  /** 1 − SQres/SQtot sobre os pontos observados (sem o ponto t = 0). */
  r2: number;
}

export interface OpcoesDoAjuste {
  /** Mínimo de sementes germinadas ao fim para tentar o ajuste. Planilha: 3. */
  germinacaoMinima?: number;
  /** Chute inicial de `b`. Artigo: 20. */
  bInicial?: number;
  /** Máximo de iterações por passada. Artigo: 10 000. */
  maxIteracoes?: number;
}

export type ResultadoDoAjuste =
  | { ajuste: AjusteDeHill; motivo: null }
  | { ajuste: null; motivo: string };

/** y(x) para o modelo de Hill. Devolve y0 para x ≤ 0 (a curva nasce em zero). */
export function hill(y0: number, a: number, b: number, c: number, x: number): number {
  if (x <= 0) return y0;
  const xb = Math.pow(x / c, b); // (x/c)^b = x^b / c^b, sem estourar para b grande
  return y0 + (a * xb) / (1 + xb);
}

/** Derivada dy/dx do modelo de Hill. Zero para x ≤ 0. */
export function derivadaDeHill(a: number, b: number, c: number, x: number): number {
  if (x <= 0) return 0;
  const xb = Math.pow(x / c, b);
  return (a * b * xb) / (x * (1 + xb) * (1 + xb));
}

/** Inverso: o tempo em que a curva atinge a fração `p` de `a` (0 < p < 1). */
export function tempoNaFracaoDeA(b: number, c: number, p: number): number {
  return c * Math.pow(p / (1 - p), 1 / b);
}

/** Frações acumuladas observadas (contagem / sementes), na ordem das leituras. */
export function fracoesObservadas(amostra: AmostraDeGerminacao): number[] {
  return amostra.leituras.map((l) => l.acumulado / amostra.sementes);
}

/** Soma dos quadrados dos resíduos nos pontos observados. */
export function somaDeQuadrados(
  horas: readonly number[],
  fracoes: readonly number[],
  y0: number,
  a: number,
  b: number,
  c: number,
): number {
  let s = 0;
  for (let i = 0; i < horas.length; i++) {
    const d = hill(y0, a, b, c, horas[i]) - fracoes[i];
    s += d * d;
  }
  return s;
}

/**
 * r² = 1 − SQres/SQtot sobre os pontos observados. NÃO inclui o ponto (0, 0):
 * a planilha bate a 6 casas sem ele e difere na 3ª casa com ele.
 * Quando todas as leituras são iguais (SQtot = 0) devolve 1 se o ajuste é
 * exato e 0 se não é — não há variância a explicar.
 */
export function r2DoAjuste(horas: readonly number[], fracoes: readonly number[], ajuste: Pick<AjusteDeHill, 'y0' | 'a' | 'b' | 'c'>): number {
  const media = fracoes.reduce((s, v) => s + v, 0) / fracoes.length;
  const sqTot = fracoes.reduce((s, v) => s + (v - media) * (v - media), 0);
  const sqRes = somaDeQuadrados(horas, fracoes, ajuste.y0, ajuste.a, ajuste.b, ajuste.c);
  if (sqTot === 0) return sqRes === 0 ? 1 : 0;
  return 1 - sqRes / sqTot;
}

/**
 * Chute inicial de `c`: o tempo em que a fração observada cruza metade do
 * gMAX, por interpolação linear entre leituras (a curva parte de (0, 0)).
 */
export function cInicial(horas: readonly number[], fracoes: readonly number[]): number {
  const gMax = fracoes[fracoes.length - 1];
  const alvo = gMax / 2;
  let hAnterior = 0;
  let fAnterior = 0;
  for (let i = 0; i < horas.length; i++) {
    if (fracoes[i] >= alvo) {
      const passo = fracoes[i] - fAnterior;
      return passo > 0 ? hAnterior + ((horas[i] - hAnterior) * (alvo - fAnterior)) / passo : horas[i];
    }
    hAnterior = horas[i];
    fAnterior = fracoes[i];
  }
  return horas[horas.length - 1];
}

function validarAmostra(amostra: AmostraDeGerminacao): string | null {
  if (!(amostra.sementes > 0)) return 'amostra sem sementes';
  if (amostra.leituras.length < 3) return 'menos de três leituras: não há como ajustar três parâmetros';
  for (let i = 0; i < amostra.leituras.length; i++) {
    const l = amostra.leituras[i];
    if (!(l.horas > 0)) return `leitura ${i}: o tempo precisa ser maior que zero`;
    if (i > 0 && l.horas <= amostra.leituras[i - 1].horas) return `leitura ${i}: os tempos precisam ser crescentes`;
    if (l.acumulado < 0 || l.acumulado > amostra.sementes) return `leitura ${i}: acumulado fora de 0..sementes`;
    if (i > 0 && l.acumulado < amostra.leituras[i - 1].acumulado) return `leitura ${i}: o acumulado não pode diminuir`;
  }
  return null;
}

/**
 * Ajusta a curva de Hill (y0 = 0) por mínimos quadrados à amostra.
 *
 * Recusa (ajuste null, com motivo) quando a amostra é inválida ou quando
 * germinaram menos sementes que `germinacaoMinima` ao fim — com uma ou duas
 * sementes a curva não significa nada.
 */
export function ajustarHill(amostra: AmostraDeGerminacao, opcoes: OpcoesDoAjuste = {}): ResultadoDoAjuste {
  const germinacaoMinima = opcoes.germinacaoMinima ?? 3;
  const bInicial = opcoes.bInicial ?? 20;
  const maxIteracoes = opcoes.maxIteracoes ?? 10_000;

  const invalida = validarAmostra(amostra);
  if (invalida !== null) return { ajuste: null, motivo: invalida };

  const germinadasAoFim = amostra.leituras[amostra.leituras.length - 1].acumulado;
  if (germinadasAoFim < germinacaoMinima) {
    return {
      ajuste: null,
      motivo: `germinaram ${germinadasAoFim} sementes; o mínimo para ajustar é ${germinacaoMinima}`,
    };
  }

  const horas = amostra.leituras.map((l) => l.horas);
  const fracoes = fracoesObservadas(amostra);
  const gMax = fracoes[fracoes.length - 1];
  const y0 = 0;

  // Região viável: 0 ≤ a ≤ gMAX, b > 0, c > 0. Fora dela, +Infinity — o
  // simplex descarta o ponto. A restrição a ≤ gMAX é a da planilha (ver nota).
  const objetivo = (p: readonly number[]): number => {
    const [a, b, c] = p;
    if (a < 0 || a > gMax || b <= 0 || c <= 0) return Number.POSITIVE_INFINITY;
    return somaDeQuadrados(horas, fracoes, y0, a, b, c);
  };

  // O simplex inicial desloca `a` para 1,1·gMAX, que é inviável; o primeiro
  // passo do método já o troca. Partir de a = gMAX é o que o artigo manda.
  const primeira = nelderMead(objetivo, [gMax, bInicial, cInicial(horas, fracoes)], { maxIteracoes });
  const segunda = nelderMead(objetivo, primeira.x, { maxIteracoes });
  const melhor = segunda.valor <= primeira.valor ? segunda : primeira;
  const [a, b, c] = melhor.x;

  const ajuste: AjusteDeHill = {
    y0,
    a,
    b,
    c,
    somaDeQuadrados: melhor.valor,
    iteracoes: primeira.iteracoes + segunda.iteracoes,
    r2: r2DoAjuste(horas, fracoes, { y0, a, b, c }),
  };
  return { ajuste, motivo: null };
}
