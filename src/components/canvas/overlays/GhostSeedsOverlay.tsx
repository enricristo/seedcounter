import React from 'react';
import { useCanvasContext } from './CanvasContext';
import type { Mark, YoloSegmentation } from '../../../types';

interface GhostSeedsOverlayProps {
  sementesSimuladas: number[];
  marks: Mark[];
  yoloSegmentations: YoloSegmentation[];
}

export function GhostSeedsOverlay({
  sementesSimuladas,
  marks,
  yoloSegmentations,
}: GhostSeedsOverlayProps) {
  const { image } = useCanvasContext();

  if (sementesSimuladas.length === 0) return null;

  const marcasAfetadas = new Set(
    sementesSimuladas.map(id => marks[id - 1]?.id).filter(Boolean)
  );
  
  const contornosVisiveis = yoloSegmentations.filter((s) => s.visible !== false);
  const ghostSegs = contornosVisiveis.filter(
    s => s.marcaId != null && marcasAfetadas.has(s.marcaId)
  );

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 11 }}
    >
      {ghostSegs.map(seg => {
        if (!seg.polygon_points || seg.polygon_points.length === 0) return null;
        const xs = seg.polygon_points.map(p => p[0]);
        const ys = seg.polygon_points.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const pad = image.width / 300;

        return (
          <rect
            key={`ghost-${seg.id}`}
            x={minX - pad}
            y={minY - pad}
            width={(maxX - minX) + pad * 2}
            height={(maxY - minY) + pad * 2}
            fill="none"
            stroke="#d946ef"
            strokeWidth={Math.max(2, image.width / 400)}
            strokeDasharray={`${image.width / 150},${image.width / 150}`}
            className="animate-pulse drop-shadow-md"
          />
        );
      })}
    </svg>
  );
}
