// =============================================================================
// SeedCounter — Inferência YOLOv8-seg no navegador (ONNX Runtime Web)
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Modelo: YOLOv8m-seg treinado no dataset de sementes de orquídea (TCC),
// imgsz 960, classes: 0 = inviavel, 1 = viavel.
//
// Para imagens grandes (scanner), a inferência é feita por RECORTE EM JANELAS
// (tiling) com sobreposição — mesma estratégia do script Python — porque
// redimensionar um scan de 4000px para 960px destruiria as sementes (0,2–2 mm).
//
// O modelo NÃO é embarcado no bundle: é baixado sob demanda da pasta pública
// e cacheado pelo navegador.
// =============================================================================

import type { InferenceSession as OrtSession, Tensor as OrtTensor } from 'onnxruntime-web';

export const YOLO_CLASSES = ['inviavel', 'viavel'] as const;
export type YoloClassName = (typeof YOLO_CLASSES)[number];

/** Caminho padrão do modelo (colocar o arquivo em public/models/). */
export const DEFAULT_MODEL_URL = 'models/seeds-yolov8m-seg.onnx';

export interface YoloDetection {
  /** Centro em coordenadas da imagem ORIGINAL. */
  x: number;
  y: number;
  /** Caixa em coordenadas da imagem original. */
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  classId: number;
  className: YoloClassName;
}

export interface InferenceOptions {
  /** Confiança mínima (padrão 0.45 — valor usado nos notebooks do TCC). */
  confThreshold?: number;
  /** Limiar de IoU do NMS (padrão 0.5). */
  iouThreshold?: number;
  /** Tamanho de entrada do modelo (o treino usou 960). */
  imgSize?: number;
  /** Sobreposição entre janelas, 0–0.5 (padrão 0.2). */
  overlap?: number;
  /** Progresso do processamento das janelas. */
  onProgress?: (done: number, total: number) => void;
}

const DEFAULTS = {
  confThreshold: 0.45,
  iouThreshold: 0.5,
  imgSize: 960,
  overlap: 0.2,
};

// ---------------------------------------------------------------------------
// Carregamento da sessão (uma vez, reaproveitada)
// ---------------------------------------------------------------------------
let sessionPromise: Promise<OrtSession> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ortModule: any = null;

/** Baixa e prepara o modelo. Usa WebGPU quando disponível, senão WASM. */
export async function loadModel(modelUrl: string = DEFAULT_MODEL_URL): Promise<OrtSession> {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    // Import estático (o Vite precisa do literal para empacotar corretamente).
    const ort = await import('onnxruntime-web');
    ortModule = ort;

    // Os binários WASM não são empacotados pelo Vite: apontamos para o CDN
    // na mesma versão do pacote instalado.
    try {
      const version = ort.env.versions?.web ?? '1.27.0';
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`;
    } catch {
      /* mantém o caminho padrão se a env não estiver acessível */
    }

    // WebGPU é bem mais rápido; cai para WASM multi-thread quando não houver.
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const providers = hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'];

    try {
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
    } catch {
      /* ambiente sem suporte a threads — segue single-thread */
    }

    return ort.InferenceSession.create(modelUrl, {
      executionProviders: providers,
      graphOptimizationLevel: 'all',
    });
  })();

  try {
    return await sessionPromise;
  } catch (err) {
    sessionPromise = null; // permite nova tentativa
    throw err;
  }
}

/** Descarta a sessão (libera memória da GPU/WASM). */
export function unloadModel() {
  sessionPromise = null;
}

export function isModelLoaded(): boolean {
  return sessionPromise !== null;
}

// ---------------------------------------------------------------------------
// Pré-processamento: recorte -> letterbox -> tensor NCHW normalizado
// ---------------------------------------------------------------------------
interface TilePrep {
  data: Float32Array;
  /** Escala aplicada ao recorte para caber em imgSize. */
  ratio: number;
  /** Deslocamento do letterbox dentro da entrada do modelo. */
  padX: number;
  padY: number;
}

function prepareTile(
  source: HTMLImageElement | HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  imgSize: number
): TilePrep | null {
  const canvas = document.createElement('canvas');
  canvas.width = imgSize;
  canvas.height = imgSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Fundo cinza do letterbox (padrão do YOLO)
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, imgSize, imgSize);

  const ratio = Math.min(imgSize / sw, imgSize / sh);
  const dw = Math.round(sw * ratio);
  const dh = Math.round(sh * ratio);
  const padX = Math.floor((imgSize - dw) / 2);
  const padY = Math.floor((imgSize - dh) / 2);

  ctx.drawImage(source, sx, sy, sw, sh, padX, padY, dw, dh);
  const { data } = ctx.getImageData(0, 0, imgSize, imgSize);

  // RGBA (HWC, 0–255) -> RGB (CHW, 0–1)
  const size = imgSize * imgSize;
  const out = new Float32Array(size * 3);
  for (let i = 0, p = 0; p < size; i += 4, p++) {
    out[p] = data[i] / 255;
    out[size + p] = data[i + 1] / 255;
    out[size * 2 + p] = data[i + 2] / 255;
  }

  return { data: out, ratio, padX, padY };
}

// ---------------------------------------------------------------------------
// Non-Maximum Suppression
// ---------------------------------------------------------------------------
function iou(a: YoloDetection, b: YoloDetection): number {
  const ax2 = a.bbox.x + a.bbox.width;
  const ay2 = a.bbox.y + a.bbox.height;
  const bx2 = b.bbox.x + b.bbox.width;
  const by2 = b.bbox.y + b.bbox.height;

  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.bbox.x, b.bbox.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.bbox.y, b.bbox.y));
  const inter = ix * iy;
  if (inter === 0) return 0;

  const union = a.bbox.width * a.bbox.height + b.bbox.width * b.bbox.height - inter;
  return union > 0 ? inter / union : 0;
}

/** NMS por classe — remove duplicatas, inclusive nas bordas entre janelas. */
export function applyNMS(dets: YoloDetection[], iouThreshold: number): YoloDetection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const kept: YoloDetection[] = [];

  for (const d of sorted) {
    let overlapping = false;
    for (const k of kept) {
      if (k.classId === d.classId && iou(d, k) > iouThreshold) {
        overlapping = true;
        break;
      }
    }
    if (!overlapping) kept.push(d);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Decodificação da saída do YOLOv8
// ---------------------------------------------------------------------------
// Saída "output0": [1, 4 + nc + nm, N] — 4 de caixa (cx, cy, w, h),
// nc scores de classe e nm coeficientes de máscara (ignorados: só usamos pontos).
// ---------------------------------------------------------------------------
function decodeOutput(
  output: OrtTensor,
  prep: TilePrep,
  tileX: number,
  tileY: number,
  confThreshold: number
): YoloDetection[] {
  const dims = output.dims as number[];
  const data = output.data as Float32Array;
  if (dims.length !== 3) return [];

  const channels = dims[1];
  const anchors = dims[2];
  const nc = YOLO_CLASSES.length;
  const dets: YoloDetection[] = [];

  // Acesso no layout [1, channels, anchors]
  const at = (c: number, a: number) => data[c * anchors + a];

  for (let a = 0; a < anchors; a++) {
    // Melhor classe entre as nc disponíveis
    let bestScore = 0;
    let bestClass = -1;
    for (let c = 0; c < nc; c++) {
      const score = at(4 + c, a);
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestClass < 0 || bestScore < confThreshold) continue;
    if (channels < 4 + nc) continue;

    // Caixa no espaço da entrada do modelo (centro + tamanho)
    const cx = at(0, a);
    const cy = at(1, a);
    const w = at(2, a);
    const h = at(3, a);

    // Desfaz letterbox e escala; soma a origem da janela.
    const x = (cx - prep.padX) / prep.ratio + tileX;
    const y = (cy - prep.padY) / prep.ratio + tileY;
    const bw = w / prep.ratio;
    const bh = h / prep.ratio;

    dets.push({
      x: Math.round(x),
      y: Math.round(y),
      bbox: {
        x: Math.round(x - bw / 2),
        y: Math.round(y - bh / 2),
        width: Math.round(bw),
        height: Math.round(bh),
      },
      confidence: bestScore,
      classId: bestClass,
      className: YOLO_CLASSES[bestClass],
    });
  }

  return dets;
}

// ---------------------------------------------------------------------------
// Inferência completa (com recorte em janelas)
// ---------------------------------------------------------------------------
export async function detectWithYolo(
  image: HTMLImageElement | HTMLCanvasElement,
  options: InferenceOptions = {}
): Promise<YoloDetection[]> {
  const opts = { ...DEFAULTS, ...options };
  const session = await loadModel();
  const ort = ortModule;
  if (!ort) throw new Error('ONNX Runtime não inicializado.');

  const srcW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

  // Janela do tamanho nativo do treino; imagens menores viram uma janela só.
  const tile = opts.imgSize;
  const step = Math.max(1, Math.round(tile * (1 - opts.overlap)));

  const tiles: { x: number; y: number; w: number; h: number }[] = [];
  if (srcW <= tile && srcH <= tile) {
    tiles.push({ x: 0, y: 0, w: srcW, h: srcH });
  } else {
    for (let y = 0; y < srcH; y += step) {
      for (let x = 0; x < srcW; x += step) {
        const w = Math.min(tile, srcW - x);
        const h = Math.min(tile, srcH - y);
        if (w > 8 && h > 8) tiles.push({ x, y, w, h });
      }
    }
  }

  const inputName = session.inputNames[0];
  const all: YoloDetection[] = [];

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const prep = prepareTile(image, t.x, t.y, t.w, t.h, tile);
    if (!prep) continue;

    const input = new ort.Tensor('float32', prep.data, [1, 3, tile, tile]);
    const output = await session.run({ [inputName]: input });
    const first = output[session.outputNames[0]];

    all.push(...decodeOutput(first, prep, t.x, t.y, opts.confThreshold));
    opts.onProgress?.(i + 1, tiles.length);

    // Cede o controle ao navegador para a interface não travar.
    await new Promise(r => setTimeout(r, 0));
  }

  return applyNMS(all, opts.iouThreshold);
}

/** Verifica se o modelo existe no servidor, sem baixar tudo. */
export async function isModelAvailable(url: string = DEFAULT_MODEL_URL): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}
