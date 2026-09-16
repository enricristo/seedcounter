import React from 'react';
import { ImageActions } from '../sidebar/ImageActions';
import { Counters } from '../sidebar/Counters';
import { MetadataForm } from '../sidebar/MetadataForm';
import { DifferentialMode } from '../sidebar/DifferentialMode';
import { HelpTip } from '../sidebar/HelpTip';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import type { Metadata, Session } from '../../types';
import type { ExemploReal } from '../../features/demo/exemplos-reais';
import type { PresetDeCena } from '../../lib/synthetic-scene';

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
  onOpenSplit?: () => void;
  onOpenRoi?: () => void;
  onCarregarExemplo?: (preset: PresetDeCena) => void;
  exemploCarregando?: PresetDeCena | null;
  onCarregarExemploReal?: (e: ExemploReal) => void;
  exemploRealCarregando?: string | null;
  /** Abre a identificação normativa (BAS/BASO). Ausente = botão oculto. */
  onAbrirIdentificacao?: () => void;

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
  /** Indica se há imagem carregada no momento. */
  hasImage?: boolean;
  /** Oculta totalizadores na barra esquerda (quando exibidos na barra direita). */
  hideCounters?: boolean;
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
  onOpenSplit,
  onOpenRoi,
  onCarregarExemplo,
  exemploCarregando,
  onCarregarExemploReal,
  exemploRealCarregando,
  onAbrirIdentificacao,
  adjustSlot,
  calibrationSlot,
  detectionSlot,
  calibrationSummary,
  needsCalibration,
  hasImage = false,
  hideCounters = false,
}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="flex flex-col p-4 gap-4 min-h-max">
        {/* Totalizadores (caso não estejam na barra lateral direita) */}
        {!hideCounters && (
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
        )}

        {/* Mensagem de boas-vindas / início de fluxo quando sem imagem */}
        {!hasImage && (
          <div className="p-3 bg-surface-2 border border-line-soft rounded-xl text-xs space-y-1">
            <div className="font-bold text-accent uppercase tracking-wider text-[10px]">
              Entrada de Amostra
            </div>
            <div className="text-ink-2 leading-relaxed">
              Carregue uma imagem de scanner, use a câmera ou selecione uma amostra de teste abaixo.
            </div>
          </div>
        )}

        {/* Entrada de imagem */}
        <ImageActions
          fileInputRef={fileInputRef}
          importInputRef={importInputRef}
          handleFileUpload={handleFileUpload}
          handleImportJSON={handleImportJSON}
          onOpenCamera={onOpenCamera}
          onOpenSplit={onOpenSplit}
          onOpenRoi={onOpenRoi}
          onCarregarExemplo={onCarregarExemplo}
          exemploCarregando={exemploCarregando}
          onCarregarExemploReal={onCarregarExemploReal}
          exemploRealCarregando={exemploRealCarregando}
        />

        {/* Etapas de preparo e calibração: Calibração -> Detecção -> Ajuste de Imagem */}
        <div className="space-y-2">
          {calibrationSlot && (
            <CollapsibleSection
              step={1}
              title="Calibrar escala"
              summary={calibrationSummary}
              attention={needsCalibration && hasImage}
              defaultOpen={needsCalibration && hasImage}
            >
              {calibrationSlot}
            </CollapsibleSection>
          )}

          {detectionSlot && (
            <CollapsibleSection step={2} title="Detectar automaticamente">
              {detectionSlot}
            </CollapsibleSection>
          )}

          {adjustSlot && (
            <CollapsibleSection step={3} title="Preparar imagem">
              {adjustSlot}
            </CollapsibleSection>
          )}
        </div>

        <hr className="border-neutral-100 dark:border-zinc-800" />

        {/* Contexto da amostra */}
        <DifferentialMode metadata={metadata} updateMetadata={updateMetadata} sessions={sessions} />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        <MetadataForm
          metadata={metadata}
          updateMetadata={updateMetadata}
          onAbrirIdentificacao={onAbrirIdentificacao}
        />

        <hr className="border-neutral-100 dark:border-zinc-800" />

        <HelpTip />
      </div>
    </aside>
  );
}
