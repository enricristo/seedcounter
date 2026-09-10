import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { MetadataInput } from '../shared/MetadataInput';
import type { Metadata } from '../../types';
import { PROTOCOLOS } from '../../lib/normas/classes-de-semente';

interface MetadataFormProps {
  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
  /**
   * Abre a identificação normativa (BAS/BASO). Ausente = botão oculto, que é o
   * caso de quem usa o aplicativo para pesquisa e não emite laudo.
   */
  onAbrirIdentificacao?: () => void;
}

export function MetadataForm({
  metadata,
  updateMetadata,
  onAbrirIdentificacao,
}: MetadataFormProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
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

        {/* O protocolo do teste de germinacao. Fica aqui, e nao na
            identificacao para laudo, porque e decisao de PESQUISA antes de
            ser campo normativo: e ele que diz quais classes existem na
            galeria. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-ink-2 ml-1 uppercase tracking-wide">
            Protocolo de germinação
          </label>
          <select
            value={metadata.protocolo ?? 'simples'}
            onChange={(e) =>
              updateMetadata('protocolo', e.target.value as Metadata['protocolo'])
            }
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          >
            {Object.values(PROTOCOLOS).map((p) => (
              <option key={p.chave} value={p.chave}>
                {p.nome}
              </option>
            ))}
          </select>
          {metadata.protocolo && metadata.protocolo !== 'simples' && (
            <p className="text-[10px] text-ink-3 ml-1 leading-snug">
              Classifique cada semente na galeria (G). Espigueta vazia sai do denominador;
              dormência acima de 5% pede tetrazólio.
            </p>
          )}
        </div>

        {/* Comments & Observations */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-ink-2 ml-1 uppercase tracking-wide">
            Observações
          </label>
          <textarea
            value={metadata.notes || ''}
            onChange={(e) => updateMetadata('notes', e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-y min-h-[70px] placeholder:text-ink-3"
            placeholder="Comentários adicionais sobre a germinação, anomalias, etc."
          />
        </div>

        {onAbrirIdentificacao && (
          <button
            type="button"
            onClick={onAbrirIdentificacao}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface-2 hover:border-accent hover:text-accent text-ink-2 text-xs font-semibold transition-colors"
          >
            <FileCheck2 size={14} className="shrink-0" />
            Identificação para laudo (BAS/BASO)
          </button>
        )}
      </div>
    </section>
  );
}
