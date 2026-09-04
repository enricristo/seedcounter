import React, { useState } from 'react';
import {
  X,
  History,
  Upload,
  Download,
  Table as TableIcon,
  Trash2,
  BarChart4,
  TrendingUp,
  Play,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlateViabilityChart } from '../charts/PlateViabilityChart';
import { SessionTrendChart } from '../charts/SessionTrendChart';
import type { Session } from '../../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  onExportHistoryJSON: () => void;
  onExportHistoryCSV: () => void;
  onExportHistoryBatchPDF?: () => void;
  onImportHistoryJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadSession?: (id: string) => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  sessions,
  onDeleteSession,
  onClearHistory,
  onExportHistoryJSON,
  onExportHistoryCSV,
  onExportHistoryBatchPDF,
  onImportHistoryJSON,
  onLoadSession,
}: HistoryModalProps) {
  const [activeChartTab, setActiveChartTab] = useState<'bar' | 'trend'>('bar');

  if (!isOpen) return null;

  // Group summary calculations
  const plateStats = sessions.reduce(
    (acc, s) => {
      const p = s.metadata.plate || 'Não definida';
      if (!acc[p]) acc[p] = { v: 0, i: 0, t: 0 };
      acc[p].v += s.viableCount;
      acc[p].i += s.inviableCount;
      acc[p].t += s.viableCount + s.inviableCount;
      return acc;
    },
    {} as Record<string, { v: number; i: number; t: number }>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-surface-1 flex flex-col rounded-3xl shadow-2xl w-full max-w-6.5xl h-full max-h-[85vh] overflow-hidden border border-line transition-all duration-300"
      >
        {/* Header bar */}
        <div className="flex flex-wrap justify-between items-center px-6 py-4.5 border-b border-line bg-surface-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-accent-tint p-2.5 rounded-xl text-accent shadow-inner">
              <History size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-ink-1 uppercase tracking-wide">
                Histórico de Contagens
              </h2>
              <p className="text-[10px] text-ink-3 font-semibold">
                Sessões persistidas com segurança no banco local do seu navegador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            {/* Import JSON */}
            <label className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
              <Upload size={14} />
              <span>Importar JSON</span>
              <input type="file" accept=".json" className="hidden" onChange={onImportHistoryJSON} />
            </label>

            <div className="h-6 w-px bg-line mx-1" />

            {/* Backup JSON */}
            <button
              onClick={onExportHistoryJSON}
              disabled={sessions.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Download size={14} />
              <span>Backup JSON</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={onExportHistoryCSV}
              disabled={sessions.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <TableIcon size={14} />
              <span>CSV Geral</span>
            </button>

            {/* Export Batch PDF */}
            <button
              onClick={onExportHistoryBatchPDF}
              disabled={sessions.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-accent hover:bg-accent-strong text-accent-on rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-sm"
            >
              <FileText size={14} />
              <span>Laudo PDF (Lote)</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="text-ink-3 hover:text-ink-2 p-2 bg-surface-2 rounded-full transition-all ml-2 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-hidden bg-surface-1 transition-colors duration-300">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center h-full gap-4">
              <History size={52} className="text-line" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-2">Nenhum Registro Salvo</h3>
                <p className="text-xs text-ink-3 max-w-sm font-medium">
                  Para armazenar dados aqui, carregue uma imagem, faça a marcação e use o botão
                  "Salvar Sessão Local" na barra superior.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row h-full">
              {/* Table side (Scrollable) */}
              <div className="flex-1 overflow-auto border-r border-line">
                <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                  <thead className="bg-surface-2 sticky top-0 z-10 border-b border-line text-ink-3 uppercase text-[9px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4 w-1/5">Data</th>
                      <th className="px-6 py-4 w-1/4">Amostra</th>
                      <th className="px-6 py-4 w-1/5">Pesquisador / Projeto</th>
                      <th className="px-6 py-4 w-1/6">Placa / Quadrante</th>
                      <th className="px-6 py-4 text-right w-[75px] text-red-500 font-bold">
                        Viáveis
                      </th>
                      <th className="px-6 py-4 text-right w-[75px] text-amber-500 font-bold">
                        Inviáveis
                      </th>
                      <th className="px-6 py-4 text-right w-[75px] text-ink-1 font-bold">Total</th>
                      <th className="px-6 py-4 w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft text-ink-2">
                    {sessions.map((s) => {
                      const totalCount = s.viableCount + s.inviableCount;
                      return (
                        <tr key={s.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="px-6 py-3 truncate">
                            <div className="text-xs font-semibold text-ink-1">
                              {new Date(s.date).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-[10px] text-ink-3 font-mono font-medium">
                              {new Date(s.date).toLocaleTimeString('pt-BR')}
                            </div>
                          </td>
                          <td
                            className="px-6 py-3 font-mono text-[11px] truncate"
                            title={s.filename}
                          >
                            {s.filename}
                          </td>
                          <td className="px-6 py-3 truncate">
                            <div className="font-bold text-xs text-ink-1 truncate">
                              {s.metadata.researcher || '-'}
                            </div>
                            <div className="text-[10px] text-ink-3 truncate">
                              {s.metadata.project || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-3 truncate">
                            <div className="font-bold text-xs">{s.metadata.plate || '-'}</div>
                            <div className="text-[10px] text-ink-3">
                              {s.metadata.quadrant ? `Q${s.metadata.quadrant}` : '-'} •{' '}
                              {s.metadata.treatment || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-xs text-red-500">
                            {s.viableCount}
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-xs text-amber-500">
                            {s.inviableCount}
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-bold text-xs text-ink-1">
                            {totalCount}
                          </td>
                          <td className="px-6 py-3 text-right flex items-center justify-end gap-1">
                            <button
                              onClick={() => onLoadSession && onLoadSession(s.id)}
                              className="text-accent hover:text-accent p-1.5 hover:bg-accent-tint rounded transition-colors cursor-pointer flex items-center gap-1"
                              title="Continuar Sessão"
                            >
                              <Play size={15} fill="currentColor" />
                            </button>
                            <button
                              onClick={() => onDeleteSession(s.id)}
                              className="text-ink-3 hover:text-red-500 dark:hover:text-red-400 p-1.5 hover:bg-surface-2 rounded transition-colors cursor-pointer"
                              title="Remover Registro"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Analytics Panel (Recharts + Plate stats) */}
              <div className="w-full lg:w-96 bg-surface-2/50 flex flex-col p-6 overflow-y-auto shrink-0 border-t lg:border-t-0 lg:border-l border-line custom-scrollbar">
                {/* Visual Analytics Selector */}
                <div className="flex bg-line/50 p-0.5 rounded-lg mb-4 shrink-0 border border-line">
                  <button
                    onClick={() => setActiveChartTab('bar')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                      ${
                        activeChartTab === 'bar'
                          ? 'bg-surface-1 text-accent shadow-sm'
                          : 'text-ink-3 hover:text-ink-2'
                      }
                    `}
                  >
                    <BarChart4 size={12} />
                    <span>Placas (Ratio)</span>
                  </button>
                  <button
                    onClick={() => setActiveChartTab('trend')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer
                      ${
                        activeChartTab === 'trend'
                          ? 'bg-surface-1 text-accent shadow-sm'
                          : 'text-ink-3 hover:text-ink-2'
                      }
                    `}
                  >
                    <TrendingUp size={12} />
                    <span>Evolução</span>
                  </button>
                </div>

                {/* Render Selected Chart */}
                <div className="bg-surface-1 rounded-2xl border border-line p-4 shadow-sm mb-5 min-h-[250px] flex items-center justify-center">
                  {activeChartTab === 'bar' ? (
                    <PlateViabilityChart sessions={sessions} />
                  ) : (
                    <SessionTrendChart sessions={sessions} />
                  )}
                </div>

                {/* Plate stats list */}
                <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-3 shrink-0">
                  Resumo Agregado
                </h3>
                <div className="space-y-3 shrink-0">
                  {Object.entries(plateStats).map(([plate, stats]: [string, any]) => {
                    const vPct = stats.t > 0 ? Math.round((stats.v / stats.t) * 100) : 0;
                    const iPct = stats.t > 0 ? Math.round((stats.i / stats.t) * 100) : 0;
                    return (
                      <div
                        key={plate}
                        className="bg-surface-1 border border-line p-3.5 rounded-2xl shadow-sm"
                      >
                        <div className="flex justify-between items-baseline mb-1.5">
                          <h4 className="font-bold text-xs text-ink-1 uppercase">{plate}</h4>
                          <span className="font-mono font-bold text-xs text-ink-3">
                            Total: {stats.t}
                          </span>
                        </div>

                        <div className="flex bg-surface-2 rounded-full h-1.5 mb-3 overflow-hidden">
                          <div
                            className="bg-red-500 h-full transition-all"
                            style={{ width: `${vPct}%` }}
                          />
                          <div
                            className="bg-amber-400 h-full transition-all"
                            style={{ width: `${iPct}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] font-medium leading-normal">
                          <div className="flex flex-col">
                            <span className="text-red-500 font-bold">{vPct}% Viáveis</span>
                            <span className="text-ink-3">{stats.v} sementes</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-amber-500 font-bold">{iPct}% Inviáveis</span>
                            <span className="text-ink-3">{stats.i} sementes</span>
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

        {/* Footer actions (e.g. wipe history) */}
        {sessions.length > 0 && (
          <div className="border-t border-line p-3 bg-surface-2 shrink-0 flex justify-end">
            <button
              onClick={onClearHistory}
              className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
            >
              Apagar Todo o Histórico Local
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
