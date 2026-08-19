// =============================================================================
// SeedCounter — Detecção Assistida (visão computacional clássica)
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Pipeline: cinza -> limiar (Otsu + sensibilidade, com polaridade automática)
// -> componentes conexos -> filtro por área -> [opcional] separação de objetos
// colados por transformada de distância -> centroides.
//
// Não requer modelo treinado: roda no navegador, offline.
// =============================================================================

export interface DetectionOptions {
  /** 0–100. Mais alto = detecta mais objetos (limiar mais permissivo). */
  sensitivity?: number;
  /** Área mínima do objeto, em pixels da imagem original. */
  minArea?: number;
  /** Área máxima do objeto, em pixels da imagem original. 0 = automático. */
  maxArea?: number;
  /**
   * Polaridade. 'auto' (padrão) decide pela borda da imagem — evita marcar o
   * fundo inteiro. true = objetos escuros em fundo claro; false = inverso.
   */
  darkOnLight?: boolean | 'auto';
  /** Separa sementes encostadas usando transformada de distância. */
  splitTouching?: boolean;
  /** Distância mínima entre centros ao separar (≈ raio da semente), em px. */
  separation?: number;
  /** Região de interesse na imagem original. Ausente = imagem inteira. */
  roi?: { x: number; y: number; width: number; height: number };
  /** Maior dimensão usada no processamento (imagens grandes são reduzidas). */
  maxProcessingSize?: number;
  /** Gera PNG (dataURL) destacando apenas os objetos aceitos. */
  buildMask?: boolean;
}

export interface DetectedObject {
  x: number;
  y: number;
  area: number;
  radius: number;
  bbox: { x: number; y: number; width: number; height: number };
  /** true quando veio da separação de um aglomerado. */
  split?: boolean;
}

export interface DetectionResult {
  objects: DetectedObject[];
  threshold: number;
  scale: number;
  totalBlobs: number;
  /** Polaridade efetivamente usada (útil quando 'auto'). */
  darkOnLight: boolean;
  maskDataUrl?: string;
  maskRect?: { x: number; y: number; width: number; height: number };
  /** Avisos para a interface (ex.: fundo detectado como objeto). */
  warnings?: string[];
}

const DEFAULTS = {
  sensitivity: 50,
  minArea: 12,
  maxArea: 0,
  darkOnLight: 'auto' as boolean | 'auto',
  splitTouching: false,
  separation: 6,
  maxProcessingSize: 1600,
  buildMask: false,
};

/** Acima disso um blob é considerado fundo/artefato e não é dividido. */
const MAX_SPLIT_PIXELS = 40000;
/** Fração máxima da área da imagem que um objeto pode ocupar. */
const MAX_OBJECT_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Limiar de Otsu
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
// Transformada de distância (chamfer 3-4)
// ---------------------------------------------------------------------------
function distanceTransform(bin: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < bin.length; i++) dist[i] = bin[i] ? INF : 0;

  const D1 = 3;
  const D2 = 4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (dist[p] === 0) continue;
      let m = dist[p];
      if (y > 0) {
        if (x > 0) m = Math.min(m, dist[p - w - 1] + D2);
        m = Math.min(m, dist[p - w] + D1);
        if (x < w - 1) m = Math.min(m, dist[p - w + 1] + D2);
      }
      if (x > 0) m = Math.min(m, dist[p - 1] + D1);
      dist[p] = m;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (dist[p] === 0) continue;
      let m = dist[p];
      if (y < h - 1) {
        if (x < w - 1) m = Math.min(m, dist[p + w + 1] + D2);
        m = Math.min(m, dist[p + w] + D1);
        if (x > 0) m = Math.min(m, dist[p + w - 1] + D2);
      }
      if (x < w - 1) m = Math.min(m, dist[p + 1] + D1);
      dist[p] = m;
    }
  }

  for (let i = 0; i < dist.length; i++) dist[i] /= D1;
  return dist;
}

// ---------------------------------------------------------------------------
// Detecção principal
// ---------------------------------------------------------------------------
export function detectObjects(
  image: HTMLImageElement | HTMLCanvasElement,
  options: DetectionOptions = {}
): DetectionResult {
  const opts = { ...DEFAULTS, ...options };
  const warnings: string[] = [];

  const srcW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

  const roiX = Math.max(0, Math.floor(options.roi?.x ?? 0));
  const roiY = Math.max(0, Math.floor(options.roi?.y ?? 0));
  const roiW = Math.min(srcW - roiX, Math.floor(options.roi?.width ?? srcW));
  const roiH = Math.min(srcH - roiY, Math.floor(options.roi?.height ?? srcH));

  const empty: DetectionResult = {
    objects: [], threshold: 0, scale: 1, totalBlobs: 0, darkOnLight: true,
  };
  if (roiW <= 0 || roiH <= 0) return empty;

  const largest = Math.max(roiW, roiH);
  const scale = largest > opts.maxProcessingSize ? opts.maxProcessingSize / largest : 1;
  const w = Math.max(1, Math.round(roiW * scale));
  const h = Math.max(1, Math.round(roiH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;

  ctx.drawImage(image, roiX, roiY, roiW, roiH, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // --- Cinza + histograma ---
  const gray = new Uint8Array(w * h);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    gray[p] = v;
    histogram[v]++;
  }

  const base = otsuThreshold(histogram, w * h);

  // --- Polaridade automática: a borda da imagem é quase sempre fundo ---
  let dark: boolean;
  if (opts.darkOnLight === 'auto') {
    let borderSum = 0;
    let borderCount = 0;
    for (let x = 0; x < w; x++) {
      borderSum += gray[x] + gray[(h - 1) * w + x];
      borderCount += 2;
    }
    for (let y = 0; y < h; y++) {
      borderSum += gray[y * w] + gray[y * w + (w - 1)];
      borderCount += 2;
    }
    const borderMean = borderSum / Math.max(1, borderCount);
    // Fundo claro (borda acima do limiar) => objetos escuros.
    dark = borderMean >= base;
  } else {
    dark = opts.darkOnLight;
  }

  const offset = Math.round(((opts.sensitivity - 50) / 50) * 40);
  const threshold = Math.max(1, Math.min(254, base + (dark ? offset : -offset)));

  // --- Binarização ---
  const bin = new Uint8Array(w * h);
  let objectPixels = 0;
  for (let p = 0; p < gray.length; p++) {
    const isObj = dark ? gray[p] < threshold : gray[p] > threshold;
    bin[p] = isObj ? 1 : 0;
    if (isObj) objectPixels++;
  }

  // Proteção: se "objeto" virou a maioria da imagem, a polaridade está errada.
  if (objectPixels > bin.length * 0.6) {
    for (let p = 0; p < bin.length; p++) bin[p] = bin[p] ? 0 : 1;
    dark = !dark;
    warnings.push('Polaridade invertida automaticamente (o fundo estava sendo marcado).');
  }

  // --- Rotulagem: primeira passagem só com estatísticas (sem guardar pixels) ---
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  const stats: { area: number; sumX: number; sumY: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  let label = 0;

  for (let start = 0; start < bin.length; start++) {
    if (bin[start] === 0 || labels[start] !== 0) continue;

    label++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;

    let area = 0, sumX = 0, sumY = 0;
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
    stats.push({ area, sumX, sumY, minX, maxX, minY, maxY });
  }

  const totalBlobs = stats.length;

  // --- Filtro por área ---
  const areaScale = scale * scale;
  const minAreaScaled = Math.max(1, opts.minArea * areaScale);
  const autoMax = w * h * MAX_OBJECT_FRACTION;
  const maxAreaScaled = opts.maxArea > 0 ? opts.maxArea * areaScale : autoMax;

  const accepted = new Uint8Array(stats.length + 1); // índice = label
  let rejectedBig = 0;
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    if (s.area >= minAreaScaled && s.area <= maxAreaScaled) accepted[i + 1] = 1;
    else if (s.area > maxAreaScaled) rejectedBig++;
  }
  if (rejectedBig > 0) {
    warnings.push(`${rejectedBig} região(ões) grande(s) ignorada(s) como fundo.`);
  }

  // --- Segunda passagem: pixels apenas dos blobs aceitos (para separação) ---
  const needPixels = opts.splitTouching;
  const pixelsByLabel = new Map<number, number[]>();
  if (needPixels) {
    for (let p = 0; p < labels.length; p++) {
      const l = labels[p];
      if (l === 0 || !accepted[l]) continue;
      let arr = pixelsByLabel.get(l);
      if (!arr) { arr = []; pixelsByLabel.set(l, arr); }
      arr.push(p);
    }
  }

  const dist = opts.splitTouching ? distanceTransform(bin, w, h) : null;
  const sepScaled = Math.max(2, opts.separation * scale);
  const objects: DetectedObject[] = [];

  const toOriginal = (px: number, py: number) => ({
    x: Math.round(roiX + px / scale),
    y: Math.round(roiY + py / scale),
  });

  for (let i = 0; i < stats.length; i++) {
    const l = i + 1;
    if (!accepted[l]) continue;
    const s = stats[i];

    const tl = toOriginal(s.minX, s.minY);
    const bbox = {
      x: tl.x,
      y: tl.y,
      width: Math.round((s.maxX - s.minX + 1) / scale),
      height: Math.round((s.maxY - s.minY + 1) / scale),
    };

    // --- Separação de aglomerados ---
    if (dist) {
      const pix = pixelsByLabel.get(l);
      // Blobs enormes não são aglomerados de sementes: não tenta dividir.
      if (pix && pix.length <= MAX_SPLIT_PIXELS) {
        const cand: { px: number; py: number; d: number }[] = [];
        for (const p of pix) {
          const d = dist[p];
          if (d >= sepScaled * 0.5) cand.push({ px: p % w, py: (p / w) | 0, d });
        }
        cand.sort((a, b) => b.d - a.d);

        // Supressão de não-máximos com grade espacial (evita custo quadrático).
        const cell = Math.max(1, sepScaled);
        const grid = new Map<string, { px: number; py: number }[]>();
        const peaks: { px: number; py: number; d: number }[] = [];

        for (const c of cand) {
          const gx = Math.floor(c.px / cell);
          const gy = Math.floor(c.py / cell);
          let tooClose = false;
          for (let ax = gx - 1; ax <= gx + 1 && !tooClose; ax++) {
            for (let ay = gy - 1; ay <= gy + 1 && !tooClose; ay++) {
              const bucket = grid.get(`${ax},${ay}`);
              if (!bucket) continue;
              for (const q of bucket) {
                if (Math.hypot(q.px - c.px, q.py - c.py) < sepScaled) { tooClose = true; break; }
              }
            }
          }
          if (tooClose) continue;
          peaks.push(c);
          const key = `${gx},${gy}`;
          const bucket = grid.get(key);
          if (bucket) bucket.push({ px: c.px, py: c.py });
          else grid.set(key, [{ px: c.px, py: c.py }]);
        }

        if (peaks.length > 1) {
          for (const peak of peaks) {
            const o = toOriginal(peak.px, peak.py);
            objects.push({
              x: o.x,
              y: o.y,
              area: Math.round(s.area / areaScale / peaks.length),
              radius: Math.max(1, Math.round(peak.d / scale)),
              bbox,
              split: true,
            });
          }
          continue;
        }
      }
    }

    const c = toOriginal(s.sumX / s.area, s.sumY / s.area);
    objects.push({
      x: c.x,
      y: c.y,
      area: Math.round(s.area / areaScale),
      radius: Math.max(1, Math.round(Math.sqrt(s.area / Math.PI) / scale)),
      bbox,
    });
  }

  // --- Máscara: pinta SOMENTE os objetos aceitos (não o binário cru) ---
  let maskDataUrl: string | undefined;
  if (opts.buildMask) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    if (mctx) {
      const img = mctx.createImageData(w, h);
      for (let p = 0, i = 0; p < labels.length; p++, i += 4) {
        const l = labels[p];
        if (l !== 0 && accepted[l]) {
          img.data[i] = 16;
          img.data[i + 1] = 185;
          img.data[i + 2] = 129;
          img.data[i + 3] = 130;
        }
      }
      mctx.putImageData(img, 0, 0);
      maskDataUrl = maskCanvas.toDataURL('image/png');
    }
  }

  return {
    objects,
    threshold,
    scale,
    totalBlobs,
    darkOnLight: dark,
    maskDataUrl,
    maskRect: { x: roiX, y: roiY, width: roiW, height: roiH },
    warnings: warnings.length ? warnings : undefined,
  };
}

// ---------------------------------------------------------------------------
// Sugestões automáticas
// ---------------------------------------------------------------------------
export function suggestMinArea(objects: DetectedObject[]): number {
  if (objects.length === 0) return DEFAULTS.minArea;
  const areas = objects.map(o => o.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  return Math.max(4, Math.round(median * 0.25));
}

export function suggestSeparation(objects: DetectedObject[]): number {
  if (objects.length === 0) return DEFAULTS.separation;
  const areas = objects.map(o => o.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  return Math.max(3, Math.round(Math.sqrt(median / Math.PI)));
}
