// =============================================================================
// SeedCounter — AiPointerPanel
// Detecção automática com o modelo YOLOv8m-seg treinado (TCC) via ONNX Runtime Web.
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Brain, Check, X, Loader2, AlertCircle, Download } from 'lucide-react';
import {
  detectWithYolo,
  isModelAvailable,
  resolveBestModel,
  DEFAULT_MODEL_URL,
  FULL_PRECISION_MODEL_URL,
  type YoloDetection,
  type ModelQuality,
} from '../../lib/yolo-onnx';
import { calculateSeedDimensions } from '../../lib/pca-utils';
import { formatLength, formatArea } from '../../lib/calibration';
import type { Mark, YoloSegmentation } from '../../types';
import type { DetectionPreview } from '../../components/canvas/MarkingCanvas';

interface AiPointerPanelProps {
  /**
   * A fonte da deteccao. Aceita canvas porque o painel de ajuste de imagem
   * entrega um HTMLCanvasElement, e detectWithYolo ja aceita os dois
   * (src/lib/yolo-onnx.ts:493). O tipo estreito anterior descrevia mal o que
   * o componente sempre soube receber.
   */
  image: HTMLImageElement | HTMLCanvasElement | null;
  marks: Mark[];
  onAddMarks: (marks: Mark[]) => void;
  onPreviewChange: (preview: DetectionPreview | null) => void;
  /** Envia os contornos para morfometria (medidas por PCA). */
  onAddSegmentations?: (segs: YoloSegmentation[]) => void;
  /** Escala atual, para exibir as medidas em µm. */
  umPerPixel?: number;
}

const DEDUPE_RADIUS = 12;

export function AiPointerPanel({
  image,
  marks,
  onAddMarks,
  onPreviewChange,
  onAddSegmentations,
  umPerPixel,
}: AiPointerPanelProps) {
  const [confidence, setConfidence] = useState(45);
  const [withMorphometry, setWithMorphometry] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [detections, setDetections] = useState<YoloDetection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelPresent, setModelPresent] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<ModelQuality | null>(null);

  // Verifica uma vez qual modelo esta instalação tem. O fp32 local vence quando existe.
  useEffect(() => {
    let alive = true;
    (async () => {
      const resolved = await resolveBestModel();
      const ok = resolved.quality === 'full' || (await isModelAvailable(DEFAULT_MODEL_URL));
      if (!alive) return;
      setModelPresent(ok);
      setQuality(ok ? resolved.quality : null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Descarta detecções onde já existe marcação.
  const newDetections = useMemo(() => {
    if (!detections) return [];
    if (marks.length === 0) return detections;
    return detections.filter(
      (d) => !marks.some((m) => Math.hypot(m.x - d.x, m.y - d.y) < DEDUPE_RADIUS)
    );
  }, [detections, marks]);

  // Espelha as detecções no canvas (reaproveita a prévia da detecção assistida).
  useEffect(() => {
    if (!detections) {
      onPreviewChange(null);
      return;
    }
    onPreviewChange({
      objects: newDetections.map((d) => ({
        x: d.x,
        y: d.y,
        area: d.bbox.width * d.bbox.height,
        radius: Math.max(3, Math.round(Math.min(d.bbox.width, d.bbox.height) / 2)),
        bbox: d.bbox,
        // Reutiliza o estilo tracejado para destacar a classe "inviável".
        split: d.className === 'inviavel',
      })),
      showMask: false,
    });
  }, [detections, newDetections, onPreviewChange]);

  useEffect(() => () => onPreviewChange(null), [onPreviewChange]);

  const handleRun = useCallback(async () => {
    if (!image) return;
    setIsRunning(true);
    setError(null);
    setProgress(null);
    try {
      const result = await detectWithYolo(image, {
        confThreshold: confidence / 100,
        withMasks: withMorphometry,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setDetections(result);
    } catch (err) {
      console.error('[AI Pointer] falha na inferência:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /fetch|404|not found/i.test(msg)
          ? 'Modelo não encontrado em public/models/.'
          : /wasm|backend|no available backend/i.test(msg)
            ? 'Falha ao carregar o motor de inferência (WASM). Verifique a conexão na primeira execução.'
            : `Falha ao executar o modelo: ${msg.slice(0, 120)}`
      );
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [image, confidence, withMorphometry]);

  const handleConfirm = useCallback(() => {
    if (newDetections.length === 0) return;
    const base = Date.now();

    onAddMarks(
      newDetections.map((d, i) => ({
        x: d.x,
        y: d.y,
        // O modelo já classifica: 'viavel' / 'inviavel'.
        type: d.className === 'viavel' ? ('viable' as const) : ('inviable' as const),
        id: base + i + Math.random(),
      }))
    );

    // Morfometria: envia os contornos para o app medir por PCA.
    const withPolygons = newDetections.filter((d) => d.polygon && d.polygon.length >= 3);
    if (onAddSegmentations && withPolygons.length > 0) {
      onAddSegmentations(
        withPolygons.map((d, i) => ({
          id: base + 1_000_000 + i,
          category: d.className === 'viavel' ? ('viable' as const) : ('inviable' as const),
          class_name: d.className,
          confidence: d.confidence,
          polygon_points: d.polygon as [number, number][],
          visible: true,
        }))
      );
    }

    setDetections(null);
  }, [newDetections, onAddMarks, onAddSegmentations]);

  const counts = useMemo(
    () => ({
      viavel: newDetections.filter((d) => d.className === 'viavel').length,
      inviavel: newDetections.filter((d) => d.className === 'inviavel').length,
    }),
    [newDetections]
  );

  // Médias morfométricas das detecções com contorno disponível.
  const morphSummary = useMemo(() => {
    const withPoly = newDetections.filter((d) => d.polygon && d.polygon.length >= 3);
    if (withPoly.length === 0) return null;

    let sumL = 0,
      sumW = 0,
      sumA = 0;
    for (const d of withPoly) {
      const { width, height } = calculateSeedDimensions(d.polygon as [number, number][]);
      // O PCA devolve eixo maior e menor: comprimento é o maior.
      sumL += Math.max(width, height);
      sumW += Math.min(width, height);
      sumA += d.maskArea ?? 0;
    }
    const n = withPoly.length;
    return {
      count: n,
      meanLength: sumL / n,
      meanWidth: sumW / n,
      meanArea: sumA / n,
    };
  }, [newDetections]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
          Detecção por IA
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400">
          YOLOv8
        </span>
        {quality === 'full' && (
          <span
            title={`Pesos originais do TCC em precisão total (${FULL_PRECISION_MODEL_URL}). Classificação viável/inviável confiável.`}
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
          >
            fp32
          </span>
        )}
        {quality === 'quantized' && (
          <span
            title="Modelo quantizado (int8). A contagem é confiável; a divisão viável/inviável é menos precisa que no fp32."
            className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
          >
            int8
          </span>
        )}
      </div>

      {/* A quantização foi medida degradando a classificação — vale avisar. */}
      {quality === 'quantized' && (
        <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-relaxed">
          Modelo quantizado. A contagem é confiável, mas a divisão viável/inviável perde precisão.
          Para pesquisa, use a instalação do laboratório, que carrega os pesos em precisão total.
        </p>
      )}

      {/* Modelo ausente */}
      {modelPresent === false && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
          <Download size={15} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            Modelo não publicado. Exporte o <code>best.pt</code> para ONNX e salve em{' '}
            <code>public/{DEFAULT_MODEL_URL}</code>.
          </p>
        </div>
      )}

      {/* Confiança mínima */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Confiança mínima
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">
            {confidence}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={withMorphometry}
          onChange={(e) => setWithMorphometry(e.target.checked)}
          className="accent-violet-500"
        />
        <span className="text-[11px] text-neutral-600 dark:text-zinc-400">
          Medir sementes (morfometria)
        </span>
      </label>

      <button
        onClick={handleRun}
        disabled={!image || isRunning || modelPresent === false}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-neutral-200 dark:border-zinc-800 transition-all text-neutral-700 dark:text-zinc-200 font-bold"
      >
        {isRunning ? (
          <Loader2 size={16} className="animate-spin text-violet-500" />
        ) : (
          <Brain size={16} className="text-violet-500" />
        )}
        <span className="text-xs uppercase tracking-wide">
          {isRunning
            ? progress
              ? `Analisando ${progress.done}/${progress.total}…`
              : 'Carregando modelo…'
            : 'Detectar com IA'}
        </span>
      </button>

      {isRunning && !progress && (
        <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
          Baixando o modelo e o motor de inferência na primeira execução. Depois ficam em cache.
        </p>
      )}

      <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-relaxed">
        Este recurso exige conexão na primeira execução. O restante do aplicativo continua
        funcionando offline.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <AlertCircle size={14} className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {detections && (
        <div className="space-y-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/60 p-3">
          <p className="text-xs text-neutral-700 dark:text-zinc-300">
            <strong>{newDetections.length}</strong>{' '}
            {newDetections.length === 1 ? 'semente' : 'sementes'}
            {newDetections.length > 0 && (
              <span className="text-neutral-500 dark:text-zinc-500">
                {' '}
                · {counts.viavel} viáveis, {counts.inviavel} inviáveis
              </span>
            )}
          </p>

          {/* Resumo morfométrico */}
          {morphSummary && (
            <div className="rounded-lg bg-violet-50 dark:bg-violet-950/25 border border-violet-200 dark:border-violet-900/40 px-2.5 py-2 space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                Morfometria ({morphSummary.count} medidas)
              </p>
              <p className="text-[11px] text-neutral-700 dark:text-zinc-300">
                Comprimento médio:{' '}
                <strong>{formatLength(morphSummary.meanLength, umPerPixel)}</strong>
              </p>
              <p className="text-[11px] text-neutral-700 dark:text-zinc-300">
                Largura média: <strong>{formatLength(morphSummary.meanWidth, umPerPixel)}</strong>
              </p>
              <p className="text-[11px] text-neutral-700 dark:text-zinc-300">
                Área média: <strong>{formatArea(morphSummary.meanArea, umPerPixel)}</strong>
              </p>
              {!umPerPixel && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Sem calibração — valores em pixels.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={newDetections.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <Check size={14} /> Adicionar
            </button>
            <button
              onClick={() => setDetections(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <X size={14} /> Descartar
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-relaxed">
            O modelo classifica viável/inviável automaticamente. Confira antes de exportar — a
            decisão final é sempre sua.
          </p>
        </div>
      )}
    </section>
  );
}
