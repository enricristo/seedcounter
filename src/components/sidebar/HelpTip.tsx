import React, { useState } from 'react';
import { Info, Keyboard, MousePointer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GRUPOS_DE_ATALHOS, INSTRUCOES_DO_MOUSE } from '../../features/ajuda/atalhos';

/**
 * Instruções de uso, na barra lateral.
 *
 * O conteúdo vem de `features/ajuda/atalhos`, que é conferido por teste
 * contra os ganchos de teclado. Este componente só dá forma: um grupo por
 * ferramenta, a tecla dela no título, e um gesto por linha.
 */
export function HelpTip() {
  const [tab, setTab] = useState<'mouse' | 'keyboard'>('mouse');

  return (
    <section className="bg-accent-tint/50 p-4 rounded-xl border border-accent/30">
      <div className="flex gap-2 mb-3 items-center">
        <Info size={16} className="text-accent shrink-0" />
        <span className="text-[11px] font-bold text-accent uppercase tracking-wider">
          Instruções de Uso
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-line/50 p-0.5 rounded-lg mb-3">
        <button
          onClick={() => setTab('mouse')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${
              tab === 'mouse' ? 'bg-surface-1 text-accent shadow-sm' : 'text-ink-3 hover:text-ink-2'
            }
          `}
        >
          <MousePointer size={11} />
          <span>Mouse / Cliques</span>
        </button>
        <button
          onClick={() => setTab('keyboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${
              tab === 'keyboard'
                ? 'bg-surface-1 text-accent shadow-sm'
                : 'text-ink-3 hover:text-ink-2'
            }
          `}
        >
          <Keyboard size={11} />
          <span>Atalhos Teclado</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'mouse' ? (
          <motion.div
            key="mouse"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {INSTRUCOES_DO_MOUSE.map((grupo) => (
              <div key={grupo.titulo}>
                <div className="flex items-center gap-1.5 mb-1">
                  {grupo.tecla && <Tecla>{grupo.tecla}</Tecla>}
                  <span className="text-[10px] font-bold text-ink-1 uppercase tracking-wide">
                    {grupo.titulo}
                  </span>
                </div>
                <ul className="text-[10px] text-ink-2 space-y-0.5 pl-1 font-medium leading-snug">
                  {grupo.instrucoes.map((i) => (
                    <li key={i.gesto} className="flex gap-1.5">
                      <span className="text-accent shrink-0">{i.gesto}:</span>
                      <span>{i.efeito}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="keyboard"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {GRUPOS_DE_ATALHOS.map((grupo) => (
              <div key={grupo.titulo}>
                <div className="text-[10px] font-bold text-ink-1 uppercase tracking-wide mb-1">
                  {grupo.titulo}
                </div>
                <div className="grid grid-cols-1 gap-y-1 text-[10px] font-medium text-ink-2">
                  {grupo.atalhos.map((a) => (
                    <div
                      key={`${a.teclas}-${a.acao}`}
                      className="flex items-start gap-2 bg-surface-2/50 p-1 px-1.5 rounded"
                    >
                      <Tecla>{a.teclas}</Tecla>
                      <div className="min-w-0 flex-1">
                        <span>{a.acao}</span>
                        {a.nota && (
                          <div className="text-[9px] text-ink-3 leading-snug mt-0.5">{a.nota}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Uma tecla como aparece no teclado: monoespaçada, num quadradinho. */
function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="shrink-0 rounded border border-line bg-surface-1 px-1 py-px font-mono text-[9px] font-bold text-ink-3 whitespace-nowrap">
      {children}
    </kbd>
  );
}
