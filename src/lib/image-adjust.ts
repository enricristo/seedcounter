// =============================================================================
// SeedCounter — Ajuste de imagem
// GPEOrq / GPSEM · Unoeste
// =============================================================================
// Ajustes não destrutivos aplicados sobre a imagem original. Servem para dois
// fins: (1) enxergar melhor durante a contagem manual e (2) melhorar o
// contraste antes da detecção automática.
//
// A imagem original NUNCA é alterada — os ajustes vivem separados e podem ser
// zerados a qualquer momento. Todo o recurso é opcional: com valores neutros,
// o app se comporta exatamente como antes.
// =============================================================================

export interface ImageAdjustments {
  /** -100 a 100. 0 = neutro. */
  brightness: number;
  /** -100 a 100. 0 = neutro. */
  contrast: number;
  /**
   * 0.2 a 3.0. 1 = neutro.
   * Valores > 1 clareiam as sombras (revelam detalhe no escuro);
   * valores < 1 escurecem os tons médios (aumentam a densidade).
   */
  gamma: number;
  /** -100 a 100 por canal. 0 = neutro. */
  red: number;
  green: number;
  blue: number;
  /** -100 a 100. -100 = tons de cinza. */
  saturation: number;
  /** Inverte a imagem (útil quando o objeto é claro no fundo escuro). */
  invert: boolean;
  /**
   * Isola um canal e o exibe em tons de cinza. Para sementes, um único canal
   * costuma separar melhor objeto e fundo do que a imagem colorida.
   */
  channel: 'all' | 'r' | 'g' | 'b';
}

export const NEUTRAL_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  red: 0,
  green: 0,
  blue: 0,
  saturation: 0,
  invert: false,
  channel: 'all',
};

/** true quando nenhum ajuste está ativo (permite pular o processamento). */
export function isNeutral(a: ImageAdjustments): boolean {
  return (
    a.brightness === 0 && a.contrast === 0 && a.gamma === 1 &&
    a.red === 0 && a.green === 0 && a.blue === 0 &&
    a.saturation === 0 && !a.invert && a.channel === 'all'
  );
}

/** Predefinições úteis no laboratório. */
export const ADJUSTMENT_PRESETS: { id: string; label: string; hint: string; values: Partial<ImageAdjustments> }[] = [
  {
    id: 'neutral', label: 'Original', hint: 'Sem ajustes',
    values: NEUTRAL_ADJUSTMENTS,
  },
  {
    id: 'contrast', label: 'Realçar sementes', hint: 'Mais contraste e leve escurecimento',
    values: { contrast: 35, brightness: -8, gamma: 0.9 },
  },
  {
    id: 'green', label: 'Canal verde', hint: 'Costuma separar melhor semente e papel',
    values: { channel: 'g', contrast: 25 },
  },
  {
    id: 'blue', label: 'Canal azul', hint: 'Útil quando há coloração avermelhada (tetrazólio)',
    values: { channel: 'b', contrast: 25 },
  },
  {
    id: 'shadows', label: 'Abrir sombras', hint: 'Recupera detalhe em regiões escuras',
    values: { gamma: 1.8, contrast: 10 },
  },
  {
    id: 'tetrazolium', label: 'Realçar vermelho', hint: 'Destaca tecido corado em tetrazólio',
    values: { red: 25, green: -15, blue: -15, saturation: 40, contrast: 20 },
  },
];

// ---------------------------------------------------------------------------
// Tabelas de consulta (LUT) — processa 1× por canal em vez de por pixel
// ---------------------------------------------------------------------------
function buildLUT(brightness: number, contrast: number, gamma: number, channelShift: number): Uint8Array {
  const lut = new Uint8Array(256);
  // Fator de contraste padrão (mesma fórmula usada em editores de imagem).
  const c = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const invGamma = 1 / Math.max(0.01, gamma);

  for (let i = 0; i < 256; i++) {
    let v = i;
    // 1) gama
    v = 255 * Math.pow(v / 255, invGamma);
    // 2) contraste em torno do cinza médio
    v = c * (v - 128) + 128;
    // 3) brilho e deslocamento do canal
    v = v + brightness * 2.55 + channelShift * 2.55;
    lut[i] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }
  return lut;
}

/**
 * Aplica os ajustes e devolve um canvas novo. A imagem de origem permanece
 * intacta — o resultado é usado para exibição e/ou detecção.
 */
export function applyAdjustments(
  source: HTMLImageElement | HTMLCanvasElement,
  adj: ImageAdjustments
): HTMLCanvasElement | null {
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0);
  if (isNeutral(adj)) return canvas;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const lutR = buildLUT(adj.brightness, adj.contrast, adj.gamma, adj.red);
  const lutG = buildLUT(adj.brightness, adj.contrast, adj.gamma, adj.green);
  const lutB = buildLUT(adj.brightness, adj.contrast, adj.gamma, adj.blue);
  const sat = 1 + adj.saturation / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = lutR[d[i]];
    let g = lutG[d[i + 1]];
    let b = lutB[d[i + 2]];

    // Saturação em torno da luminância (mantém o brilho percebido).
    if (adj.saturation !== 0) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
    }

    // Isolamento de canal: replica o canal escolhido nos três.
    if (adj.channel !== 'all') {
      const v = adj.channel === 'r' ? r : adj.channel === 'g' ? g : b;
      r = g = b = v;
    }

    if (adj.invert) {
      r = 255 - r; g = 255 - g; b = 255 - b;
    }

    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Filtro CSS equivalente, para prévia instantânea sem reprocessar pixels.
 * Cobre brilho, contraste e saturação; isolamento de canal e ajuste por canal
 * exigem o processamento real (`applyAdjustments`).
 */
export function toCssFilter(adj: ImageAdjustments): string {
  if (isNeutral(adj)) return 'none';
  const parts: string[] = [];
  if (adj.brightness !== 0) parts.push(`brightness(${1 + adj.brightness / 100})`);
  if (adj.contrast !== 0) parts.push(`contrast(${1 + adj.contrast / 100})`);
  if (adj.saturation !== 0) parts.push(`saturate(${1 + adj.saturation / 100})`);
  if (adj.channel !== 'all') parts.push('grayscale(1)');
  if (adj.invert) parts.push('invert(1)');
  return parts.length ? parts.join(' ') : 'none';
}

// ---------------------------------------------------------------------------
// Histograma — ajuda a escolher o ajuste com base na distribuição real
// ---------------------------------------------------------------------------
export interface Histogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  lum: Uint32Array;
  max: number;
}

export function computeHistogram(
  source: HTMLImageElement | HTMLCanvasElement,
  maxSize = 600
): Histogram | null {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!sw || !sh) return null;

  // Amostragem reduzida: o formato do histograma se mantém e fica instantâneo.
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const r = new Uint32Array(256), g = new Uint32Array(256);
  const b = new Uint32Array(256), lum = new Uint32Array(256);

  for (let i = 0; i < d.length; i += 4) {
    r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++;
    lum[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
  }

  let max = 0;
  for (let i = 0; i < 256; i++) if (lum[i] > max) max = lum[i];
  return { r, g, b, lum, max };
}
