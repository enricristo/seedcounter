import React from 'react';
import { ImageActions } from '../sidebar/ImageActions';
import { Counters } from '../sidebar/Counters';
import { MetadataForm } from '../sidebar/MetadataForm';
import { DifferentialMode } from '../sidebar/DifferentialMode';
import { HelpTip } from '../sidebar/HelpTip';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ExemplosSection } from '../sidebar/ImageActions';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Upload, Database, Ruler, ScanSearch, SlidersHorizontal, ClipboardList } from 'lucide-react';
import type { Metadata, Session } from '../../types';
import type { ExemploReal } from '../../features/demo/exemplos-reais';
import type { PresetDeCena } from '../../lib/synthetic-scene';
import { useVisibilidade } from '../../features/visualizacao/useModoDeVisualizacao';

interface SidebarProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;

  viableCount: number;
  inviableCount: number;
  /** Objetos declarados como não-semente. Zero até alguém classificar. */
  inertesCount?: number;
  /** Contagem por classe do protocolo declarado. Vazio = sem protocolo. */
  porClasse?: { classe: string; rotulo: string; n: number; ehSemente: boolean }[];
  semClasseFina?: number;
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
  /** Recolhida = só um trilho de ícones; cada ícone expande e cai na seção. */
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Abre a identificação normativa (BAS/BASO). Ausente = botão oculto. */
  onAbrirIdentificacao?: () => void;
  /** Abre a aba Datasets do painel direito. Ausente = botão oculto. */
  onAbrirDatasets?: () => void;

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
  inertesCount = 0,
  porClasse,
  semClasseFina,
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
  isCollapsed = false,
  onToggleCollapse,
  onAbrirIdentificacao,
  onAbrirDatasets,
  adjustSlot,
  calibrationSlot,
  detectionSlot,
  calibrationSummary,
  needsCalibration,
  hasImage = false,
  hideCounters = false,
}: SidebarProps) {
  /** Pedidos de abertura por seção (contador); ver CollapsibleSection. */
  const [abrir, setAbrir] = useState<Record<string, number>>({});
  const irPara = (secao: string) => {
    onToggleCollapse?.();
    setAbrir((a) => ({ ...a, [secao]: (a[secao] ?? 0) + 1 }));
    // Depois que a lateral expandiu e a seção abriu.
    setTimeout(() => document.getElementById(secao)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // Quais seções existem é decidido pelo modo de visualização
  // (`features/visualizacao`) — o mesmo que o cabeçalho lê. O trilho recolhido
  // e as seções abertas seguem a MESMA tabela, para que um ícone nunca aponte
  // para uma seção que não está lá.
  const { visibilidade } = useVisibilidade();

  const TRILHO = [
    { secao: 'sec-abrir', rotulo: 'Abrir imagem', icone: <Upload size={20} />, visivel: true },
    { secao: 'sec-exemplos', rotulo: 'Exemplos', icone: <Database size={20} />, visivel: visibilidade.exemplos },
    { secao: 'sec-calibrar', rotulo: 'Calibrar escala', icone: <Ruler size={20} />, visivel: visibilidade.calibrarEscala },
    { secao: 'sec-encontrar', rotulo: 'Encontrar objetos', icone: <ScanSearch size={20} />, visivel: visibilidade.encontrarObjetos },
    { secao: 'sec-preparar', rotulo: 'Preparar imagem', icone: <SlidersHorizontal size={20} />, visivel: visibilidade.prepararImagem },
    { secao: 'sec-amostra', rotulo: 'Identificar amostra', icone: <ClipboardList size={20} />, visivel: visibilidade.identificarAmostra },
  ].filter((t) => t.visivel);

  // O painel inteiro desligado no menu "Exibir": nem o trilho fica.
  if (!visibilidade.lateralEsquerda) return null;

  if (isCollapsed) {
    return (
      <aside className="border-line bg-surface-1 flex w-12 shrink-0 flex-col items-center gap-2 border-r py-3">
        <button
          onClick={onToggleCollapse}
          title="Expandir painel de entrada e preparo"
          aria-label="Expandir painel esquerdo"
          className="border-line bg-surface-2 hover:bg-surface-3 text-ink-2 hover:text-ink-1 rounded-lg border p-1.5 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
        <div className="bg-line my-1 h-px w-6" />
        {TRILHO.map((t) => (
          <button
            key={t.secao}
            onClick={() => irPara(t.secao)}
            title={t.rotulo}
            aria-label={t.rotulo}
            className="text-ink-3 hover:bg-surface-2 hover:text-ink-1 rounded-lg p-2 transition-colors"
          >
            {t.icone}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-80 border-r border-neutral-200 dark:border-zinc-800 bg-surface-1 flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-colors duration-300">
      <div className="flex flex-col p-4 gap-4 min-h-max">
        {/* Cabeçalho com o botão de recolher — espelho do painel direito. */}
        <div className="border-line-soft flex items-center justify-between border-b pb-2">
          <span className="text-ink-2 text-xs font-bold uppercase tracking-wider">Entrada & preparo</span>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Recolher painel esquerdo"
              aria-label="Recolher painel esquerdo"
              className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded p-1 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        {/* Totalizadores (caso não estejam na barra lateral direita) */}
        {!hideCounters && (
          <Counters
            viableCount={viableCount}
            inviableCount={inviableCount}
            inertesCount={inertesCount}
            porClasse={porClasse}
            semClasseFina={semClasseFina}
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

        {/* Sem imagem: uma frase que aponta para as duas portas — abrir ou exemplo. */}
        {!hasImage && (
          <div className="p-3 bg-surface-2 border border-line-soft rounded-xl text-xs space-y-1">
            <div className="font-bold text-accent uppercase tracking-wider text-[10px]">Entrada de amostra</div>
            <div className="text-ink-2 leading-relaxed">
              Carregue uma digitalização, use a câmera, ou abra um exemplo real na caixa abaixo.
            </div>
          </div>
        )}

        {/* 0. Abrir imagem — sempre à vista: é por onde tudo começa. */}
        <div id="sec-abrir" className="scroll-mt-3">
          <ImageActions
            fileInputRef={fileInputRef}
            importInputRef={importInputRef}
            handleFileUpload={handleFileUpload}
            handleImportJSON={handleImportJSON}
            onOpenCamera={onOpenCamera}
            onOpenSplit={onOpenSplit}
            onOpenRoi={onOpenRoi}
            onAbrirDatasets={onAbrirDatasets}
          />
        </div>

        {/* Exemplos numa caixa: aberta quando não há imagem, fechada quando há. */}
        {visibilidade.exemplos && (onCarregarExemplo || onCarregarExemploReal) && (
          <CollapsibleSection
            id="sec-exemplos"
            title="Exemplos"
            summary="3 simulados · reais de 19 datasets"
            icon={<Database size={14} className="text-ink-3" />}
            defaultOpen={!hasImage}
            pedidoDeAbertura={abrir['sec-exemplos']}
          >
            <ExemplosSection
              onCarregarExemplo={onCarregarExemplo}
              exemploCarregando={exemploCarregando}
              onCarregarExemploReal={onCarregarExemploReal}
              exemploRealCarregando={exemploRealCarregando}
            />
          </CollapsibleSection>
        )}

        {/* Etapas: calibrar → encontrar → preparar. */}
        <div className="space-y-2">
          {visibilidade.calibrarEscala && calibrationSlot && (
            <CollapsibleSection
              id="sec-calibrar"
              step={1}
              title="Calibrar escala"
              summary={calibrationSummary}
              attention={needsCalibration && hasImage}
              defaultOpen={needsCalibration && hasImage}
              pedidoDeAbertura={abrir['sec-calibrar']}
            >
              {calibrationSlot}
            </CollapsibleSection>
          )}

          {visibilidade.encontrarObjetos && detectionSlot && (
            <CollapsibleSection id="sec-encontrar" step={2} title="Encontrar objetos" pedidoDeAbertura={abrir['sec-encontrar']}>
              {detectionSlot}
            </CollapsibleSection>
          )}

          {visibilidade.prepararImagem && adjustSlot && (
            <CollapsibleSection id="sec-preparar" step={3} title="Preparar imagem" pedidoDeAbertura={abrir['sec-preparar']}>
              {adjustSlot}
            </CollapsibleSection>
          )}

          {visibilidade.identificarAmostra && (
          <CollapsibleSection
            id="sec-amostra"
            step={4}
            title="Identificar amostra"
            summary={[metadata.amostra?.especieNomeCientifico, metadata.project].filter(Boolean).join(' · ') || undefined}
            defaultOpen={hasImage}
            pedidoDeAbertura={abrir['sec-amostra']}
          >
            <div className="space-y-3">
              <DifferentialMode metadata={metadata} updateMetadata={updateMetadata} sessions={sessions} />
              <MetadataForm metadata={metadata} updateMetadata={updateMetadata} onAbrirIdentificacao={onAbrirIdentificacao} />
            </div>
          </CollapsibleSection>
          )}
        </div>

        <HelpTip />
      </div>
    </aside>
  );
}
