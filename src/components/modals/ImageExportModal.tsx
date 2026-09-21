import React, { useState } from 'react';
import { X, Image as ImageIcon, Check, Layers, BarChart3, TableProperties } from 'lucide-react';
import { useModalEscape } from '../../hooks/useModalEscape';
import type { ImageExportOptions } from '../../lib/export-image';
import { ExportCard } from '../shared/ExportCard';

interface ImageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasImageQueue: boolean;
  onExport: (options: ImageExportOptions, scope: 'single' | 'batch') => void;
}

export function ImageExportModal({
  isOpen,
  onClose,
  hasImageQueue,
  onExport,
}: ImageExportModalProps) {
  const [includeViable, setIncludeViable] = useState(true);
  const [includeInviable, setIncludeInviable] = useState(true);
  const [overlayType, setOverlayType] = useState<'none' | 'table' | 'chart' | 'both'>('none');

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-1 rounded-2xl w-full max-w-lg shadow-2xl border border-line flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <ImageIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-1">Exportar Foto Anotada</h2>
              <p className="text-sm text-ink-2">Configurar visualização do PNG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2 uppercase tracking-wider">O que renderizar?</h3>
            
            <label className="flex items-center justify-between p-4 rounded-xl border border-line bg-surface-2 cursor-pointer hover:border-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${includeViable ? 'border-[#2ecc71] bg-[#2ecc71]' : 'border-line'}`}>
                  {includeViable && <Check size={10} className="text-white" />}
                </div>
                <span className="font-medium text-ink-1">Sementes Viáveis</span>
              </div>
              <input type="checkbox" className="hidden" checked={includeViable} onChange={(e) => setIncludeViable(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl border border-line bg-surface-2 cursor-pointer hover:border-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${includeInviable ? 'border-[#e74c3c] bg-[#e74c3c]' : 'border-line'}`}>
                  {includeInviable && <Check size={10} className="text-white" />}
                </div>
                <span className="font-medium text-ink-1">Sementes Inviáveis/Mortas</span>
              </div>
              <input type="checkbox" className="hidden" checked={includeInviable} onChange={(e) => setIncludeInviable(e.target.checked)} />
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2 uppercase tracking-wider">Sobreposição (Overlay)</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOverlayType('none')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  overlayType === 'none' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-accent/50'
                }`}
              >
                <ImageIcon size={24} />
                <span className="font-medium">Nenhum</span>
              </button>
              
              <button
                onClick={() => setOverlayType('table')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  overlayType === 'table' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-accent/50'
                }`}
              >
                <TableProperties size={24} />
                <span className="font-medium">Tabela</span>
              </button>

              <button
                onClick={() => setOverlayType('chart')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  overlayType === 'chart' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-accent/50'
                }`}
              >
                <BarChart3 size={24} />
                <span className="font-medium">Gráfico</span>
              </button>

              <button
                onClick={() => setOverlayType('both')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  overlayType === 'both' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink-2 hover:border-accent/50'
                }`}
              >
                <Layers size={24} />
                <span className="font-medium">Ambos</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-line shrink-0 bg-surface-1 rounded-b-2xl flex flex-col gap-3">
          <button
            onClick={() => onExport({ includeViable, includeInviable, includeAgglomerated: false, overlayType }, 'single')}
            className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl shadow-lg shadow-accent/20 transition-all cursor-pointer"
          >
            Baixar Somente Esta (PNG)
          </button>
          
          {hasImageQueue && (
            <button
              onClick={() => onExport({ includeViable, includeInviable, includeAgglomerated: false, overlayType }, 'batch')}
              className="w-full py-3 bg-surface-2 hover:bg-surface-3 text-ink-1 font-bold rounded-xl border border-line transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Layers size={18} />
              Baixar Fila Completa (.ZIP)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
