import React from 'react';
import {
  Sun,
  Moon,
  History,
  Undo2,
  Eraser,
  Save,
  Download,
  Calendar,
  BarChart4,
  Target,
  FlaskConical,
} from 'lucide-react';
import type { AppView } from '../../types';

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  sessionsCount: number;
  openHistory: () => void;
  onUndo: () => void;
  undoDisabled: boolean;
  onReset: () => void;
  resetDisabled: boolean;
  hasImageQueue: boolean;
  currentImageIndex: number;
  imageQueueLength: number;
  onPrevImage: () => void;
  onNextImage: () => void;
  onSaveSession: () => void;
  onExport: () => void;
  hasImage: boolean;

  // Navigation & Feature Flags
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  isLongitudinalEnabled?: boolean;
  isStatsEnabled?: boolean;
  /** Abre o painel visível de funcionalidades (feature flags). */
  onOpenFeatures?: () => void;
}

/**
 * A marca Retículo, inline para acompanhar o tema.
 * O arquivo public/mark.svg tem cores fixas porque favicon não herda tema;
 * aqui o retículo vem do token de acento e a semente da tinta principal.
 */
function MarcaReticulo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="SeedCounter"
      className="shrink-0"
    >
      <circle
        cx="32"
        cy="32"
        r="19"
        stroke="var(--color-accent)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M32 13.8v4.7M32 50.2v-4.7M13.8 32h4.7M50.2 32h-4.7"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx="30"
        cy="34"
        rx="8"
        ry="4.8"
        transform="rotate(-30 30 34)"
        fill="var(--color-ink-1)"
      />
    </svg>
  );
}

/** Botão de ícone da barra: 16px com traço 2, o passo padrão de controle. */
const botaoIcone =
  'rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-2 border p-2 transition-all disabled:pointer-events-none disabled:opacity-30';

/** Botão da fila de imagens: rótulo curto em caixa alta. */
const botaoFila =
  'rounded-control border-line bg-surface-1 text-ink-2 hover:bg-surface-2 hover:text-ink-1 border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-30';

export function Header({
  isDarkMode,
  toggleTheme,
  sessionsCount,
  openHistory,
  onUndo,
  undoDisabled,
  onReset,
  resetDisabled,
  hasImageQueue,
  currentImageIndex,
  imageQueueLength,
  onPrevImage,
  onNextImage,
  onSaveSession,
  onExport,
  hasImage,

  currentView,
  onViewChange,
  isLongitudinalEnabled = true,
  isStatsEnabled = true,
  onOpenFeatures,
}: HeaderProps) {
  const aba = (ativa: boolean) =>
    `rounded-control flex cursor-pointer items-center gap-1.5 px-3 py-1.5 transition-all ${
      ativa
        ? 'bg-surface-1 text-ink-1 shadow-[inset_0_-2px_0_var(--color-accent)]'
        : 'text-ink-3 hover:text-ink-1'
    }`;

  return (
    // Separação por fio de 1px, não por sombra: sombra fica reservada ao que
    // de fato flutua (modais e o controle de zoom).
    <header className="border-line bg-surface-1 z-10 flex h-16 shrink-0 items-center justify-between gap-4 overflow-hidden border-b px-4 xl:px-6">
      <div className="flex min-w-0 items-center gap-4 xl:gap-5">
        {/* Identidade do produto primeiro, credenciais institucionais depois. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <MarcaReticulo />
          <div>
            <h1 className="text-ink-1 text-base leading-tight font-bold tracking-tight whitespace-nowrap">
              Contador de Sementes
            </h1>
            <p className="text-accent hidden text-[9px] font-bold tracking-widest whitespace-nowrap uppercase lg:block">
              Edição Acadêmica •{' '}
              <a
                href="https://www.instagram.com/gpeorq"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                GPEOrq
              </a>
              {' / '}
              <a
                href="https://www.instagram.com/gpsem_2000/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                GPSEM
              </a>{' '}
              • Unoeste
            </p>
          </div>
        </div>

        {/* Navegação entre vistas. A aba ativa é marcada por um fio de acento
            embaixo, não por cor de texto: cor sozinha não carrega estado. */}
        <nav className="bg-surface-2 rounded-panel hidden items-center p-0.5 text-xs font-bold tracking-wider uppercase md:flex">
          <button
            onClick={() => onViewChange('counter')}
            className={aba(currentView === 'counter')}
          >
            <Target size={14} strokeWidth={2.25} aria-hidden="true" />
            <span>Contagem</span>
          </button>

          {isLongitudinalEnabled && (
            <button
              onClick={() => onViewChange('longitudinal')}
              className={aba(currentView === 'longitudinal')}
            >
              <Calendar size={14} strokeWidth={2.25} aria-hidden="true" />
              <span>Longitudinal</span>
            </button>
          )}

          {isStatsEnabled && (
            <button onClick={() => onViewChange('stats')} className={aba(currentView === 'stats')}>
              <BarChart4 size={14} strokeWidth={2.25} aria-hidden="true" />
              <span>Estatísticas</span>
            </button>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className={botaoIcone}
          title="Alternar tema (D)"
          aria-label="Alternar tema"
        >
          {isDarkMode ? (
            <Sun size={16} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Moon size={16} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {onOpenFeatures && (
          <button
            onClick={onOpenFeatures}
            className={`${botaoIcone} hover:border-accent hover:text-accent`}
            title="Funcionalidades e recursos experimentais"
            aria-label="Funcionalidades e recursos experimentais"
          >
            {/* FlaskConical no lugar de Sparkles: o painel é de laboratório,
                não de IA — e Sparkles virou taquigrafia de IA na indústria. */}
            <FlaskConical size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {currentView === 'counter' && (
          <button
            onClick={openHistory}
            className="rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-2 flex items-center gap-2 border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-all"
          >
            <History size={16} strokeWidth={2} aria-hidden="true" />
            <span>Histórico</span>
            <span className="bg-surface-2 text-ink-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
              {sessionsCount}
            </span>
          </button>
        )}

        {currentView === 'counter' && <div className="bg-line mx-1 h-6 w-px" />}

        {currentView === 'counter' && (
          <button
            onClick={onUndo}
            disabled={undoDisabled}
            className={botaoIcone}
            title="Desfazer último ponto (Ctrl+Z)"
            aria-label="Desfazer último ponto"
          >
            <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {currentView === 'counter' && (
          <button
            onClick={onReset}
            disabled={resetDisabled}
            className={`${botaoIcone} hover:text-danger hover:border-danger`}
            title="Limpar a placa atual — pede confirmação"
            aria-label="Limpar a placa atual"
          >
            <Eraser size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {currentView === 'counter' && <div className="bg-line mx-1 h-6 w-px" />}

        {currentView === 'counter' && hasImageQueue && (
          <div className="border-line bg-surface-2 rounded-control mr-1 flex items-center gap-1 border p-1">
            <button
              onClick={onPrevImage}
              disabled={currentImageIndex === 0}
              className={botaoFila}
              title="Voltar imagem (Backspace)"
            >
              Anterior
            </button>
            <div className="text-ink-2 px-2 font-mono text-[11px] font-semibold tabular-nums">
              {currentImageIndex + 1}/{imageQueueLength}
            </div>
            <button
              onClick={onNextImage}
              disabled={currentImageIndex === imageQueueLength - 1}
              className={botaoFila}
              title="Próxima imagem (Espaço)"
            >
              Próxima
            </button>
          </div>
        )}

        {currentView === 'counter' && (
          <button
            onClick={onSaveSession}
            disabled={!hasImage}
            className="rounded-control border-line bg-surface-2 text-ink-2 hover:text-ink-1 hover:bg-surface-1 flex items-center gap-2 border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-all disabled:pointer-events-none disabled:opacity-30"
          >
            <Save size={16} strokeWidth={2} aria-hidden="true" />
            <span>Salvar local</span>
          </button>
        )}

        {/* Única ação primária da barra, e o único uso de fundo de acento. */}
        {currentView === 'counter' && (
          <button
            onClick={onExport}
            disabled={!hasImage}
            className="rounded-control bg-accent text-accent-on hover:bg-accent-strong flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-30"
          >
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            <span>Exportar</span>
          </button>
        )}
      </div>
    </header>
  );
}
