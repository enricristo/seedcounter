import React, { useState } from 'react';
import { Info, Keyboard, MousePointer, Route, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GRUPOS_DE_ATALHOS, INSTRUCOES_DO_MOUSE, FLUXO_DE_TRABALHO } from '../../features/ajuda/atalhos';
import { TAREFAS } from '../../features/ajuda/tarefas';
import { Fluxograma } from './Fluxograma';

/**
 * Instruções de uso, na barra lateral.
 *
 * O conteúdo vem de `features/ajuda/atalhos`, que é conferido por teste
 * contra os ganchos de teclado. Este componente só dá forma: um grupo por
 * ferramenta, a tecla dela no título, e um gesto por linha.
 */
export function HelpTip() {
  const [tab, setTab] = useState<'fluxo' | 'tarefas' | 'mouse' | 'keyboard'>('fluxo');
  const [tarefaAberta, setTarefaAberta] = useState<string | null>(null);
  const [formaDoFluxo, setFormaDoFluxo] = useState<'diagrama' | 'lista'>('diagrama');

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
          onClick={() => setTab('fluxo')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${tab === 'fluxo' ? 'bg-surface-1 text-accent shadow-sm' : 'text-ink-3 hover:text-ink-2'}
          `}
        >
          <Route size={11} />
          <span>Fluxo</span>
        </button>
        <button
          onClick={() => setTab('tarefas')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${tab === 'tarefas' ? 'bg-surface-1 text-accent shadow-sm' : 'text-ink-3 hover:text-ink-2'}
          `}
        >
          <ListChecks size={11} />
          <span>Tarefas</span>
        </button>
        <button
          onClick={() => setTab('mouse')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${
              tab === 'mouse' ? 'bg-surface-1 text-accent shadow-sm' : 'text-ink-3 hover:text-ink-2'
            }
          `}
        >
          <MousePointer size={11} />
          <span>Mouse</span>
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
          <span>Teclado</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'tarefas' ? (
          /* Por tarefa, com o porquê: a metade "sem PDF ao lado" do critério
             de pronto. Cada item abre sozinho; um por vez, para a lateral
             estreita não virar uma parede de texto. */
          <motion.ul
            key="tarefas"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-1.5"
          >
            {TAREFAS.map((t) => {
              const aberta = tarefaAberta === t.id;
              return (
                <li key={t.id} className="border-line-soft bg-surface-1/60 rounded-control border">
                  <button
                    type="button"
                    onClick={() => setTarefaAberta(aberta ? null : t.id)}
                    aria-expanded={aberta}
                    className="text-ink-1 hover:text-accent flex w-full cursor-pointer items-start justify-between gap-2 px-2 py-1.5 text-left text-[11px] font-semibold"
                  >
                    <span>{t.titulo}</span>
                    <span className="text-ink-3 shrink-0 text-[10px]">{aberta ? '−' : '+'}</span>
                  </button>
                  {aberta && (
                    <div className="space-y-1.5 px-2 pb-2">
                      <p className="text-ink-3 text-[10px] italic">{t.pergunta}</p>
                      <p className="text-ink-2 text-[10px] leading-snug">{t.porque}</p>
                      <ol className="text-ink-1 list-decimal space-y-0.5 pl-4 text-[10px] leading-snug">
                        {t.passos.map((p, i) => (
                          <li key={i}>
                            {p.faca}
                            {p.onde && <span className="text-ink-3"> — {p.onde}</span>}
                          </li>
                        ))}
                      </ol>
                      <p className="text-accent text-[10px] leading-snug">
                        <span className="font-bold uppercase tracking-wide">Confira: </span>
                        {t.confira}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </motion.ul>
        ) : tab === 'fluxo' ? (
          <motion.ol
            key="fluxo"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="space-y-2"
          >
            <li className="flex justify-end gap-1" aria-label="Forma do fluxo">
              {(['diagrama', 'lista'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormaDoFluxo(f)}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${formaDoFluxo === f ? 'bg-surface-1 text-accent' : 'text-ink-3 hover:text-ink-2'}`}
                >
                  {f}
                </button>
              ))}
            </li>
            {formaDoFluxo === 'diagrama' && (
              <li>
                <Fluxograma />
              </li>
            )}
            {formaDoFluxo === 'lista' && FLUXO_DE_TRABALHO.map((p, i) => (
              <li key={p.titulo} className="flex gap-2">
                <span className="bg-surface-1 text-accent border-accent/40 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 text-[10px]">
                  <div className="text-ink-1 font-bold uppercase tracking-wide">{p.titulo}</div>
                  <div className="text-ink-2 leading-snug">{p.como}</div>
                  <div className="text-ink-3 mt-0.5 text-[9px] leading-snug">{p.onde}</div>
                </div>
              </li>
            ))}
          </motion.ol>
        ) : tab === 'mouse' ? (
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
