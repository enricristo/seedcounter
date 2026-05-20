import { jsPDF } from 'jspdf';
import type { Metadata, Mark, YoloSegmentation } from '../types';

interface PDFGeneratorProps {
  filename: string;
  metadata: Metadata;
  viableCount: number;
  inviableCount: number;
  totalCount: number;
  viablePercent: string;
  inviablePercent: string;
  marks: Mark[];
  yoloSegmentations?: YoloSegmentation[];
  canvasElement: HTMLCanvasElement | null;
  imageElement: HTMLImageElement | null;
  visualMode: 'dots' | 'numbers';
}

export function generatePDFReport({
  filename,
  metadata,
  viableCount,
  inviableCount,
  totalCount,
  viablePercent,
  inviablePercent,
  marks,
  yoloSegmentations = [],
  canvasElement,
  imageElement,
  visualMode
}: PDFGeneratorProps) {
  if (!imageElement || !canvasElement) {
    alert("Erro: Amostra de imagem não carregada.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
    const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
    const margin = 40;

    // Helper: Draw header border/accents
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, pageWidth, 12, 'F');

    // Header Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Zinc 800
    doc.text("Relatório de Contagem de Sementes", margin, 42);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text("GRUPO DE PESQUISA EM ORQUÍDEAS (GPEORQ) • UNOESTE", margin, 56);

    // Meta: Date & File
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const dateStr = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, pageWidth - margin - 150, 42);
    doc.text(`Arquivo: ${filename}`, pageWidth - margin - 150, 56);

    doc.setDrawColor(226, 232, 240); // border line
    doc.setLineWidth(1);
    doc.line(margin, 68, pageWidth - margin, 68);

    // 1. Analytical Results Grid
    const gridY = 85;
    
    // Viable card background
    doc.setFillColor(254, 242, 242); // Red 50
    doc.roundedRect(margin, gridY, 160, 65, 8, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38); // Red 600
    doc.text("SEMENTES VIÁVEIS", margin + 15, gridY + 22);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`${viableCount}`, margin + 15, gridY + 48);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(127, 29, 29);
    doc.text(`(${viablePercent}%)`, margin + 65, gridY + 48);

    // Inviable card background
    doc.setFillColor(255, 251, 235); // Yellow 50
    doc.roundedRect(margin + 175, gridY, 160, 65, 8, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(217, 119, 6); // Yellow 600
    doc.text("SEMENTES INVIÁVEIS", margin + 190, gridY + 22);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`${inviableCount}`, margin + 190, gridY + 48);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 4);
    doc.text(`(${inviablePercent}%)`, margin + 240, gridY + 48);

    // Total card background
    doc.setFillColor(241, 245, 249); // Zinc 100
    doc.roundedRect(margin + 350, gridY, 165, 65, 8, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // Zinc 600
    doc.text("TOTAL DE SEMENTES", margin + 365, gridY + 22);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(`${totalCount}`, margin + 365, gridY + 48);

    // 2. Metadata Context Section
    const metaY = 175;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("CONTEXTO DA CONTROLA / METADADOS", margin, metaY);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, metaY + 6, pageWidth - margin, metaY + 6);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    
    // Left column
    doc.text("Pesquisador:", margin, metaY + 24);
    doc.text("Projeto:", margin, metaY + 42);
    doc.text("Tratamento:", margin, metaY + 60);

    // Right column
    doc.text("Placa ID:", margin + 280, metaY + 24);
    doc.text("Quadrante:", margin + 280, metaY + 42);
    doc.text("Cálculo:", margin + 280, metaY + 60);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    
    // Left Column values
    doc.text(metadata.researcher || "Não informado", margin + 85, metaY + 24);
    doc.text(metadata.project || "Não informado", margin + 85, metaY + 42);
    doc.text(metadata.treatment || "Não informado", margin + 85, metaY + 60);

    // Right Column values
    doc.text(metadata.plate || "Não informado", margin + 350, metaY + 24);
    doc.text(metadata.quadrant || "Não informado", margin + 350, metaY + 42);
    doc.text(metadata.useDifferential ? `Diferencial (Base: ${metadata.baselineCount})` : "Manual (Contagem Direta)", margin + 350, metaY + 60);

    // Observations
    if (metadata.notes) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Notas:", margin, metaY + 78);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(metadata.notes, margin + 85, metaY + 78, { maxWidth: pageWidth - margin - 125 });
    }

    // 3. Render Canvas with Marks
    const canvasY = 275;
    const canvasWidth = pageWidth - (margin * 2); // 515.28 pt
    const scaleFactor = canvasWidth / canvasElement.width;
    const canvasHeight = canvasElement.height * scaleFactor;

    // Check if canvas exceeds bottom of the page. A4 height is 842pt, leaving ~120pt for footer.
    // If it exceeds, we scale it down to fit on single page!
    const maxHeightAllowed = pageHeight - canvasY - 80; // 80pt footer safety margin
    let finalWidth = canvasWidth;
    let finalHeight = canvasHeight;

    if (canvasHeight > maxHeightAllowed) {
      finalHeight = maxHeightAllowed;
      finalWidth = canvasElement.width * (finalHeight / canvasElement.height);
    }

    // Centered coordinates
    const startX = margin + (canvasWidth - finalWidth) / 2;

    // Draw card border for the image
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1.5);
    doc.roundedRect(startX - 2, canvasY - 2, finalWidth + 4, finalHeight + 4, 4, 4, 'S');

    // Add Live Canvas Capture image
    // Live live canvas capture captures YOLO polygons SVG + Canvas, or manual canvas directly.
    // We create offscreen canvas to paint the image and manual marks, and then add YOLO overlays if visible
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = imageElement.width;
    offscreenCanvas.height = imageElement.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(imageElement, 0, 0);
      
      // Render marks
      let viableCounter = 0;
      let inviableCounter = 0;

      marks.forEach(mark => {
        let num = 0;
        if (mark.type === 'viable') {
          viableCounter++;
          num = viableCounter;
        } else {
          inviableCounter++;
          num = inviableCounter;
        }

        const fillStyle = mark.type === 'viable' ? '#ef4444' : '#fbbf24';

        if (visualMode === 'dots') {
          ctx.beginPath();
          ctx.arc(mark.x, mark.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = fillStyle;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(mark.x, mark.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = fillStyle;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = mark.type === 'inviable' ? '#92400e' : 'white';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(num.toString(), mark.x, mark.y + 0.5);
        }
      });

      // Draw YOLO segmentations onto offscreen canvas if present
      if (yoloSegmentations && yoloSegmentations.length > 0) {
        yoloSegmentations
          .filter(seg => seg.visible !== false)
          .forEach(seg => {
            ctx.beginPath();
            const first = seg.polygon_points[0];
            if (first) {
              ctx.moveTo(first[0], first[1]);
              for (let i = 1; i < seg.polygon_points.length; i++) {
                ctx.lineTo(seg.polygon_points[i][0], seg.polygon_points[i][1]);
              }
              ctx.closePath();
              
              const isViable = seg.category === 'viable';
              ctx.fillStyle = isViable ? 'rgba(239, 68, 68, 0.25)' : 'rgba(251, 191, 36, 0.25)';
              ctx.fill();
              
              ctx.strokeStyle = isViable ? '#ef4444' : '#fbbf24';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          });
      }

      const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.85);
      doc.addImage(imgData, 'JPEG', startX, canvasY, finalWidth, finalHeight);
    }

    // 4. Footer Brand Line
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Zinc 400
    doc.text("GPEOrq - Grupo de Pesquisa em Orquídeas da Unoeste. Relatório acadêmico confidencial.", margin, pageHeight - 30);
    doc.text("Fins de pesquisa e publicação interna. Cópia local.", pageWidth - margin - 220, pageHeight - 30);

    // Save PDF file
    const cleanFilename = filename.split('.')[0] || 'relatorio';
    const plateSuffix = metadata.plate ? `_${metadata.plate}` : '';
    doc.save(`${cleanFilename}${plateSuffix}_relatorio.pdf`);
    
    return true;
  } catch (error) {
    console.error("PDF generation error", error);
    alert("Houve um erro técnico ao gerar o PDF.");
    return false;
  }
}
