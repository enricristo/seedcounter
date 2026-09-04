import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';

// Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { ImageViewport } from './components/canvas/ImageViewport';
import { MarkingCanvas, type DetectionPreview } from './components/canvas/MarkingCanvas';
import { Toolbar } from './components/canvas/Toolbar';
import { ZoomControls } from './components/canvas/ZoomControls';
import { DropZone } from './components/shared/DropZone';

// Modals
import { ExportModal } from './components/modals/ExportModal';
import { HistoryModal } from './components/modals/HistoryModal';
import { ConfirmDialog } from './components/modals/ConfirmDialog';

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
import { useViewNavigation } from './hooks/useViewNavigation';
import { useTools } from './hooks/useTools';
import {
  useFeatureFlag,
  useFeatureFlags,
  FeatureFlagsDebugPanel,
} from './context/FeatureFlagContext';
import { useExperiments } from './hooks/useExperiments';

// Features
import { LongitudinalView, ExperimentModal, PlateRunModal } from './features/longitudinal';
import { StatsView } from './features/stats';
import { YoloExportModal } from './features/yolo-export';
import { CameraModal } from './features/camera';
import { DetectionPanel } from './features/detection';
import { AiPointerPanel } from './features/ai-pointer';
import { CalibrationPanel } from './features/calibration';
import { FeaturesModal } from './features/settings';
import { ImageAdjustPanel } from './features/image-adjust';
import { SplitModal } from './features/split';
import { RoiModal } from './features/roi';

// Utils
import { calculateSeedDimensions } from './lib/pca-utils';
import { buildMeasurements, measurementsToCSV, measurementsToSQL } from './lib/measurements';
import type { Regiao } from './lib/region';
import {
  NEUTRAL_ADJUSTMENTS,
  applyAdjustments,
  isNeutral,
  toCssFilter,
  type ImageAdjustments,
} from './lib/image-adjust';
import { generatePDFReport, generateBatchPDFReport } from './lib/pdf-generator';
import { baixarArquivo, nomeDeExportacao } from './lib/download';

// Types
import type { Mark, YoloSegmentation, Session, Experiment, PlateRun } from './types';

// Linguagem do especime — fonte unica das cores e formas das marcas.
import { ESPECIME, ESPECIME_FILL, corDoEspecime, desenharMarca } from './theme/specimen';

// Delega para src/lib/download.ts. A versão anterior criava a âncora sem
// anexá-la ao DOM e revogava a URL no mesmo tick do clique — os arquivos
// chegavam com nome de UUID e sem extensão, parecendo que a exportação não
// tinha funcionado.
function downloadBlob(content: string, filename: string, contentType: string) {
  baixarArquivo(content, filename, contentType);
}

// Render marks overlay helper for the canvas context
function renderMarksToContext(
  ctx: CanvasRenderingContext2D,
  marks: Mark[],
  mode: 'dots' | 'numbers'
) {
  let viableCounter = 0;
  let inviableCounter = 0;

  marks.forEach((mark) => {
    let num = 0;
    if (mark.type === 'viable') {
      viableCounter++;
      num = viableCounter;
    } else {
      inviableCounter++;
      num = inviableCounter;
    }

    if (mode === 'dots') {
      // Forma redundante: disco cheio para viavel, anel vazado para inviavel.
      desenharMarca(ctx, mark.type, mark.x, mark.y, 4.5);
    } else {
      // Em modo indices o numero ocupa o centro, entao a forma nao pode ser
      // vazada. A redundancia vira um anel externo escuro so no inviavel.
      const cor = corDoEspecime(mark.type);
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.fill();
      ctx.strokeStyle = ESPECIME.halo;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (mark.type === 'inviable') {
        ctx.beginPath();
        ctx.arc(mark.x, mark.y, 10.5, 0, Math.PI * 2);
        ctx.strokeStyle = cor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Tinta escura sobre ciano e magenta, que sao claros: texto branco
      // sumiria.
      ctx.fillStyle = '#101719';
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

  // View navigation
  const { currentView, navigate } = useViewNavigation('counter');

  // Experiments CRUD
  const { experiments } = useExperiments();

  // Feature Flags
  const isLongitudinalEnabled = useFeatureFlag('longitudinalView');
  const isStatsEnabled = useFeatureFlag('statsView');
  const isYoloExportEnabled = useFeatureFlag('yoloExport');
  const isCameraEnabled = useFeatureFlag('cameraCapture');
  const isDetectionEnabled = useFeatureFlag('assistedDetection');
  const isAiPointerEnabled = useFeatureFlag('aiPointer');
  const isSplitEnabled = useFeatureFlag('splitScan');
  const isRoiEnabled = useFeatureFlag('circularRoi');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [detectionPreview, setDetectionPreview] = useState<DetectionPreview | null>(null);

  // Calibração — modo régua e última distância medida
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [adjustEnabled, setAdjustEnabled] = useState(true);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measuredPixels, setMeasuredPixels] = useState<number | undefined>(undefined);

  // Região de detecção: onde os motores (clássico e YOLO) vão rodar.
  // Sem ela, os dois varrem a imagem inteira — que numa digitalização de
  // scanner são dezenas de janelas de inferência e minutos de espera.
  const [regiaoDeDeteccao, setRegiaoDeDeteccao] = useState<Regiao | null>(null);
  const [selecionandoRegiao, setSelecionandoRegiao] = useState(false);

  // Fase F — ferramentas de edição (marcar / borracha / mover)
  const {
    activeTool,
    setActiveTool,
    eraserRadius,
    setEraserRadius,
    isTemporary: isToolTemporary,
  } = useTools();
  const [isYoloExportModalOpen, setIsYoloExportModalOpen] = useState(false);

  // Ctrl+Shift+D shortcut for Feature Flags Debug Panel
  const { toggle: toggleFlag } = useFeatureFlags();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleFlag('debugPanel');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFlag]);

  // Modal Open states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isRoiOpen, setIsRoiOpen] = useState(false);
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);
  const [selectedExperimentForEdit, setSelectedExperimentForEdit] = useState<
    Experiment | undefined
  >(undefined);
  const [isPlateRunModalOpen, setIsPlateRunModalOpen] = useState(false);
  const [selectedExperimentForRun, setSelectedExperimentForRun] = useState<Experiment | undefined>(
    undefined
  );
  const [selectedTreatmentIdForRun, setSelectedTreatmentIdForRun] = useState<string | undefined>(
    undefined
  );
  const [selectedPlateRunForEdit, setSelectedPlateRunForEdit] = useState<PlateRun | undefined>(
    undefined
  );

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
    removeMark,
    addYoloSegmentations,
    toggleSegmentationClass,
    deleteSegmentation,
    resetAllAnnotations,
  } = useMarks();

  // Metadata sample inputs
  const { metadata, setMetadata, updateMetadata } = useMetadata();

  // Sessions CRUD history
  const { sessions, addSession, deleteSession, clearSessions, importSessions } = useSessions();

  // Zooming controls
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom, fitToScreen } = useZoom();

  // Panning & Panning gesture drag mode
  const {
    isPanningMode,
    setIsPanningMode,
    isDragging: isPanningDrag,
    startDrag,
    handleDrag,
    stopDrag,
    togglePanningMode,
  } = usePanning();

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Anotações por imagem da fila.
  //
  // A chave é nome + tamanho, não o índice: se a fila for recarregada ou
  // reordenada, o índice muda e o do lado passa a receber a contagem errada,
  // que é pior do que perdê-la.
  const chaveDaImagem = useCallback((file: File) => `${file.name}:${file.size}`, []);
  const anotacoesPorImagem = useRef<
    Map<string, { marks: Mark[]; yoloSegmentations: YoloSegmentation[] }>
  >(new Map());
  const chaveAtual = useRef<string | null>(null);

  // Espelhos do estado, para leitura dentro de callbacks assíncronos.
  const marcasRef = useRef<Mark[]>([]);
  const segmentacoesRef = useRef<YoloSegmentation[]>([]);

  // Multi-image Queue state
  const {
    image,
    setImage,
    filename,
    setFilename,
    imageQueue,
    setImageQueue,
    currentImageIndex,
    setCurrentImageIndex,
    loadError,
    loadFiles,
    handleFileUpload,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile,
  } = useImageQueue({
    onImageLoaded: (img, file) => {
      // As anotações da imagem que estava aberta são guardadas ANTES de a nova
      // entrar. Sem isto, navegar na fila apagava a contagem anterior sem
      // aviso — e numa fila de 12 pedaços de scanner isso é perder o trabalho
      // de uma folha inteira.
      //
      // A leitura vem de refs, não do estado: a função é chamada de dentro de
      // um callback assíncrono do FileReader, onde o valor capturado pelo
      // fecho pode estar velho.
      if (chaveAtual.current) {
        anotacoesPorImagem.current.set(chaveAtual.current, {
          marks: marcasRef.current,
          yoloSegmentations: segmentacoesRef.current,
        });
      }

      const chave = chaveDaImagem(file);
      chaveAtual.current = chave;

      const guardado = anotacoesPorImagem.current.get(chave);
      if (guardado) {
        setMarks(guardado.marks);
        setYoloSegmentations(guardado.yoloSegmentations);
      } else {
        resetAllAnnotations();
      }

      if (containerRef.current) {
        const container = containerRef.current;
        fitToScreen(container.clientWidth, container.clientHeight, img.width, img.height);
      }
    },
  });

  useEffect(() => {
    marcasRef.current = marks;
  }, [marks]);

  useEffect(() => {
    segmentacoesRef.current = yoloSegmentations;
  }, [yoloSegmentations]);

  useKeyboardShortcuts({
    onUndo: undoMark,
    onSetVisualMode: setVisualMode,
    onNextImage: handleNextImage,
    onPrevImage: handlePrevImage,
    onTogglePanning: togglePanningMode,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: () => {
      if (containerRef.current && image) {
        fitToScreen(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight,
          image.width,
          image.height
        );
      } else {
        resetZoom();
      }
    },
    onSaveSession: () => saveCurrentSession(true),
    onOpenExport: () => setIsExportModalOpen(true),
    onToggleTheme: toggleTheme,
    hasImage: !!image,
    hasNextImage: imageQueue.length > 0 && currentImageIndex < imageQueue.length - 1,
    hasPrevImage: imageQueue.length > 0 && currentImageIndex > 0,
  });

  // Derived counts
  const manualViable = marks.filter((m) => m.type === 'viable').length;
  const yoloViable = yoloSegmentations.filter(
    (s) => s.category === 'viable' && s.visible !== false
  ).length;
  const viableCount = manualViable + yoloViable;

  const manualInviable = marks.filter((m) => m.type === 'inviable').length;
  const yoloInviable = yoloSegmentations.filter(
    (s) => s.category === 'inviable' && s.visible !== false
  ).length;

  const inviableCount =
    metadata.useDifferential && metadata.baselineCount && metadata.baselineCount > 0
      ? Math.max(0, metadata.baselineCount - viableCount)
      : manualInviable + yoloInviable;

  const totalCount =
    metadata.useDifferential && metadata.baselineCount && metadata.baselineCount > 0
      ? metadata.baselineCount
      : viableCount + inviableCount;

  const viablePercent = totalCount > 0 ? ((viableCount / totalCount) * 100).toFixed(1) : '0';
  const inviablePercent = totalCount > 0 ? ((inviableCount / totalCount) * 100).toFixed(1) : '0';

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
    // Borracha e "mover" não criam marcações (a borracha age na camada própria).
    if (activeTool === 'eraser' || activeTool === 'pan') return;
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // A ferramenta ativa define a classe; Shift/Ctrl/botão direito invertem.
    const baseType = activeTool === 'inviable' ? 'inviable' : 'viable';
    const shouldInvert = e.shiftKey || e.ctrlKey || e.button !== 0;
    const type = shouldInvert ? (baseType === 'viable' ? 'inviable' : 'viable') : baseType;

    addMark(x, y, type);
  };

  // Limpa a placa atual: contagem, calibração e identificação da placa.
  // Preserva o histórico, os experimentos e a identificação do trabalho
  // (pesquisador, projeto, tratamento), que o usuário não deve redigitar a
  // cada placa. A confirmação vive no ConfirmDialog, que lista o alcance.
  const handleResetCurrentPlate = () => {
    resetAllAnnotations();
    setMetadata((prev) => ({
      ...prev,
      plate: '',
      quadrant: '',
      notes: '',
      baselineCount: 0,
      useDifferential: false,
      umPerPixel: undefined,
    }));
  };

  // Save local history session
  const saveCurrentSession = (silent = false) => {
    if (!filename) return;

    let imageDataStr = undefined;
    if (image) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        imageDataStr = canvas.toDataURL('image/jpeg', 0.85); // High quality but compressed
      }
    }

    const newSession: Session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      filename,
      viableCount,
      inviableCount,
      metadata: { ...metadata },
      marks,
      yoloSegmentations,
      imageData: imageDataStr,
    };
    addSession(newSession);
    if (!silent) {
      alert('Sessão salva com sucesso no histórico local!');
    }
  };

  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    // A sessão restaurada é um contexto próprio: não faz parte da fila de
    // imagens carregada antes. Limpar a fila esconde "Anterior/Próxima", que
    // até aqui continuava apontando para os arquivos antigos e trocava a
    // imagem por baixo da sessão recém-aberta.
    setImageQueue([]);
    setCurrentImageIndex(0);
    chaveAtual.current = null;

    setMetadata(session.metadata);
    setFilename(session.filename);
    setMarks(session.marks || []);
    setYoloSegmentations(session.yoloSegmentations || []);

    // Restore image if available
    if (session.imageData) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setZoomLevel(1);
        setIsHistoryModalOpen(false);
        navigate('counter');
      };
      img.onerror = () => {
        alert('Erro ao carregar a imagem salva da sessão.');
      };
      img.src = session.imageData;
    } else {
      setIsHistoryModalOpen(false);
      navigate('counter');
      alert(
        `Sessão carregada, mas esta sessão antiga não possui a imagem salva no banco.\nPor favor, carregue o arquivo de imagem "${session.filename}" manualmente.`
      );
    }
  };

  const saveAndNext = () => {
    saveCurrentSession(true);
    handleNextImage();
  };

  // JSON Import Parser supporting backups, YOLO segmentations and single session files
  const processJSONFile = useCallback(
    (file: File) => {
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
                height,
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
              alert(
                `Histórico importado com sucesso! ${parsed.length} sessões adicionadas/mescladas.`
              );
            } else {
              alert('Formato de histórico inválido.');
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
                  height: seg.height ?? height,
                };
              });
              addYoloSegmentations(mapped);
            }
            if (parsed.filename) setFilename(parsed.filename);
            alert('Sessão importada com sucesso!');
            return;
          }

          alert('Arquivo JSON com formato não reconhecido (não é YOLO, Backup ou Sessão).');
        } catch (error) {
          console.error('Erro ao importar o arquivo JSON', error);
          alert('Erro ao ler o arquivo JSON. Certifique-se de que é um formato válido.');
        }
      };
      reader.readAsText(file);
    },
    [addYoloSegmentations, importSessions, setMetadata, setMarks, setFilename]
  );

  // Drag & drop hook
  const onFilesDropped = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      const jsons = files.filter((f) => f.name.endsWith('.json') || f.type === 'application/json');

      if (images.length > 0) {
        loadFiles(images);
      }
      if (jsons.length > 0) {
        processJSONFile(jsons[0]);
      }
    },
    [loadFiles, processJSONFile]
  );

  const { isDragActive } = useDragDrop({ onFilesDropped });

  // Unified filename generation helper
  /**
   * Nome de arquivo rastreável: projeto, tratamento, placa, quadrante,
   * amostra, tipo e carimbo de data.
   *
   * Ordenar a pasta por nome passa a agrupar por projeto e depois por
   * tratamento — que é como o pesquisador procura — em vez de por ordem de
   * exportação, que não significa nada.
   */
  const generateExportName = (extension: string, tipo?: string) =>
    nomeDeExportacao(
      {
        arquivo: filename,
        projeto: metadata.project,
        tratamento: metadata.treatment,
        placa: metadata.plate,
        quadrante: metadata.quadrant,
        tipo,
      },
      extension
    );

  // EXPORTS
  const handleExportTextReport = () => {
    const content =
      `Relatório de Contagem de Sementes\n` +
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

    downloadBlob(content, generateExportName('txt', 'relatorio'), 'text/plain');
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
        inviablePercent: Number(inviablePercent),
      },
      marks,
      yoloSegmentations,
    };
    downloadBlob(
      JSON.stringify(data, null, 2),
      generateExportName('json', 'sessao'),
      'application/json'
    );
  };

  // --- Exportação por objeto (uma linha por semente) ---------------------
  // Funciona em qualquer cenário: sem calibração sai em pixels, sem
  // segmentação sai só posição e classe. Nenhuma camada é obrigatória.
  /**
   * Lê os pixels da imagem em exibição, para as medidas de cor por objeto.
   *
   * Feito sob demanda, só na hora de exportar: manter um ImageData de uma
   * digitalização de 7992×3672 vivo o tempo todo custaria ~117 MB de RAM por
   * imagem, e a contagem manual não precisa dele.
   *
   * Devolve undefined se algo falhar — as colunas de cor saem vazias e a
   * morfometria continua inteira, porque ela não depende dos pixels.
   */
  const lerPixelsDaImagem = useCallback(() => {
    if (!image) return undefined;
    try {
      const off = document.createElement('canvas');
      off.width = image.width;
      off.height = image.height;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    } catch {
      // Imagem de outra origem marca o canvas como contaminado e getImageData
      // lança. Não é motivo para abortar a exportação inteira.
      return undefined;
    }
  }, [image]);

  const buildMeasurementContext = useCallback(
    () => ({
      marks,
      segmentations: yoloSegmentations,
      metadata,
      filename,
      imageData: lerPixelsDaImagem(),
      // Uma semente de orquídea a 3600 DPI tem milhares de pixels; ler um de
      // cada quatro não muda a média e corta o custo em 4x.
      colorSampling: 2,
    }),
    [marks, yoloSegmentations, metadata, filename, lerPixelsDaImagem]
  );

  const handleExportMeasurementsCSV = useCallback(() => {
    const ctx = buildMeasurementContext();
    const rows = buildMeasurements(ctx);
    const csv = measurementsToCSV(rows, ctx);
    downloadBlob(csv, generateExportName('csv', 'medidas'), 'text/csv;charset=utf-8;');
  }, [buildMeasurementContext, filename]);

  const handleExportSQL = useCallback(() => {
    const ctx = buildMeasurementContext();
    const rows = buildMeasurements(ctx);
    const sql = measurementsToSQL(rows, ctx);
    downloadBlob(sql, generateExportName('sql', 'medidas'), 'text/plain;charset=utf-8;');
  }, [buildMeasurementContext, filename]);

  const handleExportCSV = () => {
    const headers = [
      'Data',
      'Imagem',
      'Pesquisador',
      'Projeto',
      'Tratamento',
      'Placa',
      'Quadrante',
      'Viaveis',
      'Inviaveis',
      'Total',
      '% Viavel',
      '% Inviavel',
      'Comentarios',
    ];
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
      metadata.notes.replace(/(\r\n|\n|\r)/gm, ' '),
    ];

    const csvContent = [headers, row]
      .map((e) => e.map((item) => `"${(item || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadBlob(csvContent, generateExportName('csv', 'contagem'), 'text/csv');
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
        .filter((seg) => seg.visible !== false)
        .forEach((seg) => {
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
      ctx.fillText(
        `Placa: ${metadata.plate || '-'} | Q: ${metadata.quadrant || '-'}`,
        padding + 24,
        padding + 76
      );
      statsY = padding + 104;
    }

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = ESPECIME.viable;
    ctx.fillText(`Viáveis: ${viableCount}`, padding + 24, statsY);

    ctx.fillStyle = ESPECIME.inviable;
    ctx.fillText(`Inviáveis: ${inviableCount}`, padding + 160, statsY);

    // toBlob em vez de toDataURL: uma data: URL de uma digitalização grande
    // vira uma string de dezenas de MB, e o mesmo defeito da âncora destacada
    // fazia o arquivo sair sem nome nem extensão.
    offscreenCanvas.toBlob((blob) => {
      if (blob) baixarArquivo(blob, generateExportName('png', 'anotada'), 'image/png');
    }, 'image/png');
  };

  const handleExportPDF = () => {
    generatePDFReport({
      filename: filename || 'sem-titulo.jpg',
      metadata,
      viableCount,
      inviableCount,
      totalCount: viableCount + inviableCount,
      viablePercent,
      inviablePercent,
      marks,
      yoloSegmentations,
      canvasElement: canvasRef.current,
      imageElement: image,
      visualMode,
    });
  };

  const handleExportHistoryBatchPDF = () => {
    generateBatchPDFReport(sessions, visualMode);
  };

  const handleExportHistoryCSV = () => {
    if (sessions.length === 0) return;
    const headers = [
      'Data',
      'Imagem',
      'Pesquisador',
      'Projeto',
      'Tratamento',
      'Placa',
      'Quadrante',
      'Viaveis',
      'Inviaveis',
      'Total',
      '% Viavel',
      '% Inviavel',
      'Comentarios',
    ];

    const rows = sessions.map((s) => {
      const total = s.viableCount + s.inviableCount;
      const vPct = total > 0 ? ((s.viableCount / total) * 100).toFixed(1) : '0';
      const iPct = total > 0 ? ((s.inviableCount / total) * 100).toFixed(1) : '0';
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
        s.metadata.notes.replace(/(\r\n|\n|\r)/gm, ' '),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((e) => e.map((item) => `"${(item || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadBlob(csvContent, 'historico_contagens.csv', 'text/csv');
  };

  const handleExportHistoryJSON = () => {
    if (sessions.length === 0) return;
    downloadBlob(
      JSON.stringify(sessions, null, 2),
      `seed-counter-backup-${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
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

  // Fase E — foto capturada entra no fluxo normal de imagens.
  const handleCameraCapture = useCallback(
    (file: File) => {
      loadFiles([file]);
      // Câmera exige calibração manual de escala (não há DPI de scanner).
      updateMetadata('imageSource', 'manual_camera');
    },
    [loadFiles, updateMetadata]
  );

  // A ferramenta ativa é a fonte única de verdade do modo de interação:
  // manter isPanningMode em sincronia evita que a "mãozinha" continue ligada
  // depois de trocar de ferramenta (o que bloqueava os cliques de marcação).
  useEffect(() => {
    setIsPanningMode(activeTool === 'pan');
  }, [activeTool, setIsPanningMode]);

  // Zoom com a roda do mouse, ancorado na posição do cursor.
  // Usa listener nativo com passive:false — o React registra 'wheel' como
  // passivo, o que impediria o preventDefault (a página rolaria junto).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !image) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && e.shiftKey) return; // deixa o scroll lateral livre
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      // Ponto sob o cursor, em coordenadas do conteúdo.
      const contentX = container.scrollLeft + offsetX;
      const contentY = container.scrollTop + offsetY;

      setZoomLevel((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const next = Math.min(5, Math.max(0.1, prev * factor));
        const ratio = next / prev;
        // Reposiciona o scroll para manter o ponto sob o cursor.
        requestAnimationFrame(() => {
          container.scrollLeft = contentX * ratio - offsetX;
          container.scrollTop = contentY * ratio - offsetY;
        });
        return next;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [image, setZoomLevel]);

  // Imagem com os ajustes aplicados. Serve de entrada para a detecção —
  // a imagem original permanece intacta para exibição e medidas.
  const adjustedSource = useMemo(() => {
    if (!image || !adjustEnabled || isNeutral(adjustments)) return image;
    return applyAdjustments(image, adjustments) ?? image;
  }, [image, adjustments, adjustEnabled]);

  // Filtro CSS para a prévia instantânea no canvas.
  const canvasFilter = useMemo(
    () => (adjustEnabled ? toCssFilter(adjustments) : 'none'),
    [adjustments, adjustEnabled]
  );

  // Calibração — recebe a distância medida pela régua e encerra o modo.
  const handleMeasured = useCallback((pixels: number) => {
    setMeasuredPixels(pixels);
    setIsMeasuring(false);
  }, []);

  // Fase F — clicar numa marcação inverte a classe (viável ↔ inviável).
  const handleToggleMarkClass = useCallback(
    (id: number) => {
      setMarks((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, type: m.type === 'viable' ? 'inviable' : 'viable' } : m
        )
      );
    },
    [setMarks]
  );

  // Fase F — arrastar reposiciona a marcação (correção fina da detecção).
  const handleMoveMark = useCallback(
    (id: number, x: number, y: number) => {
      setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, x, y } : m)));
    },
    [setMarks]
  );

  // Fase F — borracha: remove todas as marcações dentro do raio.
  const handleEraseArea = useCallback(
    (x: number, y: number, radius: number) => {
      setMarks((prev) => prev.filter((m) => Math.hypot(m.x - x, m.y - y) > radius));
    },
    [setMarks]
  );

  // Fase E — insere os pontos confirmados da detecção assistida.
  const handleAddDetectedMarks = useCallback(
    (detected: Mark[]) => {
      setMarks((prev) => [...prev, ...detected]);
    },
    [setMarks]
  );

  const handleFitToScreen = () => {
    if (image && containerRef.current) {
      fitToScreen(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
        image.width,
        image.height
      );
    }
  };

  // Keyboard shortcuts binding
  useEffect(() => {
    marcasRef.current = marks;
  }, [marks]);

  useEffect(() => {
    segmentacoesRef.current = yoloSegmentations;
  }, [yoloSegmentations]);

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
    hasPrevImage: currentImageIndex > 0,
  });

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-0 text-ink-1 transition-colors duration-300 font-sans">
      {/* 1. Header Toolbar */}
      <Header
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        sessionsCount={sessions.length}
        openHistory={() => setIsHistoryModalOpen(true)}
        onUndo={undoMark}
        undoDisabled={marks.length === 0}
        onReset={() => setIsResetConfirmOpen(true)}
        resetDisabled={
          marks.length === 0 &&
          yoloSegmentations.length === 0 &&
          !metadata.umPerPixel &&
          !metadata.plate &&
          !metadata.quadrant &&
          !metadata.notes &&
          !metadata.baselineCount
        }
        hasImageQueue={imageQueue.length > 0}
        currentImageIndex={currentImageIndex}
        imageQueueLength={imageQueue.length}
        onPrevImage={handlePrevImage}
        onNextImage={handleNextImage}
        onSaveSession={() => saveCurrentSession(false)}
        onExport={() => setIsExportModalOpen(true)}
        hasImage={!!image}

        currentView={currentView}
        onViewChange={navigate}
        isLongitudinalEnabled={isLongitudinalEnabled}
        isStatsEnabled={isStatsEnabled}
        onOpenFeatures={() => setIsFeaturesOpen(true)}
      />

      {currentView === 'counter' && (
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* 2. Sidebar panel */}
          <Sidebar
            fileInputRef={fileInputRef}
            importInputRef={importInputRef}
            handleFileUpload={handleFileUpload}
            handleImportJSON={(e) => {
              // ImageActions liga esta prop ao onChange de um <input type="file">,
              // entao ela recebe o evento — nao o File. Passar processJSONFile
              // direto fazia reader.readAsText(evento) lancar TypeError, e o
              // botao "Importar" da barra lateral nunca funcionou.
              const file = e.target.files?.[0];
              if (file) processJSONFile(file);
              // Zera o valor para permitir reimportar o mesmo arquivo: sem isto
              // o onChange nao dispara na segunda vez.
              e.target.value = '';
            }}
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
            onOpenCamera={isCameraEnabled ? () => setIsCameraOpen(true) : undefined}
            onOpenSplit={isSplitEnabled && image ? () => setIsSplitOpen(true) : undefined}
            onOpenRoi={isRoiEnabled && image ? () => setIsRoiOpen(true) : undefined}
            calibrationSummary={
              metadata.umPerPixel && metadata.umPerPixel > 0
                ? `${metadata.umPerPixel.toFixed(2)} µm/px`
                : 'medidas em pixels'
            }
            needsCalibration={!metadata.umPerPixel || metadata.umPerPixel <= 0}
            adjustSlot={
              <ImageAdjustPanel
                image={image}
                adjustments={adjustments}
                onChange={setAdjustments}
                enabled={adjustEnabled}
                onToggleEnabled={() => setAdjustEnabled((v) => !v)}
              />
            }
            calibrationSlot={
              <CalibrationPanel
                umPerPixel={metadata.umPerPixel}
                onChange={(value) => updateMetadata('umPerPixel', value)}
                onStartMeasure={() => {
                  setMeasuredPixels(undefined);
                  setIsMeasuring(true);
                }}
                measuredPixels={measuredPixels}
                isMeasuring={isMeasuring}
              />
            }
            detectionSlot={
              isAiPointerEnabled || isDetectionEnabled ? (
                <div className="space-y-5">
                  {isAiPointerEnabled && (
                    <AiPointerPanel
                      image={adjustedSource}
                      marks={marks}
                      onAddMarks={handleAddDetectedMarks}
                      onPreviewChange={setDetectionPreview}
                      onAddSegmentations={addYoloSegmentations}
                      umPerPixel={metadata.umPerPixel}
                      regiao={regiaoDeDeteccao}
                      onSelecionarRegiao={() => setSelecionandoRegiao(true)}
                      onLimparRegiao={() => setRegiaoDeDeteccao(null)}
                    />
                  )}
                  {isDetectionEnabled && (
                    <DetectionPanel
                      image={adjustedSource}
                      marks={marks}
                      onAddMarks={handleAddDetectedMarks}
                      onPreviewChange={setDetectionPreview}
                      regiao={regiaoDeDeteccao}
                      onSelecionarRegiao={() => setSelecionandoRegiao(true)}
                      onLimparRegiao={() => setRegiaoDeDeteccao(null)}
                    />
                  )}
                </div>
              ) : undefined
            }
          />

          {/* 3. Image viewport scroll and Zoom area */}
          <ImageViewport
            containerRef={containerRef}
            image={image}
            onBrowseFiles={handleBrowseFiles}
            loadError={loadError}
            isPanningMode={isPanningMode}
            isDragging={isPanningDrag}
            startDrag={startDrag}
            handleDrag={handleDrag}
            stopDrag={stopDrag}
          >
            {image && (
              <Toolbar
                activeTool={activeTool}
                onSelect={setActiveTool}
                eraserRadius={eraserRadius}
                onEraserRadiusChange={setEraserRadius}
                isTemporary={isToolTemporary}
                showRulers={showRulers}
                onToggleRulers={() => setShowRulers((v) => !v)}
              />
            )}
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
                umPerPixel={metadata.umPerPixel}
                detectionPreview={detectionPreview}
                canvasFilter={canvasFilter}
                activeTool={activeTool}
                eraserRadius={eraserRadius}
                onRemoveMark={removeMark}
                onToggleMarkClass={handleToggleMarkClass}
                onMoveMark={handleMoveMark}
                onEraseArea={handleEraseArea}
                showRulers={showRulers}
                isMeasuring={isMeasuring}
                onMeasured={handleMeasured}
                isSelectingRegion={selecionandoRegiao}
                selectedRegion={regiaoDeDeteccao}
                onRegionSelected={(r) => {
                  setRegiaoDeDeteccao(r);
                  setSelecionandoRegiao(false);
                }}
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
      )}

      {currentView === 'longitudinal' && isLongitudinalEnabled && (
        <LongitudinalView
          onViewSession={handleLoadSession}
          onCreateExperiment={() => {
            setSelectedExperimentForEdit(undefined);
            setIsExperimentModalOpen(true);
          }}
          onEditExperiment={(experiment) => {
            setSelectedExperimentForEdit(experiment);
            setIsExperimentModalOpen(true);
          }}
          onAddPlateRun={(experimentId, treatmentId, existingRun) => {
            const exp = experiments.find((e) => e.id === experimentId);
            if (exp) {
              setSelectedExperimentForRun(exp);
              setSelectedTreatmentIdForRun(treatmentId);
              setSelectedPlateRunForEdit(existingRun);
              setIsPlateRunModalOpen(true);
            }
          }}
        />
      )}

      {currentView === 'stats' && isStatsEnabled && (
        <StatsView
          sessions={sessions}
          experiments={experiments}
          onViewSession={handleLoadSession}
        />
      )}

      {/* 5. Footer Status Bar */}
      {currentView === 'counter' && (
        <Footer filename={filename} imageWidth={image?.width} imageHeight={image?.height} />
      )}

      {/* 6. Drag Drop file upload overlay */}
      {currentView === 'counter' && <DropZone isVisible={isDragActive} />}

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
            exportMeasurementsCSV={handleExportMeasurementsCSV}
            exportSQL={handleExportSQL}
            measurementCount={marks.length}
            hasMorphometry={yoloSegmentations.some(
              (s) => s.visible !== false && s.polygon_points?.length >= 3
            )}
            exportJSON={handleExportJSON}
            exportAnnotatedImage={handleExportAnnotatedImage}
            exportPDF={handleExportPDF}
            isYoloExportEnabled={isYoloExportEnabled}
            onOpenYoloExport={() => setIsYoloExportModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryModalOpen && (
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            sessions={sessions}
            onLoadSession={handleLoadSession}
            onDeleteSession={deleteSession}
            onClearHistory={clearSessions}
            onExportHistoryJSON={handleExportHistoryJSON}
            onExportHistoryCSV={handleExportHistoryCSV}
            onExportHistoryBatchPDF={handleExportHistoryBatchPDF}
            onImportHistoryJSON={handleImportHistoryJSON}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isYoloExportModalOpen && isYoloExportEnabled && (
          <YoloExportModal
            isOpen={isYoloExportModalOpen}
            onClose={() => setIsYoloExportModalOpen(false)}
            sessions={sessions}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExperimentModalOpen && (
          <ExperimentModal
            isOpen={isExperimentModalOpen}
            onClose={() => setIsExperimentModalOpen(false)}
            experiment={selectedExperimentForEdit}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlateRunModalOpen && selectedExperimentForRun && (
          <PlateRunModal
            isOpen={isPlateRunModalOpen}
            onClose={() => setIsPlateRunModalOpen(false)}
            experiment={selectedExperimentForRun}
            treatmentId={selectedTreatmentIdForRun}
            plateRun={selectedPlateRunForEdit}
            sessions={sessions}
          />
        )}
      </AnimatePresence>

      {/* Fase E — Captura por câmera (lupa/microscópio e celular) */}
      {isCameraEnabled && (
        <CameraModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}

      {/* Preparo da imagem (Fase G) */}
      <AnimatePresence>
        {isSplitOpen && isSplitEnabled && (
          <SplitModal
            isOpen={isSplitOpen}
            onClose={() => setIsSplitOpen(false)}
            image={image}
            filename={filename}
            // Os pedaços substituem a fila: é o fluxo do scanner, em que a
            // folha inteira deixa de interessar depois de fatiada.
            onSplit={(pecas) => loadFiles(pecas)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRoiOpen && isRoiEnabled && (
          <RoiModal
            isOpen={isRoiOpen}
            onClose={() => setIsRoiOpen(false)}
            image={image}
            filename={filename}
            // Troca só a imagem em exibição, sem mexer na fila: quem tem uma
            // fila de pedaços continua podendo navegar entre eles.
            onCrop={(recorte) => loadImageFromFile(recorte)}
          />
        )}
      </AnimatePresence>

      {/* Confirmação de limpeza — ação destrutiva, foco inicial em Cancelar */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <ConfirmDialog
            isOpen={isResetConfirmOpen}
            onClose={() => setIsResetConfirmOpen(false)}
            onConfirm={handleResetCurrentPlate}
            title="Limpar a placa atual?"
            message="Esta ação não pode ser desfeita. O histórico de sessões salvas não é afetado."
            confirmLabel="Limpar placa"
            clears={[
              'Marcações manuais',
              'Segmentações do YOLO',
              'Calibração (µm/px)',
              'Base do cálculo diferencial',
              'Placa, quadrante e notas',
            ]}
            keeps={[
              'Histórico de sessões',
              'Experimentos e placas',
              'Pesquisador e projeto',
              'Tratamento',
              'Imagem carregada',
            ]}
          />
        )}
      </AnimatePresence>

      {/* Painel visível de funcionalidades */}
      <FeaturesModal isOpen={isFeaturesOpen} onClose={() => setIsFeaturesOpen(false)} />

      {/* 8. Feature Flags Debug Panel */}
      <FeatureFlagsDebugPanel />
    </div>
  );
}
