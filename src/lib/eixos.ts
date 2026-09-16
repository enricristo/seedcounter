// =============================================================================
// SeedCounter — Eixos de medida (PCA e Feret) para desenhar sobre o contorno
// =============================================================================
// C3.1 da fila de 15/09: "de onde saem comprimento e largura" deixa de ser uma
// pergunta de código-fonte e vira algo que se vê em cima da própria semente.
//
// Dois métodos, dois pares de eixos:
//   - PCA: os eixos principais da nuvem de vértices do contorno — é a MESMA
//     conta de `calculateSeedDimensions` (pca-utils.ts), só que aqui expomos
//     os segmentos (centro + direção + extensão), não apenas os dois números.
//     Duplicar a conta em vez de importar é deliberado: pca-utils não expõe
//     a direção, e a duplicação faz o teste de equivalência valer alguma
//     coisa (ver eixos.test.ts) em vez de testar a função contra si mesma.
//   - Feret: distância entre planos paralelos que apertam o objeto (o que um
//     paquímetro mede), sobre o fecho convexo — mesma ideia de feret.ts, mas
//     aqui devolvendo os PONTOS do segmento, não só o comprimento.
//
// Numa elipse os dois coincidem. Quando divergem (contorno assimétrico,
// encostadas, quebrado), a medida PCA é palpite — é o sinal que o overlay
// mostra com "≠" (ver EixosOverlay.tsx).
// =============================================================================

import { indicesDoFechoConvexo } from './aglomerado';

export type Ponto = [number, number];

export interface EixoSegmento {
  /** Uma ponta do segmento, em coordenadas da imagem. */
  a: Ponto;
  /** A outra ponta. */
  b: Ponto;
  /** Comprimento do segmento (== distância entre a e b). */
  comprimento: number;
}

export interface EixosDoContorno {
  /** Centróide dos vértices do contorno (mesmo centro usado pela PCA). */
  centro: Ponto;
  /** Eixo PCA maior — o que `calculateSeedDimensions` chama de `width`. */
  comprimento: EixoSegmento;
  /** Eixo PCA menor, perpendicular ao maior — o `height`. */
  largura: EixoSegmento;
  /** Feret máximo: maior distância entre dois pontos do fecho convexo. */
  feretMax: EixoSegmento;
  /** Feret mínimo: menor largura entre planos paralelos, sobre uma aresta do fecho. */
  feretMin: EixoSegmento;
}

/** Ponto mais próximo de `p` sobre a reta que passa por `a` e `b`. */
function pontoNaLinha(a: Ponto, b: Ponto, p: Ponto): Ponto {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len2 = ex * ex + ey * ey;
  if (len2 < 1e-12) return a;
  const t = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / len2;
  return [a[0] + t * ex, a[1] + t * ey];
}

/**
 * Feret com os SEGMENTOS (não só os comprimentos): reimplementação da mesma
 * lógica de `feret.ts` (rotating calipers sobre o fecho convexo), porque
 * aquela função só devolve `{maximo, minimo, anguloDoMaximo}` e para desenhar
 * o eixo é preciso saber onde os pontos ficam.
 */
function feretComSegmentos(pontos: Ponto[]): { max: EixoSegmento; min: EixoSegmento } | null {
  const idx = indicesDoFechoConvexo(pontos);
  if (idx.length < 2) return null;
  const h = idx.map((i) => pontos[i]);
  const n = h.length;

  // --- máximo: maior distância entre vértices do fecho ---------------------
  let maxDist = 0;
  let maxA: Ponto = h[0];
  let maxB: Ponto = h[0];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = h[j][0] - h[i][0];
      const dy = h[j][1] - h[i][1];
      const d = Math.hypot(dx, dy);
      if (d > maxDist) {
        maxDist = d;
        maxA = h[i];
        maxB = h[j];
      }
    }
  }

  // --- mínimo: menor altura do fecho sobre cada aresta ----------------------
  // Para a aresta que dá a menor largura, o segmento que desenhamos vai do
  // pé da perpendicular na aresta até o vértice mais distante dela — é o
  // "encaixe do paquímetro" que gera essa largura.
  let minWidth = Infinity;
  let minA: Ponto = h[0];
  let minB: Ponto = h[0];
  for (let i = 0; i < n; i++) {
    const a = h[i];
    const b = h[(i + 1) % n];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    let largura = 0;
    let longeK: Ponto = a;
    for (let k = 0; k < n; k++) {
      const d = Math.abs((h[k][0] - a[0]) * ey - (h[k][1] - a[1]) * ex) / len;
      if (d > largura) {
        largura = d;
        longeK = h[k];
      }
    }
    if (largura < minWidth) {
      minWidth = largura;
      minB = longeK;
      minA = pontoNaLinha(a, b, longeK);
    }
  }
  if (!Number.isFinite(minWidth)) return null;

  return {
    max: { a: maxA, b: maxB, comprimento: maxDist },
    min: { a: minA, b: minB, comprimento: minWidth },
  };
}

/**
 * Calcula os quatro eixos de medida de um contorno: os dois principais da
 * PCA (comprimento/largura, a mesma conta de `calculateSeedDimensions`) e os
 * dois de Feret (máximo/mínimo, sobre o fecho convexo).
 *
 * Devolve `null` para contornos degenerados (menos de 3 pontos, ou fecho
 * convexo degenerado).
 */
export function eixosDoContorno(pontos: Ponto[]): EixosDoContorno | null {
  if (!pontos || pontos.length < 3) return null;

  // --- PCA: mesma conta de pca-utils.ts, expondo a direção -----------------
  const N = pontos.length;
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of pontos) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / N;
  const meanY = sumY / N;

  const centered = pontos.map(([x, y]) => [x - meanX, y - meanY] as Ponto);

  let covXX = 0;
  let covYY = 0;
  let covXY = 0;
  for (const [cx, cy] of centered) {
    covXX += cx * cx;
    covYY += cy * cy;
    covXY += cx * cy;
  }
  const divisor = N > 1 ? N - 1 : 1;
  covXX /= divisor;
  covYY /= divisor;
  covXY /= divisor;

  const T = covXX + covYY;
  const D = covXX * covYY - covXY * covXY;
  const term = (T * T) / 4 - D;
  const sqrtTerm = Math.sqrt(Math.max(0, term));
  const lambda1 = T / 2 + sqrtTerm;
  const lambda2 = T / 2 - sqrtTerm;

  let v1: Ponto = [1, 0];
  let v2: Ponto = [0, 1];

  if (Math.abs(covXY) > 1e-9) {
    const rawV1X = lambda1 - covYY;
    const rawV1Y = covXY;
    const mag1 = Math.hypot(rawV1X, rawV1Y);
    if (mag1 > 1e-9) v1 = [rawV1X / mag1, rawV1Y / mag1];

    const rawV2X = lambda2 - covYY;
    const rawV2Y = covXY;
    const mag2 = Math.hypot(rawV2X, rawV2Y);
    if (mag2 > 1e-9) v2 = [rawV2X / mag2, rawV2Y / mag2];
  } else if (covXX < covYY) {
    v1 = [0, 1];
    v2 = [1, 0];
  }

  let minP1 = Infinity;
  let maxP1 = -Infinity;
  let minP2 = Infinity;
  let maxP2 = -Infinity;

  for (const [cx, cy] of centered) {
    const p1 = cx * v1[0] + cy * v1[1];
    const p2 = cx * v2[0] + cy * v2[1];
    if (p1 < minP1) minP1 = p1;
    if (p1 > maxP1) maxP1 = p1;
    if (p2 < minP2) minP2 = p2;
    if (p2 > maxP2) maxP2 = p2;
  }

  const dim1 = maxP1 - minP1;
  const dim2 = maxP2 - minP2;

  const segmentoEixo = (v: Ponto, min: number, max: number): EixoSegmento => ({
    a: [meanX + v[0] * min, meanY + v[1] * min],
    b: [meanX + v[0] * max, meanY + v[1] * max],
    comprimento: max - min,
  });

  const eixo1 = segmentoEixo(v1, minP1, maxP1);
  const eixo2 = segmentoEixo(v2, minP2, maxP2);

  // Mesmo critério de calculateSeedDimensions: comprimento é sempre a maior
  // das duas dimensões, largura a menor — independente de qual eixo (v1/v2)
  // deu qual.
  const comprimento = dim1 >= dim2 ? eixo1 : eixo2;
  const largura = dim1 >= dim2 ? eixo2 : eixo1;

  // --- Feret sobre o fecho convexo -----------------------------------------
  const f = feretComSegmentos(pontos);
  if (!f) return null;

  return {
    centro: [meanX, meanY],
    comprimento,
    largura,
    feretMax: f.max,
    feretMin: f.min,
  };
}

/**
 * Discordância relativa entre um eixo PCA e o Feret correspondente.
 * > 0,15 (15%) é o sinal de que a forma não é elíptica e a medida PCA vira
 * palpite — é o "≠" que o overlay desenha ao lado do rótulo.
 */
export function discordanciaRelativa(pca: number, feretCorresp: number): number {
  if (feretCorresp <= 0) return 0;
  return Math.abs(pca - feretCorresp) / feretCorresp;
}
