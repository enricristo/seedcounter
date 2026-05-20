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
  children
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
      className={`flex-1 bg-neutral-50 dark:bg-[#121214] relative overflow-auto select-none transition-colors duration-300
        ${isPanningMode 
          ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') 
          : ''
        }
      `}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div className="w-fit h-fit min-w-full min-h-full flex items-center justify-center p-8 selection:bg-none">
        {!image ? (
          <EmptyState onBrowseFiles={onBrowseFiles} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
