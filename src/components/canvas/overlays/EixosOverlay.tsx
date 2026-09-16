import React from 'react';
import { useCanvasContext } from './CanvasContext';
import { eixosDoContorno, discordanciaRelativa } from '../../../lib/eixos';
import type { YoloSegmentation } from '../../../types';

interface EixosOverlayProps {
  /** Contornos visíveis (mesmo filtro `visible !== false` usado no resto do canvas). */
  yoloSegmentations: YoloSegmentation[];
  /** Qual contorno está selecionado — ganha rótulo e o sinal "≠". */
  contornoSelecionado?: number | null;
  /** Desenha os eixos em TODOS os contornos visíveis, sem rótulo (ligado por toggle). */
  mostrarEixosDeTodos?: boolean;
}

/** Acima de qual discordância relativa a forma deixa de ser "quase elipse". */
const LIMIAR_DISCORDANCIA = 0.15;

/**
 * Overlay dos eixos de medida (C3.1): para o contorno selecionado, desenha os
 * dois eixos PCA (o que `calculateSeedDimensions` usa para comprimento e
 * largura) em traço contínuo, e os dois Feret (máx/mín, `feret.ts`) em
 * tracejado — para ver quando os dois discordam.
 *
 * Discordância grande (> 15% em qualquer eixo) é o sinal de que a forma não é
 * elíptica (encostadas, quebrada) e a medida PCA é palpite: o rótulo ganha
 * "≠" nesse eixo.
 *
 * `mostrarEixosDeTodos` desenha os quatro segmentos em todo contorno visível,
 * sem rótulo — é o modo de "varredura visual" da bancada inteira.
 */
export function EixosOverlay({
  yoloSegmentations,
  contornoSelecionado,
  mostrarEixosDeTodos = false,
}: EixosOverlayProps) {
  const { image } = useCanvasContext();

  const contornosVisiveis = yoloSegmentations.filter((s) => s.visible !== false);
  const alvos = mostrarEixosDeTodos
    ? contornosVisiveis
    : contornosVisiveis.filter((s) => s.id === contornoSelecionado);

  if (alvos.length === 0) return null;

  const strokeW = Math.max(1, image.width / 700);
  const fontSize = Math.max(10, image.width / 130);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${image.width} ${image.height}`}
      style={{ width: '100%', height: '100%', zIndex: 9 }}
    >
      {alvos.map((seg) => {
        const eixos = eixosDoContorno(seg.polygon_points);
        if (!eixos) return null;

        // Rótulo só no contorno selecionado — "de todos" é varredura visual,
        // texto em cima de cada semente vira ruído.
        const comRotulo = !mostrarEixosDeTodos && seg.id === contornoSelecionado;

        const discComprimento = discordanciaRelativa(
          eixos.comprimento.comprimento,
          eixos.feretMax.comprimento
        );
        const discLargura = discordanciaRelativa(
          eixos.largura.comprimento,
          eixos.feretMin.comprimento
        );
        const pcaDiverge = discComprimento > LIMIAR_DISCORDANCIA || discLargura > LIMIAR_DISCORDANCIA;

        return (
          <g key={seg.id}>
            {/* PCA — traço contínuo. */}
            <line
              x1={eixos.comprimento.a[0]}
              y1={eixos.comprimento.a[1]}
              x2={eixos.comprimento.b[0]}
              y2={eixos.comprimento.b[1]}
              stroke="var(--color-ink-1)"
              strokeWidth={strokeW}
              className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.6))]"
            />
            <line
              x1={eixos.largura.a[0]}
              y1={eixos.largura.a[1]}
              x2={eixos.largura.b[0]}
              y2={eixos.largura.b[1]}
              stroke="var(--color-ink-1)"
              strokeWidth={strokeW}
              className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.6))]"
            />

            {/* Feret — tracejado, mesma cor neutra. */}
            <line
              x1={eixos.feretMax.a[0]}
              y1={eixos.feretMax.a[1]}
              x2={eixos.feretMax.b[0]}
              y2={eixos.feretMax.b[1]}
              stroke="var(--color-ink-1)"
              strokeWidth={strokeW}
              strokeDasharray={`${image.width / 180},${image.width / 220}`}
              opacity={0.75}
            />
            <line
              x1={eixos.feretMin.a[0]}
              y1={eixos.feretMin.a[1]}
              x2={eixos.feretMin.b[0]}
              y2={eixos.feretMin.b[1]}
              stroke="var(--color-ink-1)"
              strokeWidth={strokeW}
              strokeDasharray={`${image.width / 180},${image.width / 220}`}
              opacity={0.75}
            />

            {comRotulo && (
              <>
                <text
                  x={eixos.comprimento.b[0]}
                  y={eixos.comprimento.b[1]}
                  fill="var(--color-ink-1)"
                  fontSize={fontSize}
                  className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
                >
                  PCA{discComprimento > LIMIAR_DISCORDANCIA ? ' ≠' : ''}
                </text>
                <text
                  x={eixos.feretMax.b[0]}
                  y={eixos.feretMax.b[1]}
                  fill="var(--color-ink-1)"
                  fontSize={fontSize}
                  opacity={0.85}
                  className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
                >
                  Feret{discComprimento > LIMIAR_DISCORDANCIA ? ' ≠' : ''}
                </text>
                {pcaDiverge && (
                  <text
                    x={eixos.centro[0]}
                    y={eixos.centro[1]}
                    fill="var(--color-ink-1)"
                    fontSize={fontSize * 1.1}
                    textAnchor="middle"
                    className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
                  >
                    PCA ≠ Feret
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
