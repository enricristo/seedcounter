import React from 'react';
import { ImageActions } from '../sidebar/ImageActions';
import { Counters } from '../sidebar/Counters';
import { MetadataForm } from '../sidebar/MetadataForm';
import { DifferentialMode } from '../sidebar/DifferentialMode';
import { HelpTip } from '../sidebar/HelpTip';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import type { Metadata, Session } from '../../types';

interface SidebarProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;

  viableCount: number;
  inviableCount: number;
  viablePercent: string;
  inviablePercent: string;
  totalCount: number;
  visualMode: 'dots' | 'numbers';
  setVisualMode: (mode: 'dots' | 'numbers') => void;
  activeClassification?: 'viable' | 'inviable';
  setActiveClassification?: (type: 'viable' | 'inviable') => void;

  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  sessions: Session[];

  /** Abre a captura por câmera. Ausente = botão oculto. */
  onOpenCamera?: () => void;

  // --- Painéis opcionais, agrupados por etapa do fluxo ---
  /** Etapa 1 — ajuste de imagem. */
  adjustSlot?: React.ReactNode;
  /** Etapa 2 — calibração espacial. */
  calibrationSlot?: React.ReactNode;
  /** Etapa 3 — detecção (IA e assistida). */
  detectionSlot?: React.ReactNode;
  /** Resumo da calibração para exibir na seção fechada. */
  calibrationSummary?: string;
  /** true quando ainda não há calibração (destaca a etapa). */
  needsCalibration?: boolean;
}

export function Sidebar({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON,
  viableCount,
  inviableCount,
  viablePercent,
  inviablePercent,
  totalCount,
  visualMode,
  setVisualMode,
  activeClassification,
  setActiveClassification,
  metadata,
  updateMetadata,
  sessions,
  onOpenCamera,
  adjustSlot,
  calibrationSlot,
  detectionSlot,
  calibrationSummary,
  needsCalibration,
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-neutral-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="flex flex-col p-4 gap-4 min-h-max">
        {/* Resultado primeiro: é o produto do trabalho */}
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
          plateId={metadata.plate}
          sessions={sessions}
        />

        {/* Entrada de imagem — ação mais frequente depois de contar */}
        <ImageActions
          fileInputRef={fileInputRef}
          importInputRef={importInputRef}
          handleFileUpload={handleFileUpload}
          handleImportJSON={handleImportJSON}
          onOpenCamera={onOpenCamera}
        />

        {/* Etapas de preparo e análise — recolhidas por padrão */}
        <div className="space-y-2">
          {adjustSlot && (
            <CollapsibleSection step={1} title="Preparar imagem">
              {adjustSlot}
            </CollapsibleSection>
          )}

          {calibrationSlot && (
            <CollapsibleSection
              step={2}
              title="Calibrar escala"
              summary={calibrationSummary}
              attention={needsCalibration}
            >
              {calibrationSlot}
            </CollapsibleSection>
          )}

          {detectionSlot && (
            <CollapsibleSection step={3} title="Detectar automaticamente">
              {detectionSlot}
            </CollapsibleSection>
          )}
        </div>

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Contexto da amostra */}
        <DifferentialMode metadata={metadata} updateMetadata={updateMetadata} sessions={sessions} />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        <MetadataForm metadata={metadata} updateMetadata={updateMetadata} />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        <HelpTip />
      </div>
    </aside>
  );
}
