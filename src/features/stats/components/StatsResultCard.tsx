import React from 'react';
import type { ANOVAResult } from '../../../types';
import type { StatsPipelineResult } from '../../../lib/stats';
import { Info, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatsResultCardProps {
  result: StatsPipelineResult;
}

const METHOD_LABELS: Record<StatsPipelineResult['method'], string> = {
  'anova+scott-knott': 'ANOVA + Scott-Knott',
  'anova+tukey': 'ANOVA + Tukey HSD',
  'kruskal-wallis+dunn': 'Kruskal-Wallis + Dunn (Holm)',
  'descriptive-only': 'Apenas Descritiva',
};

function pValueLabel(p: number) {
  if (p < 0.001) return '< 0,001';
  return p.toFixed(3).replace('.', ',');
}

export function StatsResultCard({ result }: StatsResultCardProps) {
  const { method, anova, kruskalWallisResult, normalityResults, groups, transformed } = result;

  const isParametric = method.startsWith('anova');
  const isSig = anova?.significant ?? kruskalWallisResult?.significant ?? false;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-violet-500" />
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            Resultado Estatístico
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSig ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
              <CheckCircle size={10} />
              Significativo (p &lt; 0,05)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
              <AlertTriangle size={10} />
              Não significativo
            </span>
          )}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Test info */}
        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Método</p>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{METHOD_LABELS[method]}</p>
          </div>

          {transformed && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
              <Info size={11} className="shrink-0 mt-0.5" />
              <span>Transformação arcsin√x aplicada antes do teste (dados em proporções)</span>
            </div>
          )}

          {/* ANOVA stats */}
          {anova && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="F" value={anova.fStat.toFixed(3)} />
              <Stat label="GL" value={`${anova.dfBetween}, ${anova.dfWithin}`} />
              <Stat label="p-valor" value={pValueLabel(anova.pValue)} highlight={anova.significant} />
            </div>
          )}

          {/* Kruskal-Wallis stats */}
          {kruskalWallisResult && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="H" value={kruskalWallisResult.H.toFixed(3)} />
              <Stat label="GL" value={String(groups.length - 1)} />
              <Stat label="p-valor" value={pValueLabel(kruskalWallisResult.pValue)} highlight={kruskalWallisResult.significant} />
            </div>
          )}

          {method === 'descriptive-only' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Dados insuficientes para comparação estatística (mínimo 2 grupos com ≥ 2 réplicas cada).
            </p>
          )}
        </div>

        {/* Normality per group */}
        <div>
          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
            Normalidade por Grupo — Shapiro-Wilk
          </p>
          <div className="space-y-1.5">
            {normalityResults.map((nr, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800/60 rounded-lg px-3 py-1.5"
              >
                <span className="font-semibold text-zinc-700 dark:text-zinc-200 truncate max-w-[120px]">
                  {groups[i]?.label ?? `Grupo ${i + 1}`}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[10px]">
                    W = {nr.W.toFixed(3)}
                  </span>
                  <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[10px]">
                    p = {pValueLabel(nr.pValue)}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      nr.normal
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {nr.normal ? 'Normal' : 'Não-normal'}
                  </span>
                </div>
              </div>
            ))}
            {normalityResults.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">—</p>
            )}
          </div>
          {!isParametric && normalityResults.some(r => !r.normal) && (
            <p className="mt-2 text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <AlertTriangle size={10} />
              Pressuposto de normalidade violado → Kruskal-Wallis utilizado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/70 rounded-xl px-3 py-2 text-center">
      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p
        className={`text-sm font-bold font-mono ${
          highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-100'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
