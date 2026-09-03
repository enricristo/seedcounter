import React from 'react';
import { Upload, FolderUp, Camera, Grid3x3, Crosshair } from 'lucide-react';

interface ImageActionsProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Abre a captura por câmera (Fase E). Ausente = botão oculto. */
  onOpenCamera?: () => void;
  /** Divide a digitalização em pedaços (Fase G). Ausente = botão oculto. */
  onOpenSplit?: () => void;
  /** Delimita o campo circular e recorta (Fase G). Ausente = botão oculto. */
  onOpenRoi?: () => void;
}

export function ImageActions({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON,
  onOpenCamera,
  onOpenSplit,
  onOpenRoi,
}: ImageActionsProps) {
  const botao =
    'rounded-panel border-line bg-surface-2 text-ink-2 hover:text-ink-1 hover:border-accent group flex w-full items-center gap-3 border px-4 py-3 font-bold transition-all';
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

        {/* Preparo da imagem (Fase G) — só faz sentido com imagem carregada,
            então o App só passa os callbacks nesse caso. */}
        {(onOpenSplit || onOpenRoi) && (
          <div className="border-line space-y-2 border-t pt-2.5">
            {onOpenSplit && (
              <button onClick={onOpenSplit} className={botao} title="Fatiar a folha do scanner">
                <Grid3x3
                  size={16}
                  strokeWidth={2}
                  className="text-ink-3 group-hover:text-accent transition-colors"
                  aria-hidden="true"
                />
                <span className="text-xs tracking-wide uppercase">Dividir digitalização</span>
              </button>
            )}
            {onOpenRoi && (
              <button onClick={onOpenRoi} className={botao} title="Recortar no campo da ocular">
                <Crosshair
                  size={16}
                  strokeWidth={2}
                  className="text-ink-3 group-hover:text-accent transition-colors"
                  aria-hidden="true"
                />
                <span className="text-xs tracking-wide uppercase">Delimitar campo (ROI)</span>
              </button>
            )}
          </div>
        )}

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
