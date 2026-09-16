import React, { useState } from 'react';
import { useCanvasContext } from './CanvasContext';
import { ESPECIME } from '../../../theme/specimen';

interface CalibrationRulerOverlayProps {
  onMeasured?: (pixels: number, p1: { x: number; y: number }, p2: { x: number; y: number }) => void;
}

export function CalibrationRulerOverlay({ onMeasured }: CalibrationRulerOverlayProps) {
  const { image, toImageCoords } = useCanvasContext();
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    e.stopPropagation();
    e.preventDefault();
    setRulerStart(pos);
    setCursorPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rulerStart) return;
    const pos = toImageCoords(e);
    if (pos) setCursorPos(pos);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!rulerStart) return;
    const pos = toImageCoords(e) || cursorPos;
    if (pos && onMeasured) {
      const dist = Math.hypot(pos.x - rulerStart.x, pos.y - rulerStart.y);
      if (dist > 5) {
        onMeasured(dist, rulerStart, pos);
      }
    }
    setRulerStart(null);
    setCursorPos(null);
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 12, cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setRulerStart(null);
        setCursorPos(null);
      }}
    >
      <rect x={0} y={0} width={image.width} height={image.height} fill="rgba(14,165,233,0.06)" />

      {rulerStart && cursorPos && (
        <line
          x1={rulerStart.x}
          y1={rulerStart.y}
          x2={cursorPos.x}
          y2={cursorPos.y}
          stroke={ESPECIME.tool}
          className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
          strokeWidth={Math.max(2, image.width / 400)}
          strokeDasharray={`${image.width / 100},${image.width / 150}`}
        />
      )}

      {[rulerStart, cursorPos].map((p, i) =>
        p ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={Math.max(4, image.width / 220)} fill={ESPECIME.tool} className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]" />
            <circle cx={p.x} cy={p.y} r={Math.max(8, image.width / 110)} fill="none" stroke={ESPECIME.tool} className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]" strokeWidth={Math.max(1, image.width / 800)} opacity={0.5} />
          </g>
        ) : null
      )}
    </svg>
  );
}
