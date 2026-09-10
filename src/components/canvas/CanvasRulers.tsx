// =============================================================================
// SeedCounter — CanvasRulers
//
// Réguas nas bordas superior e esquerda. Quando há calibração elas mostram as
// DUAS escalas ao mesmo tempo — milímetro em cima, pixel embaixo — como régua
// de desenho técnico.
//
// A versão anterior TROCAVA de unidade: com calibração o pixel sumia. Mas o
// pixel é o que a imagem tem (resolução, raio da onda, detalhe disponível para
// segmentar) e o milímetro é como o lote é descrito. As duas são precisas ao
// mesmo tempo, e alternar obrigaria a lembrar em qual modo a régua está.
//
// A aritmética da escala vive em `lib/regua.ts`, com teste. Aqui só se desenha.
// =============================================================================

import React, { useMemo } from 'react';
import { escalaDaRegua } from '../../lib/regua';

interface CanvasRulersProps {
  /** Largura da imagem, em pixels originais. */
  imageWidth: number;
  /** Altura da imagem, em pixels originais. */
  imageHeight: number;
  /** Zoom aplicado (1 = 100%). */
  zoomLevel: number;
  /** Escala espacial; ausente = régua em pixels. */
  umPerPixel?: number;
  /** Espessura da régua, em pixels de tela. Ausente = automática. */
  size?: number;
}

export function CanvasRulers({
  imageWidth,
  imageHeight,
  zoomLevel,
  umPerPixel,
  size,
}: CanvasRulersProps) {
  const ticks = useMemo(
    () => escalaDaRegua({ zoom: zoomLevel, umPerPixel }),
    [zoomLevel, umPerPixel]
  );

  // A régua cresce quando carrega duas linhas de rótulo: espremer a segunda
  // escala nos 22 px do modo pixel deixaria as duas ilegíveis.
  const temDupla = ticks.secundario !== null;
  const espessura = size ?? (temDupla ? 30 : 22);

  const screenPerTick = ticks.pixelsPorTraco * zoomLevel;
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
        style={{ top: -espessura, left: 0, height: espessura, width: imageWidth * zoomLevel, zIndex: 15 }}
      >
        <svg width="100%" height={espessura} style={{ display: 'block' }}>
          {Array.from({ length: countX }, (_, i) => {
            const x = i * screenPerTick;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={espessura - 7}
                  x2={x}
                  y2={espessura}
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-zinc-600"
                  strokeWidth={1}
                />
                <text
                  x={x + 3}
                  y={espessura - (temDupla ? 19 : 10)}
                  fontSize={9}
                  className="fill-neutral-600 dark:fill-zinc-400"
                  style={{ fontFamily: 'monospace' }}
                >
                  {ticks.principal(i)}
                </text>
                {ticks.secundario && (
                  <text
                    x={x + 3}
                    y={espessura - 10}
                    fontSize={7.5}
                    className="fill-neutral-400 dark:fill-zinc-600"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {ticks.secundario(i)}
                  </text>
                )}
                {/* Sub-traços */}
                {[0.25, 0.5, 0.75].map((f) => (
                  <line
                    key={f}
                    x1={x + screenPerTick * f}
                    y1={espessura - 4}
                    x2={x + screenPerTick * f}
                    y2={espessura}
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
        style={{ left: -espessura, top: 0, width: espessura, height: imageHeight * zoomLevel, zIndex: 15 }}
      >
        <svg width={espessura} height="100%" style={{ display: 'block' }}>
          {Array.from({ length: countY }, (_, i) => {
            const y = i * screenPerTick;
            return (
              <g key={i}>
                <line
                  x1={espessura - 7}
                  y1={y}
                  x2={espessura}
                  y2={y}
                  stroke="currentColor"
                  className="text-neutral-400 dark:text-zinc-600"
                  strokeWidth={1}
                />
                <text
                  x={2}
                  y={y + 10}
                  fontSize={9}
                  className="fill-neutral-600 dark:fill-zinc-400"
                  style={{ fontFamily: 'monospace' }}
                >
                  {ticks.principal(i)}
                </text>
                {ticks.secundario && (
                  <text
                    x={2}
                    y={y + 19}
                    fontSize={7.5}
                    className="fill-neutral-400 dark:fill-zinc-600"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {ticks.secundario(i)}
                  </text>
                )}
                {[0.25, 0.5, 0.75].map((f) => (
                  <line
                    key={f}
                    x1={espessura - 4}
                    y1={y + screenPerTick * f}
                    x2={espessura}
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
        style={{ top: -espessura, left: -espessura, width: espessura, height: espessura, zIndex: 16 }}
      >
        <span className="text-center text-[8px] leading-tight font-bold text-neutral-400 dark:text-zinc-600">
          {ticks.unidade}
          {temDupla && (
            <>
              <br />
              px
            </>
          )}
        </span>
      </div>
    </>
  );
}
