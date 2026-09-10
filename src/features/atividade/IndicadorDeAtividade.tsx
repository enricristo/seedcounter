// =============================================================================
// SeedCounter — o indicador no rodape
//
// Mostra o que esta em curso. Ponto ANIMADO so enquanto ha atividade: o resto
// do tempo o rodape fica parado, porque um indicador que pisca sem parar cansa
// a vista numa sessao longa e deixa de significar alguma coisa.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ouvirAtividades, type Atividade } from './atividade';

export function IndicadorDeAtividade() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);

  useEffect(() => ouvirAtividades(setAtividades), []);

  if (atividades.length === 0) return null;

  // Mostra a mais recente; se ha mais de uma, diz quantas.
  const atual = atividades[atividades.length - 1];
  const extras = atividades.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-accent flex items-center gap-2 text-[10px] font-bold tracking-wide uppercase"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="bg-accent absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
        <span className="bg-accent relative inline-flex h-2 w-2 rounded-full" />
      </span>
      <span className="truncate">
        {atual.rotulo}
        {atual.progresso !== undefined && (
          <span className="ml-1.5 font-mono tabular-nums">{Math.round(atual.progresso * 100)}%</span>
        )}
        {extras > 0 && <span className="text-ink-3 ml-1.5 normal-case">(+{extras})</span>}
      </span>
    </div>
  );
}
