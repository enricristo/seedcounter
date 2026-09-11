import React from 'react';
import { Upload, Camera, Grid3x3, Crosshair, Sparkles } from 'lucide-react';
// Do módulo específico, NÃO do barril: o barril reexporta o DemoDataPanel, que
// puxa o demo-store e com ele o Dexie para dentro da barra lateral.
import { EXEMPLOS } from '../../features/demo/exemplos';
import type { PresetDeCena } from '../../lib/synthetic-scene';

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
  /** Carrega uma cena de exemplo simulada. Ausente = seção oculta. */
  onCarregarExemplo?: (preset: PresetDeCena) => void;
  /** Preset sendo gerado no momento, para desabilitar os botões. */
  exemploCarregando?: PresetDeCena | null;
}

export function ImageActions({
  fileInputRef,
  importInputRef,
  handleFileUpload,
  handleImportJSON,
  onOpenCamera,
  onOpenSplit,
  onOpenRoi,
  onCarregarExemplo,
  exemploCarregando,
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

        {/* O botao de importar sessao subiu para o cabecalho, junto de Salvar e
            Exportar — e I/O de sessao, nao de imagem. O input escondido fica
            aqui porque e quem tem a ref; o cabecalho so dispara o clique. */}
        <input
          type="file"
          ref={importInputRef}
          onChange={handleImportJSON}
          accept="application/json,.json"
          className="hidden"
        />

        {/* Exemplos simulados — para o app não abrir vazio para quem chega
            sem imagem. O aviso fica visível, não escondido atrás do clique. */}
        {onCarregarExemplo && (
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-ink-3" />
              <span className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
                Exemplos simulados
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {EXEMPLOS.map((e) => (
                <button
                  key={e.preset}
                  onClick={() => onCarregarExemplo(e.preset)}
                  disabled={!!exemploCarregando}
                  title={e.dica}
                  className="rounded-control border border-line bg-surface-2 px-2 py-2 text-[10px] font-bold text-ink-2 hover:border-accent hover:text-ink-1 disabled:opacity-50 transition-all"
                >
                  {exemploCarregando === e.preset ? '…' : e.rotulo}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-ink-3 leading-snug">
              Cenas desenhadas por código, não digitalizações. A contagem verdadeira é conhecida —
              serve para comparar o que o app encontra.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
