import { useMemo, useState } from 'react';
import { List, ArrowDownUp, Filter } from 'lucide-react';
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

type SortOption = 'indice' | 'area_asc' | 'area_desc';
type FilterOption = 'todos' | 'viaveis' | 'inviaveis' | 'aglomerados';

export function ListaDeSementes({ marks, segmentations, umPerPixel, medianaDaCena, limiares, onSelecionar }: ListaDeSementesProps) {
  const [ordenacao, setOrdenacao] = useState<SortOption>('indice');
  const [filtro, setFiltro] = useState<FilterOption>('todos');

  // A mesma lista e o mesmo índice do canvas (tecla 2), da contagem e do CSV.
  const linhasMapeadas = useMemo(
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

  const suspeitos = linhasMapeadas.filter((l) => l.suspeito).length;

  const linhas = useMemo(() => {
    let result = [...linhasMapeadas];
    
    // Filtro
    if (filtro === 'viaveis') result = result.filter(l => l.categoria === 'viable');
    else if (filtro === 'inviaveis') result = result.filter(l => l.categoria === 'inviable');
    else if (filtro === 'aglomerados') result = result.filter(l => l.suspeito);
    
    // Ordenação
    if (ordenacao === 'area_asc') result.sort((a, b) => a.areaPx - b.areaPx);
    else if (ordenacao === 'area_desc') result.sort((a, b) => b.areaPx - a.areaPx);
    // 'indice' mantém a ordem original do enumerarObjetos

    return result;
  }, [linhasMapeadas, filtro, ordenacao]);

  if (linhasMapeadas.length === 0) {
    return (
      <div className="text-ink-3 mt-8 text-center text-sm">
        Nenhum objeto na cena. Marque (V/I), segmente por clique (S) ou detecte, e eles aparecem aqui.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-xs h-full">
      <div className="text-ink-2 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <List size={14} className="text-ink-3" />
          <span className="font-bold uppercase tracking-wider">
            {linhasMapeadas.length} {linhasMapeadas.length === 1 ? 'objeto' : 'objetos'}
          </span>
          {suspeitos > 0 && <span className="text-ink-3 text-[10px]">({suspeitos} suspeitos)</span>}
        </div>
        
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-ink-3" />
            <select
              value={filtro}
              onChange={e => setFiltro(e.target.value as FilterOption)}
              className="bg-surface-2 border border-line rounded px-1.5 py-0.5 text-[10px] uppercase font-bold text-ink-2 cursor-pointer outline-none"
            >
              <option value="todos">Todos</option>
              <option value="viaveis">Viáveis</option>
              <option value="inviaveis">Inviáveis</option>
              <option value="aglomerados">Aglomerados</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowDownUp size={12} className="text-ink-3" />
            <select
              value={ordenacao}
              onChange={e => setOrdenacao(e.target.value as SortOption)}
              className="bg-surface-2 border border-line rounded px-1.5 py-0.5 text-[10px] uppercase font-bold text-ink-2 cursor-pointer outline-none"
            >
              <option value="indice">Índice</option>
              <option value="area_desc">Maior Área</option>
              <option value="area_asc">Menor Área</option>
            </select>
          </div>
        </div>
      </div>
      <ul className="divide-line flex flex-col divide-y overflow-auto pb-4 pr-1">
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
