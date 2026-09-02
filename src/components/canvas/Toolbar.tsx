// =============================================================================
// SeedCounter — Toolbar
// Barra de ferramentas flutuante (estilo editor gráfico) sobre a imagem.
// =============================================================================

import React from 'react';
import { Circle, XCircle, Eraser, Hand, Ruler } from 'lucide-react';
import { TOOLS, type ToolId } from '../../hooks/useTools';

const ICONS: Record<ToolId, React.ElementType> = {
  viable: Circle,
  inviable: XCircle,
  eraser: Eraser,
  pan: Hand,
};

// Cores alinhadas à convenção do app: viável = vermelho, inviável = amarelo.
const ACTIVE_STYLES: Record<ToolId, string> = {
  viable: 'bg-red-500 border-red-500 text-white',
  inviable: 'bg-amber-500 border-amber-500 text-white',
  eraser: 'bg-rose-600 border-rose-600 text-white',
  pan: 'bg-sky-500 border-sky-500 text-white',
};

interface ToolbarProps {
  activeTool: ToolId;
  onSelect: (tool: ToolId) => void;
  eraserRadius: number;
  onEraserRadiusChange: (radius: number) => void;
  /** true quando a borracha está ativa temporariamente (Alt pressionado). */
  isTemporary?: boolean;
  /** Réguas nas bordas ligadas? */
  showRulers?: boolean;
  onToggleRulers?: () => void;
}

export function Toolbar({
  activeTool,
  onSelect,
  eraserRadius,
  onEraserRadiusChange,
  isTemporary,
  showRulers,
  onToggleRulers,
}: ToolbarProps) {
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 rounded-2xl border border-neutral-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur p-1.5 shadow-xl">
      {TOOLS.map((tool) => {
        const Icon = ICONS[tool.id];
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            title={`${tool.label} (${tool.shortcut.toUpperCase()}) — ${tool.hint}`}
            aria-label={tool.label}
            aria-pressed={isActive}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
              isActive
                ? ACTIVE_STYLES[tool.id]
                : 'border-transparent text-neutral-500 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon size={18} />
            <span className="absolute bottom-0.5 right-1 text-[8px] font-bold opacity-60 uppercase">
              {tool.shortcut}
            </span>
            {isActive && isTemporary && tool.id === 'eraser' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white ring-2 ring-rose-500" />
            )}
          </button>
        );
      })}

      {/* Réguas nas bordas */}
      {onToggleRulers && (
        <button
          onClick={onToggleRulers}
          title="Mostrar/ocultar réguas nas bordas"
          aria-label="Alternar réguas"
          aria-pressed={!!showRulers}
          className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
            showRulers
              ? 'bg-neutral-800 dark:bg-zinc-100 border-neutral-800 dark:border-zinc-100 text-white dark:text-zinc-900'
              : 'border-transparent text-neutral-500 dark:text-zinc-400 hover:bg-neutral-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Ruler size={18} />
        </button>
      )}

      {/* Tamanho da borracha (só aparece quando ela está ativa) */}
      {activeTool === 'eraser' && (
        <div className="pt-1.5 mt-0.5 border-t border-neutral-200 dark:border-zinc-800 space-y-1">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={eraserRadius}
            onChange={(e) => onEraserRadiusChange(Number(e.target.value))}
            title="Tamanho da borracha ( [ e ] )"
            aria-label="Tamanho da borracha"
            className="w-10 accent-rose-500"
            style={{ writingMode: 'vertical-lr' as React.CSSProperties['writingMode'] }}
          />
          <p className="text-[9px] text-center font-mono text-neutral-500 dark:text-zinc-500">
            {eraserRadius}
          </p>
        </div>
      )}
    </div>
  );
}
