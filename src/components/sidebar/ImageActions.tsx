import React from 'react';
import { Upload, FolderUp } from 'lucide-react';

interface ImageActionsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImageActions({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON
}: ImageActionsProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
          Ações & Arquivos
        </h3>
      </div>
      <div className="space-y-2">
        {/* Load Image Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-xl border border-neutral-200 dark:border-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-700 transition-all text-neutral-700 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-zinc-50 font-bold group"
        >
          <Upload size={17} className="text-neutral-400 dark:text-zinc-500 group-hover:text-neutral-600 dark:group-hover:text-zinc-300 transition-colors" />
          <span className="text-xs uppercase tracking-wide">Carregar Amostras</span>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*" 
          multiple
          className="hidden" 
        />

        {/* Import Session Button */}
        <button 
          onClick={() => importInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 dark:bg-zinc-900 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-xl border border-neutral-200 dark:border-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-700 transition-all text-neutral-700 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-zinc-50 font-bold group"
        >
          <FolderUp size={17} className="text-neutral-400 dark:text-zinc-500 group-hover:text-neutral-600 dark:group-hover:text-zinc-300 transition-colors" />
          <span className="text-xs uppercase tracking-wide">Importar Sessão (JSON)</span>
        </button>
        <input 
          type="file" 
          ref={importInputRef} 
          onChange={handleImportJSON} 
          accept="application/json,.json" 
          className="hidden" 
        />
      </div>
    </section>
  );
}
