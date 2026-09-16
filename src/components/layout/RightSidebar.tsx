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
  Ruler,
  FolderOpen,
  Layers,
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
  regraSelecionadaId: string | null;
  limiaresCustomizados: Record<string, number>;
  onRegraChange: (id: string | null) => void;
  onLimiarChange: (limiares: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;

  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hasImage: boolean;
  activeTab: 'resultados' | 'inspetor' | 'galeria' | 'datasets' | 'lote';
  onTabChange: (tab: 'resultados' | 'inspetor' | 'galeria' | 'datasets' | 'lote') => void;
  inspectorContent?: React.ReactNode;
  galeriaContent?: React.ReactNode;
  /** Explorador de datasets (Lote B) — quarta aba, abaixo de Resultados/Inspetor/Galeria. */
  datasetsContent?: React.ReactNode;
  /** A mesma receita em várias imagens (Task C1) — quinta aba. */
  loteContent?: React.ReactNode;
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
  activeTab,
  onTabChange,
  inspectorContent,
  galeriaContent,
  datasetsContent,
  loteContent,
}: RightSidebarProps) {

  return (
    <div className="flex flex-row h-full shrink-0">
      {/* Faixa de Tabs (Sempre visível) */}
      <aside className="border-l border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 py-3 w-12 items-center gap-3 z-20">
        <button
          onClick={() => {
            if (activeTab === 'resultados' && !isCollapsed) onToggleCollapse();
            else { onTabChange('resultados'); if (isCollapsed) onToggleCollapse(); }
          }}
          title="Resultados"
          className={`p-1.5 rounded-lg border transition-colors ${!isCollapsed && activeTab === 'resultados' ? 'bg-accent/20 border-accent text-accent' : 'border-line bg-surface-2 hover:bg-surface-3 text-ink-3'}`}
        >
          <BarChart3 size={20} />
        </button>
        <button
          onClick={() => {
            if (activeTab === 'inspetor' && !isCollapsed) onToggleCollapse();
            else { onTabChange('inspetor'); if (isCollapsed) onToggleCollapse(); }
          }}
          title="Inspetor"
          className={`p-1.5 rounded-lg border transition-colors ${!isCollapsed && activeTab === 'inspetor' ? 'bg-accent/20 border-accent text-accent' : 'border-line bg-surface-2 hover:bg-surface-3 text-ink-3'}`}
        >
          <Ruler size={20} />
        </button>
        <button
          onClick={() => {
            if (activeTab === 'galeria' && !isCollapsed) onToggleCollapse();
            else { onTabChange('galeria'); if (isCollapsed) onToggleCollapse(); }
          }}
          title="Galeria"
          className={`p-1.5 rounded-lg border transition-colors ${!isCollapsed && activeTab === 'galeria' ? 'bg-accent/20 border-accent text-accent' : 'border-line bg-surface-2 hover:bg-surface-3 text-ink-3'}`}
        >
          <FileText size={20} />
        </button>
        <button
          onClick={() => {
            if (activeTab === 'datasets' && !isCollapsed) onToggleCollapse();
            else { onTabChange('datasets'); if (isCollapsed) onToggleCollapse(); }
          }}
          title="Datasets"
          className={`p-1.5 rounded-lg border transition-colors ${!isCollapsed && activeTab === 'datasets' ? 'bg-accent/20 border-accent text-accent' : 'border-line bg-surface-2 hover:bg-surface-3 text-ink-3'}`}
        >
          <FolderOpen size={20} />
        </button>
        <button
          onClick={() => {
            if (activeTab === 'lote' && !isCollapsed) onToggleCollapse();
            else { onTabChange('lote'); if (isCollapsed) onToggleCollapse(); }
          }}
          title="Lote"
          className={`p-1.5 rounded-lg border transition-colors ${!isCollapsed && activeTab === 'lote' ? 'bg-accent/20 border-accent text-accent' : 'border-line bg-surface-2 hover:bg-surface-3 text-ink-3'}`}
        >
          <Layers size={20} />
        </button>
      </aside>

      {/* Painel de Conteúdo (Oculto quando colapsado) */}
      {!isCollapsed && (
        <aside className="w-84 border-l border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-all duration-300">
          <div className="flex flex-col p-4 gap-4 min-h-max">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-2 border-b border-line-soft">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink-2">
                  {activeTab === 'resultados' && 'Resultados & Análise'}
                  {activeTab === 'inspetor' && 'Inspetor de Sementes'}
                  {activeTab === 'galeria' && 'Galeria e Curadoria'}
                  {activeTab === 'datasets' && 'Explorador de Datasets'}
                  {activeTab === 'lote' && 'Lote'}
                </span>
              </div>
              <button
                onClick={onToggleCollapse}
                title="Recolher painel lateral"
                className="p-1 rounded text-ink-3 hover:text-ink-1 hover:bg-surface-2 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Conteúdo Dinâmico por Tab */}
            <div className={activeTab === 'resultados' ? 'flex flex-col gap-4' : 'hidden'}>
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

              <button
                onClick={onExport}
                disabled={!hasImage && totalCount === 0}
                className="w-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none text-accent-on rounded-control py-2.5 px-3 text-xs font-bold tracking-wide uppercase flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <FileText size={14} />
                Exportar Laudo / Dados
              </button>

              <hr className="border-neutral-100 dark:border-zinc-800" />

              <div className="space-y-2">
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

                <CollapsibleSection
                  title="Distribuição & Dispersão"
                  icon={<BarChart3 size={14} className="text-ink-3" />}
                  summary={`${medicoes.length} medições`}
                  defaultOpen={false}
                >
                  <CardHistogramas medicoes={medicoes} calibrado={calibrado} />
                </CollapsibleSection>

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

            <div className={activeTab === 'inspetor' ? 'flex flex-col gap-4' : 'hidden'}>
              {inspectorContent || <div className="text-ink-3 text-sm text-center mt-8">Selecione uma semente no canvas para inspecionar.</div>}
            </div>
            
            <div className={activeTab === 'galeria' ? 'flex flex-col gap-4' : 'hidden'}>
              {galeriaContent || <div className="text-ink-3 text-sm text-center mt-8">Nenhum dado na galeria.</div>}
            </div>

            <div className={activeTab === 'datasets' ? 'flex flex-col gap-4' : 'hidden'}>
              {datasetsContent}
            </div>

            <div className={activeTab === 'lote' ? 'flex flex-col gap-4' : 'hidden'}>
              {loteContent}
            </div>

          </div>
        </aside>
      )}
    </div>
  );
}
