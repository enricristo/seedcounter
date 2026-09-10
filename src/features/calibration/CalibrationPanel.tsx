// =============================================================================
// SeedCounter — CalibrationPanel
// Calibração espacial por múltiplos métodos + metadados de aquisição.
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Ruler, Check, AlertTriangle, Crosshair, Info } from 'lucide-react';
import {
  computeUmPerPixel,
  umPerPixelToDpi,
  validateScale,
  DPI_PRESETS,
  REFERENCE_PRESETS,
  METHOD_LABELS,
  UNIT_LABELS,
  DEFAULT_LAB_DPI,
  DEFAULT_LAB_SCANNER,
  type CalibrationMethod,
  type CalibrationData,
  type LengthUnit,
} from '../../lib/calibration';
import { TAMANHOS, acharPorNome, conferirEscala } from '../../lib/normas/tamanhos-de-semente';

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
  /**
   * Espécie declarada na amostra, e o comprimento típico de um objeto da
   * imagem em pixels. Juntos permitem CONFERIR a escala, não só calculá-la.
   */
  especie?: string;
  comprimentoTipicoEmPixels?: number;
  /**
   * Muda a espécie declarada. Ausente = seletor oculto.
   *
   * Mora AQUI, e não só na identificação para laudo, porque espécie é conceito
   * de pesquisa antes de ser campo de boletim — e sem ela o alvo de calibração
   * e o corte por concavidade ficam invisíveis para quem nunca ligou o modo
   * laudo.
   */
  onEspecieChange?: (nomeCientifico: string | undefined) => void;
}

const METHODS: CalibrationMethod[] = ['dpi', 'reference', 'stage_micrometer', 'manual'];

/** Numero com virgula decimal — e documento brasileiro. */
function virgula(v: number, casas = 2): string {
  return v.toFixed(casas).replace(/\.?0+$/, '').replace('.', ',');
}

export function CalibrationPanel({
  umPerPixel,
  onChange,
  onStartMeasure,
  measuredPixels,
  isMeasuring,
  especie,
  comprimentoTipicoEmPixels,
  onEspecieChange,
}: CalibrationPanelProps) {
  const [method, setMethod] = useState<CalibrationMethod>('dpi');
  const [dpi, setDpi] = useState(DEFAULT_LAB_DPI);
  const [refLength, setRefLength] = useState(10);
  const [refUnit, setRefUnit] = useState<LengthUnit>('mm');
  const [refLabel, setRefLabel] = useState('');
  const [manualValue, setManualValue] = useState(umPerPixel ?? 0);

  const data: CalibrationData = useMemo(
    () => ({
      method,
      dpi,
      referencePixels: measuredPixels,
      referenceLength: refLength,
      referenceUnit: refUnit,
      referenceLabel: refLabel,
      umPerPixel: manualValue,
    }),
    [method, dpi, measuredPixels, refLength, refUnit, refLabel, manualValue]
  );

  const computed = useMemo(() => computeUmPerPixel(data), [data]);
  const warning = useMemo(() => validateScale(computed), [computed]);

  // A conferência por espécie pega o que `validateScale` deixa passar: informar
  // centímetro onde era milímetro produz uma escala dentro da faixa plausível,
  // e só o tamanho esperado da semente denuncia.
  /**
   * O ALVO: quanto um objeto tipico desta imagem deveria medir.
   *
   * Sai da tabela de tamanhos da especie declarada. E o numero que transforma
   * calibrar de "informe um valor" em "confira se bate" — a pessoa passa a ter
   * contra o que comparar, em vez de aceitar o que o campo disser.
   */
  const alvo = useMemo(() => {
    const referencia = acharPorNome(especie);
    if (!referencia) return null;

    const emPixels =
      comprimentoTipicoEmPixels && comprimentoTipicoEmPixels > 0
        ? comprimentoTipicoEmPixels
        : null;

    return {
      referencia,
      // A escala que faria o objeto medido cair no meio da faixa da especie.
      escalaIdeal: emPixels
        ? ((referencia.minimo + referencia.maximo) / 2 / emPixels) * 1000
        : null,
      emPixels,
    };
  }, [especie, comprimentoTipicoEmPixels]);

  const conferencia = useMemo(
    () => conferirEscala(comprimentoTipicoEmPixels ?? 0, computed, especie),
    [comprimentoTipicoEmPixels, computed, especie]
  );
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
        <Ruler size={14} className="text-accent" />
        <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
          Calibração Espacial
        </h3>
      </div>

      {/* Escala vigente */}
      <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
        {umPerPixel && umPerPixel > 0 ? (
          <>
            <p className="text-sm font-bold text-ink-1">
              {umPerPixel.toFixed(3)} <span className="text-[11px] font-normal">µm/px</span>
            </p>
            <p className="text-[10px] text-ink-3">
              ≈ {Math.round(umPerPixelToDpi(umPerPixel))} DPI · 1 mm ≈{' '}
              {Math.round(1000 / umPerPixel)} px
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
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Método</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as CalibrationMethod)}
          className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* --- Método: DPI --- */}
      {method === 'dpi' && (
        <div className="space-y-2">
          <p className="text-[10px] text-ink-3">
            Use a resolução configurada no scanner ao digitalizar a placa. Padrão do laboratório:{' '}
            <strong>{DEFAULT_LAB_SCANNER}</strong> a {DEFAULT_LAB_DPI} DPI.
          </p>
          <div className="flex flex-wrap gap-1">
            {DPI_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setDpi(p)}
                title={
                  p === DEFAULT_LAB_DPI
                    ? `Padrão do laboratório (${DEFAULT_LAB_SCANNER})`
                    : undefined
                }
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  dpi === p
                    ? 'bg-accent border-accent text-accent-on'
                    : p === DEFAULT_LAB_DPI
                      ? 'border-accent text-accent hover:bg-accent-tint'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                }`}
              >
                {p}
                {p === DEFAULT_LAB_DPI ? ' ★' : ''}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            placeholder="DPI"
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      )}

      {/* --- Métodos por medição na imagem --- */}
      {(method === 'reference' || method === 'stage_micrometer') && (
        <div className="space-y-2">
          <p className="text-[10px] text-ink-3">
            {method === 'stage_micrometer'
              ? 'Fotografe o micrômetro de platina no mesmo aumento da amostra e meça uma divisão conhecida.'
              : 'Meça um objeto de dimensão conhecida na própria imagem: régua, marcação na placa ou o diâmetro da placa.'}
          </p>

          <button
            onClick={onStartMeasure}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wide transition-colors ${
              isMeasuring
                ? 'bg-accent border-accent text-accent-on'
                : 'bg-surface-2 border-line text-ink-2 hover:bg-surface-2'
            }`}
          >
            <Crosshair size={15} />
            {isMeasuring ? 'Clique nos 2 pontos…' : 'Medir na imagem'}
          </button>

          {measuredPixels ? (
            <p className="text-[11px] text-ink-2">
              Distância medida: <strong>{measuredPixels.toFixed(1)} px</strong>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[10px] text-ink-3">
              <Info size={12} className="shrink-0 mt-0.5" />
              Nenhuma medição ainda.
            </p>
          )}

          {/* Predefinições de referência */}
          <select
            onChange={(e) => {
              const p = REFERENCE_PRESETS[Number(e.target.value)];
              if (p) applyPreset(p.length, p.unit, p.label);
            }}
            defaultValue=""
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-[11px] focus:outline-none"
          >
            <option value="" disabled>
              Referências comuns…
            </option>
            {REFERENCE_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5">
            <input
              type="number"
              min={0}
              step="any"
              value={refLength}
              onChange={(e) => setRefLength(Number(e.target.value))}
              placeholder="Comprimento real"
              className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <select
              value={refUnit}
              onChange={(e) => setRefUnit(e.target.value as LengthUnit)}
              className="bg-surface-2 border border-line rounded-lg px-2 py-2 text-sm focus:outline-none"
            >
              {(Object.keys(UNIT_LABELS) as LengthUnit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* --- Método: manual --- */}
      {method === 'manual' && (
        <div className="space-y-2">
          <p className="text-[10px] text-ink-3">
            Informe diretamente a escala, se você já a conhece.
          </p>
          <input
            type="number"
            min={0}
            step="any"
            value={manualValue}
            onChange={(e) => setManualValue(Number(e.target.value))}
            placeholder="µm por pixel"
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      )}

      {/* Prévia + aplicar */}
      {computed > 0 && (
        <div className="rounded-lg bg-accent-tint border border-accent/30 px-3 py-2">
          <p className="text-[11px] text-accent">
            Resultado: <strong>{computed.toFixed(3)} µm/px</strong>
          </p>
        </div>
      )}

      {onEspecieChange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-ink-2 ml-1 text-[11px] font-semibold tracking-wide uppercase">
            Espécie
          </label>
          <select
            value={acharPorNome(especie)?.chave ?? ''}
            onChange={(e) => {
              const t = TAMANHOS.find((x) => x.chave === e.target.value);
              onEspecieChange(t?.nomeCientifico);
            }}
            className="bg-surface-2 border-line focus:ring-accent/20 focus:border-accent w-full rounded-lg border px-3 py-2 text-sm transition-all focus:outline-none"
          >
            <option value="">Não declarada</option>
            {TAMANHOS.map((t) => (
              <option key={t.chave} value={t.chave}>
                {t.nomeComum} — {t.nomeCientifico}
              </option>
            ))}
          </select>
          <p className="text-ink-3 ml-1 text-[10px] leading-snug">
            Dá o alvo de tamanho para conferir a escala, e ajusta o corte de sementes encostadas
            à forma da semente.
          </p>
        </div>
      )}

      {alvo && (
        <div className="border-line bg-surface-2 space-y-1 rounded-lg border p-2.5">
          <p className="text-ink-3 text-[10px] font-bold tracking-wide uppercase">
            Alvo para {alvo.referencia.nomeComum.toLowerCase()}
          </p>
          <p className="text-ink-1 font-mono text-[12px] tabular-nums">
            {virgula(alvo.referencia.minimo)} a {virgula(alvo.referencia.maximo)} mm
            <span className="text-ink-3 ml-1.5 font-sans text-[10px]">de comprimento</span>
          </p>
          {alvo.emPixels ? (
            <>
              <p className="text-ink-3 text-[10px] leading-snug">
                Um objeto típico desta imagem tem {Math.round(alvo.emPixels)} px.
                {computed > 0 && conferencia.comprimentoImplicado !== undefined && (
                  <>
                    {' '}
                    Nesta escala isso dá{' '}
                    <strong className="text-ink-2">
                      {virgula(conferencia.comprimentoImplicado)} mm
                    </strong>
                    .
                  </>
                )}
              </p>
              {alvo.escalaIdeal && (
                <button
                  onClick={() => {
                    setMethod('manual');
                    setManualValue(Number(alvo.escalaIdeal!.toFixed(2)));
                  }}
                  title="Chute informado: assume que o objeto medido tem o tamanho médio da espécie"
                  className="border-line text-ink-2 hover:border-accent hover:text-accent mt-1 w-full rounded-lg border px-2 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors"
                >
                  Partir de {virgula(alvo.escalaIdeal)} µm/px
                </button>
              )}
            </>
          ) : (
            <p className="text-ink-3 text-[10px] leading-snug">
              Segmente ao menos três objetos para o aplicativo comparar com este alvo.
            </p>
          )}
        </div>
      )}

      {conferencia.veredicto === 'suspeita' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertTriangle
            size={12}
            className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400"
          />
          <p className="text-[10px] leading-snug text-amber-800 dark:text-amber-300">
            {conferencia.recado}
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
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed text-accent-on text-xs font-bold uppercase tracking-wide transition-colors"
      >
        <Check size={15} /> Aplicar calibração
      </button>
    </section>
  );
}
