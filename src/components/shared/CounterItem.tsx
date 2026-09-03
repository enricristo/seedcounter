// =============================================================================
// SeedCounter — CounterItem
// Um totalizador de classe. A contagem é a leitura primária da tela: número em
// Plex Mono com numerais tabulares, para que os dígitos não dancem enquanto o
// técnico marca.
//
// A porcentagem aparece UMA vez. A versão anterior a mostrava duas — numa
// pílula colorida e num número gigante a 6% de opacidade atrás do conteúdo —,
// e o fantasma passava por trás do rótulo e da descrição. A proporção entre as
// duas classes é mostrada por uma barra segmentada em Counters, que é onde ela
// significa alguma coisa: relação entre dois valores é um elemento só.
// =============================================================================

import React from 'react';
import { MousePointer2 } from 'lucide-react';

interface CounterItemProps {
  label: string;
  count: number;
  /** Classe utilitária de fundo do chip da classe (ex.: 'bg-red-500'). */
  color: string;
  description: string;
  percent?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function CounterItem({
  label,
  count,
  color,
  description,
  percent,
  onClick,
  isActive = false,
}: CounterItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-panel group flex w-full items-center gap-3 border p-3 text-left transition-all ${
        isActive
          ? 'border-accent bg-accent-tint'
          : 'border-line bg-surface-1 hover:border-ink-3 hover:bg-surface-2'
      }`}
    >
      <span
        className={`rounded-control flex h-8 w-8 shrink-0 items-center justify-center text-white ${color}`}
      >
        <MousePointer2 size={14} strokeWidth={2.25} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-ink-1 block text-xs leading-tight font-bold">{label}</span>
        <span className="text-ink-3 block text-[10px] leading-tight">{description}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className="text-ink-1 block font-mono text-xl leading-none font-semibold tracking-tight tabular-nums">
          {count}
        </span>
        {percent && (
          <span className="text-ink-3 mt-1 block font-mono text-[10px] tabular-nums">
            {percent}%
          </span>
        )}
      </span>
    </button>
  );
}
