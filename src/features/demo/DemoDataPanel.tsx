// =============================================================================
// SeedCounter — painel de dados de demonstração
//
// Vive dentro do modal de Funcionalidades. É o caminho para ver o painel de
// estatística e a visão longitudinal cheios sem precisar de meses de contagem
// acumulada — para aula, para apresentação, para conhecer o app.
//
// O aviso de que os dados são SIMULADOS fica visível o tempo todo, não escondido
// atrás de um clique: número simulado confundido com resultado é o único erro
// que este painel poderia causar, e é grave.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Beaker, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import { carregarDemonstracao, contarDemonstracao, removerDemonstracao } from './demo-store';

type Estado = 'ocioso' | 'carregando' | 'removendo';

export function DemoDataPanel() {
  const [existentes, setExistentes] = useState<number | null>(null);
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [recado, setRecado] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    const { sessoes, experimentos } = await contarDemonstracao();
    setExistentes(sessoes + experimentos);
  }, []);

  useEffect(() => {
    atualizar();
  }, [atualizar]);

  const carregar = async () => {
    setEstado('carregando');
    setRecado(null);
    try {
      const { sessoes, experimentos } = await carregarDemonstracao();
      setRecado(
        `${sessoes} contagens e ${experimentos} experimentos carregados. Abra Estatística e Longitudinal.`
      );
      await atualizar();
    } catch (e) {
      console.error('Falha ao carregar dados de demonstração', e);
      setRecado('Não foi possível carregar. Veja o console para o erro.');
    } finally {
      setEstado('ocioso');
    }
  };

  const remover = async () => {
    if (!window.confirm('Remover todos os dados de demonstração? Suas contagens reais não são afetadas.')) return; // prettier-ignore
    setEstado('removendo');
    setRecado(null);
    try {
      const { sessoes, experimentos } = await removerDemonstracao();
      setRecado(`${sessoes} contagens e ${experimentos} experimentos removidos.`);
      await atualizar();
    } catch (e) {
      console.error('Falha ao remover dados de demonstração', e);
      setRecado('Não foi possível remover. Veja o console para o erro.');
    } finally {
      setEstado('ocioso');
    }
  };

  const ocupado = estado !== 'ocioso';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Beaker size={13} className="text-ink-3" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
          Dados de demonstração
        </h3>
      </div>

      <div className="rounded-xl border border-line p-3 space-y-2.5">
        <p className="text-[11px] text-ink-2 leading-relaxed">
          Carrega quatro ensaios completos — tetrazólio em <em>Cattleya</em>, estresse osmótico por
          manitol, germinação in vitro por DAP e armazenamento de <em>Urochloa</em> — para conhecer
          os painéis de Estatística e Longitudinal sem esperar meses de contagem.
        </p>

        <div className="flex items-start gap-2 rounded-lg bg-warn/10 p-2">
          <TriangleAlert size={13} className="text-warn mt-px shrink-0" />
          <p className="text-[10px] text-ink-2 leading-snug">
            Os números são <strong>simulados</strong>, não medições. Todo registro fica marcado com
            <span className="font-mono"> [DEMO]</span> e pode ser removido a qualquer momento sem
            tocar nas suas contagens reais.
          </p>
        </div>

        {existentes !== null && existentes > 0 && (
          <p className="text-[10px] text-ink-3">
            {existentes} registros de demonstração no navegador.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={carregar}
            disabled={ocupado}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-accent text-accent-on hover:bg-accent-strong disabled:opacity-50 text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            {estado === 'carregando' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Beaker size={14} />
            )}
            {existentes ? 'Recarregar' : 'Carregar'}
          </button>

          {existentes !== null && existentes > 0 && (
            <button
              onClick={remover}
              disabled={ocupado}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-50 text-[11px] font-bold uppercase tracking-wide transition-colors"
            >
              {estado === 'removendo' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Remover
            </button>
          )}
        </div>

        {recado && <p className="text-[10px] text-ink-2">{recado}</p>}
      </div>
    </div>
  );
}
