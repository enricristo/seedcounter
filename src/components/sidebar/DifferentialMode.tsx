import React from 'react';
import { Percent, History } from 'lucide-react';
import { MetadataInput } from '../shared/MetadataInput';
import type { Metadata, Session } from '../../types';

interface DifferentialModeProps {
  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  sessions: Session[];
}

export function DifferentialMode({
  metadata,
  updateMetadata,
  sessions
}: DifferentialModeProps) {
  const handlePullHistory = () => {
    if (!metadata.plate) {
      alert("Por favor, preencha o ID da Placa no Contexto para buscar o histórico correspondente.");
      return;
    }
    
    // Find the latest session matching this plate ID and optionally quadrant
    const lastSession = sessions.find(s => 
      s.metadata.plate === metadata.plate && 
      (!metadata.quadrant || s.metadata.quadrant === metadata.quadrant)
    );

    if (lastSession) {
      const totalSeeds = lastSession.viableCount + lastSession.inviableCount;
      updateMetadata('baselineCount', totalSeeds);
      alert(`Histórico carregado! Contagem total de ${totalSeeds} sementes encontrada para a Placa ${metadata.plate}${metadata.quadrant ? `, Quadrante ${metadata.quadrant}` : ''}.`);
    } else {
      alert(`Nenhum histórico de contagem localizado para a Placa ${metadata.plate}${metadata.quadrant ? `, Quadrante ${metadata.quadrant}` : ''}.`);
    }
  };

  return (
    <section className="space-y-3.5 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-950/40">
      {/* Toggle Box */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent size={15} className="text-emerald-600 dark:text-emerald-450" />
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            Cálculo Diferencial
          </span>
        </div>
        <button 
          onClick={() => updateMetadata('useDifferential', !metadata.useDifferential)}
          className={`relative inline-flex h-5.5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none
            ${metadata.useDifferential ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-zinc-700'}
          `}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300
            ${metadata.useDifferential ? 'translate-x-4.5' : 'translate-x-1'}
          `} />
        </button>
      </div>

      {metadata.useDifferential && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400 leading-normal font-medium">
            Inviáveis são auto-calculadas como a diferença: <strong>Contagem Base - Viáveis</strong>. Útil para contar sementes inviáveis apenas subtraindo o total conhecido.
          </p>
          
          <div className="flex gap-2.5 items-end">
            <MetadataInput 
              label="Contagem Total Base"
              value={metadata.baselineCount?.toString() || ''}
              onChange={(v) => updateMetadata('baselineCount', parseInt(v) || 0)}
              placeholder="Ex: 150"
            />
            <button 
              onClick={handlePullHistory}
              className="bg-white dark:bg-zinc-900 hover:bg-neutral-50 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-300 border border-neutral-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all h-[36px] flex items-center gap-1.5 shrink-0"
              title="Buscar total de sementes da última sessão da mesma placa"
            >
              <History size={13} />
              <span>Placa</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
