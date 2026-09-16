// =============================================================================
// SeedCounter — o passo da montanha, escondido
//
// A onda que contorna cada semente (`region-growing.ts`) sobe a paisagem de
// ΔE a partir do clique e para no MENOR nível pelo qual se consegue sair do
// vale da semente. Esse número — o custo de escape — é, literalmente, um
// nível de passo da montanha: c = inf sobre os caminhos do máximo ao longo do
// caminho (Ambrosetti–Rabinowitz, 1973). O app faz isso mil vezes por dia sem
// dizer o nome. Este arquivo diz.
//
// A curva é a primeira curva não trivial do espectro de Fučik: o conjunto dos
// (α, β) para os quais −Δ_p u = α(u⁺)^{p−1} − β(u⁻)^{p−1} tem solução não
// trivial. Para p = 2 numa dimensão, com Dirichlet em (0, L), ela tem forma
// fechada: uma corcova positiva de meio-período π/√α e uma negativa de π/√β
// precisam caber juntas em L, logo π/√α + π/√β = L, ou 1/√α + 1/√β = 1/√λ₁.
// Contínua, estritamente decrescente, e no limite converge às retas triviais
// α = λ₁ e β = λ₁ — que é o resultado principal da dissertação, provado para
// o p-Laplaciano com o passo da montanha numa variedade C¹.
//
// Dissertação: Ambrosio, E. S. — Espectro de Fučik para o operador
// p-Laplaciano. IBILCE/UNESP. http://hdl.handle.net/11449/242691
// =============================================================================

export const DISSERTACAO = {
  titulo: 'Espectro de Fučik para o operador p-Laplaciano',
  autor: 'Enrico S. Ambrosio',
  url: 'http://hdl.handle.net/11449/242691',
};

/**
 * Nível do passo da montanha para caminhos discretos: o menor, entre os
 * caminhos, do maior custo ao longo do caminho. É o `custoDaBorda` da onda
 * quando os caminhos são todos os que saem do vale.
 */
export function nivelDoPasso(caminhos: number[][]): number | null {
  let melhor = Infinity;
  for (const c of caminhos) {
    if (c.length === 0) continue;
    let maximo = -Infinity;
    for (const v of c) if (v > maximo) maximo = v;
    if (maximo < melhor) melhor = maximo;
  }
  return Number.isFinite(melhor) ? melhor : null;
}

/** β em função de α na primeira curva não trivial (p = 2, 1D, Dirichlet). Definida para α > λ₁. */
export function betaDeFucik(alfa: number, lambda1: number): number | null {
  if (!(lambda1 > 0) || alfa <= lambda1) return null;
  const r = 1 / Math.sqrt(lambda1) - 1 / Math.sqrt(alfa);
  return 1 / (r * r);
}

/**
 * Pontos da primeira curva, de α = λ₁(1+ε) até α = λ₁·alcance, espaçados em
 * escala log para a parte assintótica não virar uma reta de pontos.
 */
export function primeiraCurvaDeFucik(lambda1: number, n = 64, alcance = 40): [number, number][] {
  const pontos: [number, number][] = [];
  const a0 = Math.log(lambda1 * 1.02);
  const a1 = Math.log(lambda1 * alcance);
  for (let i = 0; i < n; i++) {
    const alfa = Math.exp(a0 + ((a1 - a0) * i) / (n - 1));
    const beta = betaDeFucik(alfa, lambda1);
    if (beta != null) pontos.push([alfa, beta]);
  }
  return pontos;
}
