// =============================================================================
// SeedCounter — Painel Lateral Direito (Resultados, Biometria e Curadoria)
//
// Aloca os totalizadores onde eles devem estar: no final do fluxo (à direita),
// acompanhados do motor analítico de morfometria, histogramas e regras lógicas.
// =============================================================================

import React from 'react';
import {
  FileText,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Ruler,
} from 'lucide-react';
import { Counters } from '../sidebar/Counters';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { CardEstatisticasPopulacionais } from '../../features/morfometria/CardEstatisticasPopulacionais';
import { CardHistogramas } from '../../features/morfometria/CardHistogramas';
import { CardRegrasSemiAutomaticas } from '../../features/morfometria/CardRegrasSemiAutomaticas';
import type { ResumoDeMorfometria } from '../../features/morfometria/resumo';
import type { SeedMeasurement } from '../../lib/measurements';
import type { RegraParametrica } from '../../features/morfometria/regras';
import type { Session } from '../../types';

interface RightSidebarProps {
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

  resumo: ResumoDeMorfometria | null;
  medicoes: SeedMeasurement[];
  especie?: string;
  calibrado?: boolean;

  onExport: () => void;
  onDestacarSementes?: (ids: number[]) => void;
  onAplicarRegra: (regra: RegraParametrica) => void;
  regraSelecionadaId: string;
  limiaresCustomizados: Record<string, number>;
  onRegraChange: (id: string) => void;
  onLimiarChange: (limiares: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;

  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hasImage: boolean;
}

export function RightSidebar({
  viableCount,
  inviableCount,
  viablePercent,
  inviablePercent,
  totalCount,
  visualMode,
  setVisualMode,
  activeClassification,
  setActiveClassification,
  plateId,
  sessions,
  resumo,
  medicoes,
  especie,
  calibrado,
  onExport,
  onDestacarSementes,
  onAplicarRegra,
  regraSelecionadaId,
  limiaresCustomizados,
  onRegraChange,
  onLimiarChange,
  isCollapsed,
  onToggleCollapse,
  hasImage,
}: RightSidebarProps) {
  if (isCollapsed) {
    return (
      <aside className="border-l border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 py-3 px-1 items-center gap-4 transition-all">
        <button
          onClick={onToggleCollapse}
          title="Expandir Painel de Análise e Resultados"
          className="p-1.5 rounded-lg border border-line bg-surface-2 hover:bg-surface-3 text-ink-2 hover:text-ink-1 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] uppercase font-bold tracking-widest text-ink-3">
          Resultados ({totalCount})
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-84 border-l border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-all duration-300">
      <div className="flex flex-col p-4 gap-4 min-h-max">
        {/* Cabeçalho do Painel Analítico com botão de colapso */}
        <div className="flex items-center justify-between pb-2 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-2">
              Resultados & Análise
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            title="Recolher painel lateral"
            className="p-1 rounded text-ink-3 hover:text-ink-1 hover:bg-surface-2 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 1. Totalizadores (Counters) */}
        <Counters
          viableCount={viableCount}
          inviableCount={inviableCount}
          viablePercent={viablePercent}
          inviablePercent={inviablePercent}
          totalCount={totalCount}
          visualMode={visualMode}
          setVisualMode={setVisualMode}
          activeClassification={activeClassification}
          setActiveClassification={setActiveClassification}
          plateId={plateId}
          sessions={sessions}
        />

        {/* Botão de Exportação Oficial */}
        <button
          onClick={onExport}
          disabled={!hasImage && totalCount === 0}
          className="w-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none text-accent-on rounded-control py-2.5 px-3 text-xs font-bold tracking-wide uppercase flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <FileText size={14} />
          Exportar Laudo / Dados
        </button>

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* 2. Cards Sanfonados Analíticos */}
        <div className="space-y-2">
          {/* Card 1: Estatísticas Descritivas */}
          <CollapsibleSection
            title="Biometria Populacional"
            icon={<Ruler size={14} className="text-ink-3" />}
            summary={
              resumo?.areaMm2
                ? `Área: ${resumo.areaMm2.mediana.toFixed(1)} mm²`
                : resumo?.areaPx
                ? `Área: ${Math.round(resumo.areaPx.mediana)} px²`
                : undefined
            }
            defaultOpen={hasImage && (resumo?.comContorno ?? 0) > 0}
          >
            <CardEstatisticasPopulacionais resumo={resumo} especie={especie} />
          </CollapsibleSection>

          {/* Card 2: Histogramas & Dispersão */}
          <CollapsibleSection
            title="Distribuição & Dispersão"
            icon={<BarChart3 size={14} className="text-ink-3" />}
            summary={`${medicoes.length} medições`}
            defaultOpen={false}
          >
            <CardHistogramas medicoes={medicoes} calibrado={calibrado} />
          </CollapsibleSection>

          {/* Card 3: Motor de Regras Lógicas */}
          <CollapsibleSection
            title="Regras Semi-Automáticas"
            icon={<SlidersHorizontal size={14} className="text-accent" />}
            summary="Curadoria em lote"
            defaultOpen={false}
          >
            <CardRegrasSemiAutomaticas
              medicoes={medicoes}
              calibrado={calibrado}
              onDestacarSementes={onDestacarSementes}
              onAplicarRegra={onAplicarRegra}
              regraSelecionadaId={regraSelecionadaId}
              limiaresCustomizados={limiaresCustomizados}
              onRegraChange={onRegraChange}
              onLimiarChange={onLimiarChange}
            />
          </CollapsibleSection>
        </div>
      </div>
    </aside>
  );
}
