import React from 'react';
import { Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface DropZoneProps {
  isVisible: boolean;
}

export function DropZone({ isVisible }: DropZoneProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/80 dark:bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full border-2 border-dashed border-emerald-500/50 rounded-3xl p-12 bg-white dark:bg-zinc-950 text-center flex flex-col items-center gap-6 shadow-2xl"
      >
        <motion.div 
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400"
        >
          <Upload size={36} />
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-zinc-50">Solte para Carregar</h2>
          <p className="text-sm text-neutral-500 dark:text-zinc-400 leading-relaxed font-medium">
            Você pode soltar uma imagem microscópica ou um arquivo JSON de segmentações YOLO (`*_segmentations.json`)
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold uppercase tracking-wider">
          Fila de Lotes Ativa
        </div>
      </motion.div>
    </div>
  );
}
