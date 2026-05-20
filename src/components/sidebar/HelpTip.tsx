import React, { useState } from 'react';
import { Info, Keyboard, MousePointer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function HelpTip() {
  const [tab, setTab] = useState<'mouse' | 'keyboard'>('mouse');

  return (
    <section className="bg-blue-50/50 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
      <div className="flex gap-2 mb-3 items-center">
        <Info size={16} className="text-blue-500 shrink-0" />
        <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
          Instruções de Uso
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-200/50 dark:bg-zinc-900/60 p-0.5 rounded-lg mb-3">
        <button
          onClick={() => setTab('mouse')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${tab === 'mouse' 
              ? 'bg-white dark:bg-zinc-850 text-blue-700 dark:text-blue-450 shadow-sm' 
              : 'text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200'
            }
          `}
        >
          <MousePointer size={11} />
          <span>Mouse / Cliques</span>
        </button>
        <button
          onClick={() => setTab('keyboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer
            ${tab === 'keyboard' 
              ? 'bg-white dark:bg-zinc-850 text-blue-700 dark:text-blue-450 shadow-sm' 
              : 'text-neutral-500 dark:text-zinc-400 hover:text-neutral-700 dark:hover:text-zinc-200'
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
            <ul className="text-[10px] text-neutral-600 dark:text-zinc-300 space-y-1 pl-3.5 list-disc font-medium">
              <li><strong className="text-blue-800 dark:text-blue-400">Clique Esquerdo:</strong> Adiciona semente Viável (Vermelho)</li>
              <li><strong className="text-blue-800 dark:text-blue-400">Shift + Clique / Ctrl + Clique:</strong> Adiciona semente Inviável (Amarelo)</li>
              <li><strong className="text-blue-800 dark:text-blue-400">Clique Direito:</strong> Adiciona semente Inviável (Amarelo)</li>
              <li><strong className="text-blue-800 dark:text-blue-400">Scroll do Mouse:</strong> Ajusta o Zoom na posição do cursor</li>
              <li><strong className="text-blue-800 dark:text-blue-400">Arraste de Botão do Meio (Scroll):</strong> Panning/Movimentação da imagem</li>
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="keyboard"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-medium text-neutral-600 dark:text-zinc-300 pl-1"
          >
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">1</span>
              <span>Visualizar Pontos</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">2</span>
              <span>Visualizar Índices</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">H</span>
              <span>Modo Mão (Pan)</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">Ctrl + Z</span>
              <span>Desfazer Ponto</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">+ / -</span>
              <span>Zoom In / Out</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">0</span>
              <span>Ajustar à Tela</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">Espaço</span>
              <span>Próxima Foto</span>
            </div>
            <div className="flex justify-between items-center bg-neutral-100/50 dark:bg-zinc-900/30 p-1 px-1.5 rounded">
              <span className="text-neutral-400 dark:text-zinc-500 font-bold font-mono">D</span>
              <span>Tema Dark</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
