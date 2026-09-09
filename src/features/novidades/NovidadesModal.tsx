// =============================================================================
// SeedCounter — o que mudou
//
// Aparece sozinha quando a versão avançou, e por vontade quando alguém clica no
// número da versão no rodapé.
//
// A escrita é a parte que importa: cada item diz o que mudou PARA QUEM USA, não
// o que foi commitado. Correções vêm com o sintoma que a pessoa via — "o ponto
// sumia nas digitalizações grandes" diz mais que "corrigido o cálculo do raio".
// =============================================================================

import React from 'react';
import { X, Sparkles, Plus, ArrowUp, Wrench } from 'lucide-react';
import { ROTULOS, VERSOES, type TipoDeMudanca, type Versao } from '../../lib/novidades';

const ICONE: Record<TipoDeMudanca, React.ElementType> = {
  novo: Plus,
  melhorado: ArrowUp,
  corrigido: Wrench,
};

/**
 * A cor de cada tipo.
 *
 * Cromo neutro, nunca a cor do espécime: ciano e magenta significam viável e
 * inviável em toda a interface, e usá-los aqui faria uma nota de versão parecer
 * uma classificação.
 */
const TOM: Record<TipoDeMudanca, string> = {
  novo: 'bg-accent-tint text-accent',
  melhorado: 'bg-surface-2 text-ink-2',
  corrigido: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
};

interface NovidadesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** As versões a mostrar. Vazio = mostra o histórico inteiro. */
  versoes?: Versao[];
}

export function NovidadesModal({ isOpen, onClose, versoes }: NovidadesModalProps) {
  if (!isOpen) return null;
  const lista = versoes?.length ? versoes : VERSOES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-1">
                O que mudou
              </h2>
              <p className="text-[11px] text-ink-3">
                {lista.length === 1
                  ? `Versão ${lista[0].numero}`
                  : `${lista.length} versões`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {lista.map((versao) => (
            <section key={versao.numero} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="font-mono text-sm font-bold text-ink-1">v{versao.numero}</h3>
                {versao.titulo && (
                  <span className="text-[11px] font-semibold text-accent">{versao.titulo}</span>
                )}
                <span className="ml-auto font-mono text-[10px] text-ink-3 tabular-nums">
                  {formatarData(versao.data)}
                </span>
              </div>

              <ul className="space-y-2.5">
                {versao.mudancas.map((m, i) => {
                  const Icone = ICONE[m.tipo];
                  return (
                    <li key={i} className="flex gap-2.5">
                      <span
                        className={`mt-0.5 flex h-4 shrink-0 items-center gap-1 rounded px-1.5 text-[9px] font-bold uppercase tracking-wide ${TOM[m.tipo]}`}
                      >
                        <Icone size={9} />
                        {ROTULOS[m.tipo]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold leading-snug text-ink-1">
                          {m.titulo}
                        </p>
                        {m.detalhe && (
                          <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{m.detalhe}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-line px-5 py-3">
          <p className="text-[10px] text-ink-3">
            O número da versão no rodapé abre esta tela a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
