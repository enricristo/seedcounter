// src/lib/feret.ts
// =============================================================================
// SeedCounter — diametro de Feret
//
// O QUE E, E POR QUE NAO BASTA A PCA.
//
// Feret e a distancia entre dois planos paralelos que apertam o objeto — o que
// um paquimetro mede. O MAXIMO e a maior distancia entre dois pontos do
// contorno; o MINIMO e a menor largura em alguma direcao. E a medida do
// ImageJ, e e a que a usina de beneficiamento usa para escolher peneira: uma
// semente passa pela fenda se o Feret minimo couber.
//
// A PCA mede extensao ao longo dos eixos principais. Em elipse as duas
// coincidem; em forma assimetrica (reniforme, com bico) elas divergem, e a
// que o paquimetro daria e o Feret.
//
// COMO: rotating calipers sobre o fecho convexo.
//
// Feret nao muda se o contorno for trocado pelo fecho convexo — um plano que
// aperta o objeto so encosta em pontos do fecho. Sobre o fecho, o maximo e a
// maior distancia entre vertices, e o minimo e a menor altura sobre uma
// aresta (o minimo sempre encosta numa aresta do fecho por um lado). Ambos
// O(n) com n vertices do fecho.
// =============================================================================

import { indicesDoFechoConvexo } from './aglomerado';

export type Ponto = [number, number];

export interface Feret {
  /** Maior distancia entre dois pontos do contorno. */
  maximo: number;
  /** Menor largura entre planos paralelos. */
  minimo: number;
  /** Angulo (rad) da direcao do Feret maximo, para desenhar o eixo. */
  anguloDoMaximo: number;
}

export function feret(pontos: Ponto[]): Feret | null {
  if (!pontos || pontos.length < 3) return null;

  const idx = indicesDoFechoConvexo(pontos);
  if (idx.length < 2) return null;
  const h = idx.map((i) => pontos[i]);
  const n = h.length;

  // --- maximo: maior distancia entre vertices do fecho ---------------------
  // O(n^2) no fecho e barato (fecho de semente tem dezenas de vertices) e nao
  // tem o caso de borda do caliper para antipodais em fecho degenerado.
  let maximo = 0;
  let angulo = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = h[j][0] - h[i][0];
      const dy = h[j][1] - h[i][1];
      const d = Math.hypot(dx, dy);
      if (d > maximo) {
        maximo = d;
        angulo = Math.atan2(dy, dx);
      }
    }
  }

  // --- minimo: menor altura do fecho sobre cada aresta ---------------------
  // Para cada aresta, a largura na direcao perpendicular a ela e a maior
  // distancia de um vertice ate a reta da aresta. O minimo dessas larguras e
  // o Feret minimo — teorema classico: a largura minima e sempre atingida com
  // um dos planos apoiado numa aresta.
  let minimo = Infinity;
  for (let i = 0; i < n; i++) {
    const a = h[i];
    const b = h[(i + 1) % n];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    let largura = 0;
    for (let k = 0; k < n; k++) {
      const d = Math.abs((h[k][0] - a[0]) * ey - (h[k][1] - a[1]) * ex) / len;
      if (d > largura) largura = d;
    }
    if (largura < minimo) minimo = largura;
  }

  if (!Number.isFinite(minimo)) minimo = 0;
  return { maximo, minimo, anguloDoMaximo: angulo };
}
