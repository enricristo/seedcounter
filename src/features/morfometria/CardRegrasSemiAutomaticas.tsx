// =============================================================================
// SeedCounter — Card de Regras Semi-Automáticas de Curadoria
//
// Permite ao analista aplicar regras lógicas em lote (detritos, aglomerados,
// sementes chochas) com simulação em tempo real e desfazer instantâneo (Ctrl+Z).
// =============================================================================

import React, { useState, useMemo } from 'react';
import { Play, Eye, CheckCircle2 } from 'lucide-react';
import {
  REGRAS_PADRAO,
  simularRegra,
  type RegraParametrica,
} from './regras';
import type { SeedMeasurement } from '../../lib/measurements';

interface CardRegrasSemiAutomaticasProps {
  medicoes: SeedMeasurement[];
  calibrado?: boolean;
  onDestacarSementes?: (ids: number[]) => void;
  onAplicarRegra: (regra: RegraParametrica) => void;
  regraSelecionadaId: string | null;
  limiaresCustomizados: Record<string, number>;
  onRegraChange: (id: string | null) => void;
  onLimiarChange: (limiares: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
}

export function CardRegrasSemiAutomaticas({
  medicoes,
  calibrado = false,
  onDestacarSementes,
  onAplicarRegra,
  regraSelecionadaId,
  limiaresCustomizados,
  onRegraChange,
  onLimiarChange,
}: CardRegrasSemiAutomaticasProps) {
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const regraAtiva = useMemo(() => {
    const base = REGRAS_PADRAO.find((r) => r.id === regraSelecionadaId) ?? REGRAS_PADRAO[0];
    // `regraAtiva` sempre existe para a interface ter o que mostrar; o que
    // decide se a simulação roda é `regraSelecionadaId` ser null, no App.
    const limiar = limiaresCustomizados[base.id] ?? base.limiar;
    return {
      ...base,
      limiar,
    };
  }, [regraSelecionadaId, limiaresCustomizados]);

  // Se a regra usa mm² mas não está calibrado, usamos px² adaptado temporariamente
  const regraAjustada = useMemo(() => {
    if (!calibrado && regraAtiva.campo === 'areaMm2') {
      return {
        ...regraAtiva,
        campo: 'areaPx' as const,
        // Limiar aproximado em px para demonstração se não houver calibração
        limiar: regraAtiva.limiar * 100,
      };
    }
    return regraAtiva;
  }, [regraAtiva, calibrado]);

  // Simula quantas sementes atendem
  const sementesAtendidas = useMemo(() => {
    // Sem regra escolhida não há simulação — nem aqui, nem em fantasma no canvas.
    if (!regraSelecionadaId || medicoes.length === 0) return [];
    return simularRegra(medicoes, regraAjustada);
  }, [medicoes, regraAjustada, regraSelecionadaId]);

  const handleLimiarChange = (novoValor: number) => {
    onLimiarChange((prev) => ({
      ...prev,
      [regraAtiva.id]: novoValor,
    }));
  };

  const handleDestacar = () => {
    onDestacarSementes?.(sementesAtendidas);
  };

  const handleAplicar = () => {
    if (sementesAtendidas.length === 0) return;
    onAplicarRegra(regraAjustada);
    setMensagemSucesso(`${sementesAtendidas.length} sementes processadas.`);
    setTimeout(() => setMensagemSucesso(null), 3500);
  };

  if (medicoes.length === 0) {
    return (
      <div className="p-3 text-xs text-ink-3 italic text-center">
        Nenhuma semente para aplicação de regras.
      </div>
    );
  }

  const rotuloAcao = (acao: RegraParametrica['acao']) => {
    switch (acao) {
      case 'remover':
        return 'Remover / Descartar';
      case 'marcar-inviavel':
        return 'Classificar como Inviável';
      case 'marcar-viavel':
        return 'Classificar como Viável';
      case 'sinalizar-corte':
        return 'Sinalizar para Corte';
    }
  };

  return (
    <div className="space-y-3">
      {/* Seletor de Regra */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold tracking-wider text-ink-3">
          Critério de Análise
        </label>
        <select
          value={regraSelecionadaId ?? ''}
          onChange={(e) => onRegraChange(e.target.value || null)}
          className="w-full border-line bg-surface-1 text-ink-1 text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-accent outline-none font-medium"
        >
          <option value="">Nenhum — não simular</option>
          {REGRAS_PADRAO.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-ink-3 italic leading-tight">
          {regraSelecionadaId ? regraAtiva.descricao : 'Escolha um critério para ver, tracejado no canvas, o que ele afetaria.'}
        </div>
      </div>

      {/* Configuração do Limiar */}
      <div className="p-2.5 rounded bg-surface-2/70 border border-line-soft space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-2 font-medium">
            Se <span className="font-mono text-ink-1 font-bold">{regraAjustada.campo}</span> {regraAjustada.operador}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step={regraAjustada.campo.includes('solidez') || regraAjustada.campo.includes('circularidade') ? '0.05' : '1'}
              value={regraAtiva.limiar}
              onChange={(e) => handleLimiarChange(parseFloat(e.target.value) || 0)}
              className="w-16 border-line bg-surface-1 text-ink-1 font-mono text-xs text-right rounded px-1.5 py-0.5"
            />
            <span className="text-[10px] text-ink-3 font-mono">
              {regraAjustada.campo === 'areaMm2' ? 'mm²' : regraAjustada.campo === 'areaPx' ? 'px²' : ''}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-ink-2 flex items-center justify-between border-t border-line-soft pt-1.5">
          <span>Ação:</span>
          <span className="font-semibold text-accent">{rotuloAcao(regraAtiva.acao)}</span>
        </div>
      </div>

      {/* Preview de Resultados */}
      <div className="flex items-center justify-between text-xs py-1 px-2 rounded bg-surface-1 border border-line">
        <span className="text-ink-3">Sementes identificadas:</span>
        <span className="font-mono font-bold text-accent tabular-nums">
          {sementesAtendidas.length} de {medicoes.length}
        </span>
      </div>

      {/* Botões de Ação */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={handleDestacar}
          disabled={sementesAtendidas.length === 0}
          title="Foca visualmente ou destaca as sementes que atendem à regra"
          className="border-line bg-surface-1 hover:bg-surface-2 text-ink-2 disabled:opacity-40 disabled:pointer-events-none rounded px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border"
        >
          <Eye size={13} />
          Destacar
        </button>

        <button
          onClick={handleAplicar}
          disabled={sementesAtendidas.length === 0}
          title="Executa a ação da regra (pode ser desfeita com Ctrl+Z)"
          className="bg-accent hover:bg-accent/90 text-accent-on disabled:opacity-40 disabled:pointer-events-none rounded px-2.5 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Play size={13} />
          Aplicar Regra
        </button>
      </div>

      {mensagemSucesso && (
        <div className="p-2 rounded bg-accent-tint border border-accent/40 text-accent text-xs flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 size={13} className="shrink-0" />
          <span>{mensagemSucesso} <span className="text-ink-3 font-normal">(Ctrl+Z para desfazer)</span></span>
        </div>
      )}
    </div>
  );
}
