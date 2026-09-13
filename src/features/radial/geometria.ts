// =============================================================================
// SeedCounter — a geometria do menu radial
//
// A fatia e escolhida pelo ANGULO do arraste a partir do ponto onde o botao
// foi pressionado. As fronteiras ficam a meio caminho entre as direcoes
// cardeais (45 graus para quatro fatias): um gesto quase reto para a direita
// cai em "direita", nao em "baixo".
//
// Ha um raio morto: soltar sem sair do centro cancela. Sem isso, um clique
// direito comum viraria uma classificacao acidental.
// =============================================================================

export const RAIO_MORTO = 14;

export function fatiaDoAngulo(dx: number, dy: number, fatias: number): number | null {
  if (Math.hypot(dx, dy) < RAIO_MORTO || fatias <= 0) return null;
  const passo = (Math.PI * 2) / fatias;
  // Desloca meio passo para a fronteira ficar entre direcoes, nao sobre elas.
  let angulo = Math.atan2(dy, dx) + passo / 2;
  if (angulo < 0) angulo += Math.PI * 2;
  return Math.floor(angulo / passo) % fatias;
}
