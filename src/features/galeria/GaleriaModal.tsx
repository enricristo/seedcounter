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

import React, { useMemo, useState } from 'react';
import { X, Grid3x3, Layers, Trash2, RefreshCw, Scan, Wand2 } from 'lucide-react';
import { ESPECIME } from '../../theme/specimen';
import { montarGaleria, type ItemDaGaleria } from './recortes';
import { recortarTodos, LADO_DA_MINIATURA } from './recortar';
import type { Mark, YoloSegmentation } from '../../types';
import {
  CLASSES,
  consolidar,
  contarPorClasse,
  protocoloPorChave,
  type ClasseDeSemente,
  type Protocolo,
} from '../../lib/normas/classes-de-semente';

type Filtro = 'todos' | 'viable' | 'inviable' | 'sem-contorno';

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'viable', rotulo: 'Viáveis' },
  { id: 'inviable', rotulo: 'Inviáveis' },
  { id: 'sem-contorno', rotulo: 'Falta contornar' },
];

interface GaleriaModalProps {
  isOpen: boolean;
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
}: GaleriaModalProps) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [semFundo, setSemFundo] = useState(false);

  const itens = useMemo(() => {
    if (!isOpen || !image) return [];
    return montarGaleria(marks, yoloSegmentations, {
      largura: image.naturalWidth || image.width,
      altura: image.naturalHeight || image.height,
    });
  }, [isOpen, image, marks, yoloSegmentations]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Grid3x3 size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-1">
                Galeria de objetos
              </h2>
              <p className="text-[11px] text-ink-3">
                {itens.length} {itens.length === 1 ? 'objeto' : 'objetos'}
                {semContorno > 0 && ` • ${semContorno} sem contorno`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={18} />
          </button>
        </div>

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

          {/* A acao mora AQUI porque e aqui que as pendencias ja estao a vista:
              a galeria mostra cada marcacao sem contorno como celula tracejada,
              e o botao resolve exatamente a lista que a pessoa esta olhando. */}
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
                  protocolo={classificaFino ? protocolo : undefined}
                  marca={marcaDoItem(item, marks)}
                  onSubclasse={onSubclasse}
                />
              ))}
            </div>
          )}
        </div>

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
              : 'As células com borda tracejada são marcações sem contorno — a região já está identificada, falta segmentar. Clique numa célula para inverter a classe.'}
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
  onAlternarClasse,
  onRemover,
  onContornar,
  protocolo,
  marca,
  onSubclasse,
}: {
  key?: React.Key;
  item: ItemDaGaleria;
  indice: number;
  miniatura?: string;
  onAlternarClasse: () => void;
  onRemover: () => void;
  /** So nas celulas sem contorno. */
  onContornar?: () => void;
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
      className="group relative overflow-hidden rounded-xl border bg-surface-2"
      style={{
        borderColor: cor,
        borderStyle: semContorno ? 'dashed' : 'solid',
        borderWidth: semContorno ? 2 : 1,
      }}
    >
      <button
        type="button"
        onClick={onAlternarClasse}
        title={`${viavel ? 'Viável' : 'Inviável'} — clique para inverter`}
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

      {/* Índice e classe: legíveis sobre qualquer recorte, por causa do halo. */}
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

      {/* A classe fina. Um select, e nao teclas, porque a galeria e uma grade
          de dezenas de celulas e "qual esta com foco" nao e visivel. O select
          e o proprio rotulo do estado. */}
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

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
