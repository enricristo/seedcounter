import React from 'react';
import { Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  onBrowseFiles: () => void;
  /** Mensagem da última falha de carregamento, se houve. */
  loadError?: string | null;
}

export function EmptyState({ onBrowseFiles, loadError }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md w-full bg-surface-1 p-12 rounded-3xl shadow-xl shadow-neutral-400/5 dark:shadow-black/50 border border-neutral-200 dark:border-zinc-800 text-center flex flex-col items-center gap-6 m-auto transition-all"
    >
      <div className="w-20 h-20 bg-neutral-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-ink-3 border border-neutral-100 dark:border-zinc-800 shadow-inner">
        <ImageIcon size={38} className="text-neutral-400 dark:text-zinc-500" />
      </div>
      {/* A falha de carregamento vive aqui porque é aqui que o usuário fica
          quando ela acontece: sem imagem, o estado vazio é a tela. Antes disto
          um TIFF simplesmente não abria, sem dizer nada. */}
      {loadError && (
        <div
          role="alert"
          className="border-danger/40 bg-surface-2 rounded-panel flex w-full items-start gap-2.5 border p-3 text-left"
        >
          <span className="text-danger mt-0.5 shrink-0">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="text-ink-2 text-[11px] leading-relaxed">{loadError}</p>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-ink-1">Selecione uma Imagem</h2>
        <p className="text-xs text-neutral-500 dark:text-zinc-400 leading-relaxed font-semibold">
          Carregue a foto microscópica da amostra para iniciar a contagem. Você também pode arrastar
          e soltar imagens diretamente aqui!
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
