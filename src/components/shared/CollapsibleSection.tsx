// =============================================================================
// SeedCounter — CollapsibleSection
// Seção recolhível para a barra lateral. Mantém a configuração acessível sem
// competir por espaço com o que é usado o tempo todo (os contadores).
// =============================================================================

import React, { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  /** Número da etapa no fluxo de trabalho. */
  step?: number;
  title: string;
  /** Resumo do estado atual, exibido quando fechada (ex.: "7,06 µm/px"). */
  summary?: string;
  icon?: React.ReactNode;
  /** Aberta na primeira renderização. */
  defaultOpen?: boolean;
  /** Destaca a seção quando exige atenção (ex.: sem calibração). */
  attention?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  step,
  title,
  summary,
  icon,
  defaultOpen = false,
  attention = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-zinc-900/60 transition-colors text-left"
      >
        {step !== undefined && (
          <span
            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              attention
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-500 dark:text-zinc-400'
            }`}
          >
            {step}
          </span>
        )}
        {icon && <span className="shrink-0">{icon}</span>}

        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-neutral-700 dark:text-zinc-200 truncate">
            {title}
          </span>
          {summary && !open && (
            <span className="block text-[10px] text-neutral-500 dark:text-zinc-500 truncate">
              {summary}
            </span>
          )}
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-neutral-100 dark:border-zinc-800/60">
          {children}
        </div>
      )}
    </section>
  );
}
