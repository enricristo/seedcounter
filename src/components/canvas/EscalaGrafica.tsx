import { useState } from 'react';
import { Anchor, Move } from 'lucide-react';
import { escalaGrafica } from '../../lib/escala-grafica';
import { useDraggable } from '../../hooks/useDraggable';
import { lerPreferenciaTexto, gravarPreferenciaTexto } from '../../features/settings/preferencias';

interface EscalaGraficaProps {
  umPerPixel?: number;
  zoomLevel: number;
}

type Canto = 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito';
const CANTOS: Canto[] = ['superior-esquerdo', 'superior-direito', 'inferior-esquerdo', 'inferior-direito'];

const CLASSE_DO_CANTO: Record<Canto, string> = {
  'inferior-esquerdo': 'bottom-3 left-3',
  'inferior-direito': 'bottom-3 right-20',
  'superior-esquerdo': 'top-3 left-3',
  'superior-direito': 'top-3 right-3',
};

/**
 * A barra de escala sobre o viewport — como num mapa ou numa micrografia.
 *
 * Duas formas de usar: ancorada num canto (o normal, para a escala ficar
 * sempre no mesmo lugar) ou SOLTA, arrastada pelo cabo até um objeto para
 * comparar a olho — "essa semente tem mais ou menos 1 mm". Arrastar não muda
 * o comprimento, só o lugar; o comprimento redondo é recalculado a cada
 * zoom. Sem calibração fica em px e diz "sem escala", para a ausência ser
 * visível. Só o cabo arrasta, para a barra não roubar cliques do canvas.
 */
export function EscalaGrafica({ umPerPixel, zoomLevel }: EscalaGraficaProps) {
  const e = escalaGrafica(umPerPixel, zoomLevel);
  const w = Math.round(e.larguraPx);
  const [canto, setCanto] = useState<Canto>(() => {
    const c = lerPreferenciaTexto('sc:escalaCanto', 'inferior-esquerdo') as Canto;
    return CANTOS.includes(c) ? c : 'inferior-esquerdo';
  });
  const [solta, setSolta] = useState(false);
  const { position, isDragging, handlers } = useDraggable({ x: 0, y: 0 });

  const ancorar = (c: Canto) => {
    setCanto(c);
    setSolta(false);
    gravarPreferenciaTexto('sc:escalaCanto', c);
  };

  return (
    <div
      className={`bg-surface-1/90 border-line rounded-control text-ink-1 group absolute z-10 flex select-none items-stretch gap-1.5 border px-1.5 py-1 font-mono text-[10px] tabular-nums shadow-md backdrop-blur ${CLASSE_DO_CANTO[canto]}`}
      style={solta ? { transform: `translate3d(${position.x}px, ${position.y}px, 0)` } : undefined}
      aria-label={`Escala gráfica: ${e.rotulo}`}
      role="group"
    >
      <button
        type="button"
        {...handlers}
        onPointerDown={(ev) => {
          setSolta(true);
          handlers.onPointerDown(ev);
        }}
        className={`text-ink-3 hover:text-ink-1 flex items-center rounded px-0.5 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        title="Arraste a escala até um objeto para comparar o tamanho"
        aria-label="Arrastar a escala"
      >
        <Move size={11} />
      </button>

      <div className="pointer-events-none flex flex-col justify-center gap-0.5">
        <div className="flex items-end gap-1.5">
          <svg width={w + 2} height={10} aria-hidden="true">
            <rect x={1} y={3} width={w / 2} height={5} fill="currentColor" />
            <rect x={1 + w / 2} y={3} width={w / 2} height={5} fill="none" stroke="currentColor" strokeWidth={1} />
            <line x1={1} y1={0} x2={1} y2={10} stroke="currentColor" strokeWidth={1} />
            <line x1={1 + w} y1={0} x2={1 + w} y2={10} stroke="currentColor" strokeWidth={1} />
          </svg>
          <span className="font-semibold">{e.rotulo}</span>
          {/* Também em px da imagem: a unidade em que o contorno foi medido e a coluna do CSV. */}
          {!e.semCalibracao && <span className="text-ink-3">· {Math.round(e.pxDaImagem)} px</span>}
        </div>
        {e.semCalibracao && <span className="text-ink-3 text-[9px]">sem escala — calibre</span>}
      </div>

      {/* Ancorar: os quatro cantos. Aparece ao passar o mouse, ou sempre quando solta. */}
      <div
        className={`flex flex-col justify-center transition-opacity ${solta ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
        title="Ancorar num canto"
      >
        <div className="grid grid-cols-2 gap-px">
          {CANTOS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => ancorar(c)}
              aria-label={`Ancorar no canto ${c.replace('-', ' ')}`}
              className={`h-2.5 w-2.5 rounded-[2px] border transition-colors ${
                canto === c && !solta ? 'bg-accent border-accent' : 'border-line hover:border-ink-2'
              }`}
            />
          ))}
        </div>
      </div>
      {solta && (
        <button
          type="button"
          onClick={() => ancorar(canto)}
          className="text-ink-3 hover:text-ink-1 flex items-center px-0.5"
          title="Voltar ao canto"
          aria-label="Voltar ao canto"
        >
          <Anchor size={11} />
        </button>
      )}
    </div>
  );
}
