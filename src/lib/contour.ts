// =============================================================================
// SeedCounter — contorno de máscara binária
//
// Extraído de `yolo-onnx.ts` sem mudança de comportamento, porque agora tem
// dois produtores de máscara: o YOLO (combinação dos protótipos de segmentação)
// e a segmentação por clique (`region-growing.ts`). Duplicar um traçador de
// contorno é o tipo de duplicação que silenciosamente diverge — os dois
// contornos alimentam a MESMA morfometria, e área medida por dois traçadores
// diferentes não é comparável.
// =============================================================================

/**
 * Traça o contorno externo de uma máscara binária (Moore-neighbor tracing).
 * Retorna os pontos em coordenadas da própria máscara.
 */
export function traceContour(mask: Uint8Array, w: number, h: number): [number, number][] {
  // Encontra o primeiro pixel preenchido (varredura em linha).
  let startIdx = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return [];

  const sx = startIdx % w;
  const sy = (startIdx / w) | 0;

  // Vizinhança em 8 direções, sentido horário.
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  const contour: [number, number][] = [];
  let cx = sx;
  let cy = sy;
  let dir = 0;
  const maxSteps = w * h * 4; // trava de segurança

  for (let step = 0; step < maxSteps; step++) {
    contour.push([cx, cy]);

    // Procura o próximo pixel de borda girando a partir da direção anterior.
    let found = false;
    const startDir = (dir + 6) % 8; // volta duas posições
    for (let k = 0; k < 8; k++) {
      const d = (startDir + k) % 8;
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (mask[ny * w + nx]) {
        cx = nx;
        cy = ny;
        dir = d;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy && contour.length > 2) break;
  }

  return contour;
}

/** Reduz a quantidade de pontos do contorno mantendo o formato (passo fixo). */
export function simplifyContour(points: [number, number][], maxPoints = 48): [number, number][] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
  return out;
}
