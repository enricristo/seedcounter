import React from 'react';
import { Circle, Hash, Award } from 'lucide-react';
import { CounterItem } from '../shared/CounterItem';
import type { Session } from '../../types';

interface CountersProps {
  viableCount: number;
  inviableCount: number;
  viablePercent: string;
  inviablePercent: string;
  totalCount: number;
  visualMode: 'dots' | 'numbers';
  setVisualMode: (mode: 'dots' | 'numbers') => void;
  activeClassification?: 'viable' | 'inviable';
  setActiveClassification?: (type: 'viable' | 'inviable') => void;
  plateId?: string;
  sessions?: Session[];
}

export function Counters({
  viableCount,
  inviableCount,
  viablePercent,
  inviablePercent,
  totalCount,
  visualMode,
  setVisualMode,
  activeClassification = 'viable',
  setActiveClassification,
  plateId,
  sessions = [],
}: CountersProps) {
  // Agregação por placa: soma as sessões já salvas com a contagem em curso.
  const activePlate = plateId?.trim();
  const plateSessions = activePlate
    ? sessions.filter((s) => s.metadata.plate?.trim().toLowerCase() === activePlate.toLowerCase())
    : [];

  const histViable = plateSessions.reduce((sum, s) => sum + s.viableCount, 0);
  const histInviable = plateSessions.reduce((sum, s) => sum + s.inviableCount, 0);

  const combinedViable = histViable + viableCount;
  const combinedInviable = histInviable + inviableCount;
  const combinedTotal = combinedViable + combinedInviable;

  const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

  // Proporção da contagem em curso, para a barra segmentada.
  const barViable = pct(viableCount, totalCount);
  const barInviable = pct(inviableCount, totalCount);

  // Proporção acumulada da placa.
  const plateBarViable = pct(combinedViable, combinedTotal);
  const plateBarInviable = pct(combinedInviable, combinedTotal);

  const botaoModo = (ativo: boolean) =>
    `rounded-control flex flex-1 cursor-pointer items-center justify-center gap-2 border px-3 py-2 text-[10px] font-bold tracking-wider uppercase transition-all ${
      ativo
        ? 'bg-accent border-accent text-accent-on'
        : 'bg-surface-1 border-line text-ink-2 hover:border-ink-3 hover:bg-surface-2'
    }`;

  return (
    <section className="space-y-4">
      <h3 className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">Totalizadores</h3>

      <div className="space-y-3">
        <CounterItem
          label="Sementes Viáveis"
          count={viableCount}
          percent={viablePercent}
          color="bg-red-500"
          description="Embrião visível / vermelho"
          isActive={activeClassification === 'viable'}
          onClick={() => setActiveClassification?.('viable')}
        />

        <CounterItem
          label="Sementes Inviáveis"
          count={inviableCount}
          percent={inviablePercent}
          color="bg-amber-400"
          description="Vazia ou danificada / amarelo"
          isActive={activeClassification === 'inviable'}
          onClick={() => setActiveClassification?.('inviable')}
        />

        {/* Proporção entre as duas classes. É UM elemento porque é UMA relação:
            dois números soltos obrigam o técnico a comparar de cabeça. */}
        <div
          className="bg-surface-2 flex h-1.5 w-full gap-px overflow-hidden rounded-full"
          role="img"
          aria-label={`Proporção da amostra: ${viablePercent}% viáveis, ${inviablePercent}% inviáveis`}
        >
          <div className="h-full bg-red-500 transition-all" style={{ width: `${barViable}%` }} />
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${barInviable}%` }}
          />
        </div>

        <div className="border-line flex items-baseline justify-between border-t px-1 pt-3">
          <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
            Total computado
          </span>
          <span className="text-ink-1 font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {totalCount}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setVisualMode('dots')}
            className={botaoModo(visualMode === 'dots')}
          >
            <Circle size={14} strokeWidth={2.25} aria-hidden="true" />
            <span>Pontos (1)</span>
          </button>
          <button
            onClick={() => setVisualMode('numbers')}
            className={botaoModo(visualMode === 'numbers')}
          >
            <Hash size={14} strokeWidth={2.25} aria-hidden="true" />
            <span>Índices (2)</span>
          </button>
        </div>

        {/* Métricas acumuladas da placa — só aparece quando há placa nomeada. */}
        {activePlate && (
          <div className="border-line bg-surface-2 rounded-panel mt-4 space-y-2 border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-accent flex min-w-0 items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase">
                <Award size={14} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Métricas placa: <strong className="font-mono">{activePlate}</strong>
                </span>
              </span>
              <span className="text-ink-2 border-line bg-surface-1 rounded-control shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums">
                {plateSessions.length + 1} amostra{plateSessions.length + 1 === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="flex flex-col text-center">
                <span className="text-ink-3 text-[8px] font-bold tracking-wider uppercase">
                  Viáveis
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {combinedViable}
                </span>
                <span className="text-ink-3 font-mono text-[8.5px] tabular-nums">
                  {plateBarViable.toFixed(1)}%
                </span>
              </div>
              <div className="border-line flex flex-col border-x text-center">
                <span className="text-ink-3 text-[8px] font-bold tracking-wider uppercase">
                  Inviáveis
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {combinedInviable}
                </span>
                <span className="text-ink-3 font-mono text-[8.5px] tabular-nums">
                  {plateBarInviable.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-ink-3 text-[8px] font-bold tracking-wider uppercase">
                  Total
                </span>
                <span className="text-ink-1 font-mono text-xs font-semibold tabular-nums">
                  {combinedTotal}
                </span>
                <span className="text-ink-3 text-[8px] font-bold tracking-widest uppercase">
                  Placa
                </span>
              </div>
            </div>

            <div
              className="bg-surface-1 border-line flex h-1.5 w-full gap-px overflow-hidden rounded-full border"
              role="img"
              aria-label={`Proporção acumulada da placa: ${plateBarViable.toFixed(1)}% viáveis, ${plateBarInviable.toFixed(1)}% inviáveis`}
            >
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${plateBarViable}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${plateBarInviable}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
