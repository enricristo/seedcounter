import { escalaGrafica } from '../../lib/escala-grafica';

interface EscalaGraficaProps {
  umPerPixel?: number;
  zoomLevel: number;
}

/**
 * A barra de escala sobre o viewport, canto inferior esquerdo — como num mapa
 * ou numa micrografia publicada. Recalculada a cada zoom, sempre com um
 * comprimento redondo. Sem calibração fica em px e diz "sem escala", para a
 * ausência ser visível.
 */
export function EscalaGrafica({ umPerPixel, zoomLevel }: EscalaGraficaProps) {
  const e = escalaGrafica(umPerPixel, zoomLevel);
  const w = Math.round(e.larguraPx);
  return (
    <div
      className="bg-surface-1/90 border-line rounded-control text-ink-1 pointer-events-none absolute bottom-3 left-3 z-10 flex select-none flex-col gap-0.5 border px-2 py-1 font-mono text-[10px] tabular-nums shadow-md backdrop-blur"
      aria-label={`Escala gráfica: ${e.rotulo}`}
      role="img"
    >
      <div className="flex items-end gap-1.5">
        <svg width={w + 2} height={10} aria-hidden="true">
          {/* Barra em dois blocos alternados, como escala de mapa; o fio fino
              de 1 px em cada ponta é onde se lê o comprimento. */}
          <rect x={1} y={3} width={w / 2} height={5} fill="currentColor" />
          <rect x={1 + w / 2} y={3} width={w / 2} height={5} fill="none" stroke="currentColor" strokeWidth={1} />
          <line x1={1} y1={0} x2={1} y2={10} stroke="currentColor" strokeWidth={1} />
          <line x1={1 + w} y1={0} x2={1 + w} y2={10} stroke="currentColor" strokeWidth={1} />
        </svg>
        <span className="font-semibold">{e.rotulo}</span>
      </div>
      {e.semCalibracao && <span className="text-ink-3 text-[9px]">sem escala — calibre</span>}
    </div>
  );
}
