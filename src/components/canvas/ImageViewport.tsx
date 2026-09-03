import React from 'react';
import { EmptyState } from './EmptyState';

interface ViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  image: HTMLImageElement | null;
  onBrowseFiles: () => void;
  isPanningMode: boolean;
  isDragging: boolean;
  startDrag: (e: React.MouseEvent, container: HTMLDivElement | null) => void;
  handleDrag: (e: React.MouseEvent, container: HTMLDivElement | null) => void;
  stopDrag: () => void;
  children: React.ReactNode;
}

export function ImageViewport({
  containerRef,
  image,
  onBrowseFiles,
  isPanningMode,
  isDragging,
  startDrag,
  handleDrag,
  stopDrag,
  children,
}: ViewportProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    startDrag(e, containerRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDrag(e, containerRef.current);
  };

  return (
    <div
      ref={containerRef}
      // O palco so existe quando ha especime sobre ele. Com imagem carregada o
      // entorno vai para --color-stage, que tem lightness FIXA nos dois temas:
      // contraste simultaneo faz um entorno que muda de claridade alterar a
      // tonalidade percebida da amostra, e a comparacao entre sessoes deixa de
      // valer. Sem imagem, o fundo volta a ser cromo comum.
      className={`relative flex-1 overflow-auto select-none ${image ? 'bg-stage' : 'bg-surface-0'}
        ${isPanningMode ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}
      `}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div className="w-fit h-fit min-w-full min-h-full flex items-center justify-center p-8 selection:bg-none">
        {!image ? <EmptyState onBrowseFiles={onBrowseFiles} /> : children}
      </div>
    </div>
  );
}
