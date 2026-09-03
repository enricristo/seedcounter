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
  onFitToScreen,
}: ZoomControlsProps) {
  const botao =
    'rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1 cursor-pointer p-2 transition-colors';

  return (
    // Um dos dois únicos elementos que de fato flutuam sobre o conteúdo — o
    // outro são os modais. Por isso mantém sombra, enquanto o resto do cromo
    // separa por fio de 1px.
    <div className="bg-surface-1/95 border-line rounded-panel z-10 fixed right-6 bottom-12 flex select-none flex-col gap-2 border p-1.5 shadow-xl backdrop-blur-md">
      <button
        onClick={togglePanningMode}
        aria-pressed={isPanningMode}
        className={`rounded-control cursor-pointer border p-2 transition-all ${
          isPanningMode
            ? 'bg-accent-tint border-accent text-accent'
            : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1 border-transparent'
        }`}
        title={
          isPanningMode
            ? 'Modo mão ativo (H — clique e arraste para navegar)'
            : 'Ativar modo mão (H)'
        }
        aria-label="Modo mão"
      >
        <Hand size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="bg-line h-px w-full" />

      <button
        onClick={zoomIn}
        className={botao}
        title="Aumentar zoom (+)"
        aria-label="Aumentar zoom"
      >
        <ZoomIn size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      <button
        onClick={onFitToScreen}
        className="rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1 cursor-pointer py-1.5 font-mono text-[10px] font-semibold tabular-nums transition-colors"
        title="Ajustar à tela (0)"
        aria-label="Ajustar à tela"
      >
        {Math.round(zoomLevel * 100)}%
      </button>

      <button
        onClick={zoomOut}
        className={botao}
        title="Diminuir zoom (−)"
        aria-label="Diminuir zoom"
      >
        <ZoomOut size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
