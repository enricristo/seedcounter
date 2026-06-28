import React from 'react';
import { 
  Sun, 
  Moon, 
  History, 
  Undo2, 
  RotateCcw, 
  Save, 
  Download,
  Calendar,
  BarChart4,
  Activity
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
}

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
  isStatsEnabled = true
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-neutral-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex items-center justify-between px-6 shrink-0 z-10 shadow-sm transition-all duration-300">
      {/* Brand Logo & Info */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg border border-neutral-100 dark:border-zinc-800 shadow-sm flex items-center justify-center">
            <img 
              src="/gpeorq.jpg" 
              alt="GPEOrq Logo" 
              className="h-9 w-9 object-contain mix-blend-multiply" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
            />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-tight text-neutral-800 dark:text-zinc-50">
              Contador de Sementes
            </h1>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-450 uppercase tracking-widest font-bold">
              Edição Acadêmica • <a href="https://www.instagram.com/gpeorq" target="_blank" rel="noopener noreferrer" className="hover:underline">GPEOrq</a> / Unoeste
            </p>
          </div>
        </div>

        {/* View Navigation Tabs */}
        <nav className="hidden md:flex items-center bg-neutral-100 dark:bg-zinc-900 rounded-xl p-0.5 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => onViewChange('counter')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              currentView === 'counter'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
            }`}
          >
            <Activity size={13} />
            <span>Contagem</span>
          </button>

          {isLongitudinalEnabled && (
            <button
              onClick={() => onViewChange('longitudinal')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'longitudinal'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
              }`}
            >
              <Calendar size={13} />
              <span>Longitudinal</span>
            </button>
          )}

          {isStatsEnabled && (
            <button
              onClick={() => onViewChange('stats')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'stats'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
              }`}
            >
              <BarChart4 size={13} />
              <span>Estatísticas</span>
            </button>
          )}
        </nav>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 border border-neutral-200 hover:border-neutral-300 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-900 text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-50 rounded-lg transition-all"
          title="Alternar Tema (D)"
        >
          {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        
        {/* History Modal Trigger */}
        {currentView === 'counter' && (
          <button 
            onClick={openHistory}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-neutral-600 dark:text-zinc-300 hover:text-neutral-900 dark:hover:text-zinc-50 hover:bg-neutral-50 dark:hover:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-lg transition-all"
          >
            <History size={17} />
            <span>Histórico</span>
            <span className="bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {sessionsCount}
            </span>
          </button>
        )}
        
        {currentView === 'counter' && <div className="w-[1px] h-6 bg-neutral-200 dark:bg-zinc-800 mx-1" />}

        {/* Undo Mark */}
        {currentView === 'counter' && (
          <button 
            onClick={onUndo}
            disabled={undoDisabled}
            className="p-2 border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-900 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none text-neutral-600 dark:text-zinc-300 hover:text-neutral-950 dark:hover:text-white"
            title="Desfazer Último Ponto (Ctrl+Z)"
          >
            <Undo2 size={17} />
          </button>
        )}

        {/* Reset All Marks */}
        {currentView === 'counter' && (
          <button 
            onClick={onReset}
            disabled={resetDisabled}
            className="p-2 border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-900 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none text-neutral-600 dark:text-zinc-300 hover:text-red-500 dark:hover:text-red-400"
            title="Limpar Marcações"
          >
            <RotateCcw size={17} />
          </button>
        )}
        
        {currentView === 'counter' && <div className="w-[1px] h-6 bg-neutral-200 dark:bg-zinc-800 mx-1" />}

        {/* Multi-Image Queue Controls */}
        {currentView === 'counter' && hasImageQueue && (
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-zinc-900/50 border border-neutral-200 dark:border-zinc-800 rounded-lg p-1 mr-1">
            <button 
              onClick={onPrevImage}
              disabled={currentImageIndex === 0}
              className="p-1 px-2.5 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-850 rounded text-neutral-600 dark:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none text-[10px] font-bold uppercase tracking-wider transition-all"
              title="Voltar Imagem (Backspace)"
            >
              Anterior
            </button>
            <div className="text-[10px] font-bold font-mono text-neutral-500 dark:text-zinc-400 px-2">
              {currentImageIndex + 1}/{imageQueueLength}
            </div>
            <button 
              onClick={onNextImage}
              disabled={currentImageIndex === imageQueueLength - 1}
              className="p-1 px-2.5 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-850 rounded text-neutral-600 dark:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none text-[10px] font-bold uppercase tracking-wider transition-all"
              title="Próxima Imagem (Espaço)"
            >
              Próxima
            </button>
          </div>
        )}

        {/* Save Session */}
        {currentView === 'counter' && (
          <button 
            onClick={onSaveSession}
            disabled={!hasImage}
            className="flex items-center gap-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-neutral-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-neutral-700 dark:text-zinc-200 transition-all disabled:opacity-30 disabled:pointer-events-none font-semibold text-xs uppercase tracking-wide"
          >
            <Save size={14} />
            <span>Salvar Local</span>
          </button>
        )}

        {/* Export Modal Trigger */}
        {currentView === 'counter' && (
          <button 
            onClick={onExport}
            disabled={!hasImage}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none font-bold text-xs uppercase tracking-wider"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
        )}
      </div>
    </header>
  );
}
