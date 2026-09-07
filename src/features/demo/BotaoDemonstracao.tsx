// =============================================================================
// SeedCounter — botão de carga dos dados de demonstração
//
// POR QUE ELE FICA NAS TELAS VAZIAS.
//
// Os quatro ensaios simulados existiam desde antes, mas escondidos em
// Funcionalidades → Dados de demonstração. Quem abre a Visão Longitudinal ou a
// Estatística vê um painel vazio e não tem como saber que existe conteúdo a um
// clique de distância, num menu que trata de outro assunto.
//
// A tela vazia é o lugar certo: é onde a pessoa está olhando quando a pergunta
// "e agora?" aparece.
//
// O aviso de dado simulado fica junto, sempre. Um painel de estatística cheio
// de números é exatamente onde a confusão entre simulação e medição custaria
// caro.
// =============================================================================

import React, { useState } from 'react';
import { Beaker, Loader2 } from 'lucide-react';
import { carregarDemonstracao } from './demo-store';

interface BotaoDemonstracaoProps {
  /** Compacto para caber dentro de um cartão; padrão para tela cheia. */
  variante?: 'padrao' | 'compacto';
}

export function BotaoDemonstracao({ variante = 'padrao' }: BotaoDemonstracaoProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro(false);
    try {
      await carregarDemonstracao();
      // A interface se atualiza sozinha: as telas leem o banco por consulta
      // viva, então os ensaios aparecem sem recarregar a página.
    } catch (e) {
      console.error('Falha ao carregar dados de demonstração', e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  const compacto = variante === 'compacto';

  return (
    <div className={compacto ? 'mt-3 space-y-1.5' : 'space-y-2 text-center'}>
      <button
        onClick={carregar}
        disabled={carregando}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 font-bold uppercase tracking-wide text-ink-2 transition-colors hover:border-accent hover:text-ink-1 disabled:opacity-50 ${
          compacto ? 'px-3 py-2 text-[10px]' : 'px-5 py-2.5 text-xs'
        }`}
      >
        {carregando ? (
          <Loader2 size={compacto ? 13 : 15} className="animate-spin" />
        ) : (
          <Beaker size={compacto ? 13 : 15} />
        )}
        Carregar ensaios de demonstração
      </button>

      <p className={`text-ink-3 leading-snug ${compacto ? 'text-[9px]' : 'text-[10px]'}`}>
        {erro ? (
          <span className="text-danger">Não foi possível carregar. Veja o console.</span>
        ) : (
          <>
            Quatro ensaios <strong>simulados</strong> — tetrazólio, estresse osmótico, germinação in
            vitro e armazenamento. Marcados com [DEMO] e removíveis em Funcionalidades.
          </>
        )}
      </p>
    </div>
  );
}
