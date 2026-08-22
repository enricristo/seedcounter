// =============================================================================
// SeedCounter — ImageAdjustPanel
// Ajustes de imagem não destrutivos, com histograma para orientar a escolha.
// =============================================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { SlidersHorizontal, RotateCcw, Eye, EyeOff } from 'lucide-react';
import {
  NEUTRAL_ADJUSTMENTS, ADJUSTMENT_PRESETS, isNeutral, computeHistogram,
  type ImageAdjustments, type Histogram,
} from '../../lib/image-adjust';

interface ImageAdjustPanelProps {
  image: HTMLImageElement | null;
  adjustments: ImageAdjustments;
  onChange: (adj: ImageAdjustments) => void;
  /** Liga/desliga a aplicação sem perder os valores configurados. */
  enabled: boolean;
  onToggleEnabled: () => void;
}

/** Desenha o histograma de luminância como área preenchida. */
function HistogramView({ hist }: { hist: Histogram | null }) {
  const path = useMemo(() => {
    if (!hist || hist.max === 0) return '';
    const pts: string[] = ['M 0,40'];
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 256;
      const y = 40 - (hist.lum[i] / hist.max) * 38;
      pts.push(`L ${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pts.push('L 256,40 Z');
    return pts.join(' ');
  }, [hist]);

  if (!path) return null;

  return (
    <svg viewBox="0 0 256 40" className="w-full h-10 rounded bg-neutral-100 dark:bg-zinc-900" preserveAspectRatio="none">
      <path d={path} className="fill-neutral-400/60 dark:fill-zinc-600/60" />
      {/* Marcas de referência: sombras, médios, luzes */}
      {[64, 128, 192].map(x => (
        <line key={x} x1={x} y1={0} x2={x} y2={40} strokeWidth={0.5}
          className="stroke-neutral-300 dark:stroke-zinc-700" />
      ))}
    </svg>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  accent?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step = 1, accent = 'accent-emerald-500', format, onChange }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
          {label}
        </label>
        <span className="text-[11px] font-mono text-neutral-600 dark:text-zinc-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full ${accent}`}
      />
    </div>
  );
}

export function ImageAdjustPanel({
  image, adjustments, onChange, enabled, onToggleEnabled,
}: ImageAdjustPanelProps) {
  const [hist, setHist] = useState<Histogram | null>(null);

  // Recalcula o histograma quando a imagem muda (usa amostragem reduzida).
  useEffect(() => {
    if (!image) { setHist(null); return; }
    setHist(computeHistogram(image));
  }, [image]);

  const set = useCallback(
    <K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]) => {
      onChange({ ...adjustments, [key]: value });
    },
    [adjustments, onChange]
  );

  const applyPreset = useCallback((values: Partial<ImageAdjustments>) => {
    onChange({ ...NEUTRAL_ADJUSTMENTS, ...values });
  }, [onChange]);

  const neutral = isNeutral(adjustments);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-cyan-500" />
          <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
            Ajuste de Imagem
          </h3>
        </div>
        <button
          onClick={onToggleEnabled}
          title={enabled ? 'Ver imagem original' : 'Aplicar ajustes'}
          className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 transition-colors"
        >
          {enabled ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>

      <HistogramView hist={hist} />

      {/* Predefinições */}
      <div className="flex flex-wrap gap-1">
        {ADJUSTMENT_PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.values)}
            title={p.hint}
            className="px-2 py-1 rounded-lg text-[10px] font-bold border border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
        <div className="space-y-2.5">
          <Slider label="Brilho" value={adjustments.brightness} min={-100} max={100}
            accent="accent-cyan-500" onChange={v => set('brightness', v)} />
          <Slider label="Contraste" value={adjustments.contrast} min={-100} max={100}
            accent="accent-cyan-500" onChange={v => set('contrast', v)} />
          <Slider label="Gama" value={adjustments.gamma} min={0.2} max={3} step={0.05}
            accent="accent-cyan-500" format={v => v.toFixed(2)} onChange={v => set('gamma', v)} />
          <Slider label="Saturação" value={adjustments.saturation} min={-100} max={100}
            accent="accent-cyan-500" onChange={v => set('saturation', v)} />
        </div>

        {/* Canais RGB */}
        <div className="mt-3 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Canais
          </p>
          <Slider label="Vermelho" value={adjustments.red} min={-100} max={100}
            accent="accent-red-500" onChange={v => set('red', v)} />
          <Slider label="Verde" value={adjustments.green} min={-100} max={100}
            accent="accent-green-500" onChange={v => set('green', v)} />
          <Slider label="Azul" value={adjustments.blue} min={-100} max={100}
            accent="accent-blue-500" onChange={v => set('blue', v)} />
        </div>

        {/* Isolar canal */}
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
            Exibir canal
          </p>
          <div className="grid grid-cols-4 gap-1">
            {([
              ['all', 'RGB'], ['r', 'R'], ['g', 'G'], ['b', 'B'],
            ] as const).map(([value, txt]: readonly ['all' | 'r' | 'g' | 'b', string]) => (
              <button
                key={value}
                onClick={() => set('channel', value)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                  adjustments.channel === value
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : 'border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800'
                }`}
              >
                {txt}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox" checked={adjustments.invert}
            onChange={e => set('invert', e.target.checked)}
            className="accent-cyan-500"
          />
          <span className="text-[11px] text-neutral-600 dark:text-zinc-400">Inverter (negativo)</span>
        </label>
      </div>

      {!neutral && (
        <button
          onClick={() => onChange(NEUTRAL_ADJUSTMENTS)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-[11px] font-bold uppercase tracking-wide transition-colors"
        >
          <RotateCcw size={13} /> Restaurar original
        </button>
      )}

      <p className="text-[10px] text-neutral-500 dark:text-zinc-500 leading-relaxed">
        Os ajustes são apenas de visualização e detecção — a imagem original e as
        medidas não são alteradas.
      </p>
    </section>
  );
}
