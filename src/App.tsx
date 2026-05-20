import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';

// Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { ImageViewport } from './components/canvas/ImageViewport';
import { MarkingCanvas } from './components/canvas/MarkingCanvas';
import { ZoomControls } from './components/canvas/ZoomControls';
import { DropZone } from './components/shared/DropZone';

// Modals
import { ExportModal } from './components/modals/ExportModal';
import { HistoryModal } from './components/modals/HistoryModal';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useMarks } from './hooks/useMarks';
import { useMetadata } from './hooks/useMetadata';
import { useSessions } from './hooks/useSessions';
import { useImageQueue } from './hooks/useImageQueue';
import { useZoom } from './hooks/useZoom';
import { usePanning } from './hooks/usePanning';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDragDrop } from './hooks/useDragDrop';

// Utils
import { calculateSeedDimensions } from './lib/pca-utils';
import { generatePDFReport } from './lib/pdf-generator';

// Types
import type { Mark, YoloSegmentation, Session } from './types';

// Helper function to download locally generated data
function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Render marks overlay helper for the canvas context
function renderMarksToContext(ctx: CanvasRenderingContext2D, marks: Mark[], mode: 'dots' | 'numbers') {
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

    if (mode === 'dots') {
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = mark.type === 'inviable' ? '#92400e' : 'white';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num.toString(), mark.x, mark.y + 0.5);
    }
  });
}

export default function App() {
  // Theme & Darkmode State
  const { isDarkMode, toggleTheme } = useTheme();

  // Modal Open states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Manual marking class toggle
  const [activeClassification, setActiveClassification] = useState<'viable' | 'inviable'>('viable');
  const [visualMode, setVisualMode] = useState<'dots' | 'numbers'>('dots');

  // Annotation states
  const {
    marks,
    setMarks,
    yoloSegmentations,
    setYoloSegmentations,
    segmentsVisible,
    addMark,
    undoMark,
    addYoloSegmentations,
    toggleSegmentationClass,
    deleteSegmentation,
    resetAllAnnotations
  } = useMarks();

  // Metadata sample inputs
  const { metadata, setMetadata, updateMetadata } = useMetadata();

  // Sessions CRUD history
  const { sessions, setSessions, addSession, deleteSession, clearSessions, importSessions } = useSessions();

  // Zooming controls
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom, fitToScreen } = useZoom();

  // Panning & Panning gesture drag mode
  const {
    isPanningMode,
    isDragging: isPanningDrag,
    startDrag,
    handleDrag,
    stopDrag,
    togglePanningMode
  } = usePanning();

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Multi-image Queue state
  const {
    image,
    setImage,
    filename,
    setFilename,
    imageQueue,
    currentImageIndex,
    loadFiles,
    handleFileUpload,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile
  } = useImageQueue({
    onImageLoaded: (img) => {
      // Reset annotations on new sample load
      resetAllAnnotations();
      
      // Calculate fit screen zoom automatically
      if (containerRef.current) {
        const container = containerRef.current;
        fitToScreen(container.clientWidth, container.clientHeight, img.width, img.height);
      }
    }
  });

  // Derived counts
  const manualViable = marks.filter(m => m.type === 'viable').length;
  const yoloViable = yoloSegmentations.filter(s => s.category === 'viable' && s.visible !== false).length;
  const viableCount = manualViable + yoloViable;

  const manualInviable = marks.filter(m => m.type === 'inviable').length;
  const yoloInviable = yoloSegmentations.filter(s => s.category === 'inviable' && s.visible !== false).length;
  
  const inviableCount = (metadata.useDifferential && metadata.baselineCount && metadata.baselineCount > 0)
    ? Math.max(0, metadata.baselineCount - viableCount)
    : (manualInviable + yoloInviable);

  const totalCount = (metadata.useDifferential && metadata.baselineCount && metadata.baselineCount > 0)
    ? metadata.baselineCount
    : (viableCount + inviableCount);

  const viablePercent = totalCount > 0 ? ((viableCount / totalCount) * 100).toFixed(1) : "0";
  const inviablePercent = totalCount > 0 ? ((inviableCount / totalCount) * 100).toFixed(1) : "0";

  // Re-draw Canvas markings
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw manual marks
    renderMarksToContext(ctx, marks, visualMode);
  }, [image, marks, visualMode]);

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = image.width;
      canvas.height = image.height;
      drawCanvas();
    }
  }, [image, drawCanvas, marks, visualMode]);

  // Handle canvas click to place a manual mark
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningMode) return;
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Scale coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Shift/Ctrl/Right/Middle clicks invert the active classification
    const shouldInvert = e.shiftKey || e.ctrlKey || e.button !== 0;
    const type = shouldInvert 
      ? (activeClassification === 'viable' ? 'inviable' : 'viable') 
      : activeClassification;

    addMark(x, y, type);
  };

  // Reset markings prompt
  const handleReset = () => {
    if (window.confirm("Deseja realmente limpar todas as marcações manuais e segmentações YOLO da imagem atual?")) {
      resetAllAnnotations();
    }
  };

  // Save local history session
  const saveCurrentSession = (silent = false) => {
    if (!filename) return;
    const newSession: Session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      filename,
      viableCount,
      inviableCount,
      metadata: { ...metadata },
      marks,
      yoloSegmentations
    };
    addSession(newSession);
    if (!silent) {
      alert("Sessão salva com sucesso no histórico local!");
    }
  };

  const saveAndNext = () => {
    saveCurrentSession(true);
    handleNextImage();
  };

  // JSON Import Parser supporting backups, YOLO segmentations and single session files
  const processJSONFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        // 1. Check if it is a YOLO segmentation JSON file
        if (parsed && (Array.isArray(parsed.segmentations) || parsed.segmentations)) {
          const rawSegs = Array.isArray(parsed.segmentations) ? parsed.segmentations : [];
          
          // Map and calculate PCA dimensions
          const mappedSegs: YoloSegmentation[] = rawSegs.map((seg: any, idx: number) => {
            const polygon_points = seg.polygon_points || seg.points || [];
            const { width, height } = calculateSeedDimensions(polygon_points);
            
            let category: 'viable' | 'inviable' = 'viable';
            if (seg.category === 'inviable' || seg.class_name === 'inviavel' || seg.class === 1) {
              category = 'inviable';
            }
            
            return {
              id: seg.id ?? idx,
              category,
              class_name: category === 'viable' ? 'viavel' : 'inviavel',
              confidence: seg.confidence ?? 1.0,
              polygon_points,
              visible: seg.visible !== false,
              edited: seg.edited ?? false,
              width,
              height
            };
          });
          
          addYoloSegmentations(mappedSegs);
          alert(`YOLO segmentações importadas! Encontradas ${mappedSegs.length} segmentações.`);
          return;
        }

        // 2. Check if it is a SeedCounter backup history array
        if (Array.isArray(parsed)) {
          const success = importSessions(parsed);
          if (success) {
            alert(`Histórico importado com sucesso! ${parsed.length} sessões adicionadas/mescladas.`);
          } else {
            alert("Formato de histórico inválido.");
          }
          return;
        }

        // 3. Check if it is a single SeedCounter session JSON
        if (parsed && parsed.metadata && (parsed.marks || parsed.yoloSegmentations)) {
          if (parsed.metadata) setMetadata(parsed.metadata);
          if (parsed.marks) setMarks(parsed.marks);
          if (parsed.yoloSegmentations) {
            const mapped = parsed.yoloSegmentations.map((seg: any) => {
              const { width, height } = calculateSeedDimensions(seg.polygon_points || []);
              return {
                ...seg,
                width: seg.width ?? width,
                height: seg.height ?? height
              };
            });
            addYoloSegmentations(mapped);
          }
          if (parsed.filename) setFilename(parsed.filename);
          alert("Sessão importada com sucesso!");
          return;
        }

        alert("Arquivo JSON com formato não reconhecido (não é YOLO, Backup ou Sessão).");
      } catch (error) {
        console.error("Erro ao importar o arquivo JSON", error);
        alert("Erro ao ler o arquivo JSON. Certifique-se de que é um formato válido.");
      }
    };
    reader.readAsText(file);
  }, [addYoloSegmentations, importSessions, setMetadata, setMarks, setFilename]);

  // Drag & drop hook
  const onFilesDropped = useCallback((files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    const jsons = files.filter(f => f.name.endsWith('.json') || f.type === 'application/json');

    if (images.length > 0) {
      loadFiles(images);
    }
    if (jsons.length > 0) {
      processJSONFile(jsons[0]);
    }
  }, [loadFiles, processJSONFile]);

  const { isDragActive } = useDragDrop({ onFilesDropped });

  // Unified filename generation helper
  const generateExportName = (extension: string) => {
    const baseName = filename ? filename.split('.')[0] : 'contagem';
    const cleanPlate = metadata.plate ? `_${metadata.plate}` : '';
    const cleanQuad = metadata.quadrant ? `_Q${metadata.quadrant}` : '';
    return `${baseName}${cleanPlate}${cleanQuad}.${extension}`;
  };

  // EXPORTS
  const handleExportTextReport = () => {
    const content = `Relatório de Contagem de Sementes\n` +
                    `----------------------------------\n` +
                    `Arquivo da Imagem: ${filename}\n` +
                    `Data: ${new Date().toLocaleString()}\n\n` +
                    `[ Metadados ]\n` +
                    `Usuário / Pesquisador: ${metadata.researcher || '-'}\n` +
                    `Projeto de Pesquisa: ${metadata.project || '-'}\n` +
                    `Tratamento / Experimento: ${metadata.treatment || '-'}\n` +
                    `Placa: ${metadata.plate || '-'}\n` +
                    `Quadrante: ${metadata.quadrant || '-'}\n` +
                    `Comentários: ${metadata.notes || '-'}\n\n` +
                    `[ Resultados ]\n` +
                    `Sementes Viáveis (Vermelho): ${viableCount} (${viablePercent}%)\n` +
                    `Sementes Inviáveis/Detritos (Amarelo): ${inviableCount} (${inviablePercent}%)\n` +
                    `Total: ${totalCount}\n`;

    downloadBlob(content, generateExportName('txt'), 'text/plain');
  };

  const handleExportJSON = () => {
    const data = {
      filename,
      date: new Date().toISOString(),
      metadata,
      results: {
        viableCount,
        inviableCount,
        totalCount,
        viablePercent: Number(viablePercent),
        inviablePercent: Number(inviablePercent)
      },
      marks,
      yoloSegmentations
    };
    downloadBlob(JSON.stringify(data, null, 2), generateExportName('json'), 'application/json');
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Imagem', 'Pesquisador', 'Projeto', 'Tratamento', 'Placa', 'Quadrante', 'Viaveis', 'Inviaveis', 'Total', '% Viavel', '% Inviavel', 'Comentarios'];
    const row = [
      new Date().toLocaleString(),
      filename,
      metadata.researcher,
      metadata.project,
      metadata.treatment,
      metadata.plate,
      metadata.quadrant,
      viableCount.toString(),
      inviableCount.toString(),
      totalCount.toString(),
      viablePercent,
      inviablePercent,
      metadata.notes.replace(/(\r\n|\n|\r)/gm, " ")
    ];
    
    const csvContent = [headers, row]
      .map(e => e.map(item => `"${(item || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    downloadBlob(csvContent, generateExportName('csv'), 'text/csv');
  };

  const handleExportAnnotatedImage = () => {
    if (!canvasRef.current || !image) return;
    
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = image.width;
    offscreenCanvas.height = image.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return;

    // Draw base image
    ctx.drawImage(image, 0, 0);

    // Draw YOLO segmentations
    if (segmentsVisible && yoloSegmentations.length > 0) {
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

    // Draw manual marks
    renderMarksToContext(ctx, marks, visualMode);

    // Summary Box
    const padding = 20;
    const hasMoreDetails = !!(metadata.plate || metadata.quadrant);
    const boxW = 340;
    const boxH = hasMoreDetails ? 160 : 140;
    
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
    ctx.fillText(`Relatório de Contagem`, padding + 24, padding + 24);
    
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#a3a3a3';
    ctx.fillText(`Amostra: ${filename}`, padding + 24, padding + 56);
    
    let statsY = padding + 80;
    
    if (hasMoreDetails) {
      ctx.fillText(`Placa: ${metadata.plate || '-'} | Q: ${metadata.quadrant || '-'}`, padding + 24, padding + 76);
      statsY = padding + 104;
    }
    
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`Viáveis: ${viableCount}`, padding + 24, statsY);
    
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Inviáveis: ${inviableCount}`, padding + 160, statsY);

    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = generateExportName('png');
    link.click();
  };

  const handleExportPDF = () => {
    generatePDFReport({
      filename,
      metadata,
      viableCount,
      inviableCount,
      totalCount,
      viablePercent,
      inviablePercent,
      marks,
      yoloSegmentations,
      canvasElement: canvasRef.current,
      imageElement: image,
      visualMode
    });
  };

  const handleExportHistoryCSV = () => {
    if (sessions.length === 0) return;
    const headers = ['Data', 'Imagem', 'Pesquisador', 'Projeto', 'Tratamento', 'Placa', 'Quadrante', 'Viaveis', 'Inviaveis', 'Total', '% Viavel', '% Inviavel', 'Comentarios'];
    
    const rows = sessions.map(s => {
      const total = s.viableCount + s.inviableCount;
      const vPct = total > 0 ? ((s.viableCount / total) * 100).toFixed(1) : "0";
      const iPct = total > 0 ? ((s.inviableCount / total) * 100).toFixed(1) : "0";
      return [
        new Date(s.date).toLocaleString(),
        s.filename,
        s.metadata.researcher,
        s.metadata.project,
        s.metadata.treatment,
        s.metadata.plate,
        s.metadata.quadrant,
        s.viableCount.toString(),
        s.inviableCount.toString(),
        total.toString(),
        vPct,
        iPct,
        s.metadata.notes.replace(/(\r\n|\n|\r)/gm, " ")
      ];
    });

    const csvContent = [headers, ...rows]
      .map(e => e.map(item => `"${(item || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    downloadBlob(csvContent, 'historico_contagens.csv', 'text/csv');
  };

  const handleExportHistoryJSON = () => {
    if (sessions.length === 0) return;
    downloadBlob(JSON.stringify(sessions, null, 2), `seed-counter-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  };

  const handleImportHistoryJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJSONFile(file);
    }
    e.target.value = '';
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFitToScreen = () => {
    if (image && containerRef.current) {
      fitToScreen(containerRef.current.clientWidth, containerRef.current.clientHeight, image.width, image.height);
    }
  };

  // Keyboard shortcuts binding
  useKeyboardShortcuts({
    onUndo: undoMark,
    onSetVisualMode: setVisualMode,
    onNextImage: handleNextImage,
    onPrevImage: handlePrevImage,
    onTogglePanning: togglePanningMode,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: handleFitToScreen,
    onSaveSession: () => saveCurrentSession(false),
    onOpenExport: () => setIsExportModalOpen(true),
    onToggleTheme: toggleTheme,
    hasImage: !!image,
    hasNextImage: currentImageIndex < imageQueue.length - 1,
    hasPrevImage: currentImageIndex > 0
  });

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-neutral-50 dark:bg-[#121214] text-neutral-850 dark:text-zinc-105 transition-colors duration-300 font-sans">
      {/* 1. Header Toolbar */}
      <Header 
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        sessionsCount={sessions.length}
        openHistory={() => setIsHistoryModalOpen(true)}
        onUndo={undoMark}
        undoDisabled={marks.length === 0}
        onReset={handleReset}
        resetDisabled={marks.length === 0 && yoloSegmentations.length === 0}
        hasImageQueue={imageQueue.length > 0}
        currentImageIndex={currentImageIndex}
        imageQueueLength={imageQueue.length}
        onPrevImage={handlePrevImage}
        onNextImage={handleNextImage}
        onSaveSession={() => saveCurrentSession(false)}
        onExport={() => setIsExportModalOpen(true)}
        hasImage={!!image}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* 2. Sidebar panel */}
        <Sidebar 
          fileInputRef={fileInputRef}
          importInputRef={importInputRef}
          handleFileUpload={handleFileUpload}
          handleImportJSON={processJSONFile}
          viableCount={viableCount}
          inviableCount={inviableCount}
          viablePercent={viablePercent}
          inviablePercent={inviablePercent}
          totalCount={totalCount}
          visualMode={visualMode}
          setVisualMode={setVisualMode}
          activeClassification={activeClassification}
          setActiveClassification={setActiveClassification}
          metadata={metadata}
          updateMetadata={updateMetadata}
          sessions={sessions}
        />

        {/* 3. Image viewport scroll and Zoom area */}
        <ImageViewport
          containerRef={containerRef}
          image={image}
          onBrowseFiles={handleBrowseFiles}
          isPanningMode={isPanningMode}
          isDragging={isPanningDrag}
          startDrag={startDrag}
          handleDrag={handleDrag}
          stopDrag={stopDrag}
        >
          {image && (
            <MarkingCanvas 
              image={image}
              marks={marks}
              yoloSegmentations={yoloSegmentations}
              segmentsVisible={segmentsVisible}
              visualMode={visualMode}
              zoomLevel={zoomLevel}
              isPanningMode={isPanningMode}
              onCanvasClick={handleCanvasClick}
              canvasRef={canvasRef}
              onToggleSegmentationClass={toggleSegmentationClass}
              onDeleteSegmentation={deleteSegmentation}
            />
          )}
        </ImageViewport>

        {/* 4. Floating Zoom and Panning controls */}
        {image && (
          <ZoomControls 
            isPanningMode={isPanningMode}
            togglePanningMode={togglePanningMode}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            zoomLevel={zoomLevel}
            onFitToScreen={handleFitToScreen}
          />
        )}
      </div>

      {/* 5. Footer Status Bar */}
      <Footer 
        filename={filename}
        imageWidth={image?.width}
        imageHeight={image?.height}
      />

      {/* 6. Drag Drop file upload overlay */}
      <DropZone isVisible={isDragActive} />

      {/* 7. Action Modals */}
      <AnimatePresence>
        {isExportModalOpen && (
          <ExportModal 
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            filename={filename}
            hasImageQueue={imageQueue.length > 0}
            currentImageIndex={currentImageIndex}
            imageQueueLength={imageQueue.length}
            onSaveCurrentSession={() => saveCurrentSession(true)}
            onSaveAndNext={saveAndNext}
            exportTextReport={handleExportTextReport}
            exportCSV={handleExportCSV}
            exportJSON={handleExportJSON}
            exportAnnotatedImage={handleExportAnnotatedImage}
            exportPDF={handleExportPDF}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryModalOpen && (
          <HistoryModal 
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            sessions={sessions}
            onDeleteSession={deleteSession}
            onClearHistory={clearSessions}
            onExportHistoryJSON={handleExportHistoryJSON}
            onExportHistoryCSV={handleExportHistoryCSV}
            onImportHistoryJSON={handleImportHistoryJSON}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
