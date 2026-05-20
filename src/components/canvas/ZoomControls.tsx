import React from 'react';
import { Hand, ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  isPanningMode: boolean;
  togglePanningMode: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomLevel: number;
  onFitToScreen: () => void;
}

export function ZoomControls({
  isPanningMode,
  togglePanningMode,
  zoomIn,
  zoomOut,
  zoomLevel,
  onFitToScreen
}: ZoomControlsProps) {
  return (
    <div className="fixed right-6 bottom-12 flex flex-col gap-2.5 bg-white/90 dark:bg-[#18181B]/95 backdrop-blur-md p-1.5 rounded-xl shadow-xl border border-neutral-200 dark:border-zinc-800 z-10 select-none transition-all duration-300">
      {/* Hand Mode Toggle */}
      <button 
        onClick={togglePanningMode} 
        className={`p-2 rounded-lg transition-all cursor-pointer border
          ${isPanningMode 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400 font-bold' 
            : 'hover:bg-neutral-50 dark:hover:bg-zinc-900 border-transparent text-neutral-500 dark:text-zinc-400 hover:text-neutral-800 dark:hover:text-zinc-200'
          }
        `} 
        title={isPanningMode ? "Modo Mão Ativo (H - clique e arraste para navegar)" : "Ativar Modo Mão (H)"}
      >
        <Hand size={17} />
      </button>
      
      <div className="w-full h-px bg-neutral-200 dark:bg-zinc-800" />
      
      {/* Zoom In */}
      <button 
        onClick={zoomIn} 
        className="p-2 hover:bg-neutral-50 dark:hover:bg-zinc-900 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-zinc-450 dark:hover:text-zinc-250 transition-colors cursor-pointer" 
        title="Aumentar Zoom (+)"
      >
        <ZoomIn size={17} />
      </button>
      
      {/* Zoom Percentage (Click to Fit Screen) */}
      <button 
        onClick={onFitToScreen} 
        className="text-[9px] font-mono font-bold hover:bg-neutral-50 dark:hover:bg-zinc-900 rounded-lg py-1.5 transition-colors text-neutral-500 dark:text-zinc-450 cursor-pointer" 
        title="Ajustar à Tela (0)"
      >
        {Math.round(zoomLevel * 100)}%
      </button>
      
      {/* Zoom Out */}
      <button 
        onClick={zoomOut} 
        className="p-2 hover:bg-neutral-50 dark:hover:bg-zinc-900 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-zinc-450 dark:hover:text-zinc-250 transition-colors cursor-pointer" 
        title="Diminuir Zoom (-)"
      >
        <ZoomOut size={17} />
      </button>
    </div>
  );
}
