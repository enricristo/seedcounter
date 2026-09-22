// =============================================================================
// SeedCounter — Nelder-Mead: minimização sem derivadas, sem dependência
//
// POR QUE NELDER-MEAD.
//
// O ajuste da curva de germinação (hill.ts) minimiza uma soma de quadrados
// com três parâmetros. É pouco para justificar uma biblioteca de otimização,
// e a função tem um vale muito plano na direção de `b` (a inclinação) — um
// método de gradiente com diferenças finitas para cedo nesse vale, que foi
// exatamente o que aconteceu com o Solver do Excel na planilha original (ver
// hill.ts). O simplex não usa gradiente: caminha pelo vale até a amplitude
// dos valores no simplex ficar abaixo da tolerância.
//
// A implementação é a de Nelder & Mead (1965) com os coeficientes canônicos
// (reflexão 1, expansão 2, contração 1/2, encolhimento 1/2). É genérica: não
// sabe nada de sementes, e é testada numa função conhecida.
//
// Restrições: a função objetivo devolve +Infinity fora da região viável. O
// simplex trata esse ponto como o pior e o substitui; nada mais é preciso.
// =============================================================================

export type FuncaoObjetivo = (x: readonly number[]) => number;

export interface OpcoesDoOtimizador {
  /** Máximo de iterações. Cada iteração avalia a função 1 a 2 vezes (ou n no encolhimento). */
  maxIteracoes?: number;
  /**
   * Para quando (pior − melhor) ≤ tolerânciaRelativa·|melhor| + tolerânciaAbsoluta.
   * A absoluta existe para o caso em que o mínimo é exatamente zero (ajuste perfeito):
   * sem ela, a relativa nunca satisfaz.
   */
  toleranciaRelativa?: number;
  toleranciaAbsoluta?: number;
  /**
   * Passo inicial de cada vértice em relação ao ponto de partida, como fração
   * do valor (ou absoluto quando o valor é zero).
   */
  escalaInicial?: number;
}

export interface ResultadoDoOtimizador {
  /** Melhor ponto encontrado. */
  x: number[];
  /** Valor da função nesse ponto. */
  valor: number;
  /** Iterações executadas. */
  iteracoes: number;
  /** false quando parou por maxIteracoes, não pela tolerância. */
  convergiu: boolean;
}

const PADRAO: Required<OpcoesDoOtimizador> = {
  maxIteracoes: 10_000,
  toleranciaRelativa: 1e-12,
  toleranciaAbsoluta: 1e-20,
  escalaInicial: 0.1,
};

/**
 * Minimiza `f` a partir de `x0` pelo método do simplex de Nelder-Mead.
 *
 * @param f  Função objetivo. Pode devolver +Infinity para pontos inviáveis.
 * @param x0 Ponto de partida (n ≥ 1).
 */
export function nelderMead(
  f: FuncaoObjetivo,
  x0: readonly number[],
  opcoes: OpcoesDoOtimizador = {},
): ResultadoDoOtimizador {
  const o = { ...PADRAO, ...opcoes };
  const n = x0.length;
  if (n === 0) throw new Error('nelderMead: o ponto de partida precisa ter ao menos uma dimensão');

  // Simplex inicial: x0 e n vértices, cada um deslocado numa coordenada.
  let simplex: number[][] = [[...x0]];
  for (let i = 0; i < n; i++) {
    const p = [...x0];
    p[i] = p[i] !== 0 ? p[i] * (1 + o.escalaInicial) : o.escalaInicial;
    simplex.push(p);
  }
  let valores = simplex.map((p) => f(p));

  let iteracoes = 0;
  let convergiu = false;
  for (; iteracoes < o.maxIteracoes; iteracoes++) {
    // Ordena do melhor para o pior.
    const ordem = [...valores.keys()].sort((i, j) => valores[i] - valores[j]);
    simplex = ordem.map((i) => simplex[i]);
    valores = ordem.map((i) => valores[i]);
    const melhor = valores[0];
    const pior = valores[n];

    if (Math.abs(pior - melhor) <= o.toleranciaRelativa * Math.abs(melhor) + o.toleranciaAbsoluta) {
      convergiu = true;
      break;
    }

    // Centroide dos n melhores.
    const centroide = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroide[j] += simplex[i][j] / n;
    }
    const piorPonto = simplex[n];

    // Reflexão.
    const refletido = centroide.map((c, j) => c + (c - piorPonto[j]));
    const fRefletido = f(refletido);
    if (fRefletido < melhor) {
      // Expansão.
      const expandido = centroide.map((c, j) => c + 2 * (c - piorPonto[j]));
      const fExpandido = f(expandido);
      if (fExpandido < fRefletido) {
        simplex[n] = expandido;
        valores[n] = fExpandido;
      } else {
        simplex[n] = refletido;
        valores[n] = fRefletido;
      }
      continue;
    }
    if (fRefletido < valores[n - 1]) {
      simplex[n] = refletido;
      valores[n] = fRefletido;
      continue;
    }

    // Contração: por fora se o refletido ainda é melhor que o pior, por dentro se não.
    const contraido =
      fRefletido < pior
        ? centroide.map((c, j) => c + 0.5 * (refletido[j] - c))
        : centroide.map((c, j) => c + 0.5 * (piorPonto[j] - c));
    const fContraido = f(contraido);
    if (fContraido < Math.min(fRefletido, pior)) {
      simplex[n] = contraido;
      valores[n] = fContraido;
      continue;
    }

    // Encolhimento em direção ao melhor.
    const melhorPonto = simplex[0];
    for (let i = 1; i <= n; i++) {
      simplex[i] = simplex[i].map((v, j) => melhorPonto[j] + 0.5 * (v - melhorPonto[j]));
      valores[i] = f(simplex[i]);
    }
  }

  // Garante que devolvemos o melhor vértice mesmo saindo por maxIteracoes.
  let iMelhor = 0;
  for (let i = 1; i <= n; i++) if (valores[i] < valores[iMelhor]) iMelhor = i;
  return { x: [...simplex[iMelhor]], valor: valores[iMelhor], iteracoes, convergiu };
}
