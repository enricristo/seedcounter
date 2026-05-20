import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  onBrowseFiles: () => void;
}

export function EmptyState({ onBrowseFiles }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md w-full bg-white dark:bg-[#18181B] p-12 rounded-3xl shadow-xl shadow-neutral-400/5 dark:shadow-black/50 border border-neutral-200 dark:border-zinc-800 text-center flex flex-col items-center gap-6 m-auto transition-all"
    >
      <div className="w-20 h-20 bg-neutral-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-neutral-300 dark:text-zinc-650 border border-neutral-100 dark:border-zinc-800 shadow-inner">
        <ImageIcon size={38} className="text-neutral-400 dark:text-zinc-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-zinc-105">
          Selecione uma Imagem
        </h2>
        <p className="text-xs text-neutral-500 dark:text-zinc-400 leading-relaxed font-semibold">
          Carregue a foto microscópica da amostra para iniciar a contagem. Você também pode arrastar e soltar imagens diretamente aqui!
        </p>
      </div>
      <button 
        onClick={onBrowseFiles}
        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-bold text-xs uppercase tracking-wider active:scale-95 cursor-pointer"
      >
        Procurar Arquivo
      </button>
    </motion.div>
  );
}
