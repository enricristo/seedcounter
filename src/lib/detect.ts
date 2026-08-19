// =============================================================================
// SeedCounter — Detecção Assistida (visão computacional clássica)
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Pipeline: escala de cinza -> limiar (Otsu + ajuste de sensibilidade) ->
// rotulagem de componentes conexos -> filtro por área -> centroides.
//
// Não requer modelo treinado nem rede neural: roda instantaneamente no
// navegador, offline. Serve como "contagem assistida" — o pesquisador revisa,
// corrige e confirma os pontos detectados.
// =============================================================================

export interface DetectionOptions {
  /** 0–100. Mais alto = detecta mais objetos (limiar mais permissivo). */
  sensitivity?: number;
  /** Área mínima do objeto, em pixels da imagem original. */
  minArea?: number;
  /** Área máxima do objeto, em pixels da imagem original. 0 = sem limite. */
  maxArea?: number;
  /** true = objetos escuros em fundo claro (padrão). false = inverso. */
  darkOnLight?: boolean;
  /** Região de interesse na imagem original. Ausente = imagem inteira. */
  roi?: { x: number; y: number; width: number; height: number };
  /** Maior dimensão usada no processamento (imagens grandes são reduzidas). */
  maxProcessingSize?: number;
}

export interface DetectedObject {
  /** Centroide em coordenadas da imagem ORIGINAL. */
  x: number;
  y: number;
  /** Área em pixels da imagem original (aproximada). */
  area: number;
  /** Caixa delimitadora em coordenadas da imagem original. */
  bbox: { x: number; y: number; width: number; height: number };
}

export interface DetectionResult {
  objects: DetectedObject[];
  /** Limiar efetivamente aplicado (0–255), útil para depuração. */
  threshold: number;
  /** Fator de redução aplicado no processamento (1 = sem redução). */
  scale: number;
  /** Total de componentes antes do filtro de área. */
  totalBlobs: number;
}

const DEFAULTS: Required<Omit<DetectionOptions, 'roi'>> = {
  sensitivity: 50,
  minArea: 12,
  maxArea: 0,
  darkOnLight: true,
  maxProcessingSize: 1600,
};

// ---------------------------------------------------------------------------
// Limiar de Otsu — encontra o corte que melhor separa fundo de objeto
// ---------------------------------------------------------------------------
function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = -1;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

// ---------------------------------------------------------------------------
// Detecção principal
// ---------------------------------------------------------------------------
export function detectObjects(
  image: HTMLImageElement | HTMLCanvasElement,
  options: DetectionOptions = {}
): DetectionResult {
  const opts = { ...DEFAULTS, ...options };

  const srcW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

  // Região analisada (ROI ou imagem inteira), com limites saneados.
  const roiX = Math.max(0, Math.floor(options.roi?.x ?? 0));
  const roiY = Math.max(0, Math.floor(options.roi?.y ?? 0));
  const roiW = Math.min(srcW - roiX, Math.floor(options.roi?.width ?? srcW));
  const roiH = Math.min(srcH - roiY, Math.floor(options.roi?.height ?? srcH));

  if (roiW <= 0 || roiH <= 0) {
    return { objects: [], threshold: 0, scale: 1, totalBlobs: 0 };
  }

  // Reduz imagens grandes para manter a detecção rápida.
  const largest = Math.max(roiW, roiH);
  const scale = largest > opts.maxProcessingSize ? opts.maxProcessingSize / largest : 1;
  const w = Math.max(1, Math.round(roiW * scale));
  const h = Math.max(1, Math.round(roiH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { objects: [], threshold: 0, scale, totalBlobs: 0 };

  ctx.drawImage(image, roiX, roiY, roiW, roiH, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // --- Escala de cinza (luminância) + histograma ---
  const gray = new Uint8Array(w * h);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    gray[p] = v;
    histogram[v]++;
  }

  // --- Limiar: Otsu ajustado pela sensibilidade ---
  const base = otsuThreshold(histogram, w * h);
  // sensibilidade 50 = neutro; 100 = +40 níveis (mais permissivo); 0 = -40.
  const offset = Math.round(((opts.sensitivity - 50) / 50) * 40);
  const threshold = Math.max(1, Math.min(254, base + (opts.darkOnLight ? offset : -offset)));

  // --- Binarização ---
  const bin = new Uint8Array(w * h);
  for (let p = 0; p < gray.length; p++) {
    const isObject = opts.darkOnLight ? gray[p] < threshold : gray[p] > threshold;
    bin[p] = isObject ? 1 : 0;
  }

  // --- Componentes conexos (8-vizinhança, BFS iterativo com fila típada) ---
  const labels = new Int32Array(w * h).fill(0);
  const queue = new Int32Array(w * h);
  const objects: DetectedObject[] = [];
  let label = 0;
  let totalBlobs = 0;

  // Converte área do espaço original para o espaço reduzido.
  const areaScale = scale * scale;
  const minAreaScaled = Math.max(1, opts.minArea * areaScale);
  const maxAreaScaled = opts.maxArea > 0 ? opts.maxArea * areaScale : Infinity;

  for (let start = 0; start < bin.length; start++) {
    if (bin[start] === 0 || labels[start] !== 0) continue;

    label++;
    totalBlobs++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;

    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (head < tail) {
      const p = queue[head++];
      const px = p % w;
      const py = (p / w) | 0;

      area++;
      sumX += px;
      sumY += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const np = ny * w + nx;
          if (bin[np] === 1 && labels[np] === 0) {
            labels[np] = label;
            queue[tail++] = np;
          }
        }
      }
    }

    if (area < minAreaScaled || area > maxAreaScaled) continue;

    // Converte de volta para coordenadas da imagem ORIGINAL.
    const cx = roiX + (sumX / area) / scale;
    const cy = roiY + (sumY / area) / scale;

    objects.push({
      x: Math.round(cx),
      y: Math.round(cy),
      area: Math.round(area / areaScale),
      bbox: {
        x: Math.round(roiX + minX / scale),
        y: Math.round(roiY + minY / scale),
        width: Math.round((maxX - minX + 1) / scale),
        height: Math.round((maxY - minY + 1) / scale),
      },
    });
  }

  return { objects, threshold, scale, totalBlobs };
}

// ---------------------------------------------------------------------------
// Sugestão automática de área mínima
// ---------------------------------------------------------------------------
/**
 * Estima uma área mínima razoável a partir da mediana das áreas detectadas,
 * ajudando a descartar ruído (poeira, arranhões) sem perder sementes.
 */
export function suggestMinArea(objects: DetectedObject[]): number {
  if (objects.length === 0) return DEFAULTS.minArea;
  const areas = objects.map(o => o.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  return Math.max(4, Math.round(median * 0.25));
}
