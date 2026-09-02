// =============================================================================
// SeedCounter — CanvasRulers
// Réguas nas bordas superior e esquerda, com unidades reais quando há
// calibração espacial (µm/px). Ajudam a estimar tamanhos sem medir ponto a ponto.
// =============================================================================

import React, { useMemo } from 'react';

interface CanvasRulersProps {
  /** Largura da imagem, em pixels originais. */
  imageWidth: number;
  /** Altura da imagem, em pixels originais. */
  imageHeight: number;
  /** Zoom aplicado (1 = 100%). */
  zoomLevel: number;
  /** Escala espacial; ausente = régua em pixels. */
  umPerPixel?: number;
  /** Espessura da régua, em pixels de tela. */
  size?: number;
}

/** Escolhe um passo "redondo" para os traços principais. */
function niceStep(rawStep: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / pow;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * pow;
}

export function CanvasRulers({
  imageWidth,
  imageHeight,
  zoomLevel,
  umPerPixel,
  size = 22,
}: CanvasRulersProps) {
  const ticks = useMemo(() => {
    // Alvo: um traço principal a cada ~90 px de tela.
    const targetScreenPx = 90;
    const imagePxPerTick = targetScreenPx / Math.max(0.01, zoomLevel);

    if (umPerPixel && umPerPixel > 0) {
      // Passo em unidades reais (mm), arredondado para valor "bonito".
      const mmPerTick = niceStep((imagePxPerTick * umPerPixel) / 1000);
      const pxPerTick = (mmPerTick * 1000) / umPerPixel;
      return {
        pxPerTick,
        label: (i: number) => {
          const mm = i * mmPerTick;
          return mm < 1 ? `${(mm * 1000).toFixed(0)}µm` : `${Number(mm.toFixed(2))}mm`;
        },
        unit: 'mm',
      };
    }

    const pxPerTick = niceStep(imagePxPerTick);
    return {
      pxPerTick,
      label: (i: number) => `${Math.round(i * pxPerTick)}`,
      unit: 'px',
    };
  }, [zoomLevel, umPerPixel]);

  const screenPerTick = ticks.pxPerTick * zoomLevel;
  const countX = Math.ceil((imageWidth * zoomLevel) / screenPerTick) + 1;
  const countY = Math.ceil((imageHeight * zoomLevel) / screenPerTick) + 1;

  // Evita renderizar milhares de traços em zoom muito baixo.
  if (screenPerTick < 12 || countX > 400 || countY > 400) return null;

  const axisClass =
    'absolute bg-white/95 dark:bg-zinc-950/95 border-neutral-200 dark:border-zinc-800 select-none pointer-events-none';

  return (
    <>
      {/* Régua horizontal (topo) */}
      <div
        className={`${axisClass} border-b`}
        style={{ top: -size, left: 0, height: size, width: imageWidth * zoomLevel, zIndex: 15 }}
      >
        <svg width="100%" height={size} style={{ display: 'block' }}>
          {Array.from({ length: countX }, (_, i) => {
            const x = i * screenPerTick;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={size - 7}
                  x2={x}
                  y2={size}
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-zinc-600"
                  strokeWidth={1}
                />
                <text
                  x={x + 3}
                  y={size - 10}
                  fontSize={9}
                  className="fill-neutral-500 dark:fill-zinc-500"
                  style={{ fontFamily: 'monospace' }}
                >
                  {ticks.label(i)}
                </text>
                {/* Sub-traços */}
                {[0.25, 0.5, 0.75].map((f) => (
                  <line
                    key={f}
                    x1={x + screenPerTick * f}
                    y1={size - 4}
                    x2={x + screenPerTick * f}
                    y2={size}
                    stroke="currentColor"
                    className="text-neutral-300 dark:text-zinc-700"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Régua vertical (esquerda) */}
      <div
        className={`${axisClass} border-r`}
        style={{ left: -size, top: 0, width: size, height: imageHeight * zoomLevel, zIndex: 15 }}
      >
        <svg width={size} height="100%" style={{ display: 'block' }}>
          {Array.from({ length: countY }, (_, i) => {
            const y = i * screenPerTick;
            return (
              <g key={i}>
                <line
                  x1={size - 7}
                  y1={y}
                  x2={size}
                  y2={y}
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-zinc-600"
                  strokeWidth={1}
                />
                <text
                  x={2}
                  y={y + 11}
                  fontSize={9}
                  className="fill-neutral-500 dark:fill-zinc-500"
                  style={{ fontFamily: 'monospace' }}
                >
                  {ticks.label(i)}
                </text>
                {[0.25, 0.5, 0.75].map((f) => (
                  <line
                    key={f}
                    x1={size - 4}
                    y1={y + screenPerTick * f}
                    x2={size}
                    y2={y + screenPerTick * f}
                    stroke="currentColor"
                    className="text-neutral-300 dark:text-zinc-700"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Canto com a unidade em uso */}
      <div
        className="absolute bg-white/95 dark:bg-zinc-950/95 border-b border-r border-neutral-200 dark:border-zinc-800 flex items-center justify-center pointer-events-none"
        style={{ top: -size, left: -size, width: size, height: size, zIndex: 16 }}
      >
        <span className="text-[8px] font-bold text-neutral-400 dark:text-zinc-600">
          {ticks.unit}
        </span>
      </div>
    </>
  );
}
