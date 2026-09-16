// =============================================================================
// SeedCounter — galeria de segmentações
//
// A tela que muda a unidade de trabalho: da IMAGEM para o OBJETO.
//
// Procurar um contorno errado no meio de duzentos, com zoom e pan, é caro —
// e é por isso que erro de segmentação passa. Lado a lado, o objeto que destoa
// salta, porque comparação é o que o olho humano faz bem.
//
// As células vermelhas ("falta contornar") são marcações sem polígono: a pessoa
// já disse que ali tem uma semente, e o que falta é o contorno. Elas aparecem
// na mesma grade de propósito — a lista de pendências e a lista de resultados
// são a mesma lista.
// =============================================================================

import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  Grid3x3,
  Layers,
  Trash2,
  RefreshCw,
  Scan,
  Wand2,
  Crosshair,
  Info,
  AlertTriangle,
  Maximize2,
  PanelRight,
} from 'lucide-react';
import { lerPreferencia, gravarPreferencia } from '../settings/preferencias';
import { ESPECIME } from '../../theme/specimen';
import { montarGaleria, type ItemDaGaleria } from './recortes';
import { recortarTodos, LADO_DA_MINIATURA } from './recortar';
import type { Mark, YoloSegmentation } from '../../types';
import { useModalEscape } from '../../hooks/useModalEscape';
import {
  CLASSES,
  consolidar,
  contarPorClasse,
  protocoloPorChave,
  type ClasseDeSemente,
  type Protocolo,
} from '../../lib/normas/classes-de-semente';
import {
  areaDoPoligono,
  fechoConvexo,
  analisarContorno,
  type LimiaresDeAglomerado,
} from '../../lib/aglomerado';

type Filtro = 'todos' | 'viable' | 'inviable' | 'sem-contorno';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'viable', rotulo: 'Viáveis' },
  { id: 'inviable', rotulo: 'Inviáveis' },
  { id: 'sem-contorno', rotulo: 'Falta contornar' },
];

interface GaleriaModalProps {
  isOpen: boolean;
  /**
   * 'flutuante' (padrão): janela/gaveta com fundo escuro e Escape.
   * 'painel': só o conteúdo, para viver numa aba do painel lateral direito —
   * sem fundo, sem Escape (Escape no painel fecharia o que a pessoa está usando).
   */
  modo?: 'flutuante' | 'painel';
  /** No modo painel: abre a versão grande (janela flutuante). */
  onExpandir?: () => void;
  onClose: () => void;
  image: HTMLImageElement | null;
  marks: Mark[];
  yoloSegmentations: YoloSegmentation[];
  onToggleSegmentationClass: (id: number) => void;
  onDeleteSegmentation: (id: number) => void;
  onToggleMarkClass?: (id: number) => void;
  onRemoveMark?: (id: number) => void;
  /**
   * Roda a onda a partir de cada marcação sem contorno.
   * Ausente = botão oculto.
   */
  onSegmentarPendentes?: () => void;
  /** Roda a onda numa marcacao so — para conferir antes do lote. */
  onSegmentarUma?: (marcaId: number) => void;
  /** Progresso do lote em curso. */
  progresso?: { feitas: number; total: number } | null;
  /**
   * O protocolo de germinacao em vigor. Com classes finas, cada celula ganha o
   * seletor de subclasse e o rodape mostra a consolidacao.
   */
  protocolo?: string;
  onSubclasse?: (marcaId: number, subclasse: ClasseDeSemente | undefined) => void;
  /** Foca a visualização do canvas diretamente nesta semente e abre ferramentas de edição. */
  onFocarNoCanvas?: (coords: { x: number; y: number }, segmentacaoId?: number) => void;
  /** Micrômetros por pixel para cálculo de área em mm² e dimensões métricas. */
  umPerPixel?: number;
  /** Mediana da área dos contornos na cena para calibração relativa de tamanho. */
  medianaDaCena?: number;
  /** Limiares derivados da população desta imagem para diagnóstico de aglomerado. */
  limiares?: LimiaresDeAglomerado;
}

export function GaleriaModal({
  isOpen,
  onClose,
  image,
  marks,
  yoloSegmentations,
  onToggleSegmentationClass,
  onDeleteSegmentation,
  onToggleMarkClass,
  onRemoveMark,
  onSegmentarPendentes,
  onSegmentarUma,
  progresso,
  protocolo: chaveDoProtocolo,
  onSubclasse,
  onFocarNoCanvas,
  umPerPixel,
  medianaDaCena,
  limiares,
  modo = 'flutuante',
  onExpandir,
}: GaleriaModalProps) {
  useModalEscape(isOpen && modo === 'flutuante', onClose);

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [semFundo, setSemFundo] = useState(false);
  const [itemInspecionado, setItemInspecionado] = useState<ItemDaGaleria | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<'modal' | 'gaveta'>(() =>
    lerPreferencia('sc:galeriaGaveta', false) ? 'gaveta' : 'modal'
  );

  const alternarModo = () => {
    const proximo = modoVisualizacao === 'modal' ? 'gaveta' : 'modal';
    setModoVisualizacao(proximo);
    gravarPreferencia('sc:galeriaGaveta', proximo === 'gaveta');
  };

  const itens = useMemo(() => {
    if (!isOpen || !image) return [];
    return montarGaleria(marks, yoloSegmentations, {
      largura: image.naturalWidth || image.width,
      altura: image.naturalHeight || image.height,
    });
  }, [isOpen, image, marks, yoloSegmentations]);

  // Se o item selecionado deixar de existir (ex: removido), deseleciona
  useEffect(() => {
    if (!itemInspecionado) return;
    const existe = itens.some((i) => i.chave === itemInspecionado.chave);
    if (!existe) setItemInspecionado(null);
  }, [itens, itemInspecionado]);

  // O recorte roda por objeto e é caro; refazer a cada mudança de filtro seria
  // desperdício. Depende só da imagem, dos itens e da opção de fundo.
  const miniaturas = useMemo(() => {
    if (!isOpen || !image || itens.length === 0) return new Map<string, string>();
    return recortarTodos(image, itens, { semFundo });
  }, [isOpen, image, itens, semFundo]);

  const protocolo = protocoloPorChave(chaveDoProtocolo);
  const classificaFino = protocolo.classes.length > 2 && !!onSubclasse;

  // A consolidacao sai das MARCAS, nao de um contador digitado: cada marca
  // classificada na galeria vira um numero aqui, na hora.
  const consolidacao = useMemo(() => {
    if (!classificaFino) return null;
    const { contagens, naoClassificadas } = contarPorClasse(marks, protocolo);
    return { ...consolidar(contagens, protocolo), naoClassificadas };
  }, [classificaFino, marks, protocolo]);

  if (!isOpen) return null;

  const visiveis = itens.filter((i) => {
    if (filtro === 'todos') return true;
    if (filtro === 'sem-contorno') return i.tipo === 'ponto';
    return i.categoria === filtro;
  });

  const semContorno = itens.filter((i) => i.tipo === 'ponto').length;

  return (
    <div
      className={
        modo === 'painel'
          ? 'flex flex-col w-full min-h-[70vh]'
          : modoVisualizacao === 'gaveta'
            ? 'fixed right-0 top-0 bottom-0 z-40 w-[500px] max-w-[95vw] flex flex-col border-l border-line bg-surface-1 shadow-2xl overflow-hidden'
            : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4'
      }
      onClick={modo === 'flutuante' && modoVisualizacao === 'modal' ? onClose : undefined}
    >
      <div
        className={
          modo === 'painel' || modoVisualizacao === 'gaveta'
            ? 'flex flex-col h-full w-full overflow-hidden'
            : 'flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-2xl'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do Modal / Gaveta */}
        <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Grid3x3 size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-1">
                Galeria de objetos {modoVisualizacao === 'gaveta' && <span className="text-[10px] text-accent font-mono ml-1 font-semibold">(Gaveta)</span>}
              </h2>
              <p className="text-[11px] text-ink-3">
                {itens.length} {itens.length === 1 ? 'objeto' : 'objetos'}
                {semContorno > 0 && ` • ${semContorno} sem contorno`}
                {' • Duplo clique foca no canvas'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {modo === 'painel' && onExpandir && (
              <button
                type="button"
                onClick={onExpandir}
                title="Abrir a galeria grande, em janela"
                className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1 flex items-center gap-1 text-[11px] font-medium border border-line/60"
              >
                <Maximize2 size={15} />
                <span className="hidden sm:inline">Expandir</span>
              </button>
            )}
            {modo === 'flutuante' && (
            <button
              onClick={alternarModo}
              title={
                modoVisualizacao === 'modal'
                  ? 'Acoplar como gaveta lateral (para ver o canvas ao mesmo tempo)'
                  : 'Expandir como janela flutuante ampla'
              }
              className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1 flex items-center gap-1 text-[11px] font-medium border border-line/60"
            >
              {modoVisualizacao === 'modal' ? (
                <>
                  <PanelRight size={15} />
                  <span className="hidden sm:inline">Gaveta</span>
                </>
              ) : (
                <>
                  <Maximize2 size={15} />
                  <span className="hidden sm:inline">Expandir</span>
                </>
              )}
            </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Ações em Lote */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                filtro === f.id
                  ? 'bg-accent text-accent-on'
                  : 'border border-line text-ink-2 hover:border-accent hover:text-accent'
              }`}
            >
              {f.rotulo}
            </button>
          ))}

          {onSegmentarPendentes && semContorno > 0 && (
            <button
              onClick={onSegmentarPendentes}
              disabled={!!progresso}
              title="Roda a onda a partir de cada marcação sem contorno. A contagem não muda."
              className="bg-accent text-accent-on hover:bg-accent-strong flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50"
            >
              <Wand2 size={13} />
              {progresso
                ? `${progresso.feitas}/${progresso.total}…`
                : `Contornar ${semContorno}`}
            </button>
          )}

          <button
            onClick={() => setSemFundo((v) => !v)}
            title="Apaga tudo que está fora do contorno"
            className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              semFundo
                ? 'bg-accent text-accent-on'
                : 'border border-line text-ink-2 hover:border-accent hover:text-accent'
            }`}
          >
            <Scan size={13} />
            Sem fundo
          </button>
        </div>

        {/* Corpo Principal: Grade de Miniaturas + Painel de Inspeção Lateral */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
            {visiveis.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-3">
                {itens.length === 0
                  ? 'Nenhum objeto marcado nesta imagem ainda.'
                  : 'Nenhum objeto neste filtro.'}
              </p>
            ) : (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${LADO_DA_MINIATURA}px, 1fr))`,
                }}
              >
                {visiveis.map((item, indice) => (
                  <Celula
                    key={item.chave}
                    item={item}
                    indice={indice + 1}
                    miniatura={miniaturas.get(item.chave)}
                    selecionado={itemInspecionado?.chave === item.chave}
                    onInspecionar={() =>
                      setItemInspecionado((atual) => (atual?.chave === item.chave ? null : item))
                    }
                    onAlternarClasse={() =>
                      item.tipo === 'contorno'
                        ? onToggleSegmentationClass(item.segmentacao.id)
                        : onToggleMarkClass?.(item.marca.id)
                    }
                    onRemover={() =>
                      item.tipo === 'contorno'
                        ? onDeleteSegmentation(item.segmentacao.id)
                        : onRemoveMark?.(item.marca.id)
                    }
                    onContornar={
                      item.tipo === 'ponto' && onSegmentarUma
                        ? () => onSegmentarUma(item.marca.id)
                        : undefined
                    }
                    onFocarNoCanvas={
                      onFocarNoCanvas
                        ? () => {
                            const cx = item.caixa.x + item.caixa.largura / 2;
                            const cy = item.caixa.y + item.caixa.altura / 2;
                            onFocarNoCanvas(
                              { x: cx, y: cy },
                              item.tipo === 'contorno' ? item.segmentacao.id : undefined
                            );
                          }
                        : undefined
                    }
                    protocolo={classificaFino ? protocolo : undefined}
                    marca={marcaDoItem(item, marks)}
                    onSubclasse={onSubclasse}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Painel lateral de inspeção detalhada da semente selecionada */}
          {itemInspecionado && (
            <PainelInspecaoGaleria
              item={itemInspecionado}
              indice={itens.findIndex((i) => i.chave === itemInspecionado.chave) + 1}
              miniatura={miniaturas.get(itemInspecionado.chave)}
              umPerPixel={umPerPixel}
              medianaDaCena={medianaDaCena}
              limiares={limiares}
              onClose={() => setItemInspecionado(null)}
              onAlternarClasse={() => {
                if (itemInspecionado.tipo === 'contorno') {
                  onToggleSegmentationClass(itemInspecionado.segmentacao.id);
                } else {
                  onToggleMarkClass?.(itemInspecionado.marca.id);
                }
              }}
              onRemover={() => {
                if (itemInspecionado.tipo === 'contorno') {
                  onDeleteSegmentation(itemInspecionado.segmentacao.id);
                } else {
                  onRemoveMark?.(itemInspecionado.marca.id);
                }
                setItemInspecionado(null);
              }}
              onFocarNoCanvas={
                onFocarNoCanvas
                  ? () => {
                      const cx = itemInspecionado.caixa.x + itemInspecionado.caixa.largura / 2;
                      const cy = itemInspecionado.caixa.y + itemInspecionado.caixa.altura / 2;
                      onFocarNoCanvas(
                        { x: cx, y: cy },
                        itemInspecionado.tipo === 'contorno'
                          ? itemInspecionado.segmentacao.id
                          : undefined
                      );
                    }
                  : undefined
              }
              onSegmentarUma={
                itemInspecionado.tipo === 'ponto' && onSegmentarUma
                  ? () => onSegmentarUma(itemInspecionado.marca.id)
                  : undefined
              }
            />
          )}
        </div>

        {/* Rodapé e Consolidacão */}
        <div className="border-t border-line px-5 py-3 space-y-2">
          {consolidacao && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="text-ink-1 font-bold">
                Germinação{' '}
                <span className="font-mono tabular-nums">
                  {consolidacao.germinacao.toFixed(1).replace('.', ',')}%
                </span>
              </span>
              <span className="text-ink-3">
                sobre {consolidacao.denominador} sementes
                {consolidacao.unidadesExaminadas !== consolidacao.denominador &&
                  ` (${consolidacao.unidadesExaminadas} unidades examinadas)`}
              </span>
              {consolidacao.naoClassificadas > 0 && (
                <span className="text-warn font-semibold">
                  {consolidacao.naoClassificadas} sem classificar — contadas pelo tipo
                </span>
              )}
              {consolidacao.avisos
                .filter((a) => a.tipo === 'tetrazolio-obrigatorio')
                .map((a) => (
                  <span key={a.tipo} className="text-warn font-semibold">
                    {a.texto}
                  </span>
                ))}
            </div>
          )}
          <p className="text-[11px] leading-snug text-ink-3">
            <Layers size={11} className="mr-1 inline" />
            {classificaFino
              ? 'Escolha a classe de cada semente no seletor da célula. Sem escolha, viável conta como normal e inviável como morta.'
              : 'Clique numa célula para inverter classe, duplo clique para focar no canvas com zoom, ou clique no ícone de informação para abrir as métricas biométricas.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A marca que um item representa: a propria, ou a vinculada ao contorno. */
function marcaDoItem(item: ItemDaGaleria, marks: Mark[]): Mark | undefined {
  if (item.tipo === 'ponto') return item.marca;
  const id = item.segmentacao.marcaId;
  return id == null ? undefined : marks.find((m) => m.id === id);
}

function Celula({
  item,
  indice,
  miniatura,
  selecionado,
  onInspecionar,
  onAlternarClasse,
  onRemover,
  onContornar,
  onFocarNoCanvas,
  protocolo,
  marca,
  onSubclasse,
}: {
  key?: React.Key;
  item: ItemDaGaleria;
  indice: number;
  miniatura?: string;
  selecionado?: boolean;
  onInspecionar?: () => void;
  onAlternarClasse: () => void;
  onRemover: () => void;
  /** So nas celulas sem contorno. */
  onContornar?: () => void;
  onFocarNoCanvas?: () => void;
  /** Presente quando ha classe fina para atribuir. */
  protocolo?: Protocolo;
  marca?: Mark;
  onSubclasse?: (marcaId: number, subclasse: ClasseDeSemente | undefined) => void;
}) {
  const viavel = item.categoria === 'viable';
  const cor = viavel ? ESPECIME.viable : ESPECIME.inviable;
  const semContorno = item.tipo === 'ponto';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-surface-2 transition-all ${
        selecionado ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface-1 shadow-lg' : ''
      }`}
      style={{
        borderColor: cor,
        borderStyle: semContorno ? 'dashed' : 'solid',
        borderWidth: semContorno ? 2 : 1,
      }}
      onDoubleClick={onFocarNoCanvas}
    >
      <button
        type="button"
        onClick={onAlternarClasse}
        title={`${viavel ? 'Viável' : 'Inviável'} — clique para inverter, duplo clique para focar`}
        className="block w-full"
      >
        {miniatura ? (
          <img
            src={miniatura}
            alt={`Objeto ${indice}`}
            className="block aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center text-[10px] text-ink-3">
            sem recorte
          </div>
        )}
      </button>

      {/* Índice e classe: legíveis sobre qualquer recorte */}
      <span
        className="pointer-events-none absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold"
        style={{ background: 'rgba(0,0,0,0.62)', color: cor }}
      >
        {indice}
      </span>

      {semContorno && !protocolo && (
        <span
          className="pointer-events-none absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(0,0,0,0.62)', color: cor }}
        >
          falta contornar
        </span>
      )}

      {/* A classe fina */}
      {protocolo && marca && onSubclasse && (
        <select
          value={marca.subclasse ?? ''}
          onChange={(e) =>
            onSubclasse(marca.id, (e.target.value || undefined) as ClasseDeSemente | undefined)
          }
          onClick={(e) => e.stopPropagation()}
          title="Classe do teste de germinacao"
          className="absolute right-1.5 bottom-1.5 left-1.5 rounded border-0 px-1 py-0.5 text-[10px] font-semibold"
          style={{
            background: 'rgba(0,0,0,0.72)',
            color: marca.subclasse ? cor : 'rgba(255,255,255,0.7)',
          }}
        >
          <option value="">{viavel ? 'normal (pelo tipo)' : 'morta (pelo tipo)'}</option>
          {protocolo.classes.map((c) => (
            <option key={c} value={c}>
              {CLASSES[c].rotulo}
            </option>
          ))}
        </select>
      )}

      {/* Botões de Ação no Hover */}
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onFocarNoCanvas && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocarNoCanvas();
            }}
            aria-label="Focar e editar no canvas"
            title="Focar & editar no canvas (zoom)"
            className="rounded bg-black/62 p-1 text-white hover:bg-accent hover:text-accent-on"
          >
            <Crosshair size={12} />
          </button>
        )}

        {onInspecionar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspecionar();
            }}
            aria-label="Ver métricas"
            title="Ver métricas da segmentação"
            className={`rounded p-1 text-white hover:bg-accent hover:text-accent-on ${
              selecionado ? 'bg-accent text-accent-on' : 'bg-black/62'
            }`}
          >
            <Info size={12} />
          </button>
        )}

        {onContornar && (
          <button
            type="button"
            onClick={onContornar}
            aria-label="Contornar esta"
            title="Roda a onda so nesta marcacao"
            className="rounded bg-black/62 p-1 text-white hover:bg-accent"
          >
            <Wand2 size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={onAlternarClasse}
          aria-label="Inverter classe"
          title="Inverter classe"
          className="rounded bg-black/62 p-1 text-white hover:bg-black/80"
        >
          <RefreshCw size={12} />
        </button>

        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover objeto"
          title="Remover objeto"
          className="rounded bg-black/62 p-1 text-white hover:bg-red-600"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PainelInspecaoGaleria({
  item,
  indice,
  miniatura,
  umPerPixel,
  medianaDaCena,
  limiares,
  onClose,
  onAlternarClasse,
  onRemover,
  onFocarNoCanvas,
  onSegmentarUma,
}: {
  item: ItemDaGaleria;
  indice: number;
  miniatura?: string;
  umPerPixel?: number;
  medianaDaCena?: number;
  limiares?: LimiaresDeAglomerado;
  onClose: () => void;
  onAlternarClasse: () => void;
  onRemover: () => void;
  onFocarNoCanvas?: () => void;
  onSegmentarUma?: () => void;
}) {
  const isContorno = item.tipo === 'contorno';
  const viavel = item.categoria === 'viable';
  const cor = viavel ? ESPECIME.viable : ESPECIME.inviable;

  const morfometria = useMemo(() => {
    if (!isContorno) return null;
    const pts = item.segmentacao.polygon_points;
    if (!pts || pts.length < 3) return null;

    const areaPx = areaDoPoligono(pts);
    const fecho = fechoConvexo(pts);
    const areaFecho = areaDoPoligono(fecho);
    const solidez = areaFecho > 0 ? areaPx / areaFecho : 1;

    let perimetroPx = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      perimetroPx += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    }
    const circularidade =
      perimetroPx > 0
        ? Math.min(1, Math.max(0, (4 * Math.PI * areaPx) / (perimetroPx * perimetroPx)))
        : 0;

    let areaMm2: number | undefined;
    let compMm: number | undefined;
    let largMm: number | undefined;
    if (umPerPixel && umPerPixel > 0) {
      areaMm2 = (areaPx * (umPerPixel * umPerPixel)) / 1_000_000;
      if (item.segmentacao.width && item.segmentacao.height) {
        compMm = (Math.max(item.segmentacao.width, item.segmentacao.height) * umPerPixel) / 1000;
        largMm = (Math.min(item.segmentacao.width, item.segmentacao.height) * umPerPixel) / 1000;
      }
    }

    const sinais = analisarContorno(pts, medianaDaCena ?? NaN, limiares);

    return {
      areaPx,
      areaMm2,
      circularidade,
      solidez,
      compMm,
      largMm,
      sinais,
    };
  }, [isContorno, item, umPerPixel, medianaDaCena, limiares]);

  return (
    <aside className="w-80 border-l border-line bg-surface-1 flex flex-col overflow-y-auto p-4 shrink-0 transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-ink-3 uppercase">
            {isContorno ? 'Segmentação de Instância' : 'Marcação Manual'}
          </span>
          <h3 className="text-sm font-bold text-ink-1">Objeto #{indice}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar inspeção"
          className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* Recorte ampliado */}
      <div className="mt-3 relative overflow-hidden rounded-xl border border-line bg-surface-2 aspect-square flex items-center justify-center">
        {miniatura ? (
          <img
            src={miniatura}
            alt={`Recorte ${indice}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-ink-3">Sem recorte disponível</span>
        )}
        <span
          className="absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold"
          style={{ background: 'rgba(0,0,0,0.65)', color: cor }}
        >
          {viavel ? 'Viável' : 'Inviável'}
        </span>
      </div>

      {/* Botões de Ação Imediata */}
      <div className="mt-3 space-y-2">
        {onFocarNoCanvas && (
          <button
            onClick={onFocarNoCanvas}
            title="Abre o canvas na posição desta semente com zoom e ferramentas ativas"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-accent-on hover:bg-accent-strong transition-all shadow-md active:scale-95"
          >
            <Crosshair size={14} />
            Focar & Editar no Canvas
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAlternarClasse}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-1 hover:bg-surface-2 transition-colors"
          >
            <RefreshCw size={12} />
            Inverter
          </button>
          <button
            onClick={onRemover}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-danger/10 hover:border-danger/30 transition-colors"
          >
            <Trash2 size={12} />
            Remover
          </button>
        </div>
      </div>

      {/* Métricas e Biometria */}
      {morfometria && (
        <div className="mt-4 space-y-3">
          {morfometria.sinais.veredito === 'aglomerado' && (
            <div className="rounded-xl border border-warn/30 bg-warn/10 p-2.5 text-ink-1">
              <div className="flex items-center gap-1.5 text-warn font-bold text-xs">
                <AlertTriangle size={14} />
                <span>Possível Aglomerado</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-2 leading-tight">
                {morfometria.sinais.motivo}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface-2/60 p-3 space-y-2">
            <h4 className="text-[11px] font-bold text-ink-2 uppercase tracking-wide">
              Morfometria
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-ink-3 block">Área</span>
                <span className="font-mono font-bold text-ink-1">
                  {morfometria.areaMm2 != null
                    ? `${morfometria.areaMm2.toFixed(3)} mm²`
                    : `${Math.round(morfometria.areaPx)} px²`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-3 block">Circularidade</span>
                <span className="font-mono font-bold text-ink-1">
                  {(morfometria.circularidade * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-3 block">Solidez</span>
                <span className="font-mono font-bold text-ink-1">
                  {(morfometria.solidez * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-3 block">Dimensões</span>
                <span className="font-mono font-bold text-ink-1">
                  {morfometria.compMm != null
                    ? `${morfometria.compMm.toFixed(2)} × ${morfometria.largMm?.toFixed(2)} mm`
                    : `${Math.round(item.caixa.largura)} × ${Math.round(item.caixa.altura)} px`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isContorno && onSegmentarUma && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2/60 p-3 space-y-2">
          <p className="text-xs text-ink-2">
            Esta semente tem ponto marcado, mas ainda não possui máscara de segmentação.
          </p>
          <button
            onClick={onSegmentarUma}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30 px-3 py-2 text-xs font-bold hover:bg-accent/25 transition-colors"
          >
            <Wand2 size={13} />
            Segmentar com a onda
          </button>
        </div>
      )}
    </aside>
  );
}
