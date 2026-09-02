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

/** Origem do runtime ONNX. Fixada em versão para builds reproduzíveis. */
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0';

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
  /** Contorno da semente em coordenadas da imagem original (morfometria). */
  polygon?: [number, number][];
  /** Área da máscara, em pixels da imagem original. */
  maskArea?: number;
  /** Coeficientes de máscara (uso interno, descartados após gerar o polígono). */
  maskCoeffs?: Float32Array;
  /** Dados do recorte usados para remapear a máscara (uso interno). */
  tileInfo?: { ratio: number; padX: number; padY: number; tileX: number; tileY: number };
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
  /** Extrai contornos das máscaras para morfometria (mais lento). */
  withMasks?: boolean;
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
    // O runtime é carregado do CDN em vez de empacotado. Motivo: os binários
    // WASM somam ~27 MB e ficariam no build mesmo para quem nunca usa a IA.
    // Como este recurso é experimental e já exigia rede na primeira execução,
    // buscá-lo sob demanda mantém o aplicativo principal leve e offline.
    // O pacote npm continua instalado apenas para fornecer os tipos.
    const ort = await import(/* @vite-ignore */ `${ORT_CDN}/+esm`);
    ortModule = ort;

    try {
      ort.env.wasm.wasmPaths = `${ORT_CDN}/dist/`;
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
  sx: number,
  sy: number,
  sw: number,
  sh: number,
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

    // Coeficientes de máscara (canais após as classes), se houver.
    let maskCoeffs: Float32Array | undefined;
    const nm = channels - 4 - nc;
    if (nm > 0) {
      maskCoeffs = new Float32Array(nm);
      for (let c = 0; c < nm; c++) maskCoeffs[c] = at(4 + nc + c, a);
    }

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
      maskCoeffs,
      tileInfo: { ratio: prep.ratio, padX: prep.padX, padY: prep.padY, tileX, tileY },
    });
  }

  return dets;
}

// ---------------------------------------------------------------------------
// Morfometria — reconstrução das máscaras de segmentação
// ---------------------------------------------------------------------------
// O YOLOv8-seg entrega 32 "protótipos" de máscara (output1) e, por detecção,
// 32 coeficientes. A máscara final é a combinação linear deles, passada por
// sigmoide. Trabalhamos só dentro da caixa de cada semente — muito mais rápido
// que reconstruir a máscara inteira.
// ---------------------------------------------------------------------------

/**
 * Traça o contorno externo de uma máscara binária (Moore-neighbor tracing).
 * Retorna os pontos em coordenadas da própria máscara.
 */
function traceContour(mask: Uint8Array, w: number, h: number): [number, number][] {
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
function simplifyContour(points: [number, number][], maxPoints = 48): [number, number][] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

/**
 * Gera o polígono de uma detecção a partir dos protótipos de máscara.
 * Coordenadas de saída em pixels da imagem ORIGINAL.
 */
function buildPolygon(
  det: YoloDetection,
  protos: Float32Array,
  protoC: number,
  protoH: number,
  protoW: number,
  imgSize: number
): { polygon: [number, number][]; area: number } | null {
  const info = det.tileInfo;
  const coeffs = det.maskCoeffs;
  if (!info || !coeffs) return null;

  // Fator entre a entrada do modelo e o espaço dos protótipos (normalmente 4).
  const stride = imgSize / protoW;

  // Caixa da detecção de volta ao espaço da entrada do modelo.
  const bx = (det.bbox.x - info.tileX) * info.ratio + info.padX;
  const by = (det.bbox.y - info.tileY) * info.ratio + info.padY;
  const bw = det.bbox.width * info.ratio;
  const bh = det.bbox.height * info.ratio;

  // Recorte no espaço dos protótipos, com uma folga de 1 px.
  const x0 = Math.max(0, Math.floor(bx / stride) - 1);
  const y0 = Math.max(0, Math.floor(by / stride) - 1);
  const x1 = Math.min(protoW, Math.ceil((bx + bw) / stride) + 1);
  const y1 = Math.min(protoH, Math.ceil((by + bh) / stride) + 1);
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw <= 1 || ch <= 1) return null;

  // Combinação linear dos protótipos + sigmoide, só na região da caixa.
  const mask = new Uint8Array(cw * ch);
  let area = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let sum = 0;
      const base = (y0 + y) * protoW + (x0 + x);
      for (let c = 0; c < protoC; c++) {
        sum += coeffs[c] * protos[c * protoH * protoW + base];
      }
      const prob = 1 / (1 + Math.exp(-sum));
      if (prob > 0.5) {
        mask[y * cw + x] = 1;
        area++;
      }
    }
  }
  if (area === 0) return null;

  const contour = simplifyContour(traceContour(mask, cw, ch));
  if (contour.length < 3) return null;

  // Volta ao espaço da imagem original: protótipo -> entrada -> recorte -> original.
  const polygon = contour.map(([px, py]) => {
    const inputX = (x0 + px) * stride;
    const inputY = (y0 + py) * stride;
    return [
      Math.round((inputX - info.padX) / info.ratio + info.tileX),
      Math.round((inputY - info.padY) / info.ratio + info.tileY),
    ] as [number, number];
  });

  // Área em pixels da imagem original (protótipo é reduzido por stride e ratio).
  const areaOriginal = area * (stride / info.ratio) * (stride / info.ratio);

  return { polygon, area: Math.round(areaOriginal) };
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

    const tileDets = decodeOutput(first, prep, t.x, t.y, opts.confThreshold);

    // Morfometria: reconstrói máscaras só das detecções que sobrevivem ao NMS
    // desta janela — evita processar centenas de caixas redundantes.
    if (opts.withMasks && session.outputNames.length > 1) {
      const protoTensor = output[session.outputNames[1]];
      const pdims = protoTensor.dims as number[];
      const protos = protoTensor.data as Float32Array;
      if (pdims.length === 4) {
        const kept = applyNMS(tileDets, opts.iouThreshold);
        for (const det of kept) {
          const res = buildPolygon(det, protos, pdims[1], pdims[2], pdims[3], tile);
          if (res) {
            det.polygon = res.polygon;
            det.maskArea = res.area;
          }
        }
        all.push(...kept);
      } else {
        all.push(...tileDets);
      }
    } else {
      all.push(...tileDets);
    }

    opts.onProgress?.(i + 1, tiles.length);

    // Cede o controle ao navegador para a interface não travar.
    await new Promise((r) => setTimeout(r, 0));
  }

  const final = applyNMS(all, opts.iouThreshold);
  // Descarta dados intermediários pesados antes de devolver.
  for (const d of final) {
    delete d.maskCoeffs;
    delete d.tileInfo;
  }
  return final;
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
