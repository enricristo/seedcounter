import React from 'react';
import { 
  X, 
  Save, 
  FileText, 
  Table, 
  FileJson, 
  Image as ImageIcon,
  FileCheck2,
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';
import { ExportCard } from '../shared/ExportCard';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  hasImageQueue: boolean;
  currentImageIndex: number;
  imageQueueLength: number;
  onSaveCurrentSession: (silent?: boolean) => void;
  onSaveAndNext: () => void;
  
  exportTextReport: () => void;
  exportCSV: () => void;
  exportJSON: () => void;
  exportAnnotatedImage: () => void;
  exportPDF: () => void;

  // YOLO beta export
  isYoloExportEnabled?: boolean;
  onOpenYoloExport?: () => void;
}

export function ExportModal({
  isOpen,
  onClose,
  filename,
  hasImageQueue,
  currentImageIndex,
  imageQueueLength,
  onSaveCurrentSession,
  onSaveAndNext,
  exportTextReport,
  exportCSV,
  exportJSON,
  exportAnnotatedImage,
  exportPDF,
  isYoloExportEnabled = false,
  onOpenYoloExport
}: ExportModalProps) {
  if (!isOpen) return null;

  const isLastInQueue = currentImageIndex === imageQueueLength - 1;

  return (
    <div className="fixed inset-0 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white dark:bg-[#18181B] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-neutral-200 dark:border-zinc-800 transition-colors duration-300"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50">
          <div>
            <h2 className="font-bold text-base text-neutral-800 dark:text-zinc-100 uppercase tracking-wide">
              Exportar Resultados
            </h2>
            <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium font-mono pt-0.5 truncate max-w-[400px]">
              Amostra: {filename}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-neutral-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1.5 hover:bg-neutral-100 dark:hover:bg-zinc-850 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Save locally Banner */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/30 text-emerald-800 dark:text-emerald-450 p-4.5 rounded-2xl flex items-start gap-3.5 shadow-sm">
            <div className="bg-emerald-100 dark:bg-emerald-950/40 p-2 rounded-xl text-emerald-600 dark:text-emerald-450 shrink-0 mt-0.5 shadow-inner">
              <Save size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">Histórico Local</h4>
              <p className="text-[10.5px] opacity-90 leading-relaxed font-semibold">
                Salva a contagem atual permanentemente no histórico offline do navegador para gerar estatísticas agregadas por placa depois.
              </p>
              <div className="pt-2">
                {hasImageQueue && !isLastInQueue ? (
                  <button 
                    onClick={() => {
                      onSaveAndNext();
                      onClose();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                  >
                    Salvar e Avançar Fila ({currentImageIndex + 1}/{imageQueueLength})
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      onSaveCurrentSession(false);
                      onClose();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                  >
                    Salvar no Histórico Local
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Individual Export Cards */}
          <div>
            <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
              Formatos de Download
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {/* PDF Report */}
              <ExportCard 
                icon={<FileCheck2 size={20} className="text-emerald-600 dark:text-emerald-450" />}
                title="Relatório PDF (A4)"
                desc="Metadados, totais e foto anotada em formato PDF premium."
                onClick={exportPDF}
              />
              
              {/* Text Report */}
              <ExportCard 
                icon={<FileText size={20} className="text-blue-500" />}
                title="Relatório TXT"
                desc="Resumo estruturado em arquivo de texto legível."
                onClick={exportTextReport}
              />
              
              {/* Spreadsheet CSV */}
              <ExportCard 
                icon={<Table size={20} className="text-teal-500" />}
                title="Tabela (CSV)"
                desc="Ideal para carregar no Excel, Google Sheets ou R."
                onClick={exportCSV}
              />
              
              {/* Raw JSON */}
              <ExportCard 
                icon={<FileJson size={20} className="text-amber-500" />}
                title="Dados Brutos (JSON)"
                desc="Contém coordenadas X/Y de todos os pontos marcados."
                onClick={exportJSON}
              />

              {/* Annotated Image */}
              <div className="col-span-2">
                <button
                  onClick={exportAnnotatedImage}
                  className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl border border-neutral-200 dark:border-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-700 bg-neutral-50 dark:bg-zinc-900/50 hover:bg-neutral-100 dark:hover:bg-zinc-850 hover:shadow-sm transition-all text-neutral-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wide cursor-pointer group active:scale-[0.99]"
                >
                  <ImageIcon size={15} className="text-purple-500 group-hover:scale-105 transition-transform" />
                  <span>Baixar Foto Anotada (PNG)</span>
                </button>
              </div>

              {/* YOLO Export Option (BETA) */}
              {isYoloExportEnabled && onOpenYoloExport && (
                <div className="col-span-2">
                  <button
                    onClick={() => {
                      onOpenYoloExport();
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl border border-amber-300 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/10 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 hover:shadow-sm transition-all text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wide cursor-pointer group active:scale-[0.99]"
                  >
                    <Layers size={15} className="group-hover:scale-105 transition-transform text-amber-600 dark:text-amber-400" />
                    <span>Exportar Dataset YOLO (BETA)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
