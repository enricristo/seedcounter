import React from 'react';
import { Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useVisibilidade } from '../../features/visualizacao/useModoDeVisualizacao';

/**
 * A primeira tela de quem nunca viu o app — logo depois do perfil.
 *
 * Diz o que abrir (qualquer imagem, não só "foto microscópica"), como (arrastar
 * ou procurar) e, para quem não tem imagem à mão, onde estão os exemplos. É a
 * única tela em que a pessoa está parada sem nada para fazer; por isso ela
 * também é a que mostra a falha de carregamento, quando há uma.
 */
interface EmptyStateProps {
  onBrowseFiles: () => void;
  /** Mensagem da última falha de carregamento, se houve. */
  loadError?: string | null;
}

export function EmptyState({ onBrowseFiles, loadError }: EmptyStateProps) {
  // A dica dos exemplos só vale quando a lateral e a seção existem no modo
  // atual — no modo apresentação, por exemplo, não há lateral para apontar.
  const { visibilidade } = useVisibilidade();
  const exemplosAoLado = visibilidade.lateralEsquerda && visibilidade.exemplos;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-surface-1 border-line rounded-panel m-auto flex w-full max-w-md flex-col items-center gap-6 border p-12 text-center shadow-xl transition-all"
    >
      <div className="bg-surface-2 border-line-soft rounded-panel text-ink-3 flex h-20 w-20 items-center justify-center border shadow-inner">
        <ImageIcon size={38} aria-hidden="true" />
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
        <h2 className="text-ink-1 text-xl font-bold tracking-tight">Abra uma imagem</h2>
        <p className="text-ink-2 text-xs leading-relaxed font-semibold">
          Digitalização, foto de microscópio ou de celular — JPG, PNG ou TIFF, inclusive com várias
          páginas. Arraste e solte aqui, ou procure no computador.
        </p>
        {exemplosAoLado && (
          <p className="text-ink-3 text-[11px] leading-relaxed">
            Sem imagem à mão? Na lateral esquerda, em <strong>Exemplos</strong>, há cenas com
            contagem conhecida e imagens reais de vários datasets — servem para ver o que o app faz
            antes de usar as suas.
          </p>
        )}
      </div>
      <button
        onClick={onBrowseFiles}
        className="bg-accent hover:bg-accent-strong text-accent-on rounded-control cursor-pointer px-6 py-3 text-xs font-bold tracking-wider uppercase transition-all hover:shadow-lg active:scale-95"
      >
        Procurar arquivo
      </button>
    </motion.div>
  );
}
