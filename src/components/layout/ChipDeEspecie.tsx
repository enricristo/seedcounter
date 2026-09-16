// =============================================================================
// SeedCounter — chip de espécie, no cabeçalho (C7)
//
// A espécie é o que mais "configura" a bancada — priors, tamanho típico,
// receita do ensaio, protocolo, tolerâncias, classes do dataset — e hoje
// fica enterrada dentro de "Identificar amostra". Este chip é o atalho: fica
// ao lado das abas, mostra a espécie em vigor (ou "sem espécie"), e um
// clique abre a busca.
//
// MESMO PADRÃO DE `BotaoDeConta` + `PainelDaConta`: um componente só, gatilho
// e popover juntos, porque quem tem a referência do botão (para devolver o
// foco ao fechar) é quem também decide quando fechar.
//
// POR QUE A LISTA MISTURA TRÊS FONTES.
//
// `especies` são as conhecidas (`ESPECIES_CONHECIDAS`, de `lib/normas/
// especies.ts`) — priors e faixas de literatura. `extras` são nomes que só
// existem NESTE laboratório: o que já foi digitado em sessões salvas, e as
// classes do dataset aberto no explorador (B3). Uma orquídea rara que nunca
// entrou em tabela nenhuma ainda precisa aparecer na busca — é por isso que
// `buscarEspecies` (o módulo puro) já sabe misturar as duas sem duplicar.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Sprout } from 'lucide-react';
import { buscarEspecies, type EspecieConhecida, type EspecieOuNomeLivre } from '../../lib/normas/especies';

export interface ChipDeEspecieProps {
  /** A espécie em vigor na bancada — `especieAtual(metadata)`, calculado por quem chama. */
  atual: EspecieOuNomeLivre | null;
  /**
   * O cultivar declarado (`metadata.amostra.cultivar`), quando há um — é o
   * que faz o rótulo virar "Cattleya · orquídea" em vez de só "Orquídea": o
   * cultivar é o nome específico da amostra, a espécie é o gênero de
   * configuração.
   */
  cultivar?: string;
  /** Nomes ad hoc — sessões salvas e classes do dataset aberto — que ainda não estão em `ESPECIES_CONHECIDAS`. */
  extras?: string[];
  /** Escolheu uma espécie conhecida, ou digitou um nome que não bate com nenhuma. */
  onEscolher: (especie: EspecieConhecida | { nomeComum: string }) => void;
  /** "limpar" — zera a espécie declarada. Ausente = sem espécie ainda, o botão não aparece no popover. */
  onLimpar: () => void;
}

function rotuloDoChip(atual: EspecieOuNomeLivre | null, cultivar: string | undefined): string {
  const nomeCultivar = cultivar?.trim();
  if (!atual) {
    // Sem espécie declarada, mas com cultivar sozinho não configura nada — o
    // chip existe para dizer o que FALTA, não para exibir metade da
    // informação como se bastasse.
    return 'sem espécie';
  }
  if (nomeCultivar && nomeCultivar.toLowerCase() !== atual.nomeComum.trim().toLowerCase()) {
    return `${nomeCultivar} · ${atual.nomeComum.toLowerCase()}`;
  }
  return atual.nomeComum;
}

export function ChipDeEspecie({ atual, cultivar, extras = [], onEscolher, onLimpar }: ChipDeEspecieProps) {
  const botaoRef = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');

  const resultados = useMemo(() => buscarEspecies(texto, extras), [texto, extras]);

  const fechar = useCallback(() => {
    setAberto(false);
    setTexto('');
    botaoRef.current?.focus();
  }, []);

  const abrir = useCallback(() => setAberto((v) => !v), []);

  // Foco na busca ao abrir; Esc e clique fora fecham — mesmo trio de
  // `PainelDaConta`, e pela mesma razão: quem navega por teclado não pode
  // perder o lugar.
  useEffect(() => {
    if (!aberto) return;
    buscaRef.current?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar();
    }
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) fechar();
    }
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto, fechar]);

  const escolher = useCallback(
    (especie: EspecieOuNomeLivre) => {
      onEscolher(especie);
      fechar();
    },
    [onEscolher, fechar]
  );

  return (
    <div className="relative" ref={painelRef}>
      <button
        ref={botaoRef}
        type="button"
        onClick={abrir}
        onMouseDown={(e) => e.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={atual ? `Espécie: ${rotuloDoChip(atual, cultivar)}. Clique para trocar.` : 'Sem espécie declarada. Clique para escolher.'}
        title="Espécie da bancada — configura priors, receita do ensaio e protocolo"
        className="border-line bg-surface-2 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 text-[11px] font-semibold transition-colors"
      >
        <Sprout size={13} className={atual ? 'text-accent shrink-0' : 'text-ink-3 shrink-0'} aria-hidden="true" />
        <span className={atual ? 'text-ink-1 max-w-[160px] truncate' : 'text-ink-3 italic'}>
          {atual ? `Espécie: ${rotuloDoChip(atual, cultivar)}` : 'sem espécie'}
        </span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher espécie"
          className="border-line bg-surface-1 absolute left-0 top-full z-50 mt-2 w-72 space-y-2.5 rounded-panel border p-3 shadow-2xl"
        >
          <div className="border-line bg-surface-2 flex items-center gap-2 rounded-control border px-2.5 py-1.5">
            <Search size={13} className="text-ink-3 shrink-0" aria-hidden="true" />
            <input
              ref={buscaRef}
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar espécie…"
              aria-label="Buscar espécie"
              className="text-ink-1 placeholder:text-ink-3 min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>

          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {resultados.map((especie, i) => (
              <li key={'id' in especie ? especie.id : `extra-${especie.nomeComum}-${i}`}>
                <button
                  type="button"
                  onClick={() => escolher(especie)}
                  className="hover:bg-surface-2 focus-visible:bg-surface-2 flex w-full cursor-pointer flex-col items-start gap-0 rounded-control px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none"
                >
                  <span className="text-ink-1 text-xs font-semibold">{especie.nomeComum}</span>
                  {'nomeCientifico' in especie && especie.nomeCientifico && (
                    <span className="text-ink-3 text-[10px] italic">{especie.nomeCientifico}</span>
                  )}
                </button>
              </li>
            ))}
            {resultados.length === 0 && (
              <li className="text-ink-3 px-2.5 py-3 text-center text-[11px]">Nenhuma espécie encontrada.</li>
            )}
          </ul>

          {atual && (
            <button
              type="button"
              onClick={() => {
                onLimpar();
                fechar();
              }}
              className="border-line text-ink-3 hover:border-danger hover:text-danger focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors"
            >
              <X size={12} aria-hidden="true" />
              Limpar espécie
            </button>
          )}
        </div>
      )}
    </div>
  );
}
