// =============================================================================
// SeedCounter — AiPointerPanel
// Detecção automática com o modelo YOLOv8m-seg treinado (TCC) via ONNX Runtime Web.
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Brain, Check, X, Loader2, AlertCircle, Download } from 'lucide-react';
import {
  detectWithYolo,
  isModelAvailable,
  DEFAULT_MODEL_URL,
  type YoloDetection,
} from '../../lib/yolo-onnx';
import type { Mark } from '../../types';
import type { DetectionPreview } from '../../components/canvas/MarkingCanvas';

interface AiPointerPanelProps {
  image: HTMLImageElement | null;
  marks: Mark[];
  onAddMarks: (marks: Mark[]) => void;
  onPreviewChange: (preview: DetectionPreview | null) => void;
}

const DEDUPE_RADIUS = 12;

export function AiPointerPanel({ image, marks, onAddMarks, onPreviewChange }: AiPointerPanelProps) {
  const [confidence, setConfidence] = useState(45);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [detections, setDetections] = useState<YoloDetection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelPresent, setModelPresent] = useState<boolean | null>(null);

  // Verifica uma vez se o modelo está publicado.
  useEffect(() => {
    let alive = true;
    isModelAvailable().then(ok => { if (alive) setModelPresent(ok); });
    return () => { alive = false; };
  }, []);

  // Descarta detecções onde já existe marcação.
  const newDetections = useMemo(() => {
    if (!detections) return [];
    if (marks.length === 0) return detections;
    return detections.filter(d =>
      !marks.some(m => Math.hypot(m.x - d.x, m.y - d.y) < DEDUPE_RADIUS)
    );
  }, [detections, marks]);

  // Espelha as detecções no canvas (reaproveita a prévia da detecção assistida).
  useEffect(() => {
    if (!detections) {
      onPreviewChange(null);
      return;
    }
    onPreviewChange({
      objects: newDetections.map(d => ({
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
  }, [image, confidence]);

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
    setDetections(null);
  }, [newDetections, onAddMarks]);

  const counts = useMemo(() => ({
    viavel: newDetections.filter(d => d.className === 'viavel').length,
    inviavel: newDetections.filter(d => d.className === 'inviavel').length,
  }), [newDetections]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
          Detecção por IA
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400">
          YOLOv8
        </span>
      </div>

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
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">{confidence}%</span>
        </div>
        <input
          type="range" min={10} max={90} step={5} value={confidence}
          onChange={e => setConfidence(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      <button
        onClick={handleRun}
        disabled={!image || isRunning || modelPresent === false}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-neutral-200 dark:border-zinc-800 transition-all text-neutral-700 dark:text-zinc-200 font-bold"
      >
        {isRunning
          ? <Loader2 size={16} className="animate-spin text-violet-500" />
          : <Brain size={16} className="text-violet-500" />}
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
          O modelo é baixado na primeira execução (~55 MB) e fica em cache.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <AlertCircle size={14} className="text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {detections && (
        <div className="space-y-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/60 p-3">
          <p className="text-xs text-neutral-700 dark:text-zinc-300">
            <strong>{newDetections.length}</strong> {newDetections.length === 1 ? 'semente' : 'sementes'}
            {newDetections.length > 0 && (
              <span className="text-neutral-500 dark:text-zinc-500">
                {' '}· {counts.viavel} viáveis, {counts.inviavel} inviáveis
              </span>
            )}
          </p>

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
            O modelo classifica viável/inviável automaticamente. Confira antes de exportar —
            a decisão final é sempre sua.
          </p>
        </div>
      )}
    </section>
  );
}
