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
  sessions = []
}: CountersProps) {
  // Live Plate aggregation
  const activePlate = plateId?.trim();
  const plateSessions = activePlate
    ? sessions.filter(s => s.metadata.plate?.trim().toLowerCase() === activePlate.toLowerCase())
    : [];

  const histViable = plateSessions.reduce((sum, s) => sum + s.viableCount, 0);
  const histInviable = plateSessions.reduce((sum, s) => sum + s.inviableCount, 0);
  
  // Combine historical sessions + current active counting
  const combinedViable = histViable + viableCount;
  const combinedInviable = histInviable + inviableCount;
  const combinedTotal = combinedViable + combinedInviable;
  const combinedViablePercent = combinedTotal > 0 
    ? ((combinedViable / combinedTotal) * 100).toFixed(1) 
    : "0";
  const combinedInviablePercent = combinedTotal > 0 
    ? ((combinedInviable / combinedTotal) * 105).toFixed(1) // Keep it normalized
    : "0";

  // Recalculate inviable percentage cleanly for visual bar
  const pctViableBar = combinedTotal > 0 ? (combinedViable / combinedTotal) * 100 : 0;
  const pctInviableBar = combinedTotal > 0 ? (combinedInviable / combinedTotal) * 100 : 0;

  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
        Totalizadores
      </h3>
      <div className="space-y-3">
        {/* Viable Seeds Card */}
        <CounterItem 
          label="Sementes Viáveis" 
          count={viableCount} 
          percent={viablePercent}
          color="bg-red-500" 
          description="Embrião visível / vermelho"
          isActive={activeClassification === 'viable'}
          onClick={() => setActiveClassification?.('viable')}
        />
        
        {/* Inviable Seeds Card */}
        <CounterItem 
          label="Sementes Inviáveis" 
          count={inviableCount} 
          percent={inviablePercent}
          color="bg-amber-400" 
          description="Vazia ou danificada / amarelo"
          isActive={activeClassification === 'inviable'}
          onClick={() => setActiveClassification?.('inviable')}
        />
        
        {/* Combined Total */}
        <div className="pt-3 mt-1 border-t border-neutral-100 dark:border-zinc-800 flex justify-between items-baseline px-1">
          <span className="text-xs font-semibold text-neutral-500 dark:text-zinc-450 uppercase tracking-wide">
            Total Computado
          </span>
          <span className="text-2xl font-black font-mono text-neutral-800 dark:text-zinc-50">
            {totalCount}
          </span>
        </div>
        
        {/* Rendering Visual Mode Toggle */}
        <div className="pt-2 flex gap-2">
          <button
            onClick={() => setVisualMode('dots')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer
              ${visualMode === 'dots' 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                : 'bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800'
              }
            `}
          >
            <Circle size={13} />
            <span>Pontos (1)</span>
          </button>
          <button
            onClick={() => setVisualMode('numbers')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer
              ${visualMode === 'numbers' 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                : 'bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800'
              }
            `}
          >
            <Hash size={13} />
            <span>Índices (2)</span>
          </button>
        </div>

        {/* Live Plate ID Statistics Widget */}
        {activePlate && (
          <div className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-950/30 p-3.5 rounded-xl space-y-2 mt-4 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-350 uppercase tracking-wide flex items-center gap-1.5">
                <Award size={13} className="text-emerald-600 dark:text-emerald-450 shrink-0" />
                Métricas Placa: <strong className="font-mono text-emerald-700 dark:text-emerald-200">{activePlate}</strong>
              </span>
              <span className="text-[9px] font-bold text-neutral-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 px-1.5 py-0.5 rounded-md shadow-sm shrink-0">
                {plateSessions.length + 1} Amostra{plateSessions.length + 1 === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1">
              <div className="flex flex-col text-center">
                <span className="text-[8px] font-extrabold text-neutral-450 dark:text-zinc-500 uppercase tracking-wider">Viáveis</span>
                <span className="text-xs font-black font-mono text-red-500">{combinedViable}</span>
                <span className="text-[8.5px] text-neutral-400 dark:text-zinc-500 font-bold font-mono">
                  {combinedTotal > 0 ? ((combinedViable / combinedTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="flex flex-col text-center border-x border-neutral-200/50 dark:border-zinc-800/80">
                <span className="text-[8px] font-extrabold text-neutral-450 dark:text-zinc-500 uppercase tracking-wider">Inviáveis</span>
                <span className="text-xs font-black font-mono text-amber-500">{combinedInviable}</span>
                <span className="text-[8.5px] text-neutral-400 dark:text-zinc-500 font-bold font-mono">
                  {combinedTotal > 0 ? ((combinedInviable / combinedTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-[8px] font-extrabold text-neutral-450 dark:text-zinc-500 uppercase tracking-wider">Total</span>
                <span className="text-xs font-black font-mono text-neutral-800 dark:text-zinc-150">{combinedTotal}</span>
                <span className="text-[8.5px] text-neutral-400 dark:text-zinc-500 font-bold uppercase tracking-widest text-[8px]">Placa</span>
              </div>
            </div>

            {/* Combined Viability bar */}
            <div className="flex bg-neutral-100 dark:bg-zinc-900 rounded-full h-1.5 w-full overflow-hidden mt-1 shadow-inner">
              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${pctViableBar}%` }} />
              <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${pctInviableBar}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
