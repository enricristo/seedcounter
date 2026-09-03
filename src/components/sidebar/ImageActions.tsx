import React from 'react';
import { Upload, FolderUp, Camera } from 'lucide-react';

interface ImageActionsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Abre a captura por câmera (Fase E). Ausente = botão oculto. */
  onOpenCamera?: () => void;
}

export function ImageActions({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON,
  onOpenCamera,
}: ImageActionsProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
          Ações & Arquivos
        </h3>
      </div>
      <div className="space-y-2">
        {/* Load Image Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-2 rounded-xl border border-line hover:border-line transition-all text-ink-2 hover:text-ink-1 font-bold group"
        >
          <Upload size={17} className="text-ink-3 group-hover:text-ink-2 transition-colors" />
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

        {/* Camera Capture Button (Fase E) */}
        {onOpenCamera && (
          <button
            onClick={onOpenCamera}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-2 rounded-xl border border-line hover:border-line transition-all text-ink-2 hover:text-ink-1 font-bold group"
          >
            <Camera size={17} className="text-ink-3 group-hover:text-ink-2 transition-colors" />
            <span className="text-xs uppercase tracking-wide">Capturar da Câmera</span>
          </button>
        )}

        {/* Import Session Button */}
        <button
          onClick={() => importInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-2 rounded-xl border border-line hover:border-line transition-all text-ink-2 hover:text-ink-1 font-bold group"
        >
          <FolderUp size={17} className="text-ink-3 group-hover:text-ink-2 transition-colors" />
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
