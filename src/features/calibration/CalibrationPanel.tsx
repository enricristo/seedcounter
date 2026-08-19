// =============================================================================
// SeedCounter — CalibrationPanel
// Calibração espacial por múltiplos métodos + metadados de aquisição.
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Ruler, Check, AlertTriangle, Crosshair, Info } from 'lucide-react';
import {
  computeUmPerPixel, umPerPixelToDpi, validateScale,
  DPI_PRESETS, REFERENCE_PRESETS, METHOD_LABELS, UNIT_LABELS,
  DEFAULT_LAB_DPI, DEFAULT_LAB_SCANNER,
  type CalibrationMethod, type CalibrationData, type LengthUnit,
} from '../../lib/calibration';

interface CalibrationPanelProps {
  /** Escala atual (µm/px). */
  umPerPixel?: number;
  /** Salva a escala calculada. */
  onChange: (umPerPixel: number | undefined) => void;
  /** Ativa o modo régua no canvas (usuário clica 2 pontos). */
  onStartMeasure?: () => void;
  /** Distância medida pela régua, em pixels (vem do canvas). */
  measuredPixels?: number;
  /** true enquanto o modo régua está ativo. */
  isMeasuring?: boolean;
}

const METHODS: CalibrationMethod[] = ['dpi', 'reference', 'stage_micrometer', 'manual'];

export function CalibrationPanel({
  umPerPixel,
  onChange,
  onStartMeasure,
  measuredPixels,
  isMeasuring,
}: CalibrationPanelProps) {
  const [method, setMethod] = useState<CalibrationMethod>('dpi');
  const [dpi, setDpi] = useState(DEFAULT_LAB_DPI);
  const [refLength, setRefLength] = useState(10);
  const [refUnit, setRefUnit] = useState<LengthUnit>('mm');
  const [refLabel, setRefLabel] = useState('');
  const [manualValue, setManualValue] = useState(umPerPixel ?? 0);

  const data: CalibrationData = useMemo(() => ({
    method,
    dpi,
    referencePixels: measuredPixels,
    referenceLength: refLength,
    referenceUnit: refUnit,
    referenceLabel: refLabel,
    umPerPixel: manualValue,
  }), [method, dpi, measuredPixels, refLength, refUnit, refLabel, manualValue]);

  const computed = useMemo(() => computeUmPerPixel(data), [data]);
  const warning = useMemo(() => validateScale(computed), [computed]);
  const needsMeasure = (method === 'reference' || method === 'stage_micrometer') && !measuredPixels;

  const handleApply = useCallback(() => {
    if (computed > 0) onChange(computed);
  }, [computed, onChange]);

  const applyPreset = useCallback((length: number, unit: LengthUnit, label: string) => {
    setRefLength(length);
    setRefUnit(unit);
    setRefLabel(label);
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Ruler size={14} className="text-sky-500" />
        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
          Calibração Espacial
        </h3>
      </div>

      {/* Escala vigente */}
      <div className="rounded-xl border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/60 px-3 py-2.5">
        {umPerPixel && umPerPixel > 0 ? (
          <>
            <p className="text-sm font-bold text-neutral-800 dark:text-zinc-100">
              {umPerPixel.toFixed(3)} <span className="text-[11px] font-normal">µm/px</span>
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
              ≈ {Math.round(umPerPixelToDpi(umPerPixel))} DPI · 1 mm ≈ {Math.round(1000 / umPerPixel)} px
            </p>
          </>
        ) : (
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Sem calibração — as medidas sairão apenas em pixels.
          </p>
        )}
      </div>

      {/* Método */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
          Método
        </label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value as CalibrationMethod)}
          className="w-full bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
        >
          {METHODS.map(m => (
            <option key={m} value={m}>{METHOD_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {/* --- Método: DPI --- */}
      {method === 'dpi' && (
        <div className="space-y-2">
          <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
            Use a resolução configurada no scanner ao digitalizar a placa.
            Padrão do laboratório: <strong>{DEFAULT_LAB_SCANNER}</strong> a {DEFAULT_LAB_DPI} DPI.
          </p>
          <div className="flex flex-wrap gap-1">
            {DPI_PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setDpi(p)}
                title={p === DEFAULT_LAB_DPI ? `Padrão do laboratório (${DEFAULT_LAB_SCANNER})` : undefined}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  dpi === p
                    ? 'bg-sky-500 border-sky-500 text-white'
                    : p === DEFAULT_LAB_DPI
                      ? 'border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                      : 'border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800'
                }`}
              >
                {p}{p === DEFAULT_LAB_DPI ? ' ★' : ''}
              </button>
            ))}
          </div>
          <input
            type="number" min={1} value={dpi}
            onChange={e => setDpi(Number(e.target.value))}
            placeholder="DPI"
            className="w-full bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
      )}

      {/* --- Métodos por medição na imagem --- */}
      {(method === 'reference' || method === 'stage_micrometer') && (
        <div className="space-y-2">
          <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
            {method === 'stage_micrometer'
              ? 'Fotografe o micrômetro de platina no mesmo aumento da amostra e meça uma divisão conhecida.'
              : 'Meça um objeto de dimensão conhecida na própria imagem: régua, marcação na placa ou o diâmetro da placa.'}
          </p>

          <button
            onClick={onStartMeasure}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wide transition-colors ${
              isMeasuring
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-200 hover:bg-neutral-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Crosshair size={15} />
            {isMeasuring ? 'Clique nos 2 pontos…' : 'Medir na imagem'}
          </button>

          {measuredPixels ? (
            <p className="text-[11px] text-neutral-600 dark:text-zinc-300">
              Distância medida: <strong>{measuredPixels.toFixed(1)} px</strong>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[10px] text-neutral-500 dark:text-zinc-500">
              <Info size={12} className="shrink-0 mt-0.5" />
              Nenhuma medição ainda.
            </p>
          )}

          {/* Predefinições de referência */}
          <select
            onChange={e => {
              const p = REFERENCE_PRESETS[Number(e.target.value)];
              if (p) applyPreset(p.length, p.unit, p.label);
            }}
            defaultValue=""
            className="w-full bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-[11px] dark:text-zinc-100 focus:outline-none"
          >
            <option value="" disabled>Referências comuns…</option>
            {REFERENCE_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>

          <div className="flex gap-1.5">
            <input
              type="number" min={0} step="any" value={refLength}
              onChange={e => setRefLength(Number(e.target.value))}
              placeholder="Comprimento real"
              className="flex-1 bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
            <select
              value={refUnit}
              onChange={e => setRefUnit(e.target.value as LengthUnit)}
              className="bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-2 py-2 text-sm dark:text-zinc-100 focus:outline-none"
            >
              {(Object.keys(UNIT_LABELS) as LengthUnit[]).map(u => (
                <option key={u} value={u}>{UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* --- Método: manual --- */}
      {method === 'manual' && (
        <div className="space-y-2">
          <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
            Informe diretamente a escala, se você já a conhece.
          </p>
          <input
            type="number" min={0} step="any" value={manualValue}
            onChange={e => setManualValue(Number(e.target.value))}
            placeholder="µm por pixel"
            className="w-full bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
      )}

      {/* Prévia + aplicar */}
      {computed > 0 && (
        <div className="rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 px-3 py-2">
          <p className="text-[11px] text-sky-800 dark:text-sky-300">
            Resultado: <strong>{computed.toFixed(3)} µm/px</strong>
          </p>
        </div>
      )}

      {warning && (
        <p className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          {warning}
        </p>
      )}

      <button
        onClick={handleApply}
        disabled={computed <= 0 || needsMeasure}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide transition-colors"
      >
        <Check size={15} /> Aplicar calibração
      </button>
    </section>
  );
}
