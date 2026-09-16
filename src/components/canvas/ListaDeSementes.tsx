import { useMemo } from 'react';
import { List } from 'lucide-react';
import type { Mark, YoloSegmentation } from '../../types';
import { enumerarObjetos } from '../../lib/objetos';
import { areaDoPoligono, analisarContorno, type LimiaresDeAglomerado } from '../../lib/aglomerado';
import { formatArea, formatLength } from '../../lib/calibration';

interface ListaDeSementesProps {
  marks: Mark[];
  segmentations: YoloSegmentation[];
  umPerPixel?: number;
  medianaDaCena?: number;
  limiares?: LimiaresDeAglomerado;
  onSelecionar: (id: number) => void;
}

/**
 * O que a aba Inspetor mostra quando nenhuma semente está selecionada.
 *
 * A aba tinha um vazio de meio painel dizendo "selecione uma semente". O
 * espaço serve melhor listando o que há: cada contorno com classe, área e
 * comprimento × largura, e o aviso de aglomerado quando a própria população
 * da cena o acusa. Clicar numa linha seleciona o contorno — é o mesmo gesto
 * que clicar nele no canvas, para quem prefere percorrer uma lista.
 */
export function ListaDeSementes({ marks, segmentations, umPerPixel, medianaDaCena, limiares, onSelecionar }: ListaDeSementesProps) {
  // A mesma lista e o mesmo índice do canvas (tecla 2), da contagem e do CSV.
  const linhas = useMemo(
    () =>
      enumerarObjetos(marks, segmentations).map((o) => {
        const c = o.contorno;
        const analise = c ? analisarContorno(c.polygon_points, medianaDaCena ?? NaN, limiares) : null;
        return {
          indice: o.indice,
          id: c?.id ?? null,
          categoria: o.categoria,
          areaPx: c ? areaDoPoligono(c.polygon_points) : 0,
          comprimento: c?.height ?? 0,
          largura: c?.width ?? 0,
          suspeito: analise?.veredito === 'aglomerado',
          semContorno: !c,
        };
      }),
    [marks, segmentations, medianaDaCena, limiares]
  );

  if (linhas.length === 0) {
    return (
      <div className="text-ink-3 mt-8 text-center text-sm">
        Nenhum objeto na cena. Marque (V/I), segmente por clique (S) ou detecte, e eles aparecem aqui.
      </div>
    );
  }

  const suspeitos = linhas.filter((l) => l.suspeito).length;

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="text-ink-2 flex items-center gap-2">
        <List size={14} className="text-ink-3" />
        <span className="font-bold uppercase tracking-wider">
          {linhas.length} {linhas.length === 1 ? 'objeto' : 'objetos'}
        </span>
        {suspeitos > 0 && <span className="text-ink-3">· {suspeitos} com sinal de aglomerado</span>}
      </div>
      <ul className="divide-line flex flex-col divide-y">
        {linhas.map((l) => (
          <li key={l.indice}>
            <button
              type="button"
              disabled={l.id == null}
              onClick={() => l.id != null && onSelecionar(l.id)}
              className="hover:bg-surface-2 flex w-full items-center gap-2 px-1 py-1.5 text-left transition-colors"
              title="Selecionar no canvas e abrir o inspetor"
            >
              <span className="text-ink-3 w-6 shrink-0 font-mono tabular-nums">{l.indice}</span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: l.categoria === 'viable' ? '#00e5ff' : '#ff3dc8' }}
                aria-label={l.categoria === 'viable' ? 'viável' : 'inviável'}
              />
              <span className="text-ink-1 flex-1 font-mono tabular-nums">
                {l.semContorno ? 'sem contorno' : formatArea(l.areaPx, umPerPixel)}
              </span>
              <span className="text-ink-3 font-mono tabular-nums">
                {l.comprimento > 0 && l.largura > 0
                  ? `${formatLength(l.comprimento, umPerPixel)} × ${formatLength(l.largura, umPerPixel)}`
                  : '—'}
              </span>
              {l.suspeito && (
                <span className="text-ink-3 shrink-0 text-[10px] font-bold uppercase" title="A população desta cena acusa forma de aglomerado">
                  aglom.?
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
