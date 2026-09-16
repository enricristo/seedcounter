import React, { useState } from 'react';
import { useCanvasContext } from './CanvasContext';
import { ESPECIME } from '../../../theme/specimen';
import { regiaoDeDoisPontos, regiaoUtilizavel, type Regiao } from '../../../lib/region';

interface RegionSelectorOverlayProps {
  selectedRegion?: Regiao | null;
  onRegionSelected?: (regiao: Regiao) => void;
}

export function RegionSelectorOverlay({
  selectedRegion,
  onRegionSelected,
}: RegionSelectorOverlayProps) {
  const { image, toImageCoords } = useCanvasContext();
  const [arrasteInicio, setArrasteInicio] = useState<{ x: number; y: number } | null>(null);
  const [arrasteAtual, setArrasteAtual] = useState<{ x: number; y: number } | null>(null);

  const regiaoEmConstrucao =
    arrasteInicio && arrasteAtual
      ? regiaoDeDoisPontos(arrasteInicio.x, arrasteInicio.y, arrasteAtual.x, arrasteAtual.y)
      : null;

  const iniciarRegiao = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    setArrasteInicio(pos);
    setArrasteAtual(pos);
  };

  const arrastarRegiao = (e: React.MouseEvent) => {
    if (!arrasteInicio) return;
    const pos = toImageCoords(e);
    if (pos) setArrasteAtual(pos);
  };

  const concluirRegiao = () => {
    if (regiaoUtilizavel(regiaoEmConstrucao)) {
      onRegionSelected?.(regiaoEmConstrucao);
    }
    setArrasteInicio(null);
    setArrasteAtual(null);
  };

  const regiaoDesenhada = regiaoEmConstrucao ?? selectedRegion ?? null;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 13, cursor: 'crosshair' }}
      onMouseDown={iniciarRegiao}
      onMouseMove={arrastarRegiao}
      onMouseUp={concluirRegiao}
      onMouseLeave={concluirRegiao}
    >
      {regiaoDesenhada ? (
        <>
          <rect x={0} y={0} width={image.width} height={regiaoDesenhada.y} fill="rgba(0,0,0,0.45)" />
          <rect
            x={0}
            y={regiaoDesenhada.y + regiaoDesenhada.height}
            width={image.width}
            height={Math.max(0, image.height - regiaoDesenhada.y - regiaoDesenhada.height)}
            fill="rgba(0,0,0,0.45)"
          />
          <rect x={0} y={regiaoDesenhada.y} width={regiaoDesenhada.x} height={regiaoDesenhada.height} fill="rgba(0,0,0,0.45)" />
          <rect
            x={regiaoDesenhada.x + regiaoDesenhada.width}
            y={regiaoDesenhada.y}
            width={Math.max(0, image.width - regiaoDesenhada.x - regiaoDesenhada.width)}
            height={regiaoDesenhada.height}
            fill="rgba(0,0,0,0.45)"
          />
          <rect
            x={regiaoDesenhada.x}
            y={regiaoDesenhada.y}
            width={regiaoDesenhada.width}
            height={regiaoDesenhada.height}
            fill="none"
            stroke={ESPECIME.tool}
            strokeWidth={Math.max(2, image.width / 500)}
            strokeDasharray={`${image.width / 120},${image.width / 200}`}
            className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
          />
        </>
      ) : (
        <rect x={0} y={0} width={image.width} height={image.height} fill="rgba(0,0,0,0.25)" />
      )}
    </svg>
  );
}
