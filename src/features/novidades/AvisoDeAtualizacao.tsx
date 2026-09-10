// =============================================================================
// SeedCounter — aviso de versao nova
//
// Aparece quando o service worker baixou um bundle novo. Nao recarrega
// sozinho: recarregar no meio de uma contagem apagaria marcacoes nao salvas.
// A pessoa escolhe quando.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export function AvisoDeAtualizacao() {
  const [pendente, setPendente] = useState(false);

  useEffect(() => {
    const ao = () => setPendente(true);
    window.addEventListener('seedcounter:nova-versao', ao);
    return () => window.removeEventListener('seedcounter:nova-versao', ao);
  }, []);

  if (!pendente) return null;

  return (
    <div
      role="status"
      className="border-accent bg-surface-1 fixed right-4 bottom-16 z-40 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl"
    >
      <RefreshCw size={16} className="text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-ink-1 text-xs font-bold">Nova versão disponível</p>
        <p className="text-ink-3 text-[10px] leading-snug">
          Salve o que estiver fazendo antes de recarregar.
        </p>
      </div>
      <button
        onClick={() => {
          // Importacao dinamica: main.tsx e a raiz, e importa-lo estaticamente
          // de um componente criaria um ciclo.
          import('../../main').then((m) => m.aplicarAtualizacao());
        }}
        className="bg-accent text-accent-on hover:bg-accent-strong shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase"
      >
        Recarregar
      </button>
      <button
        onClick={() => setPendente(false)}
        aria-label="Depois"
        className="text-ink-3 hover:text-ink-1 shrink-0 p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}
