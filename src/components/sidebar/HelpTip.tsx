import React, { useState } from 'react';
import { Info, Keyboard, MousePointer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
            className="space-y-1.5"
          >
            <ul className="text-[10px] text-ink-2 space-y-1 pl-3.5 list-disc font-medium">
              <li>
                <strong className="text-accent">Clique Esquerdo:</strong> Adiciona semente na classe
                da ferramenta ativa
              </li>
              <li>
                <strong className="text-accent">Shift / Ctrl + Clique:</strong> Adiciona na classe
                oposta
              </li>
              <li>
                <strong className="text-accent">Clique Direito:</strong> Adiciona na classe oposta
              </li>
              <li>
                <strong className="text-accent">Shift / Alt + Clique numa marcação:</strong> Apaga
                aquela marcação
              </li>
              <li>
                <strong className="text-accent">Scroll do Mouse:</strong> Zoom na posição do cursor
              </li>
              <li>
                <strong className="text-accent">Borracha + arrastar:</strong> Apaga tudo dentro do
                círculo
              </li>
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="keyboard"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-medium text-ink-2 pl-1"
          >
            <div className="flex justify-between items-center bg-red-100/60 dark:bg-red-950/20 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">V</span>
              <span>Marcar Viável</span>
            </div>
            <div className="flex justify-between items-center bg-amber-100/60 dark:bg-amber-950/20 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">I</span>
              <span>Marcar Inviável</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">X</span>
              <span>Inverter Classe</span>
            </div>
            <div className="flex justify-between items-center bg-rose-100/60 dark:bg-rose-950/20 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">E</span>
              <span>Borracha</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">Alt</span>
              <span>Borracha temporária</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">[ ]</span>
              <span>Tamanho da borracha</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">1</span>
              <span>Visualizar Pontos</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">2</span>
              <span>Visualizar Índices</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">H</span>
              <span>Modo Mão (Pan)</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">Ctrl + Z</span>
              <span>Desfazer Ponto</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">+ / -</span>
              <span>Zoom In / Out</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">0</span>
              <span>Ajustar à Tela</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">Espaço</span>
              <span>Próxima Foto</span>
            </div>
            <div className="flex justify-between items-center bg-surface-2/50 p-1 px-1.5 rounded">
              <span className="text-ink-3 font-bold font-mono">D</span>
              <span>Tema Dark</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
