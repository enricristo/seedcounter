import { jsPDF } from 'jspdf';
import type { Metadata, Mark, YoloSegmentation, Session } from '../types';

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

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Zinc 400
    doc.text("GPEOrq - Grupo de Pesquisa em Orquídeas da Unoeste.", margin, pageHeight - 38);
    doc.text("Laboratório de Sementes e Tecido Vegetal (Campus II - Pres. Prudente) • Dr. Nelson Machado Neto & Dra. Ceci Custódio", margin, pageHeight - 26);
    doc.text("Relatório Acadêmico", pageWidth - margin - 150, pageHeight - 38);

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

export function generateBatchPDFReport(sessions: Session[], visualMode: 'dots' | 'numbers' = 'dots') {
  if (!sessions || sessions.length === 0) {
    alert("Nenhuma sessão para exportar.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    sessions.forEach((session, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // 1. Header
      doc.setFillColor(16, 185, 129); // Emerald 500
      doc.rect(0, 0, pageWidth, 12, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(`Laudo de Sementes - Amostra ${index + 1}/${sessions.length}`, margin, 42);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(16, 185, 129);
      doc.text("GRUPO DE PESQUISA EM ORQUÍDEAS (GPEORQ) • UNOESTE", margin, 56);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Arquivo: ${session.filename}`, pageWidth - margin - 200, 42);
      doc.text(`Data Sessão: ${new Date(session.date).toLocaleString('pt-BR')}`, pageWidth - margin - 200, 56);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(margin, 68, pageWidth - margin, 68);

      // 2. Metrics Card
      const gridY = 80;
      const totalCount = session.viableCount + session.inviableCount;
      const viablePercent = totalCount > 0 ? ((session.viableCount / totalCount) * 100).toFixed(1) : "0";
      const inviablePercent = totalCount > 0 ? ((session.inviableCount / totalCount) * 100).toFixed(1) : "0";

      // Viable
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, gridY, 160, 55, 6, 6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text("VIÁVEIS", margin + 15, gridY + 20);
      doc.setFontSize(18);
      doc.text(`${session.viableCount}`, margin + 15, gridY + 42);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`(${viablePercent}%)`, margin + 65, gridY + 42);

      // Inviable
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(margin + 175, gridY, 160, 55, 6, 6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(217, 119, 6);
      doc.text("INVIÁVEIS", margin + 190, gridY + 20);
      doc.setFontSize(18);
      doc.text(`${session.inviableCount}`, margin + 190, gridY + 42);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`(${inviablePercent}%)`, margin + 240, gridY + 42);

      // Total
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin + 350, gridY, 165, 55, 6, 6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("TOTAL", margin + 365, gridY + 20);
      doc.setFontSize(18);
      doc.text(`${totalCount}`, margin + 365, gridY + 42);

      // 3. Metadata
      const metaY = 155;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("METADADOS", margin, metaY);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, metaY + 5, pageWidth - margin, metaY + 5);

      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("Pesquisador:", margin, metaY + 20);
      doc.text("Projeto:", margin, metaY + 35);
      doc.text("Tratamento:", margin, metaY + 50);

      doc.text("Placa ID:", margin + 280, metaY + 20);
      doc.text("Quadrante:", margin + 280, metaY + 35);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(session.metadata.researcher || "-", margin + 75, metaY + 20);
      doc.text(session.metadata.project || "-", margin + 75, metaY + 35);
      doc.text(session.metadata.treatment || "-", margin + 75, metaY + 50);

      doc.text(session.metadata.plate || "-", margin + 330, metaY + 20);
      doc.text(session.metadata.quadrant ? `Q${session.metadata.quadrant}` : "-", margin + 330, metaY + 35);

      // 4. Image rendering (if imageData is available)
      const canvasY = 220;
      if (session.imageData) {
        // Since we don't have an HTMLImageElement ready, we have to add the image synchronously if possible.
        // jsPDF's addImage supports base64 directly!
        const canvasWidth = pageWidth - (margin * 2);
        
        // We don't know the exact aspect ratio of the base64 string, so we'll guess a 4:3 standard microscope ratio, 
        // or just fit it in the remaining space.
        const maxH = pageHeight - canvasY - 50;
        const finalWidth = canvasWidth;
        const finalHeight = (canvasWidth / 4) * 3; // roughly 4:3
        const drawH = Math.min(finalHeight, maxH);
        const drawW = drawH * (4/3);
        const startX = margin + (canvasWidth - drawW) / 2;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1);
        doc.roundedRect(startX - 1, canvasY - 1, drawW + 2, drawH + 2, 2, 2, 'S');

        // We just draw the bare image that we saved (which in App.tsx we saved as just the image itself without the marks natively rendered into the base64!)
        // Wait, in saveCurrentSession, we ONLY drew `ctx.drawImage(image, 0, 0)`, which means the marks ARE NOT in the base64!
        // So the PDF will show the image, but without the dots. This is acceptable for a dataset/batch view or we could draw dots on top.
        // For simplicity and speed in batch, we just show the base image that was saved.
        doc.addImage(session.imageData, 'JPEG', startX, canvasY, drawW, drawH);
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Nota: A imagem reflete a foto original salva (anotações sobrepostas em Base64 não renderizadas neste lote).", margin, canvasY + drawH + 15);

      } else {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhuma imagem salva disponível para esta sessão.", margin, canvasY + 20);
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("GPEOrq - Grupo de Pesquisa em Orquídeas da Unoeste.", margin, pageHeight - 38);
      doc.text("Laboratório de Sementes e Tecido Vegetal (Campus II - Pres. Prudente) • Dr. Nelson Machado Neto & Dra. Ceci Custódio", margin, pageHeight - 26);
      doc.text("Laudo em Lote (Exportação Automatizada)", pageWidth - margin - 200, pageHeight - 38);
    });

    const filenameStr = sessions.length === 1 
      ? `${sessions[0].filename.split('.')[0]}_laudo.pdf`
      : `laudo_lote_${sessions.length}_amostras.pdf`;

    doc.save(filenameStr);
    return true;

  } catch (error) {
    console.error("Batch PDF generation error", error);
    alert("Houve um erro técnico ao gerar o PDF em lote.");
    return false;
  }
}
