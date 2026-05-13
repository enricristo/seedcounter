import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  RotateCcw, 
  Download, 
  Info, 
  Trash2, 
  Undo2,
  MousePointer2,
  Target,
  FileText,
  Image as ImageIcon,
  FileJson,
  Table,
  History,
  X,
  Save,
  Circle,
  Hash,
  ZoomIn,
  ZoomOut,
  Maximize,
  FolderUp,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Mark, Metadata, Session } from './types';

const defaultMetadata: Metadata = {
  researcher: '',
  project: '',
  treatment: '',
  plate: '',
  quadrant: '',
  notes: ''
};

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
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [metadata, setMetadata] = useState<Metadata>(defaultMetadata);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [visualMode, setVisualMode] = useState<'dots' | 'numbers'>('dots');
  const [zoomLevel, setZoomLevel] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [imageQueue, setImageQueue] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const viableCount = marks.filter(m => m.type === 'viable').length;
  const inviableCount = marks.filter(m => m.type === 'inviable').length;
  
  const viablePercent = marks.length > 0 ? ((viableCount / marks.length) * 100).toFixed(1) : "0";
  const inviablePercent = marks.length > 0 ? ((inviableCount / marks.length) * 100).toFixed(1) : "0";

  // Load saved metadata and history from localStorage
  useEffect(() => {
    try {
      const savedMetadata = localStorage.getItem('lastMetadata');
      if (savedMetadata) {
        setMetadata(JSON.parse(savedMetadata));
      }
      const savedSessions = localStorage.getItem('seedCounterSessions');
      if (savedSessions) {
        setSessions(JSON.parse(savedSessions));
      }
    } catch (e) {
      console.error("Local storage error", e);
    }
  }, []);

  // Save metadata to localstorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lastMetadata', JSON.stringify(metadata));
  }, [metadata]);

  // Save sessions to localstorage
  useEffect(() => {
    localStorage.setItem('seedCounterSessions', JSON.stringify(sessions));
  }, [sessions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (Array.from(e.target.files || []) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      setImageQueue(files);
      setCurrentImageIndex(0);
      loadImageFromFile(files[0]);
    }
  };

  const loadImageFromFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setMarks([]); // Reset marks for new image
        setZoomLevel(1);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleNextImage = () => {
    if (currentImageIndex < imageQueue.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      loadImageFromFile(imageQueue[nextIndex]);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      loadImageFromFile(imageQueue[prevIndex]);
    }
  };

  const saveAndNext = () => {
    saveCurrentSession(true);
    handleNextImage();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.metadata) setMetadata(data.metadata);
          if (data.marks) setMarks(data.marks);
          if (data.filename) setFilename(data.filename);
          alert("Sessão importada com sucesso. Por favor, carregue a imagem correspondente, caso ainda não esteja carregada.");
        } catch (error) {
          alert("Erro ao importar o arquivo JSON. Arquivo corrompido ou formato inválido.");
        }
      };
      reader.readAsText(file);
    }
    // reset input
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw marks
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Scale coordinates if displayed size differs from internal size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Determine type: Left click = viable, Shift/Ctrl/Right/Middle = inviable
    const type = (e.shiftKey || e.ctrlKey || e.button !== 0) ? 'inviable' : 'viable';

    setMarks(prev => [...prev, { x, y, type, id: Date.now() }]);
  };

  const handleUndo = () => {
    setMarks(prev => prev.slice(0, -1));
  };

  const handleReset = () => {
    if (window.confirm("Deseja realmente limpar todas as marcações da imagem atual?")) {
      setMarks([]);
    }
  };

  const saveCurrentSession = (silent = false) => {
    if (!filename) return;
    const newSession: Session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      filename,
      viableCount,
      inviableCount,
      metadata: { ...metadata }
    };
    setSessions(prev => [newSession, ...prev]);
    if (!silent) {
      alert("Sessão salva com sucesso no histórico local!");
    }
  };

  // EXPORT FUNCTIONS //
  const generateExportName = (extension: string) => {
    const baseName = filename ? filename.split('.')[0] : 'contagem';
    const cleanPlate = metadata.plate ? `_${metadata.plate}` : '';
    const cleanQuad = metadata.quadrant ? `_Q${metadata.quadrant}` : '';
    return `${baseName}${cleanPlate}${cleanQuad}.${extension}`;
  };

  const exportTextReport = () => {
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
                    `Total: ${marks.length}\n`;

    downloadBlob(content, generateExportName('txt'), 'text/plain');
  };

  const exportJSON = () => {
    const data = {
      filename,
      date: new Date().toISOString(),
      metadata,
      results: {
        viableCount,
        inviableCount,
        totalCount: marks.length,
        viablePercent: Number(viablePercent),
        inviablePercent: Number(inviablePercent)
      },
      marks
    };
    downloadBlob(JSON.stringify(data, null, 2), generateExportName('json'), 'application/json');
  };

  const exportCSV = () => {
    // Generate a single row CSV for this session
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
      marks.length.toString(),
      viablePercent,
      inviablePercent,
      metadata.notes.replace(/(\r\n|\n|\r)/gm, " ") // Clean newlines in comments
    ];
    
    // Process quotes for CSV
    const csvContent = [headers, row]
      .map(e => e.map(item => `"${(item || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
      
    downloadBlob(csvContent, generateExportName('csv'), 'text/csv');
  };

  const exportAnnotatedImage = () => {
    if (!canvasRef.current || !image) return;
    
    // Create an offscreen canvas to paint the summary box on top without affecting live view
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = image.width;
    offscreenCanvas.height = image.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return;

    // Draw image and marks
    ctx.drawImage(image, 0, 0);
    renderMarksToContext(ctx, marks, visualMode);

    // Draw Summary Box
    const padding = 20;
    // We adjust the box dimensions based on the contents
    const hasMoreDetails = !!(metadata.plate || metadata.quadrant);
    const boxW = 340;
    const boxH = hasMoreDetails ? 160 : 140;
    
    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    // Background
    ctx.fillStyle = 'rgba(23, 23, 23, 0.85)'; // Neutral 900 with opacity
    ctx.beginPath();
    ctx.roundRect(padding, padding, boxW, boxH, 12);
    ctx.fill();
    
    // Reset shadow for text
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Relatório de Contagem`, padding + 24, padding + 24);
    
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#a3a3a3'; // Neutral 400
    ctx.fillText(`Amostra: ${filename}`, padding + 24, padding + 56);
    
    let statsY = padding + 80;
    
    if (hasMoreDetails) {
      ctx.fillText(`Placa: ${metadata.plate || '-'} | Q: ${metadata.quadrant || '-'}`, padding + 24, padding + 76);
      statsY = padding + 104;
    }
    
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ef4444'; // Red
    ctx.fillText(`Viáveis: ${viableCount}`, padding + 24, statsY);
    
    ctx.fillStyle = '#fbbf24'; // Yellow
    ctx.fillText(`Inviáveis: ${inviableCount}`, padding + 160, statsY);

    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = generateExportName('png');
    link.click();
  };

  // HISTORY EXPORT
  const exportHistoryCSV = () => {
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

  const deleteSession = (id: string) => {
    if(window.confirm("Remover esta contagem do histórico local?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const clearHistory = () => {
    if(window.confirm("Tem certeza que deseja apagar TODO o histórico? Esta ação não pode ser desfeita.")) {
      setSessions([]);
    }
  };

  const plateStats = sessions.reduce((acc, s) => {
    const p = s.metadata.plate || 'Não definida';
    if (!acc[p]) acc[p] = { v: 0, i: 0, t: 0 };
    acc[p].v += s.viableCount;
    acc[p].i += s.inviableCount;
    acc[p].t += (s.viableCount + s.inviableCount);
    return acc;
  }, {} as Record<string, {v: number, i: number, t: number}>);

  const downloadBlob = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateMetadata = (key: keyof Metadata, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-100 text-neutral-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-neutral-200 bg-white flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-2 rounded-lg text-white">
            <Target size={20} />
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight leading-tight">Contador de Sementes</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Edição Acadêmica</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors mr-2"
          >
            <History size={18} />
            Histórico ({sessions.length})
          </button>
          
          <div className="w-[1px] h-6 bg-neutral-200 mx-2" />

          <button 
            onClick={handleUndo}
            disabled={marks.length === 0}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors disabled:opacity-30 tooltip text-neutral-600"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 size={20} />
          </button>
          <button 
            onClick={handleReset}
            disabled={marks.length === 0}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors disabled:opacity-30 text-neutral-600"
            title="Limpar Tudo"
          >
            <RotateCcw size={20} />
          </button>
          
          <div className="w-[1px] h-6 bg-neutral-200 mx-2" />

          {imageQueue.length > 1 && (
            <div className="flex items-center gap-1 mr-2 bg-neutral-100 rounded-lg p-1">
              <button 
                onClick={handlePrevImage}
                disabled={currentImageIndex === 0}
                className="p-1 px-2 hover:bg-neutral-200 rounded text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-medium transition-colors"
                title="Imagem Anterior"
              >
                Anterior
              </button>
              <div className="text-[10px] font-mono text-neutral-500 px-1">
                {currentImageIndex + 1}/{imageQueue.length}
              </div>
              <button 
                onClick={handleNextImage}
                disabled={currentImageIndex === imageQueue.length - 1}
                className="p-1 px-2 hover:bg-neutral-200 rounded text-neutral-600 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-medium transition-colors"
                title="Próxima Imagem"
              >
                Próxima
              </button>
            </div>
          )}

          <button 
            onClick={imageQueue.length > 1 && currentImageIndex < imageQueue.length - 1 ? saveAndNext : () => saveCurrentSession(false)}
            disabled={!image}
            className="flex items-center gap-2 bg-neutral-100 text-neutral-700 border border-neutral-200 px-3 py-2 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 font-medium text-sm"
          >
            <Save size={16} />
            {imageQueue.length > 1 && currentImageIndex < imageQueue.length - 1 ? "Salvar & Próxima" : "Salvar Sessão Local"}
          </button>

          <button 
            onClick={() => setIsExportModalOpen(true)}
            disabled={!image}
            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-800 transition-colors disabled:bg-neutral-200 disabled:text-neutral-400 font-medium text-sm"
          >
            <Download size={18} />
            Exportar...
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-neutral-200 bg-white flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col p-6 gap-6 min-h-max">
            
            {/* Actions */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Imagem & Sessão</h3>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-all text-neutral-700 hover:text-neutral-900 font-medium group"
                >
                  <div className="flex items-center gap-3">
                    <Upload size={18} className="text-neutral-400 group-hover:text-neutral-600" />
                    <span className="text-sm">Carregar Nova Imagem</span>
                  </div>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />

                <button 
                  onClick={() => importInputRef.current?.click()}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-all text-neutral-700 hover:text-neutral-900 font-medium group"
                >
                  <div className="flex items-center gap-3">
                    <FolderUp size={18} className="text-neutral-400 group-hover:text-neutral-600" />
                    <span className="text-sm">Importar Sessão (JSON)</span>
                  </div>
                </button>
                <input 
                  type="file" 
                  ref={importInputRef} 
                  onChange={handleImportJSON} 
                  accept="application/json,.json" 
                  className="hidden" 
                />
              </div>
            </section>

            {/* Totalizers */}
            <section>
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Totalizadores</h3>
              <div className="space-y-3">
                <CounterItem 
                  label="Viáveis" 
                  count={viableCount} 
                  percent={viablePercent}
                  color="bg-red-500" 
                  description="Pontos vermelhos"
                />
                <CounterItem 
                  label="Inviáveis (Detritos)" 
                  count={inviableCount} 
                  percent={inviablePercent}
                  color="bg-amber-400" 
                  description="Pontos amarelos"
                />
                <div className="pt-2 mt-2 border-t border-neutral-100 flex justify-between items-baseline px-1">
                  <span className="text-sm font-semibold text-neutral-600">Total Geral</span>
                  <span className="text-xl font-bold font-mono text-neutral-900">{marks.length}</span>
                </div>
                
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setVisualMode('dots')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${visualMode === 'dots' ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    <Circle size={14} /> Pontos
                  </button>
                  <button
                    onClick={() => setVisualMode('numbers')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${visualMode === 'numbers' ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                  >
                    <Hash size={14} /> Números
                  </button>
                </div>
              </div>
            </section>

            {/* Context / Metadata */}
            <section className="flex-1">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Contexto da Amostra</h3>
              <div className="space-y-3">
                <MetadataInput 
                  label="Usuário (Pesquisador)" 
                  value={metadata.researcher} 
                  onChange={(v) => updateMetadata('researcher', v)} 
                  placeholder="Ex: Maiara, Nelson"
                />
                <MetadataInput 
                  label="Projeto" 
                  value={metadata.project} 
                  onChange={(v) => updateMetadata('project', v)} 
                  placeholder="Ex: Projeto Orquídeas 2026"
                />
                <MetadataInput 
                  label="Tratamento / Experimento" 
                  value={metadata.treatment} 
                  onChange={(v) => updateMetadata('treatment', v)} 
                  placeholder="Ex: 25° 3h"
                />
                <div className="flex gap-3">
                  <MetadataInput 
                    label="Placa" 
                    value={metadata.plate} 
                    onChange={(v) => updateMetadata('plate', v)} 
                    placeholder="Ex: P12"
                  />
                  <MetadataInput 
                    label="Quadrante" 
                    value={metadata.quadrant} 
                    onChange={(v) => updateMetadata('quadrant', v)} 
                    placeholder="Ex: Q3"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-neutral-600 ml-1">Observações e Comentários</label>
                  <textarea 
                    value={metadata.notes}
                    onChange={(e) => updateMetadata('notes', e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-y min-h-[80px]"
                    placeholder="Notas adicionais sobre a imagem ou anomalias..."
                  />
                </div>
              </div>
            </section>

            {/* Help / Tip */}
            <section className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
              <div className="flex gap-3">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-900">Como marcar:</p>
                  <ul className="text-[10px] text-blue-800 space-y-1 opacity-80 list-disc pl-3">
                    <li><b>Clique:</b> Semente Viável</li>
                    <li><b>Shift + Clique:</b> Inviável/Detrito</li>
                    <li><b>Botão Dir.:</b> Inviável/Detrito</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* Viewport Area */}
        <div 
          ref={containerRef}
          className="flex-1 bg-neutral-200 relative overflow-auto flex items-center justify-center p-8 selection:bg-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md w-full bg-white p-12 rounded-3xl shadow-xl shadow-neutral-400/10 border border-neutral-100 text-center flex flex-col items-center gap-6"
              >
                <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300">
                  <ImageIcon size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight text-neutral-800">Selecione uma imagem</h2>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    Carregue a foto microscópica da amostra para iniciar a marcação manual.
                  </p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-neutral-900 text-white px-6 py-3 rounded-xl hover:bg-neutral-800 transition-all font-medium text-sm shadow-lg shadow-neutral-900/10 active:scale-95"
                >
                  Procurar Arquivo
                </button>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative bg-white shadow-2xl rounded-sm overflow-hidden"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
              >
                <canvas 
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseDown={(e) => {
                    // Handle right click with onMouseDown because onClick ignores button 2
                    if (e.button === 2) handleCanvasClick(e as any);
                  }}
                  className="max-w-full h-auto cursor-crosshair block"
                  style={{ maxHeight: 'calc(100vh - 12rem)' }}
                />
                
                {/* Overlay Filename */}
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded text-[10px] text-white/90 font-mono pointer-events-none">
                  {filename}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Zoom Controls */}
          {image && (
            <div className="absolute right-6 bottom-6 flex flex-col gap-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-lg border border-neutral-200 z-10">
              <button onClick={() => setZoomLevel(z => Math.min(z + 0.2, 5))} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors" title="Aumentar Zoom">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => setZoomLevel(1)} className="text-xs font-mono font-medium hover:bg-neutral-100 rounded-lg py-1 transition-colors text-neutral-500" title="Resetar Zoom">
                {Math.round(zoomLevel * 100)}%
              </button>
              <button onClick={() => setZoomLevel(z => Math.max(z - 0.2, 0.2))} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors" title="Diminuir Zoom">
                <ZoomOut size={18} />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 border-t border-neutral-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-neutral-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Sistema Ativo
          </div>
          {filename && <div>{filename} • {image?.width}x{image?.height}px</div>}
        </div>
        <div className="text-[10px] text-neutral-300 font-mono tracking-wider italic">
          v1.1.0 • Edição Pesquisa
        </div>
      </footer>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200"
            >
              <div className="flex justify-between items-center p-5 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="font-semibold text-lg text-neutral-800">Exportar Contagem</h2>
                <button onClick={() => setIsExportModalOpen(false)} className="text-neutral-400 hover:text-neutral-700 p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                
                <div className="mb-6 bg-red-50 border border-red-100 text-red-800 p-4 rounded-xl flex items-start gap-3">
                  <Save className="shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Salvar no Histórico Local</h4>
                    <p className="text-xs opacity-80 mb-3">Armazena os metadados e os números da contagem dentro do navegador. Útil para consolidar tabelas complexas depois.</p>
                    <button 
                      onClick={() => {
                        if (imageQueue.length > 1 && currentImageIndex < imageQueue.length - 1) {
                          saveAndNext();
                        } else {
                          saveCurrentSession();
                        }
                        setIsExportModalOpen(false);
                      }}
                      className="bg-white border border-red-200 hover:border-red-300 text-red-700 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm"
                    >
                      {imageQueue.length > 1 && currentImageIndex < imageQueue.length - 1 ? "Salvar & Próxima Imagem" : "Salvar Sessão Localmente"}
                    </button>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Baixar Arquivos para esta amostra</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ExportCard 
                    icon={<FileText size={20} className="text-blue-500" />}
                    title="Relatório TXT"
                    desc="Texto estruturado e de fácil leitura."
                    onClick={exportTextReport}
                  />
                  <ExportCard 
                    icon={<Table size={20} className="text-emerald-500" />}
                    title="Planilha (CSV)"
                    desc="Formato CSV. Ideal para Excel ou R."
                    onClick={exportCSV}
                  />
                  <ExportCard 
                    icon={<FileJson size={20} className="text-amber-500" />}
                    title="Dados Brutos (JSON)"
                    desc="Inclui coordenadas xy de todos pontos."
                    onClick={exportJSON}
                  />
                  <ExportCard 
                    icon={<ImageIcon size={20} className="text-purple-500" />}
                    title="Imagem Anotada"
                    desc="Salva a imagem PNG com os pontos."
                    onClick={exportAnnotatedImage}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white flex flex-col rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[85vh] overflow-hidden border border-neutral-200"
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100 bg-neutral-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-neutral-200 p-2 rounded-lg text-neutral-700">
                    <History size={20} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-xl text-neutral-800">Histórico de Sessões</h2>
                    <p className="text-xs text-neutral-500 pt-0.5">Contagens salvas localmente neste navegador</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={exportHistoryCSV}
                    disabled={sessions.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Table size={16} />
                    Exportar Tabela Completa (CSV)
                  </button>
                  <button onClick={() => setIsHistoryModalOpen(false)} className="text-neutral-400 hover:text-neutral-700 p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors ml-2">
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto bg-white">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                    <History size={48} className="text-neutral-200 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-600">Nenhum registro ainda</h3>
                    <p className="text-sm text-neutral-400 max-w-sm mt-2">
                      Após contar uma placa, clique em "Exportar Contagem" e depois em "Salvar Sessão Localmente" para adicionar os resultados aqui.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row h-full">
                    <div className="flex-1 overflow-auto border-r border-neutral-100">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-neutral-50 sticky top-0 z-10 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-6 py-4 font-semibold">Data</th>
                            <th className="px-6 py-4 font-semibold">Arquivo</th>
                            <th className="px-6 py-4 font-semibold">Pesquisador / Projeto</th>
                            <th className="px-6 py-4 font-semibold">Placa / Q</th>
                            <th className="px-6 py-4 font-semibold text-right text-red-600">Viáveis</th>
                            <th className="px-6 py-4 font-semibold text-right text-amber-500">Inviáveis</th>
                            <th className="px-6 py-4 font-semibold text-right text-neutral-700">Total</th>
                            <th className="px-6 py-4 font-semibold"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 text-neutral-700">
                          {sessions.map((s) => (
                            <tr key={s.id} className="hover:bg-neutral-50/50 transition-colors">
                              <td className="px-6 py-3">
                                <div className="text-xs text-neutral-500">{new Date(s.date).toLocaleDateString()}</div>
                                <div className="text-[10px] text-neutral-400">{new Date(s.date).toLocaleTimeString()}</div>
                              </td>
                              <td className="px-6 py-3 font-mono text-[11px] truncate max-w-[150px]">{s.filename}</td>
                              <td className="px-6 py-3">
                                <div className="font-medium text-neutral-900 truncate max-w-[150px]">{s.metadata.researcher || '-'}</div>
                                <div className="text-xs text-neutral-500 truncate max-w-[150px]">{s.metadata.project || '-'}</div>
                              </td>
                              <td className="px-6 py-3">
                                <div className="font-medium">{s.metadata.plate || '-'}</div>
                                <div className="text-xs text-neutral-500">{s.metadata.quadrant||'-'} / {s.metadata.treatment||'-'}</div>
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-red-500">{s.viableCount}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-amber-500">{s.inviableCount}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-neutral-800">{s.viableCount + s.inviableCount}</td>
                              <td className="px-6 py-3 text-right">
                                <button 
                                  onClick={() => deleteSession(s.id)}
                                  className="text-neutral-400 hover:text-red-500 p-1.5 rounded transition-colors"
                                  title="Excluir Registro"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Panel Stats */}
                    <div className="w-full md:w-80 bg-neutral-50/50 flex flex-col p-6 overflow-y-auto">
                      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Resumo por Placa</h3>
                      <div className="space-y-4">
                        {Object.entries(plateStats).map(([plate, stats]: [string, any]) => {
                          const vPct = stats.t > 0 ? Math.round((stats.v / stats.t) * 100) : 0;
                          const iPct = stats.t > 0 ? Math.round((stats.i / stats.t) * 100) : 0;
                          return (
                            <div key={plate} className="bg-white border border-neutral-200 p-4 rounded-xl shadow-sm">
                              <h4 className="font-semibold text-neutral-800 mb-2">{plate}</h4>
                              <div className="flex justify-between items-end mb-1">
                                <span className="text-xs text-neutral-500">Total</span>
                                <span className="font-mono font-bold text-sm">{stats.t}</span>
                              </div>
                              <div className="flex bg-neutral-100 rounded-full h-1.5 mb-3 overflow-hidden">
                                <div className="bg-red-500 h-full" style={{ width: `${vPct}%`}} />
                                <div className="bg-amber-400 h-full" style={{ width: `${iPct}%`}} />
                              </div>
                              <div className="flex justify-between text-xs">
                                <div className="flex flex-col">
                                  <span className="text-red-600 font-semibold">{vPct}% Viáveis</span>
                                  <span className="text-neutral-400">{stats.v} sementes</span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-amber-500 font-semibold">{iPct}% Inviáveis</span>
                                  <span className="text-neutral-400">{stats.i} sementes</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {sessions.length > 0 && (
                <div className="border-t border-neutral-100 p-4 bg-neutral-50 shrink-0 flex justify-end">
                   <button 
                    onClick={clearHistory}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-4 py-2"
                  >
                    Apagar todo o histórico
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function CounterItem({ label, count, color, description, percent }: { label: string, count: number, color: string, description: string, percent?: string }) {
  return (
    <div className="flex flex-col p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors border border-transparent shadow-sm group relative overflow-hidden">
      <div className="flex items-center justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${color} rounded-lg shadow-sm flex items-center justify-center text-white`}>
            <MousePointer2 size={14} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col z-10">
            <span className="text-xs font-semibold text-neutral-800">{label}</span>
            <span className="text-[9px] text-neutral-500">{description}</span>
          </div>
        </div>
        <div className="flex flex-col items-end z-10">
          <span className="text-lg font-bold font-mono tracking-tighter text-neutral-900">
            {count}
          </span>
        </div>
      </div>
      {percent && (
        <div className="absolute top-0 right-0 h-full flex items-center justify-end pr-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <span className="text-4xl font-black font-mono tracking-tighter -mr-2">{percent}%</span>
        </div>
      )}
    </div>
  );
}

function MetadataInput({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[11px] font-semibold text-neutral-600 ml-1">{label}</label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-neutral-400"
      />
    </div>
  );
}

function ExportCard({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-start text-left p-4 rounded-xl border border-neutral-200 hover:border-neutral-400 hover:shadow-md transition-all bg-white group active:scale-[0.98]"
    >
      <div className="bg-neutral-50 p-2.5 rounded-lg mb-3 group-hover:bg-neutral-100 transition-colors">
        {icon}
      </div>
      <h4 className="font-semibold text-sm text-neutral-800 mb-1">{title}</h4>
      <p className="text-[10px] text-neutral-500 leading-relaxed">{desc}</p>
    </button>
  );
}
