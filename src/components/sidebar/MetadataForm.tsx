import React from 'react';
import { MetadataInput } from '../shared/MetadataInput';
import type { Metadata } from '../../types';

interface MetadataFormProps {
  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
}

export function MetadataForm({
  metadata,
  updateMetadata
}: MetadataFormProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-widest">
        Contexto da Amostra
      </h3>
      <div className="space-y-3.5">
        <MetadataInput 
          label="Usuário (Pesquisador)" 
          value={metadata.researcher || ''} 
          onChange={(v) => updateMetadata('researcher', v)} 
          placeholder="Ex: Nelson, Mayara"
        />
        
        <MetadataInput 
          label="Projeto de Pesquisa" 
          value={metadata.project || ''} 
          onChange={(v) => updateMetadata('project', v)} 
          placeholder="Ex: Orquídeas da Unoeste 2026"
        />
        
        <MetadataInput 
          label="Tratamento / Experimento" 
          value={metadata.treatment || ''} 
          onChange={(v) => updateMetadata('treatment', v)} 
          placeholder="Ex: Estufa 25°C - Lote A"
        />

        <div className="flex gap-3">
          <MetadataInput 
            label="Placa ID" 
            value={metadata.plate || ''} 
            onChange={(v) => updateMetadata('plate', v)} 
            placeholder="Ex: P04"
          />
          <MetadataInput 
            label="Quadrante" 
            value={metadata.quadrant || ''} 
            onChange={(v) => updateMetadata('quadrant', v)} 
            placeholder="Ex: Q2"
          />
        </div>

        <MetadataInput 
          label="Calibração Espacial (µm/px)" 
          value={metadata.umPerPixel !== undefined ? metadata.umPerPixel.toString() : ''} 
          onChange={(v) => {
            const val = parseFloat(v);
            updateMetadata('umPerPixel', isNaN(val) ? undefined : val);
          }} 
          placeholder="Ex: 2.5"
        />

        {/* Comments & Observations */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-neutral-600 dark:text-zinc-400 ml-1 uppercase tracking-wide">
            Observações
          </label>
          <textarea 
            value={metadata.notes || ''}
            onChange={(e) => updateMetadata('notes', e.target.value)}
            className="w-full bg-neutral-100 dark:bg-zinc-900/80 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-y min-h-[70px] placeholder:text-neutral-400 dark:placeholder:text-zinc-650 dark:text-zinc-100"
            placeholder="Comentários adicionais sobre a germinação, anomalias, etc."
          />
        </div>
      </div>
    </section>
  );
}
