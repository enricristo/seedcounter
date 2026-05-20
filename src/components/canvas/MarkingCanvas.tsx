import React, { useState } from 'react';
import type { Mark, YoloSegmentation } from '../../types';

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
  umPerPixel
}: MarkingCanvasProps) {
  const [hoveredSeg, setHoveredSeg] = useState<YoloSegmentation | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handlePolygonMouseMove = (e: React.MouseEvent, seg: YoloSegmentation) => {
    if (isPanningMode) return;
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    
    // Position tooltip slightly above the cursor
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 45
    });
    setHoveredSeg(seg);
  };

  const handlePolygonClick = (e: React.MouseEvent, seg: YoloSegmentation) => {
    if (isPanningMode) return;
    e.stopPropagation(); // Avoid placing a manual mark when clicking a polygon

    if (e.shiftKey || e.ctrlKey || e.button === 2) {
      // Delete/hide segment
      onDeleteSegmentation(seg.id);
    } else {
      // Toggle category (viable <-> inviable)
      onToggleSegmentationClass(seg.id);
    }
  };

  const handlePolygonMouseLeave = () => {
    setHoveredSeg(null);
  };

  return (
    <div 
      className="relative bg-white dark:bg-[#18181B] shadow-2xl rounded-sm transition-all"
      style={{ 
        width: `${image.width * zoomLevel}px`,
        height: `${image.height * zoomLevel}px`
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
          height: '100%'
        }}
      />

      {/* SVG Overlay for YOLO Polygons */}
      {segmentsVisible && yoloSegmentations.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox={`0 0 ${image.width} ${image.height}`}
          style={{
            width: '100%',
            height: '100%',
            zIndex: 5
          }}
        >
          {yoloSegmentations
            .filter(seg => seg.visible !== false)
            .map(seg => {
              // Convert polygon points array into string representation "x1,y1 x2,y2 ..."
              const pointsStr = seg.polygon_points
                .map(([x, y]) => `${x},${y}`)
                .join(' ');

              const isViable = seg.category === 'viable';
              const isHovered = hoveredSeg?.id === seg.id;
              
              // Colors matching design aesthetics (emerald/red for viable, amber for inviable)
              const fillColor = isViable 
                ? (isHovered ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.25)') // Viable = Red
                : (isHovered ? 'rgba(251, 191, 36, 0.45)' : 'rgba(251, 191, 36, 0.25)'); // Inviable = Yellow

              const strokeColor = isViable ? '#ef4444' : '#fbbf24';

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
                    filter: isHovered ? 'drop-shadow(0px 0px 4px rgba(255,255,255,0.4))' : 'none'
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
            top: `${tooltipPos.y}px`
          }}
        >
          <div className="font-bold border-b border-neutral-700/50 pb-1 mb-1 text-neutral-300">
            Semente YOLO #{hoveredSeg.id}
          </div>
          <div className="space-y-0.5">
            <div>Class: <strong className={hoveredSeg.category === 'viable' ? 'text-red-400' : 'text-amber-400'}>{hoveredSeg.category === 'viable' ? 'Viável' : 'Inviável'}</strong></div>
            <div>Confiança: {(hoveredSeg.confidence * 100).toFixed(1)}%</div>
            {hoveredSeg.width && hoveredSeg.height && (
              <>
                <div>Comprimento: {hoveredSeg.width} px {umPerPixel ? `(${(hoveredSeg.width * umPerPixel).toFixed(1)} µm)` : ''}</div>
                <div>Largura: {hoveredSeg.height} px {umPerPixel ? `(${(hoveredSeg.height * umPerPixel).toFixed(1)} µm)` : ''}</div>
              </>
            )}
            <div className="text-[8px] text-neutral-400 pt-1 border-t border-neutral-700/30 mt-1 uppercase">
              Clique: Alternar • Shift+Clique: Apagar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
