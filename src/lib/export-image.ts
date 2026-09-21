import type { Mark, YoloSegmentation, Metadata } from '../types';
import { corDoEspecime, ESPECIME_FILL } from '../theme/specimen';
import { renderMarksToContext } from './render-marks';

export interface ImageExportOptions {
  includeViable: boolean;
  includeInviable: boolean;
  includeAgglomerated: boolean; // Just in case we support it later
  overlayType: 'none' | 'table' | 'chart' | 'both';
}

function drawPieSlice(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  fillColor: string
) {
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
}

export function drawAnnotatedImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  metadata: Metadata,
  marks: Mark[],
  segmentations: YoloSegmentation[],
  options: ImageExportOptions,
  visualMode: 'dots' | 'numbers',
  ajusteDaMarca: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw base image
  ctx.drawImage(image, 0, 0);

  // Filter segments based on options
  const activeSegments = segmentations.filter((seg) => {
    if (seg.visible === false) return false;
    if (seg.category === 'viable' && !options.includeViable) return false;
    if (seg.category === 'inviable' && !options.includeInviable) return false;
    return true;
  });

  // Filter marks
  const activeMarks = marks.filter((mark) => {
    const isViable = mark.type === 'viable';
    if (isViable && !options.includeViable) return false;
    if (!isViable && !options.includeInviable) return false;
    return true;
  });

  // Draw YOLO segmentations
  activeSegments.forEach((seg) => {
    ctx.beginPath();
    const first = seg.polygon_points[0];
    if (first) {
      ctx.moveTo(first[0], first[1]);
      for (let i = 1; i < seg.polygon_points.length; i++) {
        ctx.lineTo(seg.polygon_points[i][0], seg.polygon_points[i][1]);
      }
      ctx.closePath();

      const isViable = seg.category === 'viable';
      ctx.fillStyle = isViable ? ESPECIME_FILL.viable : ESPECIME_FILL.inviable;
      ctx.fill();

      ctx.strokeStyle = corDoEspecime(isViable ? 'viable' : 'inviable');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // Draw manual marks
  renderMarksToContext(ctx, activeMarks, visualMode, image.width, ajusteDaMarca);

  // Counts
  const totalViable = activeSegments.filter((s) => s.category === 'viable').length + activeMarks.filter(m => m.type === 'viable').length;
  const totalInviable = activeSegments.filter((s) => s.category === 'inviable').length + activeMarks.filter(m => m.type !== 'viable').length;
  const total = totalViable + totalInviable;

  if (options.overlayType === 'none') {
    return; // Done
  }

  // Draw Overlay Box
  const padding = 20;
  const hasMoreDetails = !!(metadata.plate || metadata.quadrant);
  
  let boxW = 340;
  let boxH = hasMoreDetails ? 160 : 140;

  if (options.overlayType === 'table') {
    boxW = 400;
    boxH = hasMoreDetails ? 300 : 280;
  } else if (options.overlayType === 'chart') {
    boxW = 400;
    boxH = hasMoreDetails ? 340 : 320;
  } else if (options.overlayType === 'both') {
    boxW = 400;
    boxH = hasMoreDetails ? 450 : 430;
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = 'rgba(23, 23, 23, 0.85)';
  ctx.beginPath();
  ctx.roundRect(padding, padding, boxW, boxH, 12);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = 'white';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Relatório de Viabilidade', padding + 24, padding + 24);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cbd6d9'; // cor.linha
  let currentY = padding + 60;
  
  if (metadata.researcher) {
    ctx.fillText(`Pesquisador: ${metadata.researcher}`, padding + 24, currentY);
    currentY += 24;
  }
  if (hasMoreDetails) {
    const details = [];
    if (metadata.plate) details.push(`Placa: ${metadata.plate}`);
    if (metadata.quadrant) details.push(`Quad: ${metadata.quadrant}`);
    ctx.fillText(details.join(' | '), padding + 24, currentY);
    currentY += 24;
  }

  currentY += 10;
  ctx.strokeStyle = '#4a585c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding + 24, currentY);
  ctx.lineTo(padding + boxW - 24, currentY);
  ctx.stroke();
  currentY += 20;

  if (options.overlayType === 'table' || options.overlayType === 'both') {
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Tabela de Classes', padding + 24, currentY);
    currentY += 30;

    const vPerc = total > 0 ? Math.round((totalViable / total) * 100) : 0;
    const iPerc = total > 0 ? 100 - vPerc : 0;

    ctx.font = '16px sans-serif';
    
    // Viáveis
    ctx.fillStyle = corDoEspecime('viable');
    ctx.fillText('Viáveis:', padding + 24, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`${totalViable} (${vPerc}%)`, padding + boxW - 24, currentY);
    
    // Inviáveis
    currentY += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = corDoEspecime('inviable');
    ctx.fillText('Inviáveis/Mortas:', padding + 24, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`${totalInviable} (${iPerc}%)`, padding + boxW - 24, currentY);

    // Total
    currentY += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.fillText('Total:', padding + 24, currentY);
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${total}`, padding + boxW - 24, currentY);
    
    currentY += 30;
  }

  if (options.overlayType === 'chart' || options.overlayType === 'both') {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Gráfico de Proporção', padding + 24, currentY);
    currentY += 20;

    const cx = padding + boxW / 2;
    const cy = currentY + 60;
    const radius = 50;

    if (total === 0) {
      drawPieSlice(ctx, cx, cy, radius, 0, 2 * Math.PI, '#4a585c');
    } else {
      const vAngle = (totalViable / total) * 2 * Math.PI;
      // Inviable
      drawPieSlice(ctx, cx, cy, radius, 0, 2 * Math.PI, corDoEspecime('inviable'));
      // Viable
      if (totalViable > 0) {
        drawPieSlice(ctx, cx, cy, radius, -Math.PI/2, -Math.PI/2 + vAngle, corDoEspecime('viable'));
      }
    }

    // Legend
    currentY = cy + radius + 20;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.fillText(`Viáveis (${totalViable})  |  Inviáveis (${totalInviable})`, cx, currentY);
  }
}
