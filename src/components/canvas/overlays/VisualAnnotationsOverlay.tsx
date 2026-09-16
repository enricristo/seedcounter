import React, { useState } from 'react';
import { useCanvasContext } from './CanvasContext';
import { ESPECIME } from '../../../theme/specimen';
import type { AnotacaoVisual } from '../../../types';

interface VisualAnnotationsOverlayProps {
  onAddAnotacaoVisual: (anotacao: AnotacaoVisual) => void;
}

export function VisualAnnotationsOverlay({ onAddAnotacaoVisual }: VisualAnnotationsOverlayProps) {
  const { image, toImageCoords, activeTool, naImagem } = useCanvasContext();
  const [anotacaoInicio, setAnotacaoInicio] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const isToolActive = activeTool === 'cota' || activeTool === 'caixa' || activeTool === 'seta';

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !isToolActive) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    setAnotacaoInicio(pos);
    setCursorPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!anotacaoInicio) return;
    const pos = toImageCoords(e);
    if (pos) setCursorPos(pos);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!anotacaoInicio) return;
    const pos = toImageCoords(e) || cursorPos;
    if (pos && onAddAnotacaoVisual) {
      const dx = pos.x - anotacaoInicio.x;
      const dy = pos.y - anotacaoInicio.y;
      
      // ARRANQUE_PX = 4, scaled to image pixels
      const arranque = naImagem(4);
      if (Math.hypot(dx, dy) > arranque) {
        if (activeTool === 'cota' || activeTool === 'seta') {
          onAddAnotacaoVisual({
            id: Date.now().toString(),
            tipo: activeTool, // 'cota' ou 'seta'
            p1: [anotacaoInicio.x, anotacaoInicio.y],
            p2: [pos.x, pos.y],
          });
        } else if (activeTool === 'caixa') {
          onAddAnotacaoVisual({
            id: Date.now().toString(),
            tipo: 'caixa',
            x: Math.min(anotacaoInicio.x, pos.x),
            y: Math.min(anotacaoInicio.y, pos.y),
            w: Math.abs(dx),
            h: Math.abs(dy),
          });
        }
      }
    }
    setAnotacaoInicio(null);
    setCursorPos(null);
  };

  if (!isToolActive && !anotacaoInicio) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 13, cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setAnotacaoInicio(null);
        setCursorPos(null);
      }}
    >
      <defs>
        <marker
          id="arrowhead-overlay"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill={ESPECIME.tool} />
        </marker>
      </defs>

      {anotacaoInicio && cursorPos && activeTool === 'cota' && (
        <>
          <line
            x1={anotacaoInicio.x}
            y1={anotacaoInicio.y}
            x2={cursorPos.x}
            y2={cursorPos.y}
            stroke={ESPECIME.tool}
            strokeWidth={Math.max(2, image.width / 400)}
            strokeDasharray={`${image.width / 100},${image.width / 150}`}
            className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
          />
          {[anotacaoInicio, cursorPos].map((p, i) => (
             <g key={i}>
                <circle cx={p.x} cy={p.y} r={Math.max(4, image.width / 220)} fill={ESPECIME.tool} className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]" />
                <circle cx={p.x} cy={p.y} r={Math.max(8, image.width / 110)} fill="none" stroke={ESPECIME.tool} className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]" strokeWidth={Math.max(1, image.width / 800)} opacity={0.5} />
             </g>
          ))}
        </>
      )}

      {anotacaoInicio && cursorPos && activeTool === 'seta' && (
        <>
          <line
            x1={anotacaoInicio.x}
            y1={anotacaoInicio.y}
            x2={cursorPos.x}
            y2={cursorPos.y}
            stroke={ESPECIME.tool}
            strokeWidth={Math.max(3, image.width / 300)}
            markerEnd="url(#arrowhead-overlay)"
            className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
          />
          <circle cx={anotacaoInicio.x} cy={anotacaoInicio.y} r={Math.max(4, image.width / 220)} fill={ESPECIME.tool} className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]" />
        </>
      )}

      {anotacaoInicio && cursorPos && activeTool === 'caixa' && (
        <rect
          x={Math.min(anotacaoInicio.x, cursorPos.x)}
          y={Math.min(anotacaoInicio.y, cursorPos.y)}
          width={Math.abs(cursorPos.x - anotacaoInicio.x)}
          height={Math.abs(cursorPos.y - anotacaoInicio.y)}
          fill="none"
          stroke={ESPECIME.tool}
          strokeWidth={Math.max(2, image.width / 400)}
          strokeDasharray={`${image.width / 150},${image.width / 200}`}
          className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
        />
      )}
    </svg>
  );
}
