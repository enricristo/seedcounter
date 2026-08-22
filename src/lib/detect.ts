// =============================================================================
// SeedCounter — Detecção Assistida (visão computacional clássica)
// GPEOrq / GPSEM · Unoeste
// =============================================================================
// Pipeline (cada etapa pode ser desligada):
//   1. escala de cinza (com escolha do canal)
//   2. subtração de fundo — remove gradiente de iluminação e o fundo da placa
//   3. limiar: global (Otsu) ou adaptativo local
//   4. limpeza morfológica — elimina pontos isolados e fecha buracos
//   5. componentes conexos
//   6. filtros de forma — área e alongamento
//   7. separação opcional de aglomerados
//
// LIMITE CONHECIDO: para sementes translúcidas, muito sobrepostas e de baixo
// contraste, esta abordagem sempre terá dificuldade — o modelo de IA é a
// ferramenta adequada nesses casos. Aqui buscamos ser úteis em imagens de
// scanner com fundo razoavelmente uniforme.
// =============================================================================

export type ThresholdMode = 'otsu' | 'adaptive';
export type GrayChannel = 'luminance' | 'r' | 'g' | 'b';

export interface DetectionOptions {
  sensitivity?: number;
  minArea?: number;
  maxArea?: number;
  darkOnLight?: boolean | 'auto';
  splitTouching?: boolean;
  separation?: number;
  roi?: { x: number; y: number; width: number; height: number };
  maxProcessingSize?: number;
  buildMask?: boolean;

  /** Canal usado para a conversão em cinza. */
  channel?: GrayChannel;
  /**
   * Subtração de fundo: raio (px) da estimativa. 0 desliga.
   * Deve ser maior que a maior semente — o fundo é o que "sobra" ao suavizar.
   */
  backgroundRadius?: number;
  /** Estratégia de limiar. */
  thresholdMode?: ThresholdMode;
  /** Janela do limiar adaptativo, em pixels. */
  adaptiveWindow?: number;
  /** Remove ruído: 0 = desligado, 1–3 = intensidade da limpeza. */
  denoise?: number;
  /** Descarta objetos muito alongados (razão de aspecto acima disto). 0 = sem limite. */
  maxElongation?: number;
}

export interface DetectedObject {
  x: number;
  y: number;
  area: number;
  radius: number;
  bbox: { x: number; y: number; width: number; height: number };
  split?: boolean;
}

export interface DetectionResult {
  objects: DetectedObject[];
  threshold: number;
  scale: number;
  totalBlobs: number;
  darkOnLight: boolean;
  maskDataUrl?: string;
  maskRect?: { x: number; y: number; width: number; height: number };
  warnings?: string[];
  /** Diagnóstico: quantos objetos cada filtro descartou. */
  rejected?: { area: number; elongation: number; background: number };
}

const DEFAULTS = {
  sensitivity: 50,
  minArea: 60,
  maxArea: 0,
  darkOnLight: 'auto' as boolean | 'auto',
  splitTouching: false,
  separation: 8,
  maxProcessingSize: 1400,
  buildMask: false,
  channel: 'luminance' as GrayChannel,
  backgroundRadius: 0,
  thresholdMode: 'otsu' as ThresholdMode,
  adaptiveWindow: 51,
  denoise: 1,
  maxElongation: 0,
};

const MAX_SPLIT_PIXELS = 40000;
const MAX_OBJECT_FRACTION = 0.25;

// ---------------------------------------------------------------------------
// Limiar de Otsu
// ---------------------------------------------------------------------------
function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0, wB = 0, maxVar = -1, threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; threshold = t; }
  }
  return threshold;
}

// ---------------------------------------------------------------------------
// Imagem integral — permite média em janela em tempo constante
// ---------------------------------------------------------------------------
function integralImage(src: Uint8Array, w: number, h: number): Float64Array {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      ii[(y + 1) * (w + 1) + (x + 1)] = ii[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  return ii;
}

/** Média da janela quadrada centrada em (x,y), via imagem integral. */
function boxMean(ii: Float64Array, w: number, h: number, x: number, y: number, r: number): number {
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
  const x1 = Math.min(w - 1, x + r), y1 = Math.min(h - 1, y + r);
  const W = w + 1;
  const sum =
    ii[(y1 + 1) * W + (x1 + 1)] - ii[y0 * W + (x1 + 1)] -
    ii[(y1 + 1) * W + x0] + ii[y0 * W + x0];
  return sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
}

// ---------------------------------------------------------------------------
// Subtração de fundo
// ---------------------------------------------------------------------------
/**
 * Estima o fundo por média em janela grande e o subtrai — aproximação do
 * "rolling ball" do ImageJ. Corrige gradiente de iluminação e o tom da placa,
 * que é o que faz o limiar global falhar.
 */
function subtractBackground(
  gray: Uint8Array, w: number, h: number, radius: number, darkObjects: boolean
): Uint8Array {
  const ii = integralImage(gray, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bg = boxMean(ii, w, h, x, y, radius);
      const v = gray[y * w + x];
      // Objetos escuros: guarda o quanto o pixel está ABAIXO do fundo.
      const d = darkObjects ? bg - v : v - bg;
      // Recentra em 128 para manter o resultado no domínio de 8 bits.
      const r = 128 + d;
      out[y * w + x] = r < 0 ? 0 : r > 255 ? 255 : r;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Morfologia binária (limpeza)
// ---------------------------------------------------------------------------
/** Erosão/dilatação 3×3 — combinadas formam abertura e fechamento. */
function morph(bin: Uint8Array, w: number, h: number, erode: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = erode ? 1 : 0;
      for (let dy = -1; dy <= 1 && (erode ? acc : !acc); dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) { if (erode) acc = 0; continue; }
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) { if (erode) acc = 0; break; }
          const v = bin[ny * w + nx];
          if (erode && !v) { acc = 0; break; }
          if (!erode && v) { acc = 1; break; }
        }
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** Abertura (remove pontos isolados) seguida de fechamento (tapa buracos). */
function cleanup(bin: Uint8Array, w: number, h: number, strength: number): Uint8Array {
  let b = bin;
  for (let i = 0; i < strength; i++) b = morph(b, w, h, true);   // erosões
  for (let i = 0; i < strength * 2; i++) b = morph(b, w, h, false); // dilatações
  for (let i = 0; i < strength; i++) b = morph(b, w, h, true);   // volta ao tamanho
  return b;
}

// ---------------------------------------------------------------------------
// Transformada de distância (chamfer 3-4)
// ---------------------------------------------------------------------------
function distanceTransform(bin: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < bin.length; i++) d[i] = bin[i] ? INF : 0;
  const D1 = 3, D2 = 4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (d[p] === 0) continue;
      let m = d[p];
      if (y > 0) {
        if (x > 0) m = Math.min(m, d[p - w - 1] + D2);
        m = Math.min(m, d[p - w] + D1);
        if (x < w - 1) m = Math.min(m, d[p - w + 1] + D2);
      }
      if (x > 0) m = Math.min(m, d[p - 1] + D1);
      d[p] = m;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (d[p] === 0) continue;
      let m = d[p];
      if (y < h - 1) {
        if (x < w - 1) m = Math.min(m, d[p + w + 1] + D2);
        m = Math.min(m, d[p + w] + D1);
        if (x > 0) m = Math.min(m, d[p + w - 1] + D2);
      }
      if (x < w - 1) m = Math.min(m, d[p + 1] + D1);
      d[p] = m;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= D1;
  return d;
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
  const rejected = { area: 0, elongation: 0, background: 0 };

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
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return empty;
  ctx.drawImage(image, roiX, roiY, roiW, roiH, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // --- 1. Cinza (canal escolhido) ---
  let gray: Uint8Array = new Uint8Array(new ArrayBuffer(w * h));
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] =
      opts.channel === 'r' ? data[i] :
      opts.channel === 'g' ? data[i + 1] :
      opts.channel === 'b' ? data[i + 2] :
      (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }

  // --- Polaridade: a borda da imagem é quase sempre fundo ---
  const histRaw = new Uint32Array(256);
  for (let p = 0; p < gray.length; p++) histRaw[gray[p]]++;
  const baseRaw = otsuThreshold(histRaw, w * h);

  let dark: boolean;
  if (opts.darkOnLight === 'auto') {
    let s = 0, n = 0;
    for (let x = 0; x < w; x++) { s += gray[x] + gray[(h - 1) * w + x]; n += 2; }
    for (let y = 0; y < h; y++) { s += gray[y * w] + gray[y * w + w - 1]; n += 2; }
    dark = s / Math.max(1, n) >= baseRaw;
  } else {
    dark = opts.darkOnLight;
  }

  // --- 2. Subtração de fundo (opcional) ---
  let subtracted = false;
  if (opts.backgroundRadius > 0) {
    const r = Math.max(3, Math.round(opts.backgroundRadius * scale));
    gray = subtractBackground(gray, w, h, r, dark);
    subtracted = true;
    // Após a subtração, o objeto é sempre CLARO sobre fundo cinza médio.
    dark = false;
  }

  // --- 3. Limiar ---
  const bin = new Uint8Array(w * h);
  let threshold = 0;
  const offset = ((opts.sensitivity - 50) / 50) * 40;

  if (opts.thresholdMode === 'adaptive') {
    // Limiar local: compara cada pixel com a média da vizinhança.
    const ii = integralImage(gray, w, h);
    const r = Math.max(3, Math.round((opts.adaptiveWindow * scale) / 2));
    // Margem sobre a média local; sensibilidade desloca essa margem.
    const bias = 6 - offset * 0.25;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const m = boxMean(ii, w, h, x, y, r);
        bin[p] = (dark ? gray[p] < m - bias : gray[p] > m + bias) ? 1 : 0;
      }
    }
    threshold = -1; // não há valor global
  } else {
    const hist = new Uint32Array(256);
    for (let p = 0; p < gray.length; p++) hist[gray[p]]++;
    const base = subtracted ? otsuThreshold(hist, w * h) : baseRaw;
    threshold = Math.max(1, Math.min(254, Math.round(base + (dark ? offset : -offset))));
    for (let p = 0; p < gray.length; p++) {
      bin[p] = (dark ? gray[p] < threshold : gray[p] > threshold) ? 1 : 0;
    }
  }

  // Proteção: se "objeto" virou a maioria, a polaridade está errada.
  let objPixels = 0;
  for (let p = 0; p < bin.length; p++) objPixels += bin[p];
  if (objPixels > bin.length * 0.6) {
    for (let p = 0; p < bin.length; p++) bin[p] = bin[p] ? 0 : 1;
    dark = !dark;
    warnings.push('Polaridade invertida automaticamente (o fundo estava sendo marcado).');
  }

  // --- 4. Limpeza morfológica ---
  const clean = opts.denoise > 0 ? cleanup(bin, w, h, Math.min(3, opts.denoise)) : bin;

  // --- 5. Componentes conexos ---
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  const stats: { area: number; sumX: number; sumY: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  let label = 0;

  for (let start = 0; start < clean.length; start++) {
    if (clean[start] === 0 || labels[start] !== 0) continue;
    label++;
    let head = 0, tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let area = 0, sumX = 0, sumY = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (head < tail) {
      const p = queue[head++];
      const px = p % w, py = (p / w) | 0;
      area++; sumX += px; sumY += py;
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
          if (clean[np] === 1 && labels[np] === 0) {
            labels[np] = label;
            queue[tail++] = np;
          }
        }
      }
    }
    stats.push({ area, sumX, sumY, minX, maxX, minY, maxY });
  }

  const totalBlobs = stats.length;

  // --- 6. Filtros de forma ---
  const areaScale = scale * scale;
  const minAreaScaled = Math.max(1, opts.minArea * areaScale);
  const autoMax = w * h * MAX_OBJECT_FRACTION;
  const maxAreaScaled = opts.maxArea > 0 ? opts.maxArea * areaScale : autoMax;

  const accepted = new Uint8Array(stats.length + 1);
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    if (s.area < minAreaScaled) { rejected.area++; continue; }
    if (s.area > maxAreaScaled) { rejected.background++; continue; }
    if (opts.maxElongation > 0) {
      const bw = s.maxX - s.minX + 1, bh = s.maxY - s.minY + 1;
      const elong = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
      if (elong > opts.maxElongation) { rejected.elongation++; continue; }
    }
    accepted[i + 1] = 1;
  }

  if (rejected.background > 0) {
    warnings.push(`${rejected.background} região(ões) grande(s) ignorada(s) como fundo.`);
  }
  if (rejected.area > totalBlobs * 0.8 && totalBlobs > 20) {
    warnings.push('Quase tudo foi descartado por tamanho — reduza o tamanho mínimo.');
  }

  // --- 7. Separação de aglomerados (opcional) ---
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

  const dist = opts.splitTouching ? distanceTransform(clean, w, h) : null;
  const sepScaled = Math.max(3, opts.separation * scale);
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
      x: tl.x, y: tl.y,
      width: Math.round((s.maxX - s.minX + 1) / scale),
      height: Math.round((s.maxY - s.minY + 1) / scale),
    };

    if (dist) {
      const pix = pixelsByLabel.get(l);
      if (pix && pix.length <= MAX_SPLIT_PIXELS) {
        // Só separa se o blob for grande o bastante para conter vários objetos.
        const expectedOne = Math.PI * sepScaled * sepScaled;
        if (pix.length > expectedOne * 1.6) {
          // Candidatos: apenas MÁXIMOS LOCAIS verdadeiros da distância.
          // Sem esta exigência, regiões alongadas geram cadeias de pontos.
          const cand: { px: number; py: number; d: number }[] = [];
          for (const p of pix) {
            const d0 = dist[p];
            if (d0 < sepScaled * 0.6) continue;
            const px = p % w, py = (p / w) | 0;
            let isMax = true;
            const rr = Math.max(1, Math.round(sepScaled * 0.5));
            for (let dy = -rr; dy <= rr && isMax; dy++) {
              const ny = py + dy;
              if (ny < 0 || ny >= h) continue;
              for (let dx = -rr; dx <= rr; dx++) {
                const nx = px + dx;
                if (nx < 0 || nx >= w) continue;
                if (dist[ny * w + nx] > d0) { isMax = false; break; }
              }
            }
            if (isMax) cand.push({ px, py, d: d0 });
          }

          cand.sort((a, b) => b.d - a.d);
          const cell = Math.max(1, sepScaled);
          const grid = new Map<string, { px: number; py: number }[]>();
          const peaks: { px: number; py: number; d: number }[] = [];

          for (const c of cand) {
            const gx = Math.floor(c.px / cell), gy = Math.floor(c.py / cell);
            let close = false;
            for (let ax = gx - 1; ax <= gx + 1 && !close; ax++) {
              for (let ay = gy - 1; ay <= gy + 1 && !close; ay++) {
                const bucket = grid.get(`${ax},${ay}`);
                if (!bucket) continue;
                for (const q of bucket) {
                  if (Math.hypot(q.px - c.px, q.py - c.py) < sepScaled) { close = true; break; }
                }
              }
            }
            if (close) continue;
            peaks.push(c);
            const key = `${gx},${gy}`;
            const bucket = grid.get(key);
            if (bucket) bucket.push({ px: c.px, py: c.py });
            else grid.set(key, [{ px: c.px, py: c.py }]);
          }

          // Só aceita a divisão se cada parte ficar com área plausível.
          const partArea = s.area / Math.max(1, peaks.length);
          if (peaks.length > 1 && partArea >= minAreaScaled) {
            for (const peak of peaks) {
              const o = toOriginal(peak.px, peak.py);
              objects.push({
                x: o.x, y: o.y,
                area: Math.round(partArea / areaScale),
                radius: Math.max(1, Math.round(peak.d / scale)),
                bbox, split: true,
              });
            }
            continue;
          }
        }
      }
    }

    const c = toOriginal(s.sumX / s.area, s.sumY / s.area);
    objects.push({
      x: c.x, y: c.y,
      area: Math.round(s.area / areaScale),
      radius: Math.max(1, Math.round(Math.sqrt(s.area / Math.PI) / scale)),
      bbox,
    });
  }

  // --- Máscara: apenas os objetos aceitos ---
  let maskDataUrl: string | undefined;
  if (opts.buildMask) {
    const mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    const mctx = mc.getContext('2d');
    if (mctx) {
      const img = mctx.createImageData(w, h);
      for (let p = 0, i = 0; p < labels.length; p++, i += 4) {
        const l = labels[p];
        if (l !== 0 && accepted[l]) {
          img.data[i] = 16; img.data[i + 1] = 185; img.data[i + 2] = 129; img.data[i + 3] = 130;
        }
      }
      mctx.putImageData(img, 0, 0);
      maskDataUrl = mc.toDataURL('image/png');
    }
  }

  return {
    objects, threshold, scale, totalBlobs, darkOnLight: dark,
    maskDataUrl,
    maskRect: { x: roiX, y: roiY, width: roiW, height: roiH },
    warnings: warnings.length ? warnings : undefined,
    rejected,
  };
}

// ---------------------------------------------------------------------------
// Sugestões automáticas
// ---------------------------------------------------------------------------
export function suggestMinArea(objects: DetectedObject[]): number {
  if (objects.length === 0) return DEFAULTS.minArea;
  const areas = objects.map(o => o.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  return Math.max(10, Math.round(median * 0.4));
}

export function suggestSeparation(objects: DetectedObject[]): number {
  if (objects.length === 0) return DEFAULTS.separation;
  const areas = objects.map(o => o.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  return Math.max(4, Math.round(Math.sqrt(median / Math.PI)));
}
