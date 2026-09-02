// =============================================================================
// SeedCounter — YOLO Dataset Exporter
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
//
// Exports annotated sessions as a YOLOv8-compatible dataset (.zip):
//   dataset/
//   ├── images/train/   (80% of sessions)
//   ├── images/val/     (20%)
//   ├── labels/train/   (YOLO .txt files)
//   ├── labels/val/
//   └── dataset.yaml
//
// Supports two annotation types:
//   - YoloSegmentation (polygon_points) → YOLO segmentation format
//   - Manual marks (x, y, type)         → YOLO detection (estimated bbox)
// =============================================================================

import JSZip from 'jszip';
import type { Session } from '../types';
import { IMAGE_SOURCE_UM_PER_PIXEL } from '../types';

// ---------------------------------------------------------------------------
// Public Interfaces
// ---------------------------------------------------------------------------

export interface YOLOExportOptions {
  /** Fraction of sessions used for training. Default: 0.8 */
  trainValSplit?: number;
  /** Estimated seed diameter in µm for bbox estimation. Default: 500 (orchid) */
  estimatedSeedDiameterUm?: number;
  /** Fallback radius in pixels when umPerPixel is unavailable. Default: 30 */
  fallbackRadiusPx?: number;
  /** Include class 1 (inviable) annotations. Default: true */
  includeInviable?: boolean;
  /** Class name overrides. Default: { viable: 'viable', inviable: 'inviable' } */
  className?: { viable: string; inviable: string };
}

export interface YOLOExportSummary {
  totalSessions: number;
  sessionsWithImages: number;
  sessionsWithPolygons: number;
  sessionsWithMarksOnly: number;
  totalAnnotations: number;
  totalViable: number;
  totalInviable: number;
  estimatedBboxSizes: {
    minPx: number;
    maxPx: number;
    nominalPx: number;
  };
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Class indices */
const CLASS_VIABLE = 0;
const CLASS_INVIABLE = 1;

/** Default DPI warning thresholds (72 / 96 are browser/web defaults) */
const DEFAULT_DPI_VALUES = new Set([72, 96]);

function getUmPerPixel(session: Session): number | undefined {
  // Explicit manual calibration wins
  if (session.metadata.umPerPixel && session.metadata.umPerPixel > 0) {
    return session.metadata.umPerPixel;
  }
  // Infer from imageSource preset
  if (session.metadata.imageSource) {
    return IMAGE_SOURCE_UM_PER_PIXEL[session.metadata.imageSource];
  }
  return undefined;
}

function estimateRadiusPx(
  session: Session,
  seedDiameterUm: number,
  fallbackRadiusPx: number
): number {
  const umPerPixel = getUmPerPixel(session);
  if (umPerPixel && umPerPixel > 0) {
    return seedDiameterUm / (2 * umPerPixel);
  }
  return fallbackRadiusPx;
}

/** Parse base64 image → [width, height] by loading an HTMLImageElement */
function getImageDimensions(base64: string): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/** Strip the data-URL prefix and return raw base64 */
function stripDataUrl(base64: string): string {
  const idx = base64.indexOf(',');
  return idx >= 0 ? base64.slice(idx + 1) : base64;
}

/** Convert base64 data URL to a Uint8Array for JSZip */
function base64ToUint8Array(base64: string): Uint8Array {
  const raw = stripDataUrl(base64);
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Detect MIME type from base64 data URL header */
function getImageExtension(base64: string): string {
  if (base64.startsWith('data:image/png')) return 'png';
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) return 'jpg';
  if (base64.startsWith('data:image/webp')) return 'webp';
  if (base64.startsWith('data:image/tiff')) return 'tif';
  return 'jpg'; // safe default
}

/** Shuffle an array (Fisher-Yates) and split into train/val */
function splitSessions(
  sessions: Session[],
  trainFraction: number
): { train: Session[]; val: Session[] } {
  const shuffled = [...sessions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const cutoff = Math.max(1, Math.round(shuffled.length * trainFraction));
  return {
    train: shuffled.slice(0, cutoff),
    val: shuffled.slice(cutoff),
  };
}

/** Build a sanitised filename stem from the session */
function sessionStem(session: Session): string {
  const datePart = session.date.replace(/[^0-9]/g, '').slice(0, 8);
  const namePart = session.filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  return `${datePart}_${session.id.slice(0, 8)}_${namePart}`;
}

/** Generate YOLO segmentation label line for a polygon annotation */
function polygonToYOLOLine(
  points: [number, number][],
  classId: number,
  imgW: number,
  imgH: number
): string {
  const coords = points
    .map(([x, y]) => {
      const nx = Math.min(1, Math.max(0, x / imgW));
      const ny = Math.min(1, Math.max(0, y / imgH));
      return `${nx.toFixed(6)} ${ny.toFixed(6)}`;
    })
    .join(' ');
  return `${classId} ${coords}`;
}

/** Generate YOLO detection label line from a center-point mark */
function markToYOLOLine(
  cx: number,
  cy: number,
  radiusPx: number,
  classId: number,
  imgW: number,
  imgH: number
): string {
  const ncx = Math.min(1, Math.max(0, cx / imgW));
  const ncy = Math.min(1, Math.max(0, cy / imgH));
  const nw = Math.min(1, (radiusPx * 2) / imgW);
  const nh = Math.min(1, (radiusPx * 2) / imgH);
  return `${classId} ${ncx.toFixed(6)} ${ncy.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`;
}

/** Build label lines for one session */
async function buildLabelLines(
  session: Session,
  imgW: number,
  imgH: number,
  opts: Required<YOLOExportOptions>
): Promise<string[]> {
  const lines: string[] = [];
  const hasPolygons =
    session.yoloSegmentations && session.yoloSegmentations.length > 0;

  if (hasPolygons && session.yoloSegmentations) {
    for (const seg of session.yoloSegmentations) {
      if (seg.category === 'inviable' && !opts.includeInviable) continue;
      const classId = seg.category === 'viable' ? CLASS_VIABLE : CLASS_INVIABLE;
      if (seg.polygon_points.length >= 3) {
        lines.push(
          polygonToYOLOLine(seg.polygon_points, classId, imgW, imgH)
        );
      }
    }
  } else if (session.marks && session.marks.length > 0) {
    const radiusPx = estimateRadiusPx(
      session,
      opts.estimatedSeedDiameterUm,
      opts.fallbackRadiusPx
    );
    for (const mark of session.marks) {
      if (mark.type === 'inviable' && !opts.includeInviable) continue;
      const classId = mark.type === 'viable' ? CLASS_VIABLE : CLASS_INVIABLE;
      lines.push(
        markToYOLOLine(mark.x, mark.y, radiusPx, classId, imgW, imgH)
      );
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a preview summary without generating the actual zip.
 * Used to populate the "Preview" card in the export modal.
 */
export function getExportSummary(sessions: Session[]): YOLOExportSummary {
  const warnings: string[] = [];
  let totalAnnotations = 0;
  let totalViable = 0;
  let totalInviable = 0;
  let sessionsWithImages = 0;
  let sessionsWithPolygons = 0;
  let sessionsWithMarksOnly = 0;
  let minPx = Infinity;
  let maxPx = -Infinity;

  for (const session of sessions) {
    if (session.imageData) sessionsWithImages++;

    const hasPolygons =
      session.yoloSegmentations && session.yoloSegmentations.length > 0;

    if (hasPolygons && session.yoloSegmentations) {
      sessionsWithPolygons++;
      totalAnnotations += session.yoloSegmentations.length;
      for (const seg of session.yoloSegmentations) {
        if (seg.category === 'viable') totalViable++;
        else totalInviable++;
      }
    } else if (session.marks && session.marks.length > 0) {
      sessionsWithMarksOnly++;
      totalAnnotations += session.marks.length;
      for (const mark of session.marks) {
        if (mark.type === 'viable') totalViable++;
        else totalInviable++;
      }
      // Estimate radius for preview stats
      const radiusPx = estimateRadiusPx(session, 500, 30);
      const bboxPx = radiusPx * 2;
      if (bboxPx < minPx) minPx = bboxPx;
      if (bboxPx > maxPx) maxPx = bboxPx;
    }

    // Check for suspicious DPI
    const umPx = getUmPerPixel(session);
    if (!umPx) {
      const src = session.metadata.imageSource;
      if (!src || src === 'other') {
        warnings.push(
          `Sessão "${session.filename}" sem calibração espacial — usando fallback de 30px`
        );
      }
    }
  }

  // Nominal estimates for 1200 DPI (21.2 µm/px), seed diameter 0.5 mm
  const nominalUmPerPixel = 21.2;
  const nominalRadiusPx = 500 / (2 * nominalUmPerPixel);
  const nominalPx = Math.round(nominalRadiusPx * 2);

  return {
    totalSessions: sessions.length,
    sessionsWithImages,
    sessionsWithPolygons,
    sessionsWithMarksOnly,
    totalAnnotations,
    totalViable,
    totalInviable,
    estimatedBboxSizes: {
      minPx: minPx === Infinity ? nominalPx : Math.round(minPx),
      maxPx: maxPx === -Infinity ? nominalPx : Math.round(maxPx),
      nominalPx,
    },
    warnings,
  };
}

/**
 * Generates a YOLO dataset zip file from the provided sessions.
 *
 * @param sessions - Sessions to export (should already be filtered by the caller)
 * @param options  - Export configuration
 * @returns A Blob containing the .zip archive
 */
export async function generateYOLODataset(
  sessions: Session[],
  options: YOLOExportOptions = {}
): Promise<Blob> {
  // Apply defaults
  const opts: Required<YOLOExportOptions> = {
    trainValSplit: options.trainValSplit ?? 0.8,
    estimatedSeedDiameterUm: options.estimatedSeedDiameterUm ?? 500,
    fallbackRadiusPx: options.fallbackRadiusPx ?? 30,
    includeInviable: options.includeInviable ?? true,
    className: options.className ?? { viable: 'viable', inviable: 'inviable' },
  };

  const zip = new JSZip();
  const skippedSessions: string[] = [];
  const calibrationNotes: string[] = [];

  // Sessions that have image data
  const exportable = sessions.filter(s => {
    if (!s.imageData) {
      skippedSessions.push(
        `  - ${s.filename} (${s.date}): sem imageData (base64 ausente)`
      );
      return false;
    }
    const hasAnnotations =
      (s.yoloSegmentations && s.yoloSegmentations.length > 0) ||
      (s.marks && s.marks.length > 0);
    if (!hasAnnotations) {
      skippedSessions.push(
        `  - ${s.filename} (${s.date}): sem anotações`
      );
      return false;
    }
    return true;
  });

  const { train, val } = splitSessions(exportable, opts.trainValSplit);

  const splits: Array<{ subset: 'train' | 'val'; sessions: Session[] }> = [
    { subset: 'train', sessions: train },
    { subset: 'val', sessions: val },
  ];

  for (const { subset, sessions: subsetSessions } of splits) {
    for (const session of subsetSessions) {
      const stem = sessionStem(session);
      const ext = getImageExtension(session.imageData!);

      let imgW: number;
      let imgH: number;
      try {
        [imgW, imgH] = await getImageDimensions(session.imageData!);
      } catch {
        skippedSessions.push(
          `  - ${session.filename} (${session.date}): falha ao decodificar imagem`
        );
        continue;
      }

      // Write image
      const imageBytes = base64ToUint8Array(session.imageData!);
      zip.file(`dataset/images/${subset}/${stem}.${ext}`, imageBytes);

      // Build & write label
      const labelLines = await buildLabelLines(session, imgW, imgH, opts);
      zip.file(
        `dataset/labels/${subset}/${stem}.txt`,
        labelLines.join('\n')
      );

      // Collect calibration notes
      const umPx = getUmPerPixel(session);
      if (umPx) {
        const radiusPx = opts.estimatedSeedDiameterUm / (2 * umPx);
        calibrationNotes.push(
          `  ${stem}: ${umPx} µm/px → radius ≈ ${radiusPx.toFixed(1)}px (source: ${session.metadata.imageSource ?? 'manual'})`
        );
      } else {
        calibrationNotes.push(
          `  ${stem}: calibração desconhecida → fallback ${opts.fallbackRadiusPx}px radius`
        );
      }
    }
  }

  // dataset.yaml
  const classes = opts.includeInviable
    ? [opts.className.viable, opts.className.inviable]
    : [opts.className.viable];

  const yaml = [
    `# SeedCounter YOLO Dataset`,
    `# Generated: ${new Date().toISOString()}`,
    `# GPEOrq / Unoeste — Orchid Seed Germination`,
    ``,
    `path: dataset`,
    `train: images/train`,
    `val: images/val`,
    ``,
    `nc: ${classes.length}`,
    `names:`,
    ...classes.map((c, i) => `  ${i}: ${c}`),
    ``,
    `# Calibration: ${opts.estimatedSeedDiameterUm}µm estimated seed diameter`,
    `# For orchid seeds at 1200 DPI (21.2 µm/px): ~${Math.round(opts.estimatedSeedDiameterUm / 21.2)}px diameter`,
  ].join('\n');

  zip.file('dataset/dataset.yaml', yaml);

  // README.txt
  const readme = buildReadme(opts, skippedSessions, calibrationNotes, {
    totalExported: exportable.length,
    trainCount: train.length,
    valCount: val.length,
  });
  zip.file('dataset/README.txt', readme);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------------------
// README builder
// ---------------------------------------------------------------------------

function buildReadme(
  opts: Required<YOLOExportOptions>,
  skipped: string[],
  calibrationNotes: string[],
  stats: { totalExported: number; trainCount: number; valCount: number }
): string {
  const lines: string[] = [
    '=============================================================',
    ' SeedCounter — YOLO Dataset Export',
    ' GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal',
    `=============================================================`,
    '',
    `Data de exportação : ${new Date().toLocaleString('pt-BR')}`,
    `Sessões exportadas : ${stats.totalExported}`,
    `  Train            : ${stats.trainCount}`,
    `  Val              : ${stats.valCount}`,
    '',
    '--- FORMATO ---',
    '',
    'Anotações com polígonos YOLO (segmentação):',
    '  <class_id> x1_norm y1_norm x2_norm y2_norm ...',
    '  Coordenadas normalizadas em [0, 1] relativas à imagem.',
    '',
    'Anotações com marcações manuais (pontos → bboxes estimados):',
    '  <class_id> cx_norm cy_norm w_norm h_norm',
    '  Formato YOLO Detection (não segmentação).',
    '',
    '--- CLASSES ---',
    `  0: ${opts.className.viable} (sementes viáveis)`,
    ...(opts.includeInviable ? [`  1: ${opts.className.inviable} (sementes inviáveis)`] : []),
    '',
    '--- CALIBRAÇÃO ESPACIAL ---',
    '',
    `Diâmetro estimado de semente : ${opts.estimatedSeedDiameterUm} µm`,
    `Raio fallback (sem calibração): ${opts.fallbackRadiusPx} px`,
    '',
    'Calibração por sessão:',
    ...calibrationNotes,
    '',
    '--- SCANNER / DPI ---',
    '',
    '  flatbed_1200dpi → 21.2 µm/px (recomendado)',
    '  flatbed_600dpi  → 42.3 µm/px',
    '  flatbed_2400dpi → 10.6 µm/px',
    '',
    '  ATENÇÃO: DPI 72 ou 96 são valores padrão de câmera/web.',
    '  Se a imagem veio de câmera, calibre manualmente usando',
    '  uma régua na imagem (campo umPerPixel nos metadados).',
    '',
    '--- TREINAMENTO YOLO ---',
    '',
    '  Segmentação:',
    '    yolo segment train data=dataset/dataset.yaml model=yolov8n-seg.pt imgsz=640',
    '',
    '  Detecção (se todas as anotações forem bbox):',
    '    yolo detect train data=dataset/dataset.yaml model=yolov8n.pt imgsz=640',
    '',
    '  Exportar para ONNX após treino:',
    '    yolo export model=best.pt format=onnx imgsz=128 simplify=true',
    '',
  ];

  if (skipped.length > 0) {
    lines.push('--- SESSÕES OMITIDAS ---');
    lines.push('');
    lines.push(...skipped);
    lines.push('');
  }

  lines.push('=============================================================');
  return lines.join('\n');
}
