import React, { useState, useMemo } from 'react';
import { X, Download, AlertTriangle, FileCheck, Layers, Settings, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Session } from '../../types';
import { generateYOLODataset, getExportSummary } from '../../lib/yolo-exporter';

interface YoloExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
}

export function YoloExportModal({ isOpen, onClose, sessions }: YoloExportModalProps) {
  // Option states
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [trainValSplit, setTrainValSplit] = useState(80); // percentage for train
  const [estimatedSeedDiameterUm, setEstimatedSeedDiameterUm] = useState(500); // 0.5mm
  const [fallbackRadiusPx, setFallbackRadiusPx] = useState(30);
  const [includeInviable, setIncludeInviable] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'polygon' | 'marks'>('all');

  // Initialize with all sessions selected
  React.useEffect(() => {
    if (isOpen) {
      setSelectedSessionIds(sessions.filter(s => s.imageData).map(s => s.id));
    }
  }, [isOpen, sessions]);

  // Session stats/filters
  const sessionsWithImages = useMemo(() => sessions.filter(s => s.imageData), [sessions]);

  const filteredSessions = useMemo(() => {
    return sessionsWithImages.filter(s => {
      const hasPolygons = s.yoloSegmentations && s.yoloSegmentations.length > 0;
      const hasMarks = s.marks && s.marks.length > 0;
      if (filterType === 'polygon') return hasPolygons;
      if (filterType === 'marks') return hasMarks && !hasPolygons;
      return true;
    });
  }, [sessionsWithImages, filterType]);

  // Select helpers
  const handleToggleSelectAll = () => {
    if (selectedSessionIds.length === filteredSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(filteredSessions.map(s => s.id));
    }
  };

  const handleToggleSession = (id: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  // Selected sessions array
  const selectedSessions = useMemo(() => {
    return sessions.filter(s => selectedSessionIds.includes(s.id));
  }, [sessions, selectedSessionIds]);

  // Summary of export
  const summary = useMemo(() => {
    return getExportSummary(selectedSessions);
  }, [selectedSessions]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (selectedSessions.length === 0) {
      alert('Selecione pelo menos uma sessão para exportar.');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await generateYOLODataset(selectedSessions, {
        trainValSplit: trainValSplit / 100,
        estimatedSeedDiameterUm,
        fallbackRadiusPx,
        includeInviable,
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seedcounter_yolo_dataset_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('YOLO Export failed:', error);
      alert('Falha ao exportar dataset. Verifique o console para mais detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/80 dark:bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white dark:bg-[#18181B] flex flex-col rounded-3xl shadow-2xl w-full max-w-4xl h-full max-h-[85vh] overflow-hidden border border-neutral-200 dark:border-zinc-800 transition-all duration-300"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl text-amber-600 dark:text-amber-400 shadow-inner">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-neutral-800 dark:text-zinc-100 uppercase tracking-wide">
                  Exportar Dataset YOLO
                </h2>
                <span className="px-1.5 py-0.5 text-[8px] font-bold bg-amber-500 text-neutral-900 rounded uppercase tracking-wide">
                  BETA
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                Gere imagens e marcações no formato compatível com treinamento de modelos YOLOv8
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel: Selection and Settings */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-neutral-200 dark:border-zinc-800">
            {/* Filter and Selection Table */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider">
                  Selecione as Imagens ({selectedSessionIds.length} de {filteredSessions.length})
                </span>
                
                {/* Filters */}
                <div className="flex items-center bg-neutral-100 dark:bg-zinc-900 rounded-lg p-0.5 text-[10px] font-bold uppercase">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-1.5 rounded-md ${
                      filterType === 'all'
                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('polygon')}
                    className={`px-2 py-1.5 rounded-md ${
                      filterType === 'polygon'
                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Polígonos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('marks')}
                    className={`px-2 py-1.5 rounded-md ${
                      filterType === 'marks'
                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    Pontos
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div className="border border-neutral-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-neutral-50 dark:bg-zinc-900/30">
                <div className="flex items-center px-4 py-2 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-100/50 dark:bg-zinc-900/50 justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.length === filteredSessions.length && filteredSessions.length > 0}
                      onChange={handleToggleSelectAll}
                      className="accent-purple-600"
                    />
                    <span className="text-[10px] font-bold text-neutral-600 dark:text-zinc-400 uppercase">
                      Selecionar Filtrados
                    </span>
                  </label>
                  <span className="text-[10px] text-neutral-400 font-semibold uppercase">
                    Amostras com Imagem
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-neutral-200 dark:divide-zinc-850">
                  {filteredSessions.length === 0 ? (
                    <p className="text-xs text-neutral-400 dark:text-zinc-600 text-center py-6 font-semibold">
                      Nenhuma contagem corresponde ao filtro selecionado.
                    </p>
                  ) : (
                    filteredSessions.map(s => {
                      const annotationCount =
                        (s.yoloSegmentations?.length || 0) || (s.marks?.length || 0);
                      const isPolygon = s.yoloSegmentations && s.yoloSegmentations.length > 0;
                      
                      return (
                        <label
                          key={s.id}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-100/40 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedSessionIds.includes(s.id)}
                              onChange={() => handleToggleSession(s.id)}
                              className="accent-purple-600"
                            />
                            <div className="max-w-[200px] sm:max-w-xs md:max-w-md">
                              <span className="text-xs font-semibold text-neutral-800 dark:text-zinc-200 block truncate">
                                {s.filename}
                              </span>
                              <span className="text-[9px] text-neutral-400 dark:text-zinc-500 font-medium">
                                {new Date(s.date).toLocaleDateString('pt-BR')} • {s.metadata.treatment || 'Sem Tratamento'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-neutral-200 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 rounded-md">
                              {annotationCount} {isPolygon ? 'polígonos' : 'pontos'}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {s.metadata.imageSource ? 'Scanner' : 'Câmera'}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Config Sliders */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings size={14} /> Configurações de Calibração & Divisão
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Train/Val Split */}
                <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-neutral-600 dark:text-zinc-400">
                      Divisão Treino / Validação
                    </label>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {trainValSplit}% / {100 - trainValSplit}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={trainValSplit}
                    onChange={e => setTrainValSplit(parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[9px] text-neutral-400 dark:text-zinc-500 mt-1 font-semibold leading-relaxed">
                    Fração das imagens reservada para treinar o modelo vs validar a precisão.
                  </p>
                </div>

                {/* Diameter Estimation */}
                <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-neutral-600 dark:text-zinc-400">
                      Diâmetro das Sementes (µm)
                    </label>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {estimatedSeedDiameterUm} µm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={estimatedSeedDiameterUm}
                    onChange={e => setEstimatedSeedDiameterUm(parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[9px] text-neutral-400 dark:text-zinc-500 mt-1 font-semibold leading-relaxed">
                    Estima o tamanho da caixa delimitadora usando a calibração física da imagem (ex: 500µm para orquídeas).
                  </p>
                </div>

                {/* Fallback Radius */}
                <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-4 rounded-2xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-neutral-600 dark:text-zinc-400">
                      Raio Fallback (pixels)
                    </label>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                      {fallbackRadiusPx} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={fallbackRadiusPx}
                    onChange={e => setFallbackRadiusPx(parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <p className="text-[9px] text-neutral-400 dark:text-zinc-500 mt-1 font-semibold leading-relaxed">
                    Tamanho do raio em pixels se a imagem não tiver calibração de escala configurada.
                  </p>
                </div>

                {/* Class options */}
                <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-4 rounded-2xl flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeInviable}
                      onChange={e => setIncludeInviable(e.target.checked)}
                      className="accent-purple-600"
                    />
                    <span className="text-xs font-bold text-neutral-600 dark:text-zinc-400">
                      Exportar Sementes Inviáveis (Classe 1)
                    </span>
                  </label>
                  <p className="text-[9px] text-neutral-400 dark:text-zinc-500 mt-1.5 font-semibold pl-5 leading-relaxed">
                    Se desativado, o dataset conterá apenas uma única classe (viável). Sementes inviáveis serão ignoradas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Preview and Actions */}
          <div className="w-full md:w-80 bg-neutral-50 dark:bg-zinc-900/50 p-6 flex flex-col justify-between shrink-0">
            {/* Preview details */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} /> Resumo do Dataset
              </h3>

              <div className="space-y-3.5 bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Total de Imagens:</span>
                  <span className="font-bold text-neutral-800 dark:text-zinc-200">{summary.sessionsWithImages}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Sessões com Polígonos:</span>
                  <span className="font-bold text-neutral-800 dark:text-zinc-200">{summary.sessionsWithPolygons}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Sessões com Pontos:</span>
                  <span className="font-bold text-neutral-800 dark:text-zinc-200">{summary.sessionsWithMarksOnly}</span>
                </div>
                <div className="h-px bg-neutral-100 dark:bg-zinc-800" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Total Anotações:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{summary.totalAnnotations}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] pl-2">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Sementes Viáveis (Cls 0):</span>
                  <span className="font-semibold text-neutral-800 dark:text-zinc-300">{summary.totalViable}</span>
                </div>
                {includeInviable && (
                  <div className="flex justify-between items-center text-[10px] pl-2">
                    <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Sementes Inviáveis (Cls 1):</span>
                    <span className="font-semibold text-neutral-800 dark:text-zinc-300">{summary.totalInviable}</span>
                  </div>
                )}
                <div className="h-px bg-neutral-100 dark:bg-zinc-800" />
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400 dark:text-zinc-500 font-semibold">Tamanho das BBoxes (estimado):</span>
                  <span className="font-mono text-neutral-800 dark:text-zinc-300">
                    {summary.estimatedBboxSizes.minPx} - {summary.estimatedBboxSizes.maxPx} px
                  </span>
                </div>
              </div>

              {/* Calibration warnings */}
              {summary.warnings.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 p-3.5 rounded-2xl flex items-start gap-2.5 max-h-48 overflow-y-auto">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                      Calibração Recomendada
                    </h4>
                    <ul className="text-[9px] text-amber-700 dark:text-amber-500 list-disc pl-3.5 font-medium space-y-1">
                      {summary.warnings.slice(0, 3).map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                      {summary.warnings.length > 3 && (
                        <li>E mais {summary.warnings.length - 3} sessões...</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Actions button */}
            <div className="pt-6 border-t border-neutral-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || selectedSessionIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 dark:disabled:bg-zinc-800 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Gerando Dataset...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Exportar ZIP
                  </>
                )}
              </button>
              <p className="text-[9px] text-neutral-400 dark:text-zinc-500 text-center font-medium mt-2 leading-relaxed">
                Este processo compactará e formatará os rótulos de forma totalmente local no seu navegador.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
