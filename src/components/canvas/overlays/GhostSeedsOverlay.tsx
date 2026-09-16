import React from 'react';
import { useCanvasContext } from './CanvasContext';
import type { Mark, YoloSegmentation } from '../../../types';
import { enumerarObjetos } from '../../../lib/objetos';

type Ponto = [number, number];

interface GhostSeedsOverlayProps {
  /** Índices canônicos (`enumerarObjetos`, = `objeto_id` do CSV) que uma regra afetaria. */
  sementesSimuladas: number[];
  marks: Mark[];
  yoloSegmentations: YoloSegmentation[];
  /**
   * Contornos que ainda NÃO estão na cena — a proposta de um ensaio sob o
   * mouse, por exemplo. Desenhados como polígono tracejado, para comparar
   * receitas antes de aceitar qualquer uma.
   */
  contornosPropostos?: Ponto[][];
}

/**
 * Fantasmas sobre o canvas: o que uma regra afetaria, e o que um ensaio
 * propõe.
 *
 * Os índices vêm da MESMA enumeração que a tabela de medidas usa. Antes o
 * overlay fazia `marks[id − 1]` e só achava contorno por `marcaId` — semente
 * do modelo sem marca nunca ganhava o quadrinho, e o índice da regra (que já
 * era o do CSV) não batia com a posição na lista de marcações.
 */
export function GhostSeedsOverlay({
  sementesSimuladas,
  marks,
  yoloSegmentations,
  contornosPropostos = [],
}: GhostSeedsOverlayProps) {
  const { image } = useCanvasContext();

  if (sementesSimuladas.length === 0 && contornosPropostos.length === 0) return null;

  const objetos = enumerarObjetos(marks, yoloSegmentations);
  const porIndice = new Map(objetos.map((o) => [o.indice, o]));
  const pad = image.width / 300;
  const traco = Math.max(2, image.width / 400);
  const tracejado = `${image.width / 150},${image.width / 150}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 11 }}
    >
      {sementesSimuladas.map((indice) => {
        const o = porIndice.get(indice);
        if (!o) return null;
        let minX: number, maxX: number, minY: number, maxY: number;
        if (o.contorno && o.contorno.polygon_points.length > 0) {
          const xs = o.contorno.polygon_points.map((p) => p[0]);
          const ys = o.contorno.polygon_points.map((p) => p[1]);
          minX = Math.min(...xs); maxX = Math.max(...xs); minY = Math.min(...ys); maxY = Math.max(...ys);
        } else {
          // Marcação sem contorno: caixa do tamanho de uma marca, para a regra
          // ainda mostrar ONDE está o que ela afetaria.
          const r = image.width / 80;
          minX = o.x - r; maxX = o.x + r; minY = o.y - r; maxY = o.y + r;
        }
        return (
          <rect
            key={`ghost-${indice}`}
            x={minX - pad}
            y={minY - pad}
            width={maxX - minX + pad * 2}
            height={maxY - minY + pad * 2}
            fill="none"
            stroke="#d946ef"
            strokeWidth={traco}
            strokeDasharray={tracejado}
            className="animate-pulse drop-shadow-md"
          />
        );
      })}

      {contornosPropostos.map((pontos, i) => (
        <polygon
          key={`proposto-${i}`}
          points={pontos.map((p) => p.join(',')).join(' ')}
          fill="rgba(217,70,239,0.10)"
          stroke="#d946ef"
          strokeWidth={traco}
          strokeDasharray={tracejado}
        />
      ))}
    </svg>
  );
}
