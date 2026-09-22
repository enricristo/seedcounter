// =============================================================================
// SeedCounter — a tela dos cinco perfis
// Spec: docs/superpowers/specs/2026-09-22-predefinicoes-por-perfil-design.md
//
// UMA TELA, DUAS OCASIÕES.
//
// Na primeira abertura (nenhum `sc:perfil` gravado) ela ocupa a página antes
// do canvas: escolher um cartão grava as preferências e abre o app; fechar
// sem escolher grava `sc:perfil = 'nenhum'` e não pergunta de novo. Em
// Configurações ela é uma seção: os mesmos cartões, o atual marcado, e —
// porque a pessoa pode ter ajustado algo à mão — a lista do que vai mudar
// ANTES de confirmar. A tabela e o diff vêm de `perfis.ts`; aqui só há o
// desenho e o momento de aplicar.
//
// O QUE É APLICADO AGORA E O QUE ESPERA A PRÓXIMA MONTAGEM.
//
// O modo de visualização entra na sessão viva pelo contexto (`aplicar`), e
// as sugestões são lidas a cada avaliação. Estilo da marca, receita e
// cronômetro são lidos por `App.tsx` quando ele monta — na primeira abertura
// isso acontece logo depois desta tela (o app ainda não montou); em
// Configurações vale na próxima abertura, e a tela diz isso em vez de fingir.
//
// Cartões são botões, não rádios: escolher é uma ação, e o teclado (Tab,
// Enter, Espaço) e o leitor de tela vêm de graça.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Hash,
  ListOrdered,
  MousePointerClick,
  Presentation,
  Route,
  Ruler,
  Sigma,
  Sprout,
  Tags,
  Timer,
  X,
} from 'lucide-react';
import { useVisibilidade } from '../visualizacao/useModoDeVisualizacao';
import { useModalEscape } from '../../hooks/useModalEscape';
import {
  PERFIS,
  PERFIS_IDS,
  aplicarPerfil,
  lerPerfilAtual,
  lerPreferenciasAtuais,
  oQueMuda,
  registrarSemPerfil,
  type Mudanca,
  type PerfilId,
} from './perfis';

/** Os três ícones de cada cartão, na ordem de `Perfil.aVista`. */
const ICONES: Record<PerfilId, readonly [React.ElementType, React.ElementType, React.ElementType]> =
  {
    analista: [FileText, ListOrdered, Download],
    orquidea: [Ruler, FlaskConical, Route],
    forrageira: [Tags, Sprout, CalendarDays],
    aluno: [MousePointerClick, Hash, Timer],
    apresentacao: [Presentation, Eye, Sigma],
  };

const anelDeFoco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

interface CartaoProps {
  id: PerfilId;
  marcado: boolean;
  atual: boolean;
  autoFocus?: boolean;
  onEscolher: (id: PerfilId) => void;
}

function Cartao({ id, marcado, atual, autoFocus, onEscolher }: CartaoProps) {
  const perfil = PERFIS[id];
  const icones = ICONES[id];
  return (
    <button
      type="button"
      aria-pressed={marcado}
      autoFocus={autoFocus}
      onClick={() => onEscolher(id)}
      title={perfil.titulo}
      className={`rounded-panel flex cursor-pointer flex-col gap-2.5 border p-3.5 text-left transition-colors ${anelDeFoco} ${
        marcado
          ? 'border-accent bg-accent-tint'
          : 'border-line bg-surface-1 hover:border-accent hover:bg-surface-2'
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-ink-1 text-sm leading-tight font-bold">{perfil.titulo}</span>
        {atual && (
          <span className="rounded-control bg-accent text-accent-on shrink-0 px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
            atual
          </span>
        )}
      </span>
      <span className="text-ink-2 text-[11px] leading-snug italic">“{perfil.voz}”</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        {icones.map((Icone, i) => (
          <span key={perfil.aVista[i]} className="text-ink-3 flex items-center gap-1 text-[10px]">
            <Icone size={13} strokeWidth={2} aria-hidden="true" />
            {perfil.aVista[i]}
          </span>
        ))}
      </span>
    </button>
  );
}

/**
 * Grava o perfil e põe o modo na sessão viva. Apresentação não grava modo —
 * entra só nesta sessão, como o link `?modo=apresentacao`.
 */
function useAplicarNaSessao() {
  const { aplicar } = useVisibilidade();
  return useCallback(
    (id: PerfilId) => {
      const prefs = aplicarPerfil(id);
      if (prefs) aplicar(prefs.modo, prefs.sobrescritas);
      else if (id === 'apresentacao') aplicar('apresentacao', {}, { persistir: false });
    },
    [aplicar]
  );
}

// -----------------------------------------------------------------------------
// Primeira abertura
// -----------------------------------------------------------------------------

interface PrimeiraAberturaProps {
  /** Depois de gravar — o perfil escolhido, ou 'nenhum' se fechou sem escolher. */
  onConcluir: (perfil: PerfilId | 'nenhum') => void;
}

export function TelaDePerfil({ onConcluir }: PrimeiraAberturaProps) {
  const aplicarNaSessao = useAplicarNaSessao();

  const fecharSemEscolher = useCallback(() => {
    registrarSemPerfil();
    onConcluir('nenhum');
  }, [onConcluir]);

  const escolher = useCallback(
    (id: PerfilId) => {
      aplicarNaSessao(id);
      onConcluir(id);
    },
    [aplicarNaSessao, onConcluir]
  );

  useModalEscape(true, fecharSemEscolher);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tela-de-perfil-titulo"
      className="bg-surface-0 text-ink-1 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
    >
      <div className="border-line bg-surface-1 rounded-panel w-full max-w-3xl border shadow-2xl">
        <div className="border-line flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h1
              id="tela-de-perfil-titulo"
              className="text-ink-1 text-sm font-bold tracking-wide uppercase"
            >
              Quem está na bancada?
            </h1>
            <p className="text-ink-2 mt-1 text-[11px] leading-snug">
              Escolha um ponto de partida. Cada opção só marca preferências que já existem no
              aplicativo — dá para mudar qualquer uma depois, campo a campo.
            </p>
          </div>
          <button
            type="button"
            onClick={fecharSemEscolher}
            aria-label="Fechar sem escolher"
            title="Fechar sem escolher (Esc): tudo à vista"
            className={`rounded-control text-ink-3 hover:bg-surface-2 hover:text-ink-1 shrink-0 cursor-pointer p-1.5 transition-colors ${anelDeFoco}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {PERFIS_IDS.map((id, i) => (
            <Cartao
              key={id}
              id={id}
              marcado={false}
              atual={false}
              autoFocus={i === 0}
              onEscolher={escolher}
            />
          ))}
        </div>

        <div className="border-line border-t px-5 py-3">
          <p className="text-ink-3 text-[10px]">
            Posso mudar depois em Configurações. Fechar sem escolher deixa tudo à vista.
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Configurações
// -----------------------------------------------------------------------------

interface SecaoDePerfilProps {
  /** Depois de confirmar: o painel de Configurações relê o que mostra. */
  onAplicado?: (perfil: PerfilId) => void;
}

export function SecaoDePerfil({ onAplicado }: SecaoDePerfilProps) {
  const aplicarNaSessao = useAplicarNaSessao();
  const [atual, setAtual] = useState(() => lerPerfilAtual());
  const [escolhido, setEscolhido] = useState<PerfilId | null>(null);
  const [aplicado, setAplicado] = useState<PerfilId | null>(null);

  // O diff é contra o que está EM VIGOR, lido na hora da escolha — a
  // opacidade ajustada à mão aparece aqui, e é o motivo desta lista existir.
  const mudancas = useMemo<Mudanca[]>(
    () => (escolhido ? oQueMuda(lerPreferenciasAtuais(), escolhido) : []),
    [escolhido]
  );

  const confirmar = useCallback(() => {
    if (!escolhido) return;
    aplicarNaSessao(escolhido);
    setAtual(escolhido);
    setAplicado(escolhido);
    setEscolhido(null);
    onAplicado?.(escolhido);
  }, [escolhido, aplicarNaSessao, onAplicado]);

  const cancelar = useCallback(() => setEscolhido(null), []);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PERFIS_IDS.map((id) => (
          <Cartao
            key={id}
            id={id}
            marcado={escolhido ? escolhido === id : atual === id}
            atual={atual === id}
            onEscolher={(x) => {
              setAplicado(null);
              setEscolhido(x);
            }}
          />
        ))}
      </div>

      {escolhido && (
        <div className="border-line bg-surface-2 rounded-panel space-y-2 border p-3">
          <p className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
            O que vai mudar
          </p>
          {escolhido === 'apresentacao' ? (
            <p className="text-ink-2 text-[11px] leading-snug">
              Nada fica gravado: a apresentação vale só nesta sessão, como o link{' '}
              <code className="font-mono">?modo=apresentacao</code>. Recarregar volta ao modo de
              antes.
            </p>
          ) : mudancas.length === 0 ? (
            <p className="text-ink-2 text-[11px] leading-snug">
              Nada: as preferências em vigor já são as deste perfil.
            </p>
          ) : (
            <ul className="space-y-1">
              {mudancas.map((m) => (
                <li
                  key={m.campo}
                  className="text-ink-2 flex flex-wrap items-baseline gap-x-1.5 text-[11px]"
                >
                  <span className="text-ink-1 font-semibold">{m.rotulo}:</span>
                  <span>{m.de}</span>
                  <ArrowRight size={11} aria-hidden="true" className="text-ink-3 self-center" />
                  <span className="text-ink-1">{m.para}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelar}
              className={`rounded-control border-line text-ink-2 hover:bg-surface-1 cursor-pointer border px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors ${anelDeFoco}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              className={`rounded-control bg-accent text-accent-on hover:bg-accent-strong flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors ${anelDeFoco}`}
            >
              <Check size={12} aria-hidden="true" />
              Confirmar
            </button>
          </div>
        </div>
      )}

      {aplicado && !escolhido && (
        <p role="status" className="text-ink-2 text-[11px] leading-snug">
          Perfil <strong className="text-ink-1">{PERFIS[aplicado].titulo}</strong> aplicado.{' '}
          {aplicado === 'apresentacao'
            ? 'O modo mudou só nesta sessão.'
            : 'O modo de visualização e as sugestões já valem; estilo da marca, receita e cronômetro entram na próxima abertura, e o protocolo, na próxima amostra.'}
        </p>
      )}
    </div>
  );
}
