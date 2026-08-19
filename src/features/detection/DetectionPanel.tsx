// =============================================================================
// SeedCounter — DetectionPanel
// Detecção assistida por visão computacional clássica (sem modelo treinado).
// O pesquisador ajusta a sensibilidade, pré-visualiza e confirma os pontos.
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Wand2, Check, X, Loader2, Info } from 'lucide-react';
import { detectObjects, type DetectedObject } from '../../lib/detect';
import type { Mark } from '../../types';

interface DetectionPanelProps {
  image: HTMLImageElement | null;
  /** Marcações atuais — usadas para evitar duplicar pontos já existentes. */
  marks: Mark[];
  /** Insere as marcações confirmadas. */
  onAddMarks: (marks: Mark[]) => void;
  /** Notifica a prévia para o canvas desenhar (opcional). */
  onPreviewChange?: (objects: DetectedObject[] | null) => void;
}

/** Distância mínima (px) para considerar que já existe marcação no local. */
const DEDUPE_RADIUS = 12;

export function DetectionPanel({ image, marks, onAddMarks, onPreviewChange }: DetectionPanelProps) {
  const [sensitivity, setSensitivity] = useState(50);
  const [minArea, setMinArea] = useState(12);
  const [darkOnLight, setDarkOnLight] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [candidates, setCandidates] = useState<DetectedObject[] | null>(null);

  const setPreview = useCallback(
    (objs: DetectedObject[] | null) => {
      setCandidates(objs);
      onPreviewChange?.(objs);
    },
    [onPreviewChange]
  );

  // Remove candidatos que caem sobre marcações já existentes.
  const newCandidates = useMemo(() => {
    if (!candidates) return [];
    if (marks.length === 0) return candidates;
    return candidates.filter(c =>
      !marks.some(m => Math.hypot(m.x - c.x, m.y - c.y) < DEDUPE_RADIUS)
    );
  }, [candidates, marks]);

  const handleDetect = useCallback(async () => {
    if (!image) return;
    setIsRunning(true);
    // Cede um quadro ao navegador para a UI atualizar antes do processamento.
    await new Promise(r => setTimeout(r, 0));
    try {
      const result = detectObjects(image, { sensitivity, minArea, darkOnLight });
      setPreview(result.objects);
    } finally {
      setIsRunning(false);
    }
  }, [image, sensitivity, minArea, darkOnLight, setPreview]);

  const handleConfirm = useCallback(() => {
    if (newCandidates.length === 0) return;
    const base = Date.now();
    onAddMarks(
      newCandidates.map((c, i) => ({
        x: c.x,
        y: c.y,
        type: 'viable' as const,
        id: base + i + Math.random(),
      }))
    );
    setPreview(null);
  }, [newCandidates, onAddMarks, setPreview]);

  const handleDiscard = useCallback(() => setPreview(null), [setPreview]);

  const disabled = !image || isRunning;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
          Detecção Assistida
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
          Beta
        </span>
      </div>

      {/* Sensibilidade */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Sensibilidade
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">{sensitivity}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sensitivity}
          onChange={e => setSensitivity(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Área mínima — filtra poeira e ruído */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Tamanho mínimo (px²)
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">{minArea}</span>
        </div>
        <input
          type="range"
          min={2}
          max={400}
          step={2}
          value={minArea}
          onChange={e => setMinArea(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Polaridade */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={darkOnLight}
          onChange={e => setDarkOnLight(e.target.checked)}
          className="accent-emerald-500"
        />
        <span className="text-[11px] text-neutral-600 dark:text-zinc-400">
          Sementes escuras em fundo claro
        </span>
      </label>

      {/* Ação principal */}
      <button
        onClick={handleDetect}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-neutral-200 dark:border-zinc-800 transition-all text-neutral-700 dark:text-zinc-200 font-bold"
      >
        {isRunning
          ? <Loader2 size={16} className="animate-spin text-emerald-500" />
          : <Wand2 size={16} className="text-emerald-500" />}
        <span className="text-xs uppercase tracking-wide">
          {isRunning ? 'Detectando…' : 'Detectar sementes'}
        </span>
      </button>

      {/* Resultado / confirmação */}
      {candidates && (
        <div className="space-y-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/60 p-3">
          <p className="text-xs text-neutral-700 dark:text-zinc-300">
            <strong>{newCandidates.length}</strong>{' '}
            {newCandidates.length === 1 ? 'objeto novo detectado' : 'objetos novos detectados'}
            {candidates.length !== newCandidates.length && (
              <span className="text-neutral-500 dark:text-zinc-500">
                {' '}({candidates.length - newCandidates.length} já marcados)
              </span>
            )}
          </p>

          {newCandidates.length === 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 dark:text-zinc-500">
              <Info size={13} className="shrink-0 mt-0.5" />
              Ajuste a sensibilidade ou o tamanho mínimo e tente de novo.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={newCandidates.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <Check size={14} /> Adicionar
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <X size={14} /> Descartar
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-relaxed">
            Os pontos entram como <strong>viáveis</strong> e podem ser corrigidos ou removidos
            normalmente. Sempre confira antes de exportar.
          </p>
        </div>
      )}
    </section>
  );
}
