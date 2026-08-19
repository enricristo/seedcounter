// =============================================================================
// SeedCounter — DetectionPanel
// Detecção assistida por visão computacional clássica (sem modelo treinado).
// O pesquisador ajusta os parâmetros, visualiza a máscara e confirma os pontos.
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Wand2, Check, X, Loader2, Info, Eye, EyeOff, Sparkles } from 'lucide-react';
import { detectObjects, suggestMinArea, suggestSeparation, type DetectionResult } from '../../lib/detect';
import type { Mark } from '../../types';
import type { DetectionPreview } from '../../components/canvas/MarkingCanvas';

interface DetectionPanelProps {
  image: HTMLImageElement | null;
  /** Marcações atuais — usadas para evitar duplicar pontos já existentes. */
  marks: Mark[];
  /** Insere as marcações confirmadas. */
  onAddMarks: (marks: Mark[]) => void;
  /** Envia a prévia para o canvas desenhar. */
  onPreviewChange: (preview: DetectionPreview | null) => void;
}

/** Distância mínima (px) para considerar que já existe marcação no local. */
const DEDUPE_RADIUS = 12;

export function DetectionPanel({ image, marks, onAddMarks, onPreviewChange }: DetectionPanelProps) {
  const [sensitivity, setSensitivity] = useState(50);
  const [minArea, setMinArea] = useState(12);
  const [separation, setSeparation] = useState(6);
  const [polarity, setPolarity] = useState<'auto' | 'dark' | 'light'>('auto');
  const [splitTouching, setSplitTouching] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  // Remove candidatos que caem sobre marcações já existentes.
  const newCandidates = useMemo(() => {
    if (!result) return [];
    if (marks.length === 0) return result.objects;
    return result.objects.filter(c =>
      !marks.some(m => Math.hypot(m.x - c.x, m.y - c.y) < DEDUPE_RADIUS)
    );
  }, [result, marks]);

  // Mantém o canvas sincronizado com o resultado e o botão de máscara.
  useEffect(() => {
    if (!result) {
      onPreviewChange(null);
      return;
    }
    onPreviewChange({
      objects: newCandidates,
      maskDataUrl: result.maskDataUrl,
      maskRect: result.maskRect,
      showMask,
    });
  }, [result, newCandidates, showMask, onPreviewChange]);

  // Limpa a prévia ao desmontar (ex.: ao desligar a flag).
  useEffect(() => () => onPreviewChange(null), [onPreviewChange]);

  const run = useCallback(
    async (over?: { minArea?: number; separation?: number }) => {
      if (!image) return null;
      setIsRunning(true);
      // Cede um quadro ao navegador para a UI atualizar.
      await new Promise(r => setTimeout(r, 0));
      try {
        const r = detectObjects(image, {
          sensitivity,
          minArea: over?.minArea ?? minArea,
          separation: over?.separation ?? separation,
          darkOnLight: polarity === 'auto' ? 'auto' : polarity === 'dark',
          splitTouching,
          buildMask: true,
        });
        setResult(r);
        return r;
      } finally {
        setIsRunning(false);
      }
    },
    [image, sensitivity, minArea, separation, polarity, splitTouching]
  );

  const handleDetect = useCallback(() => { void run(); }, [run]);

  /** Roda uma vez solto, mede os objetos e reajusta os parâmetros sozinho. */
  const handleAutoTune = useCallback(async () => {
    if (!image) return;
    const probe = await run({ minArea: 4, separation: 4 });
    if (!probe || probe.objects.length === 0) return;
    const nextMin = suggestMinArea(probe.objects);
    const nextSep = suggestSeparation(probe.objects);
    setMinArea(nextMin);
    setSeparation(nextSep);
    await run({ minArea: nextMin, separation: nextSep });
  }, [image, run]);

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
    setResult(null);
  }, [newCandidates, onAddMarks]);

  const handleDiscard = useCallback(() => setResult(null), []);

  const disabled = !image || isRunning;
  const splitCount = newCandidates.filter(o => o.split).length;

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
          type="range" min={0} max={100} step={1} value={sensitivity}
          onChange={e => setSensitivity(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Área mínima */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Tamanho mínimo (px²)
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">{minArea}</span>
        </div>
        <input
          type="range" min={2} max={400} step={2} value={minArea}
          onChange={e => setMinArea(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>

      {/* Separação de sementes coladas */}
      <div className={`space-y-1.5 ${splitTouching ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Separação (raio, px)
          </label>
          <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">{separation}</span>
        </div>
        <input
          type="range" min={2} max={60} step={1} value={separation}
          onChange={e => setSeparation(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </div>

      {/* Interruptores */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={splitTouching}
            onChange={e => setSplitTouching(e.target.checked)}
            className="accent-sky-500"
          />
          <span className="text-[11px] text-neutral-600 dark:text-zinc-400">
            Separar sementes encostadas
          </span>
        </label>
      </div>

      {/* Polaridade */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
          Contraste da imagem
        </label>
        <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-snug">
          As sementes aparecem mais escuras ou mais claras que o fundo da placa?
          Em “Auto” o programa decide sozinho.
        </p>
        <div className="grid grid-cols-3 gap-1">
          {([
            ['auto', 'Auto'],
            ['dark', 'Escuras'],
            ['light', 'Claras'],
          ] as const).map(([value, txt]: readonly ['auto' | 'dark' | 'light', string]) => (
            <button
              key={value}
              onClick={() => setPolarity(value)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                polarity === value
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800'
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {/* Ações principais */}
      <div className="flex gap-2">
        <button
          onClick={handleDetect}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-neutral-200 dark:border-zinc-800 transition-all text-neutral-700 dark:text-zinc-200 font-bold"
        >
          {isRunning
            ? <Loader2 size={16} className="animate-spin text-emerald-500" />
            : <Wand2 size={16} className="text-emerald-500" />}
          <span className="text-xs uppercase tracking-wide">
            {isRunning ? 'Detectando…' : 'Detectar'}
          </span>
        </button>
        <button
          onClick={handleAutoTune}
          disabled={disabled}
          title="Ajusta tamanho mínimo e separação automaticamente"
          className="flex items-center justify-center gap-1.5 px-3 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-neutral-200 dark:border-zinc-800 transition-all text-neutral-700 dark:text-zinc-200 font-bold"
        >
          <Sparkles size={15} className="text-amber-500" />
          <span className="text-xs uppercase tracking-wide">Auto</span>
        </button>
      </div>

      {/* Resultado / confirmação */}
      {result && (
        <div className="space-y-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-neutral-700 dark:text-zinc-300">
              <strong>{newCandidates.length}</strong>{' '}
              {newCandidates.length === 1 ? 'objeto novo' : 'objetos novos'}
              {splitCount > 0 && (
                <span className="text-sky-600 dark:text-sky-400"> · {splitCount} separados</span>
              )}
              {result.objects.length !== newCandidates.length && (
                <span className="text-neutral-500 dark:text-zinc-500">
                  {' '}({result.objects.length - newCandidates.length} já marcados)
                </span>
              )}
            </p>
            <button
              onClick={() => setShowMask(v => !v)}
              title={showMask ? 'Ocultar máscara' : 'Mostrar máscara'}
              className="shrink-0 p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
            >
              {showMask ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
            Limiar {result.threshold} · {result.totalBlobs} regiões brutas ·{' '}
            {result.darkOnLight ? 'escuras em fundo claro' : 'claras em fundo escuro'}
          </p>

          {result.warnings?.map((wmsg, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
              <Info size={12} className="shrink-0 mt-0.5" />
              {wmsg}
            </p>
          ))}

          {newCandidates.length === 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 dark:text-zinc-500">
              <Info size={13} className="shrink-0 mt-0.5" />
              Ajuste a sensibilidade ou o tamanho mínimo — ou use o botão “Auto”.
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
            Verde = detectado · Azul tracejado = separado de um aglomerado.
            Os pontos entram como <strong>viáveis</strong> e podem ser corrigidos depois.
          </p>
        </div>
      )}
    </section>
  );
}
