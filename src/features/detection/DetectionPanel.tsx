// =============================================================================
// SeedCounter — DetectionPanel
// Detecção assistida por visão computacional clássica (sem modelo treinado).
// =============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Wand2,
  Check,
  X,
  Loader2,
  Info,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  detectObjects,
  suggestMinArea,
  suggestSeparation,
  type DetectionResult,
  type ThresholdMode,
  type GrayChannel,
} from '../../lib/detect';
import type { Mark } from '../../types';
import type { DetectionPreview } from '../../components/canvas/MarkingCanvas';

interface DetectionPanelProps {
  image: HTMLImageElement | HTMLCanvasElement | null;
  marks: Mark[];
  onAddMarks: (marks: Mark[]) => void;
  onPreviewChange: (preview: DetectionPreview | null) => void;
}

const DEDUPE_RADIUS = 12;

/** Cenários prontos — o usuário começa por aqui e ajusta se precisar. */
const SCENARIOS = [
  {
    id: 'scanner',
    label: 'Scanner (fundo claro)',
    hint: 'Sementes sobre papel ou placa clara, iluminação uniforme',
    values: {
      thresholdMode: 'otsu' as ThresholdMode,
      backgroundRadius: 0,
      denoise: 1,
      minArea: 60,
      channel: 'luminance' as GrayChannel,
    },
  },
  {
    id: 'uneven',
    label: 'Fundo irregular',
    hint: 'Iluminação desigual ou sombras — remove o fundo antes',
    values: {
      thresholdMode: 'adaptive' as ThresholdMode,
      backgroundRadius: 60,
      denoise: 2,
      minArea: 80,
      channel: 'luminance' as GrayChannel,
    },
  },
  {
    id: 'lowcontrast',
    label: 'Baixo contraste',
    hint: 'Sementes translúcidas ou pouco distintas do fundo',
    values: {
      thresholdMode: 'adaptive' as ThresholdMode,
      backgroundRadius: 40,
      denoise: 2,
      minArea: 50,
      channel: 'g' as GrayChannel,
    },
  },
  {
    id: 'crowded',
    label: 'Muitas encostadas',
    hint: 'Sementes agrupadas — tenta separar aglomerados',
    values: {
      thresholdMode: 'otsu' as ThresholdMode,
      backgroundRadius: 40,
      denoise: 1,
      minArea: 60,
      splitTouching: true,
      channel: 'luminance' as GrayChannel,
    },
  },
];

export function DetectionPanel({ image, marks, onAddMarks, onPreviewChange }: DetectionPanelProps) {
  // Básico
  const [sensitivity, setSensitivity] = useState(50);
  const [minArea, setMinArea] = useState(60);
  const [polarity, setPolarity] = useState<'auto' | 'dark' | 'light'>('auto');
  // Fundo e limiar
  const [backgroundRadius, setBackgroundRadius] = useState(0);
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>('otsu');
  const [channel, setChannel] = useState<GrayChannel>('luminance');
  const [denoise, setDenoise] = useState(1);
  // Separação e forma
  const [splitTouching, setSplitTouching] = useState(false);
  const [separation, setSeparation] = useState(8);
  const [maxElongation, setMaxElongation] = useState(0);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const newCandidates = useMemo(() => {
    if (!result) return [];
    if (marks.length === 0) return result.objects;
    return result.objects.filter(
      (c) => !marks.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < DEDUPE_RADIUS)
    );
  }, [result, marks]);

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

  useEffect(() => () => onPreviewChange(null), [onPreviewChange]);

  const run = useCallback(
    async (over?: Partial<{ minArea: number; separation: number }>) => {
      if (!image) return null;
      setIsRunning(true);
      await new Promise((r) => setTimeout(r, 0));
      try {
        const r = detectObjects(image, {
          sensitivity,
          minArea: over?.minArea ?? minArea,
          separation: over?.separation ?? separation,
          darkOnLight: polarity === 'auto' ? 'auto' : polarity === 'dark',
          splitTouching,
          backgroundRadius,
          thresholdMode,
          channel,
          denoise,
          maxElongation,
          buildMask: true,
        });
        setResult(r);
        return r;
      } finally {
        setIsRunning(false);
      }
    },
    [
      image,
      sensitivity,
      minArea,
      separation,
      polarity,
      splitTouching,
      backgroundRadius,
      thresholdMode,
      channel,
      denoise,
      maxElongation,
    ]
  );

  const applyScenario = useCallback((v: Record<string, unknown>) => {
    if ('thresholdMode' in v) setThresholdMode(v.thresholdMode as ThresholdMode);
    if ('backgroundRadius' in v) setBackgroundRadius(v.backgroundRadius as number);
    if ('denoise' in v) setDenoise(v.denoise as number);
    if ('minArea' in v) setMinArea(v.minArea as number);
    if ('channel' in v) setChannel(v.channel as GrayChannel);
    setSplitTouching(('splitTouching' in v ? v.splitTouching : false) as boolean);
  }, []);

  const handleAutoTune = useCallback(async () => {
    if (!image) return;
    const probe = await run({ minArea: 8, separation: 4 });
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

  const disabled = !image || isRunning;
  const splitCount = newCandidates.filter((o) => o.split).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
          Detecção Assistida
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
          Beta
        </span>
      </div>

      {/* Cenários — ponto de partida */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
          Comece por um cenário
        </label>
        <div className="grid grid-cols-2 gap-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => applyScenario(s.values)}
              title={s.hint}
              className="px-2 py-1.5 rounded-lg text-[10px] font-bold border border-line text-ink-2 hover:bg-surface-2 transition-colors text-left leading-tight"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Remoção de fundo — o ajuste que mais resolve */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
            Remover fundo
          </label>
          <span className="text-[11px] font-mono text-ink-2">
            {backgroundRadius === 0 ? 'desligado' : `${backgroundRadius} px`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          step={10}
          value={backgroundRadius}
          onChange={(e) => setBackgroundRadius(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <p className="text-[10px] text-ink-3 leading-snug">
          Elimina gradiente de iluminação e o tom da placa. Use um valor
          <strong> maior que a maior semente</strong>.
        </p>
      </div>

      {/* Sensibilidade e tamanho mínimo */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
            Sensibilidade
          </label>
          <span className="text-[11px] font-mono text-ink-2">{sensitivity}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
            Tamanho mínimo (px²)
          </label>
          <span className="text-[11px] font-mono text-ink-2">{minArea}</span>
        </div>
        <input
          type="range"
          min={5}
          max={2000}
          step={5}
          value={minArea}
          onChange={(e) => setMinArea(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      {/* Avançado */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-ink-3 hover:bg-surface-2 transition-colors"
      >
        Ajustes avançados
        {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-1 border-l-2 border-line-soft">
          {/* Limiar */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
              Limiar
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ['otsu', 'Global'],
                  ['adaptive', 'Local'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setThresholdMode(v)}
                  title={
                    v === 'otsu'
                      ? 'Um corte para a imagem toda'
                      : 'Corte por região — melhor com iluminação desigual'
                  }
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    thresholdMode === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Canal */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
              Canal analisado
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['luminance', 'Lum'],
                  ['r', 'R'],
                  ['g', 'G'],
                  ['b', 'B'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setChannel(v)}
                  className={`px-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    channel === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Polaridade */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
              Contraste
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['auto', 'Auto'],
                  ['dark', 'Escuras'],
                  ['light', 'Claras'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setPolarity(v)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    polarity === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Limpeza de ruído */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                Limpeza de ruído
              </label>
              <span className="text-[11px] font-mono text-ink-2">{denoise}</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              value={denoise}
              onChange={(e) => setDenoise(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Alongamento máximo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                Alongamento máx.
              </label>
              <span className="text-[11px] font-mono text-ink-2">
                {maxElongation === 0 ? 'sem limite' : `${maxElongation}:1`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15}
              value={maxElongation}
              onChange={(e) => setMaxElongation(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <p className="text-[10px] text-ink-3">Descarta riscos e fios muito finos.</p>
          </div>

          {/* Separação */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={splitTouching}
              onChange={(e) => setSplitTouching(e.target.checked)}
              className="accent-accent"
            />
            <span className="text-[11px] text-ink-2">Separar sementes encostadas</span>
          </label>

          {splitTouching && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                  Separação (raio, px)
                </label>
                <span className="text-[11px] font-mono text-ink-2">{separation}</span>
              </div>
              <input
                type="range"
                min={3}
                max={60}
                value={separation}
                onChange={(e) => setSeparation(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            void run();
          }}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-surface-2 hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl border border-line transition-all text-ink-2 font-bold"
        >
          {isRunning ? (
            <Loader2 size={16} className="animate-spin text-accent" />
          ) : (
            <Wand2 size={16} className="text-accent" />
          )}
          <span className="text-xs uppercase tracking-wide">
            {isRunning ? 'Detectando…' : 'Detectar'}
          </span>
        </button>
        <button
          onClick={handleAutoTune}
          disabled={disabled}
          title="Mede os objetos e ajusta o tamanho mínimo"
          className="flex items-center justify-center gap-1.5 px-3 py-3 bg-surface-2 hover:bg-surface-2 disabled:opacity-40 rounded-xl border border-line transition-all text-ink-2 font-bold"
        >
          <Sparkles size={15} className="text-amber-500" />
          <span className="text-xs uppercase tracking-wide">Auto</span>
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="space-y-2.5 rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-ink-2">
              <strong>{newCandidates.length}</strong>{' '}
              {newCandidates.length === 1 ? 'objeto' : 'objetos'}
              {splitCount > 0 && <span className="text-accent"> · {splitCount} separados</span>}
            </p>
            <button
              onClick={() => setShowMask((v) => !v)}
              title={showMask ? 'Ocultar máscara' : 'Mostrar máscara'}
              className="shrink-0 p-1 rounded text-ink-3 hover:text-ink-2 transition-colors"
            >
              {showMask ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>

          <p className="text-[10px] text-ink-3">
            {result.totalBlobs} regiões brutas
            {result.rejected &&
              ` · descartadas: ${result.rejected.area} por tamanho, ${result.rejected.background} como fundo${result.rejected.elongation ? `, ${result.rejected.elongation} por forma` : ''}`}
          </p>

          {result.warnings?.map((wmsg, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400"
            >
              <Info size={12} className="shrink-0 mt-0.5" />
              {wmsg}
            </p>
          ))}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={newCandidates.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-strong disabled:opacity-40 text-accent-on text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <Check size={14} /> Adicionar
            </button>
            <button
              onClick={() => setResult(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line text-ink-2 hover:bg-surface-2 text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              <X size={14} /> Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
