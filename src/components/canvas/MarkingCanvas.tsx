import React, { useEffect, useState } from 'react';
import type { Mark, YoloSegmentation } from '../../types';
import { ESPECIME, ESPECIME_FILL, corDoEspecime } from '../../theme/specimen';
import type { DetectedObject } from '../../lib/detect';
import { CanvasRulers } from './CanvasRulers';
import { formatLengthDual } from '../../lib/calibration';
import { regiaoDeDoisPontos, regiaoUtilizavel, type Regiao } from '../../lib/region';
import { AJUSTE_PADRAO, espessuraNaImagem, raioDoAlvo } from '../../lib/escala-da-marca';
import {
  arestaMaisProxima,
  contornoSobOPonto,
  pesosDeInfluencia,
  raioDeInfluencia,
  verticeMaisProximo,
  type Ponto,
} from '../../lib/edicao-de-contorno';

/**
 * O que está sob o cursor na ferramenta de contorno. É o que o realce e o
 * cursor mostram ANTES do clique — a pessoa vê o que o clique vai fazer.
 */
type AlvoDaEdicao =
  | { tipo: 'vertice'; id: number; indice: number }
  | { tipo: 'aresta'; id: number; aresta: number; ponto: Ponto }
  | { tipo: 'contorno'; id: number }
  | null;

// Tamanhos em pixels de TELA. A alça tem o mesmo tamanho sob o dedo em
// qualquer zoom; a versão anterior media em pixels da imagem e ficava
// invisível numa varredura grande com zoom baixo.
const ALCA_PX = 5;
const ALCANCE_DO_VERTICE_PX = 9;
const ALCANCE_DA_ARESTA_PX = 7;
/** Quanto o ponteiro anda antes de um clique virar arraste ou traço. */
const ARRANQUE_PX = 3;

/** Dois alvos iguais não merecem um re-render: o move dispara a cada pixel. */
function mesmoAlvo(a: AlvoDaEdicao, b: AlvoDaEdicao): boolean {
  if (a === b) return true;
  if (!a || !b || a.tipo !== b.tipo || a.id !== b.id) return false;
  if (a.tipo === 'vertice' && b.tipo === 'vertice') return a.indice === b.indice;
  if (a.tipo === 'aresta' && b.tipo === 'aresta') {
    return a.aresta === b.aresta && a.ponto[0] === b.ponto[0] && a.ponto[1] === b.ponto[1];
  }
  return true;
}

/** Prévia da detecção assistida (Fase E) — candidatos ainda não confirmados. */
export interface DetectionPreview {
  objects: DetectedObject[];
  maskDataUrl?: string;
  maskRect?: { x: number; y: number; width: number; height: number };
  showMask: boolean;
}

interface MarkingCanvasProps {
  image: HTMLImageElement;
  marks: Mark[];
  yoloSegmentations: YoloSegmentation[];
  /** Os contornos de segmentacao aparecem? (mascara) */
  mostrarContornos: boolean;
  /** As marcacoes aparecem? (mascara) */
  mostrarPontos: boolean;
  /** Multiplicador do tamanho da marca, controlado pela pessoa. */
  ajusteDaMarca?: number;
  visualMode: 'dots' | 'numbers';
  zoomLevel: number;
  isPanningMode: boolean;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onToggleSegmentationClass: (id: number) => void;
  onDeleteSegmentation: (id: number) => void;
  umPerPixel?: number;
  /** Prévia da detecção assistida (Fase E). */
  detectionPreview?: DetectionPreview | null;
  /** Ferramenta ativa (Fase F — editor). */
  activeTool?: 'viable' | 'inviable' | 'onda' | 'contorno' | 'desenho' | 'eraser' | 'pan';
  /** Raio da borracha, em pixels da imagem. */
  eraserRadius?: number;
  /** Remove uma marcação específica (clique direto nela). */
  onRemoveMark?: (id: number) => void;
  /** Inverte a classe de uma marcação (viável ↔ inviável). */
  onToggleMarkClass?: (id: number) => void;
  /** Reposiciona uma marcação (arrastar). */
  onMoveMark?: (id: number, x: number, y: number) => void;
  /** Apaga todas as marcações dentro do raio (arrastar a borracha). */
  onEraseArea?: (x: number, y: number, radius: number) => void;
  /** Filtro CSS de ajuste de imagem (prévia instantânea). */
  canvasFilter?: string;
  /** Exibe réguas nas bordas (estilo PowerPoint). */
  showRulers?: boolean;
  /** Modo régua ativo: usuário clica dois pontos para calibrar. */
  isMeasuring?: boolean;
  /** Devolve a distância medida, em pixels da imagem. */
  onMeasured?: (pixels: number, a: { x: number; y: number }, b: { x: number; y: number }) => void;
  /** Modo de seleção de região: arrastar define onde a detecção vai rodar. */
  isSelectingRegion?: boolean;
  /** Região já escolhida — continua desenhada enquanto valer. */
  selectedRegion?: Regiao | null;
  /** Devolve a região desenhada, em pixels da imagem. */
  onRegionSelected?: (regiao: Regiao) => void;

  // --- Ajuste de contorno (ferramenta `contorno`) ---
  /** Qual contorno está selecionado para edição. */
  contornoSelecionado?: number | null;
  onSelecionarContorno?: (id: number | null) => void;
  /**
   * Move um vértice do contorno. `rigido` (Shift) move só ele; sem Shift os
   * vizinhos acompanham.
   */
  onMoverVertice?: (id: number, indice: number, x: number, y: number, rigido?: boolean) => void;
  /** Insere um vértice na aresta `aresta`, em (x, y) — clique na borda. */
  onInserirVertice?: (id: number, aresta: number, x: number, y: number) => void;
  /** Remove um vértice (duplo clique ou Ctrl+clique nele). */
  onRemoverVertice?: (id: number, indice: number) => void;
  /**
   * Um gesto contínuo (arraste, traço, borracha) começou / terminou. Quem
   * guarda o histórico usa o par para tratar o gesto inteiro como um passo.
   */
  onInicioDeGesto?: () => void;
  onFimDeGesto?: () => void;
  /**
   * Traço da borracha concluído, em pixels da imagem.
   * `acrescentar` verdadeiro quando a pessoa segurou Shift.
   */
  onRaspar?: (
    id: number,
    pinceladas: { x: number; y: number; raio: number }[],
    acrescentar: boolean
  ) => void;
  /** Raio do traço da borracha de contorno. */
  raioDaRaspagem?: number;
  /** Linha de corte proposta para o contorno selecionado. */
  linhaDeCorte?: [[number, number], [number, number]] | null;
  /** Poligono desenhado a mao, fechado. Em pixels da imagem. */
  onDesenhoConcluido?: (pontos: [number, number][]) => void;
}

export function MarkingCanvas({
  image,
  marks,
  yoloSegmentations,
  mostrarContornos,
  mostrarPontos,
  ajusteDaMarca = AJUSTE_PADRAO,
  visualMode,
  zoomLevel,
  isPanningMode,
  onCanvasClick,
  canvasRef,
  onToggleSegmentationClass,
  onDeleteSegmentation,
  umPerPixel,
  detectionPreview,
  activeTool = 'viable',
  eraserRadius = 20,
  onRemoveMark,
  onToggleMarkClass,
  onMoveMark,
  onEraseArea,
  canvasFilter,
  showRulers,
  isMeasuring,
  onMeasured,
  isSelectingRegion,
  selectedRegion,
  onRegionSelected,
  contornoSelecionado,
  onSelecionarContorno,
  onMoverVertice,
  onInserirVertice,
  onRemoverVertice,
  onInicioDeGesto,
  onFimDeGesto,
  onRaspar,
  raioDaRaspagem = 14,
  linhaDeCorte,
  onDesenhoConcluido,
}: MarkingCanvasProps) {
  const [hoveredSeg, setHoveredSeg] = useState<YoloSegmentation | null>(null);

  // --- Ajuste de contorno ---
  /**
   * Vértice sendo arrastado agora. `origem` é onde o botão desceu: um vértice
   * já existente só começa a andar depois do arranque, para o duplo clique
   * que remove não deixar um "movido 1 px" no histórico.
   */
  const [verticeArrastado, setVerticeArrastado] = useState<{
    id: number;
    indice: number;
    origem: { x: number; y: number } | null;
  } | null>(null);
  /** Traço da borracha em curso, acumulado em pixels da imagem. */
  const [raspagem, setRaspagem] = useState<{
    id: number;
    acrescentar: boolean;
    /** Onde o botão desceu: o traço só nasce depois de andar daqui. */
    origem: { x: number; y: number };
    pinceladas: { x: number; y: number; raio: number }[];
  } | null>(null);
  const [alvoDaEdicao, setAlvoDaEdicao] = useState<AlvoDaEdicao>(null);

  const editandoContorno = activeTool === 'contorno';
  const desenhando = activeTool === 'desenho';

  /** Pixels de tela em pixels da imagem. */
  const naImagem = (px: number) => px / Math.max(zoomLevel, 1e-6);

  const contornosVisiveis = yoloSegmentations.filter((s) => s.visible !== false);
  const selecionado =
    contornoSelecionado != null
      ? (contornosVisiveis.find((s) => s.id === contornoSelecionado) ?? null)
      : null;

  /** O que um clique em `p` atingiria, na ordem de prioridade: vértice, aresta, contorno. */
  const acharAlvo = (p: Ponto): AlvoDaEdicao => {
    if (selecionado) {
      const v = verticeMaisProximo(selecionado.polygon_points, p, naImagem(ALCANCE_DO_VERTICE_PX));
      if (v) return { tipo: 'vertice', id: selecionado.id, indice: v.indice };
      const a = arestaMaisProxima(selecionado.polygon_points, p, naImagem(ALCANCE_DA_ARESTA_PX));
      if (a) return { tipo: 'aresta', id: selecionado.id, aresta: a.aresta, ponto: a.ponto };
    }
    const sob = contornoSobOPonto(contornosVisiveis, p);
    return sob ? { tipo: 'contorno', id: sob.id } : null;
  };

  // Sair da ferramenta limpa o alvo: um realce de aresta sem ferramenta para
  // usá-lo seria um convite a nada.
  useEffect(() => {
    if (!editandoContorno) setAlvoDaEdicao(null);
  }, [editandoContorno]);

  /** Vertices do poligono em construcao, em pixels da imagem. */
  const [desenho, setDesenho] = useState<[number, number][]>([]);

  // Trocar de ferramenta descarta o desenho pela metade. Um poligono aberto
  // sem ferramenta para fecha-lo seria um estado de que nao se sai.
  useEffect(() => {
    if (!desenhando) setDesenho([]);
  }, [desenhando]);

  // Esc cancela. E a unica saida sem fechar, e precisa existir: sem ela a
  // pessoa que errou o primeiro clique teria de trocar de ferramenta.
  // Na ferramenta de contorno, Esc desmarca o contorno selecionado.
  useEffect(() => {
    if (!desenhando && !editandoContorno) return;
    const ao = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (desenhando) setDesenho([]);
      if (editandoContorno) onSelecionarContorno?.(null);
    };
    window.addEventListener('keydown', ao);
    return () => window.removeEventListener('keydown', ao);
  }, [desenhando, editandoContorno, onSelecionarContorno]);

  /** Fecha o poligono se ele tem forma; senao, so limpa. */
  const fecharDesenho = () => {
    if (desenho.length >= 3) onDesenhoConcluido?.(desenho);
    setDesenho([]);
  };
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredMarkId, setHoveredMarkId] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isErasing, setIsErasing] = useState(false);
  /** Marcação sendo arrastada; distingue clique de arraste. */
  const [dragMark, setDragMark] = useState<{ id: number; moved: boolean } | null>(null);

  const isEraser = activeTool === 'eraser';

  /** Converte a posição do mouse para coordenadas da imagem original. */
  const toImageCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * image.width,
      y: ((e.clientY - rect.top) / rect.height) * image.height,
    };
  };

  /**
   * Prende o ponteiro à camada enquanto o gesto durar.
   *
   * Sem isso, sair da imagem no meio de um arraste abandonava o gesto pela
   * metade — e o vértice ficava onde o cursor saiu, não onde a pessoa soltou.
   */
  const capturar = (e: React.PointerEvent) => {
    const el = e.currentTarget as Element & { setPointerCapture?: (id: number) => void };
    if (typeof el.setPointerCapture !== 'function') return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ponteiro já solto (ou ambiente sem DOM real): segue sem captura.
    }
  };

  const removerVertice = (id: number, indice: number) => {
    const seg = contornosVisiveis.find((c) => c.id === id);
    // Um polígono precisa de três pontos para existir.
    if (!seg || seg.polygon_points.length <= 3) return;
    onRemoverVertice?.(id, indice);
  };

  const handleLayerPointerMove = (e: React.PointerEvent) => {
    const pos = toImageCoords(e);
    if (!pos) return;

    // Arrastando um vértice do contorno.
    if (verticeArrastado) {
      const { origem } = verticeArrastado;
      const arrancou =
        !origem || Math.hypot(pos.x - origem.x, pos.y - origem.y) > naImagem(ARRANQUE_PX);
      if (arrancou) {
        if (origem) setVerticeArrastado({ ...verticeArrastado, origem: null });
        onMoverVertice?.(verticeArrastado.id, verticeArrastado.indice, pos.x, pos.y, e.shiftKey);
      }
      return;
    }

    // Raspando a borda: cada movimento vira uma pincelada.
    if (raspagem) {
      const ultima = raspagem.pinceladas[raspagem.pinceladas.length - 1];
      // Só acumula quando o cursor andou de fato: sem isso um tremor de mão
      // enche o traço de pinceladas idênticas e a busca do caminho fica lenta
      // sem ficar melhor. E a primeira só nasce depois do arranque — um
      // clique seco não é traço.
      const andou = ultima
        ? Math.hypot(pos.x - ultima.x, pos.y - ultima.y) > raioDaRaspagem / 2
        : Math.hypot(pos.x - raspagem.origem.x, pos.y - raspagem.origem.y) > naImagem(ARRANQUE_PX);
      if (andou) {
        setRaspagem({
          ...raspagem,
          pinceladas: [...raspagem.pinceladas, { x: pos.x, y: pos.y, raio: raioDaRaspagem }],
        });
      }
      setCursorPos(pos);
      return;
    }

    // Arrastando uma marcação: reposiciona em tempo real.
    if (dragMark && onMoveMark) {
      onMoveMark(dragMark.id, pos.x, pos.y);
      if (!dragMark.moved) setDragMark({ ...dragMark, moved: true });
      return;
    }

    if (editandoContorno) {
      setCursorPos(pos);
      const alvo = acharAlvo([pos.x, pos.y]);
      // Só troca o estado quando o alvo mudou: o move dispara a cada pixel.
      if (!mesmoAlvo(alvo, alvoDaEdicao)) setAlvoDaEdicao(alvo);
      return;
    }

    if (!isEraser) {
      if (cursorPos) setCursorPos(null);
      return;
    }
    setCursorPos(pos);
    // Arrastar com o botão pressionado apaga continuamente.
    if (isErasing && onEraseArea) onEraseArea(pos.x, pos.y, eraserRadius);
  };

  /**
   * Fecha o que estiver em curso. Um só ponto de saída para o mouseup, o
   * cancelamento e a perda da captura, para nenhum caminho deixar gesto
   * aberto no histórico.
   */
  const encerrarGestos = () => {
    if (isErasing) {
      setIsErasing(false);
      onFimDeGesto?.();
    }
    if (dragMark) {
      setDragMark(null);
      onFimDeGesto?.();
    }
    if (verticeArrastado) {
      setVerticeArrastado(null);
      onFimDeGesto?.();
    }
    if (raspagem) {
      if (raspagem.pinceladas.length > 0) {
        onRaspar?.(raspagem.id, raspagem.pinceladas, raspagem.acrescentar);
      } else {
        // Clique seco, longe de vértice e aresta: desmarca. É a saída sem
        // teclado, e é o que "clicar no vazio" faz em qualquer editor.
        onSelecionarContorno?.(null);
      }
      setRaspagem(null);
    }
  };

  const handleLayerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    if (editandoContorno) {
      const pos = toImageCoords(e);
      if (!pos) return;
      e.preventDefault();
      e.stopPropagation();
      const alvo = acharAlvo([pos.x, pos.y]);

      if (alvo?.tipo === 'vertice') {
        // Ctrl no vértice remove. Shift não: Shift é "acrescentar" no traço,
        // e o traço pode começar em cima de um vértice. Alt também não: Alt
        // segurado já é a borracha temporária, e nem chegaria aqui.
        if (e.ctrlKey || e.metaKey) {
          removerVertice(alvo.id, alvo.indice);
          return;
        }
        onInicioDeGesto?.();
        setVerticeArrastado({ id: alvo.id, indice: alvo.indice, origem: pos });
        capturar(e);
        return;
      }

      if (alvo?.tipo === 'aresta' && !e.shiftKey) {
        // Clicar na borda cria o vértice ali e já sai arrastando: é o gesto
        // de "puxar a borda daqui", sem passo intermediário.
        onInicioDeGesto?.();
        onInserirVertice?.(alvo.id, alvo.aresta, alvo.ponto[0], alvo.ponto[1]);
        setVerticeArrastado({ id: alvo.id, indice: alvo.aresta + 1, origem: null });
        capturar(e);
        return;
      }

      if (alvo?.tipo === 'contorno' && alvo.id !== contornoSelecionado) {
        onSelecionarContorno?.(alvo.id);
        return;
      }

      if (selecionado) {
        // Longe de vértice e aresta: é traço. Dentro remove; com Shift
        // acrescenta — o mesmo gesto, o outro sentido, que é como o
        // algoritmo também enxerga os dois casos.
        setRaspagem({ id: selecionado.id, acrescentar: e.shiftKey, origem: pos, pinceladas: [] });
        capturar(e);
      }
      return;
    }

    if (!isEraser) return;
    e.preventDefault();
    e.stopPropagation();
    onInicioDeGesto?.();
    setIsErasing(true);
    capturar(e);
    const pos = toImageCoords(e);
    if (pos && onEraseArea) onEraseArea(pos.x, pos.y, eraserRadius);
  };

  const handleLayerDoubleClick = (e: React.MouseEvent) => {
    if (!editandoContorno) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    const alvo = acharAlvo([pos.x, pos.y]);
    if (alvo?.tipo === 'vertice') {
      e.preventDefault();
      e.stopPropagation();
      removerVertice(alvo.id, alvo.indice);
    }
  };

  /** Cursor que anuncia o que o clique vai fazer. */
  const cursorDaEdicao = verticeArrastado
    ? 'grabbing'
    : raspagem
      ? 'crosshair'
      : alvoDaEdicao?.tipo === 'vertice'
        ? 'grab'
        : alvoDaEdicao?.tipo === 'aresta'
          ? 'copy'
          : alvoDaEdicao?.tipo === 'contorno' && alvoDaEdicao.id !== contornoSelecionado
            ? 'pointer'
            : selecionado
              ? 'crosshair'
              : 'default';

  // --- Régua de calibração: dois cliques definem a distância conhecida ---
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);

  const handleRulerClick = (e: React.MouseEvent) => {
    const pos = toImageCoords(e);
    if (!pos) return;
    e.stopPropagation();

    if (!rulerStart || rulerEnd) {
      // Primeiro ponto (ou reinício após uma medição concluída)
      setRulerStart(pos);
      setRulerEnd(null);
    } else {
      setRulerEnd(pos);
      onMeasured?.(Math.hypot(pos.x - rulerStart.x, pos.y - rulerStart.y), rulerStart, pos);
    }
  };

  const handleRulerMove = (e: React.MouseEvent) => {
    const pos = toImageCoords(e);
    if (pos) setCursorPos(pos);
  };

  // --- Região de detecção: um arraste define onde o modelo vai rodar ---
  // Arraste, e não dois cliques como a régua: aqui o retorno visual contínuo
  // do retângulo é o que deixa a pessoa enquadrar o que quer, e o gesto é o
  // mesmo de qualquer seleção retangular que ela já conhece.
  const [arrasteInicio, setArrasteInicio] = useState<{ x: number; y: number } | null>(null);
  const [arrasteAtual, setArrasteAtual] = useState<{ x: number; y: number } | null>(null);

  const regiaoEmConstrucao =
    arrasteInicio && arrasteAtual
      ? regiaoDeDoisPontos(arrasteInicio.x, arrasteInicio.y, arrasteAtual.x, arrasteAtual.y)
      : null;

  const iniciarRegiao = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = toImageCoords(e);
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    setArrasteInicio(pos);
    setArrasteAtual(pos);
  };

  const arrastarRegiao = (e: React.MouseEvent) => {
    if (!arrasteInicio) return;
    const pos = toImageCoords(e);
    if (pos) setArrasteAtual(pos);
  };

  const concluirRegiao = () => {
    // Arraste curto demais é clique com a mão trêmula, não seleção: descarta
    // em silêncio em vez de mandar o modelo rodar num retângulo de 3 px.
    if (regiaoUtilizavel(regiaoEmConstrucao)) onRegionSelected?.(regiaoEmConstrucao);
    setArrasteInicio(null);
    setArrasteAtual(null);
  };

  const regiaoDesenhada = regiaoEmConstrucao ?? selectedRegion ?? null;

  const handlePolygonMouseMove = (e: React.MouseEvent, seg: YoloSegmentation) => {
    if (isPanningMode) return;
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    // Position tooltip slightly above the cursor
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 45,
    });
    setHoveredSeg(seg);
  };

  const handlePolygonClick = (e: React.MouseEvent, seg: YoloSegmentation) => {
    if (isPanningMode) return;
    e.stopPropagation(); // Avoid placing a manual mark when clicking a polygon

    // Mesma regra da marcação manual: Ctrl inverte a classe, Shift/Alt e o
    // botão direito apagam, clique simples não faz nada.
    if (e.shiftKey || e.altKey || e.button === 2) {
      onDeleteSegmentation(seg.id);
    } else if (e.ctrlKey || e.metaKey) {
      onToggleSegmentationClass(seg.id);
    }
  };

  const handlePolygonMouseLeave = () => {
    setHoveredSeg(null);
  };

  return (
    <div
      className="relative bg-surface-1 shadow-2xl rounded-sm transition-all"
      style={{
        width: `${image.width * zoomLevel}px`,
        height: `${image.height * zoomLevel}px`,
      }}
    >
      {/* Underlying Canvas for image and manual marks */}
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          if (desenhando) {
            const pos = toImageCoords(e);
            if (!pos) return;
            // Clicar perto do PRIMEIRO vertice fecha: e o gesto natural de
            // "voltei ao comeco", e nao exige saber que duplo clique existe.
            const primeiro = desenho[0];
            const raioDeFecho = Math.max(6, image.width / 150);
            if (
              primeiro &&
              desenho.length >= 3 &&
              Math.hypot(pos.x - primeiro[0], pos.y - primeiro[1]) < raioDeFecho
            ) {
              fecharDesenho();
              return;
            }
            setDesenho((d) => [...d, [pos.x, pos.y]]);
            return;
          }
          onCanvasClick(e);
        }}
        onDoubleClick={(e) => {
          if (!desenhando) return;
          e.preventDefault();
          // O duplo clique ja colocou um vertice no primeiro clique; o segundo
          // clique do par cairia em cima dele. Fecha sem duplicar.
          fecharDesenho();
        }}
        onMouseDown={(e) => {
          if (e.button === 2) onCanvasClick(e as any);
        }}
        className={`${isPanningMode ? '' : 'cursor-crosshair'} block absolute inset-0 w-full h-full`}
        style={{
          width: '100%',
          height: '100%',
          filter: canvasFilter && canvasFilter !== 'none' ? canvasFilter : undefined,
        }}
      />

      {/* Réguas nas bordas, com unidades reais quando calibrado */}
      {showRulers && (
        <CanvasRulers
          imageWidth={image.width}
          imageHeight={image.height}
          zoomLevel={zoomLevel}
          umPerPixel={umPerPixel}
        />
      )}

      {/* Régua de calibração — camada acima de tudo */}
      {isMeasuring && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{ width: '100%', height: '100%', zIndex: 12, cursor: 'crosshair' }}
          onClick={handleRulerClick}
          onMouseMove={handleRulerMove}
          onMouseLeave={() => setCursorPos(null)}
        >
          {/* Fundo semitransparente para destacar o modo de medição */}
          <rect
            x={0}
            y={0}
            width={image.width}
            height={image.height}
            fill="rgba(14,165,233,0.06)"
          />

          {/* Linha em construção (do primeiro ponto até o cursor) */}
          {rulerStart && !rulerEnd && cursorPos && (
            <line
              x1={rulerStart.x}
              y1={rulerStart.y}
              x2={cursorPos.x}
              y2={cursorPos.y}
              stroke={ESPECIME.tool}
              className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
              strokeWidth={Math.max(2, image.width / 400)}
              strokeDasharray={`${image.width / 100},${image.width / 150}`}
            />
          )}

          {/* Linha final medida */}
          {rulerStart && rulerEnd && (
            <line
              x1={rulerStart.x}
              y1={rulerStart.y}
              x2={rulerEnd.x}
              y2={rulerEnd.y}
              stroke={ESPECIME.tool}
              className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
              strokeWidth={Math.max(2, image.width / 400)}
            />
          )}

          {/* Marcadores das extremidades */}
          {[rulerStart, rulerEnd].map((p, i) =>
            p ? (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(4, image.width / 220)}
                  fill={ESPECIME.tool}
                  className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(8, image.width / 110)}
                  fill="none"
                  stroke={ESPECIME.tool}
                  className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
                  strokeWidth={Math.max(1, image.width / 800)}
                  opacity={0.5}
                />
              </g>
            ) : null
          )}
        </svg>
      )}

      {/* Região de detecção — camada de arraste, acima de tudo */}
      {isSelectingRegion && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{ width: '100%', height: '100%', zIndex: 13, cursor: 'crosshair' }}
          onMouseDown={iniciarRegiao}
          onMouseMove={arrastarRegiao}
          onMouseUp={concluirRegiao}
          onMouseLeave={concluirRegiao}
        >
          {/* Escurece o que está FORA da região: o recorte é a informação, e
              quatro retângulos ao redor mostram isso sem depender de máscara
              SVG, que alguns navegadores rasterizam mal em zoom alto. */}
          {regiaoDesenhada ? (
            <>
              <rect x={0} y={0} width={image.width} height={regiaoDesenhada.y} fill="rgba(0,0,0,0.45)" />
              <rect
                x={0}
                y={regiaoDesenhada.y + regiaoDesenhada.height}
                width={image.width}
                height={Math.max(0, image.height - regiaoDesenhada.y - regiaoDesenhada.height)}
                fill="rgba(0,0,0,0.45)"
              />
              <rect
                x={0}
                y={regiaoDesenhada.y}
                width={regiaoDesenhada.x}
                height={regiaoDesenhada.height}
                fill="rgba(0,0,0,0.45)"
              />
              <rect
                x={regiaoDesenhada.x + regiaoDesenhada.width}
                y={regiaoDesenhada.y}
                width={Math.max(0, image.width - regiaoDesenhada.x - regiaoDesenhada.width)}
                height={regiaoDesenhada.height}
                fill="rgba(0,0,0,0.45)"
              />
              <rect
                x={regiaoDesenhada.x}
                y={regiaoDesenhada.y}
                width={regiaoDesenhada.width}
                height={regiaoDesenhada.height}
                fill="none"
                stroke={ESPECIME.tool}
                strokeWidth={Math.max(2, image.width / 500)}
                strokeDasharray={`${image.width / 120},${image.width / 200}`}
                className="[filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
              />
            </>
          ) : (
            <rect
              x={0}
              y={0}
              width={image.width}
              height={image.height}
              fill="rgba(0,0,0,0.25)"
            />
          )}
        </svg>
      )}

      {/* Fase F — Camada interativa: hover nas marcações, borracha e a
          ferramenta de contorno. Na ferramenta de contorno ela captura TUDO:
          a versão anterior só capturava com a borracha ou arrastando marca,
          e o arraste de vértice perdia o mouse assim que saía da alça. */}
      {(isEraser || onRemoveMark || onToggleMarkClass) && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{
            width: '100%',
            height: '100%',
            zIndex: 8,
            cursor: isEraser
              ? 'none'
              : editandoContorno
                ? cursorDaEdicao
                : dragMark
                  ? 'grabbing'
                  : 'default',
            pointerEvents: isEraser || dragMark || editandoContorno ? 'auto' : 'none',
          }}
          onPointerMove={handleLayerPointerMove}
          onPointerDown={handleLayerPointerDown}
          onPointerUp={encerrarGestos}
          onPointerCancel={encerrarGestos}
          onLostPointerCapture={encerrarGestos}
          onDoubleClick={handleLayerDoubleClick}
          onPointerLeave={() => {
            // Com captura, o ponteiro não "sai" no meio do gesto; sem ela
            // (navegador antigo), sair encerra — melhor do que arrastar às cegas.
            encerrarGestos();
            setCursorPos(null);
            setHoveredMarkId(null);
            setAlvoDaEdicao(null);
          }}
        >
          {/* Alvos de interacao sobre cada marcacao.
              Com a mascara em "nada" as marcacoes somem INTEIRAS — inclusive o
              alvo de clique. Deixar o alvo invisivel porem clicavel criaria uma
              area que responde sem nada a mostrar, que e pior que nao ter.
              Na ferramenta de contorno os alvos saem: ali o clique e do
              contorno, e uma marca por cima roubaria o vertice. */}
          {(mostrarPontos && !editandoContorno ? marks : []).map((mark) => {
            const isHovered = hoveredMarkId === mark.id;
            // Mesma fonte que o desenho da marca, para o alvo nunca ficar menor
            // que o que a pessoa esta vendo.
            const r = raioDoAlvo(image.width, ajusteDaMarca);
            // Cor do realce indica a ação: vermelho apaga, branco inverte.
            const highlight = isEraser ? 'var(--color-danger)' : ESPECIME.tool;
            return (
              <circle
                key={`hit-${mark.id}`}
                cx={mark.x}
                cy={mark.y}
                r={r}
                fill={
                  isHovered
                    ? isEraser
                      ? 'rgba(192,57,46,0.35)'
                      : 'rgba(255,255,255,0.22)'
                    : 'transparent'
                }
                stroke={isHovered ? highlight : 'none'}
                strokeWidth={espessuraNaImagem(image.width, 1.5)}
                style={{
                  pointerEvents: 'auto',
                  cursor: isEraser ? 'none' : dragMark?.id === mark.id ? 'grabbing' : 'grab',
                }}
                onMouseEnter={() => setHoveredMarkId(mark.id)}
                onMouseLeave={() => setHoveredMarkId(null)}
                onPointerDown={(e) => {
                  // Arrastar reposiciona a marcação (só com a ferramenta de marcação).
                  if (
                    isEraser ||
                    e.button !== 0 ||
                    e.shiftKey ||
                    e.altKey ||
                    e.ctrlKey ||
                    e.metaKey
                  )
                    return;
                  e.stopPropagation();
                  onInicioDeGesto?.();
                  setDragMark({ id: mark.id, moved: false });
                  // A captura vai para a CAMADA, que e quem ouve o movimento.
                  const camada = (e.currentTarget as SVGElement).ownerSVGElement;
                  if (camada && typeof camada.setPointerCapture === 'function') {
                    try {
                      camada.setPointerCapture(e.pointerId);
                    } catch {
                      // Sem captura: o arraste segue enquanto o cursor ficar na camada.
                    }
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Se houve arraste, não interpreta como clique.
                  if (dragMark?.moved) return;

                  // O clique simples fica LIVRE para arrastar. Antes ele
                  // invertia a classe, então parar em cima de uma marcação sem
                  // mover trocava viável por inviável sem querer — o erro mais
                  // caro possível numa contagem de viabilidade.
                  if (isEraser || e.shiftKey || e.altKey) {
                    onRemoveMark?.(mark.id);
                    setHoveredMarkId(null);
                  } else if (e.ctrlKey || e.metaKey) {
                    onToggleMarkClass?.(mark.id);
                  }
                }}
              />
            );
          })}

          {/* Cursor da borracha */}
          {isEraser && cursorPos && (
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={eraserRadius}
              fill="rgba(244,63,94,0.12)"
              stroke="var(--color-danger)"
              strokeWidth={Math.max(1.5, image.width / 600)}
              strokeDasharray={`${image.width / 120},${image.width / 200}`}
              pointerEvents="none"
            />
          )}
        </svg>
      )}

      {/* Fase E — Máscara da detecção assistida (ajuda no ajuste dos parâmetros) */}
      {detectionPreview?.showMask && detectionPreview.maskDataUrl && detectionPreview.maskRect && (
        <img
          src={detectionPreview.maskDataUrl}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{
            left: `${(detectionPreview.maskRect.x / image.width) * 100}%`,
            top: `${(detectionPreview.maskRect.y / image.height) * 100}%`,
            width: `${(detectionPreview.maskRect.width / image.width) * 100}%`,
            height: `${(detectionPreview.maskRect.height / image.height) * 100}%`,
            imageRendering: 'pixelated',
            zIndex: 3,
          }}
        />
      )}

      {/* Fase E — Marcadores dos candidatos detectados (ainda não confirmados) */}
      {detectionPreview && detectionPreview.objects.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{ width: '100%', height: '100%', zIndex: 6 }}
        >
          {detectionPreview.objects.map((o, i) => (
            <circle
              key={`det-${i}`}
              cx={o.x}
              cy={o.y}
              r={Math.max(3, o.radius)}
              fill="rgba(16, 185, 129, 0.20)"
              stroke={corDoEspecime(o.split ? 'inviable' : 'viable')}
              strokeWidth={Math.max(1, image.width / 900)}
              strokeDasharray={o.split ? `${image.width / 200},${image.width / 300}` : undefined}
            />
          ))}
        </svg>
      )}

      {/* SVG Overlay for YOLO Polygons */}
      {mostrarContornos && yoloSegmentations.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{
            width: '100%',
            height: '100%',
            zIndex: 5,
          }}
        >
          {yoloSegmentations
            .filter((seg) => seg.visible !== false)
            .map((seg) => {
              // Convert polygon points array into string representation "x1,y1 x2,y2 ..."
              const pointsStr = seg.polygon_points.map(([x, y]) => `${x},${y}`).join(' ');

              const isViable = seg.category === 'viable';
              const isHovered =
                hoveredSeg?.id === seg.id ||
                (alvoDaEdicao?.tipo === 'contorno' && alvoDaEdicao.id === seg.id);

              // Linguagem do especime: ciano e magenta praticamente nao ocorrem
              // em material biologico, entao o contorno sobrevive a qualquer
              // lamina — inclusive corada por tetrazolio, que e carmim.
              const fillColor = isViable
                ? isHovered
                  ? ESPECIME_FILL.viableHover
                  : ESPECIME_FILL.viable
                : isHovered
                  ? ESPECIME_FILL.inviableHover
                  : ESPECIME_FILL.inviable;

              const strokeColor = corDoEspecime(isViable ? 'viable' : 'inviable');

              return (
                <polygon
                  key={seg.id}
                  points={pointsStr}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                  className="pointer-events-auto cursor-pointer transition-all duration-150"
                  // Na ferramenta de contorno a camada interativa fica por
                  // cima e seleciona por geometria; aqui so chega o clique
                  // das outras ferramentas.
                  onClick={(e) => handlePolygonClick(e, seg)}
                  onMouseDown={(e) => {
                    if (e.button === 2) {
                      e.preventDefault();
                      handlePolygonClick(e, seg);
                    }
                  }}
                  onMouseMove={(e) => handlePolygonMouseMove(e, seg)}
                  onMouseLeave={handlePolygonMouseLeave}
                  style={{
                    filter: isHovered ? 'drop-shadow(0px 0px 4px rgba(255,255,255,0.4))' : 'none',
                  }}
                />
              );
            })}
        </svg>
      )}

      {/* O poligono em construcao. Aparece so na ferramenta de desenho: os
          vertices ja colocados, o fio entre eles, e uma linha elastica ate o
          cursor mostrando onde o proximo cairia. O primeiro vertice e maior:
          e o alvo para fechar. */}
      {desenhando && desenho.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{ width: '100%', height: '100%', zIndex: 9 }}
        >
          {(() => {
            const traco = Math.max(1.5, image.width / 400);
            const raio = Math.max(3, image.width / 220);
            const cor = ESPECIME.tool;
            const caminho = desenho.map(([x, y]) => `${x},${y}`).join(' ');
            return (
              <g>
                {/* Halo escuro sob o fio, para sobreviver a lamina clara. */}
                <polyline
                  points={caminho}
                  fill="none"
                  stroke={ESPECIME.halo}
                  strokeWidth={traco * 2.2}
                  strokeLinejoin="round"
                />
                <polyline
                  points={caminho}
                  fill="none"
                  stroke={cor}
                  strokeWidth={traco}
                  strokeLinejoin="round"
                />
                {cursorPos && desenho.length > 0 && (
                  <line
                    x1={desenho[desenho.length - 1][0]}
                    y1={desenho[desenho.length - 1][1]}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke={cor}
                    strokeWidth={traco}
                    strokeDasharray={`${traco * 3},${traco * 2}`}
                    opacity={0.7}
                  />
                )}
                {desenho.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={i === 0 ? raio * 1.6 : raio}
                    fill={i === 0 ? cor : ESPECIME.halo}
                    stroke={cor}
                    strokeWidth={traco * 0.8}
                  />
                ))}
              </g>
            );
          })()}
        </svg>
      )}

      {/* Camada de edição de contorno: só desenho. Quem ouve o mouse é a
          camada interativa; esta fica por cima dela sem pegar evento, para as
          alças nunca roubarem o ponteiro do gesto em curso. */}
      {editandoContorno && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{ width: '100%', height: '100%', zIndex: 9 }}
        >
          {selecionado &&
            (() => {
              const pontos = selecionado.polygon_points;
              // Alca menor quando os vertices estao apertados na tela: 48
              // alcas de 5 px num grao de 150 px viravam um colar sem
              // contorno visivel. Nunca menor que 2 px — abaixo disso e ruido.
              const espacamentoNaTela = (raioDeInfluencia(pontos) * 8 * zoomLevel) / Math.max(pontos.length, 1);
              const alca = naImagem(Math.max(2, Math.min(ALCA_PX, espacamentoNaTela / 4)));
              const traco = naImagem(1.5);
              const cor = corDoEspecime(selecionado.category === 'viable' ? 'viable' : 'inviable');
              const caminho = pontos.map(([x, y]) => `${x},${y}`).join(' ');
              const emArraste = verticeArrastado?.id === selecionado.id ? verticeArrastado.indice : -1;
              const sobOCursor =
                alvoDaEdicao?.tipo === 'vertice' && alvoDaEdicao.id === selecionado.id
                  ? alvoDaEdicao.indice
                  : -1;
              // Quem vai junto no puxao: pinta antes do clique, para a pessoa
              // ver o alcance do arraste suave em vez de descobrir puxando.
              const foco = emArraste >= 0 ? emArraste : sobOCursor;
              const pesos = foco >= 0 ? pesosDeInfluencia(pontos, foco, raioDeInfluencia(pontos)) : null;
              return (
                <g>
                  {/* O contorno selecionado ganha halo: e o unico que a
                      ferramenta edita, e precisa se distinguir dos vizinhos. */}
                  <polygon
                    points={caminho}
                    fill="none"
                    stroke={ESPECIME.halo}
                    strokeWidth={traco * 3}
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={caminho}
                    fill="none"
                    stroke={ESPECIME.tool}
                    strokeWidth={traco}
                    strokeLinejoin="round"
                  />

                  {/* Onde um clique inseriria um vertice: a alca fantasma
                      aparece na aresta antes do clique. */}
                  {alvoDaEdicao?.tipo === 'aresta' && !verticeArrastado && (
                    <circle
                      cx={alvoDaEdicao.ponto[0]}
                      cy={alvoDaEdicao.ponto[1]}
                      r={alca}
                      fill={ESPECIME.halo}
                      stroke={ESPECIME.tool}
                      strokeWidth={traco}
                      strokeDasharray={`${traco * 2},${traco * 1.5}`}
                    />
                  )}

                  {pontos.map(([x, y], i) => {
                    const ativo = i === emArraste || i === sobOCursor;
                    const peso = pesos ? pesos[i] : 0;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={ativo ? alca * 1.6 : alca * (1 + 0.3 * peso)}
                        fill={ativo ? cor : ESPECIME.tool}
                        fillOpacity={ativo ? 1 : 0.55 + 0.45 * peso}
                        stroke={ativo ? ESPECIME.tool : cor}
                        strokeWidth={traco}
                      />
                    );
                  })}
                </g>
              );
            })()}

          {/* O pincel da raspagem, onde o traco vai passar. Some sobre vertice
              e aresta, onde o clique faz outra coisa. */}
          {selecionado &&
            cursorPos &&
            !verticeArrastado &&
            alvoDaEdicao?.tipo !== 'vertice' &&
            alvoDaEdicao?.tipo !== 'aresta' && (
              <circle
                cx={cursorPos.x}
                cy={cursorPos.y}
                r={raioDaRaspagem}
                fill="none"
                stroke={ESPECIME.tool}
                strokeWidth={naImagem(1)}
                strokeDasharray={`${naImagem(3)},${naImagem(2)}`}
                opacity={0.75}
              />
            )}

          {/* A linha de corte proposta, ANTES de aplicar.
              Mostrar a proposta e nao aplicar direto e o que permite recusar:
              cortar por engano vira duas sementes onde havia uma, e o numero
              do laudo sobe. */}
          {linhaDeCorte && (
            <g>
              <line
                x1={linhaDeCorte[0][0]}
                y1={linhaDeCorte[0][1]}
                x2={linhaDeCorte[1][0]}
                y2={linhaDeCorte[1][1]}
                stroke={ESPECIME.halo}
                strokeWidth={Math.max(3, image.width / 180)}
                strokeLinecap="round"
              />
              <line
                x1={linhaDeCorte[0][0]}
                y1={linhaDeCorte[0][1]}
                x2={linhaDeCorte[1][0]}
                y2={linhaDeCorte[1][1]}
                stroke={ESPECIME.tool}
                strokeWidth={Math.max(1.5, image.width / 380)}
                strokeDasharray={`${image.width / 120},${image.width / 200}`}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* O traço em curso, para a pessoa ver o que está declarando. */}
          {raspagem?.pinceladas.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.raio}
              fill={raspagem.acrescentar ? 'rgba(0,229,255,0.28)' : 'rgba(192,57,46,0.30)'}
              stroke={raspagem.acrescentar ? ESPECIME.viable : 'var(--color-danger)'}
              strokeWidth={1}
            />
          ))}
        </svg>
      )}

      {/* Floating details tooltip on hover of YOLO polygons */}
      {hoveredSeg && (
        <div
          className="absolute z-30 bg-neutral-900/90 dark:bg-black/95 text-white p-2.5 rounded-lg text-[10px] font-mono shadow-xl pointer-events-none border border-neutral-700 dark:border-zinc-800"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className="font-bold border-b border-neutral-700/50 pb-1 mb-1 text-neutral-300">
            Semente YOLO #{hoveredSeg.id}
          </div>
          <div className="space-y-0.5">
            <div>
              Class:{' '}
              <strong
                className={hoveredSeg.category === 'viable' ? 'text-red-400' : 'text-amber-400'}
              >
                {hoveredSeg.category === 'viable' ? 'Viável' : 'Inviável'}
              </strong>
            </div>
            <div>Confiança: {(hoveredSeg.confidence * 100).toFixed(1)}%</div>
            {hoveredSeg.width && hoveredSeg.height && (
              <>
                {/* Pixel e milímetro juntos: o pixel é o que a imagem tem, o
                    milímetro é a unidade em que a semente é descrita e
                    publicada. Mostrar só um obriga a converter de cabeça. */}
                <div>Comprimento: {formatLengthDual(hoveredSeg.width, umPerPixel)}</div>
                <div>Largura: {formatLengthDual(hoveredSeg.height, umPerPixel)}</div>
                {hoveredSeg.height > 0 && (
                  <div>Razão C/L: {(hoveredSeg.width / hoveredSeg.height).toFixed(2)}</div>
                )}
              </>
            )}
            <div className="text-[8px] text-neutral-400 pt-1 border-t border-neutral-700/30 mt-1 uppercase">
              Ctrl+clique: inverter classe • Shift+clique: apagar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
