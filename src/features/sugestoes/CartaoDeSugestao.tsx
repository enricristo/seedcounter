// =============================================================================
// SeedCounter — o cartão de sugestão
//
// Discreto de propósito: canto inferior direito, abaixo de qualquer modal
// (z-40), largura curta. A sugestão é a de maior prioridade que `sugerir`
// escolheu — este componente não decide QUAL mostrar, só COMO mostrar uma.
//
// CROMO, NUNCA ESPÉCIME.
//
// Ciano e magenta (as cores de viável/inviável) significam isso na interface
// inteira. Um cartão de sugestão nessas cores pareceria uma anotação sobre a
// semente, não uma dica sobre o fluxo de trabalho — por isso só os tokens de
// cromo (surface/ink/accent/line) aparecem aqui.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { AcaoDeSugestao, Sugestao } from './regras';

interface CartaoDeSugestaoProps {
  sugestao: Sugestao | null;
  onAcao: (id: AcaoDeSugestao) => void;
  onDispensar: (s: Sugestao) => void;
}

export function CartaoDeSugestao({ sugestao, onAcao, onDispensar }: CartaoDeSugestaoProps) {
  // Começa escondido e sobe para visível um quadro depois de montar, para que
  // a transição tenha um estado inicial diferente do final. Sem isto o
  // navegador aplicaria opacity-100 direto, sem nada para animar. Quem prefere
  // menos movimento nem percebe a diferença: `motion-reduce:` zera a
  // transição, e a troca de opacidade vira instantânea.
  const [visivel, setVisivel] = useState(false);
  // Guarda o id da última sugestão animada, para reanimar só quando ela MUDA
  // — não a cada re-render de App.tsx com a mesma sugestão de sempre.
  const ultimoId = useRef<string | null>(null);

  useEffect(() => {
    if (!sugestao) {
      ultimoId.current = null;
      setVisivel(false);
      return;
    }
    if (sugestao.id === ultimoId.current) return;
    ultimoId.current = sugestao.id;
    setVisivel(false);
    const quadro = requestAnimationFrame(() => setVisivel(true));
    return () => cancelAnimationFrame(quadro);
  }, [sugestao]);

  if (!sugestao) return null;

  return (
    <div
      key={sugestao.id}
      role="status"
      aria-live="polite"
      className={[
        'fixed bottom-16 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)]',
        'rounded-xl border border-line bg-surface-1 p-4 shadow-xl',
        'transition-all duration-300 ease-out motion-reduce:transition-none',
        visivel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink-1">{sugestao.titulo}</p>
          <p className="mt-1 text-[12px] leading-snug text-ink-2">{sugestao.texto}</p>

          <div className="mt-3 flex items-center gap-2">
            {sugestao.acao && (
              <button
                type="button"
                onClick={() => onAcao(sugestao.acao!.id)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-accent-on transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {sugestao.acao.rotulo}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDispensar(sugestao)}
              className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
