import React, { useState } from 'react';
import type { Mark, YoloSegmentation } from '../../types';
import { ESPECIME, ESPECIME_FILL, corDoEspecime } from '../../theme/specimen';
import type { DetectedObject } from '../../lib/detect';
import { CanvasRulers } from './CanvasRulers';
import { formatLengthDual } from '../../lib/calibration';

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
  segmentsVisible: boolean;
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
  activeTool?: 'viable' | 'inviable' | 'eraser' | 'pan';
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
}

export function MarkingCanvas({
  image,
  marks,
  yoloSegmentations,
  segmentsVisible,
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
}: MarkingCanvasProps) {
  const [hoveredSeg, setHoveredSeg] = useState<YoloSegmentation | null>(null);
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

  const handleLayerMouseMove = (e: React.MouseEvent) => {
    // Arrastando uma marcação: reposiciona em tempo real.
    if (dragMark && onMoveMark) {
      const pos = toImageCoords(e);
      if (pos) {
        onMoveMark(dragMark.id, pos.x, pos.y);
        if (!dragMark.moved) setDragMark({ ...dragMark, moved: true });
      }
      return;
    }

    if (!isEraser) {
      if (cursorPos) setCursorPos(null);
      return;
    }
    const pos = toImageCoords(e);
    if (!pos) return;
    setCursorPos(pos);
    // Arrastar com o botão pressionado apaga continuamente.
    if (isErasing && onEraseArea) onEraseArea(pos.x, pos.y, eraserRadius);
  };

  const endDragMark = () => setDragMark(null);

  const handleLayerMouseDown = (e: React.MouseEvent) => {
    if (!isEraser || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsErasing(true);
    const pos = toImageCoords(e);
    if (pos && onEraseArea) onEraseArea(pos.x, pos.y, eraserRadius);
  };

  const stopErasing = () => setIsErasing(false);

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
        onClick={onCanvasClick}
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

      {/* Fase F — Camada interativa: hover nas marcações + borracha */}
      {(isEraser || onRemoveMark || onToggleMarkClass) && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{
            width: '100%',
            height: '100%',
            zIndex: 8,
            cursor: isEraser ? 'none' : dragMark ? 'grabbing' : 'default',
            // Enquanto arrasta, a camada precisa capturar o movimento do mouse.
            pointerEvents: isEraser || dragMark ? 'auto' : 'none',
          }}
          onMouseMove={handleLayerMouseMove}
          onMouseDown={handleLayerMouseDown}
          onMouseUp={() => {
            stopErasing();
            endDragMark();
          }}
          onMouseLeave={() => {
            stopErasing();
            endDragMark();
            setCursorPos(null);
            setHoveredMarkId(null);
          }}
        >
          {/* Alvos de interação sobre cada marcação */}
          {marks.map((mark) => {
            const isHovered = hoveredMarkId === mark.id;
            const r = Math.max(6, image.width / 130);
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
                strokeWidth={Math.max(1.5, image.width / 500)}
                style={{
                  pointerEvents: 'auto',
                  cursor: isEraser ? 'none' : dragMark?.id === mark.id ? 'grabbing' : 'grab',
                }}
                onMouseEnter={() => setHoveredMarkId(mark.id)}
                onMouseLeave={() => setHoveredMarkId(null)}
                onMouseDown={(e) => {
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
                  setDragMark({ id: mark.id, moved: false });
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
      {segmentsVisible && yoloSegmentations.length > 0 && (
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
              const isHovered = hoveredSeg?.id === seg.id;

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
