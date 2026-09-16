import React, { createContext, useContext } from 'react';
import type { ToolId } from '../../../hooks/useTools';

export interface CanvasState {
  image: HTMLImageElement;
  zoomLevel: number;
  activeTool: ToolId;
  isPanningMode: boolean;
  umPerPixel?: number;
  toImageCoords: (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => { x: number; y: number } | null;
  naImagem: (px: number) => number;
}

const CanvasContext = createContext<CanvasState | null>(null);

export function CanvasProvider({ value, children }: { value: CanvasState; children: React.ReactNode }) {
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function useCanvasContext() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
}
