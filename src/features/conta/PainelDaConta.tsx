// =============================================================================
// SeedCounter — o painel da conta
//
// POR QUE UM POPOVER, E NÃO UM MODAL CHEIO.
//
// A conta não é uma tela para onde a pessoa "vai": é um resumo rápido de algo
// que já está acontecendo em segundo plano (a sincronização) e um atalho para
// o que ela às vezes precisa (aplicar a bancada, abrir configurações). Um
// modal centralizado, com fundo escurecido, trata isso como se fosse uma
// tarefa — e não é.
//
// A BANCADA É "COMPLETAMENTO RÁPIDO", NO SENTIDO LITERAL.
//
// A conta guarda `PreferenciaDeBancada` (ver `conta.ts`) para preencher os
// metadados de uma imagem nova sozinha. Mas preencher sozinho e às cegas é
// justamente o tipo de mágica que confunde — por isso ela é sempre visível
// aqui: espécie, escala, pesquisador, com o valor que está em vigor agora, e
// o botão de aplicar só aparece quando há alguma coisa a aplicar
// (`mesmaPreferencia` diz que não é o caso).
//
// FOCO E TECLADO.
//
// Abre com foco no próprio painel (tabIndex=-1 + .focus()), fecha com Esc e
// com clique fora, e devolve o foco ao gatilho ao fechar — isso é
// responsabilidade de `BotaoDeConta`, que é quem tem a referência do botão.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { Cloud, CloudOff, RefreshCw, LogOut, Settings2, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Conta } from './useConta';
import { extrairPreferencia, mesmaPreferencia, type PreferenciaDeBancada } from './conta';
import type { Metadata } from '../../types';

interface PainelDaContaProps {
  conta: Conta;
  metadata: Metadata;
  /** A preferência da conta difere da bancada atual — chamado ao confirmar. */
  onAplicarBancada: () => void;
  onAbrirConfiguracoes: () => void;
  onAbrirNovidades: () => void;
  aberto: boolean;
  onFechar: () => void;
}

export function PainelDaConta({
  conta,
  metadata,
  onAplicarBancada,
  onAbrirConfiguracoes,
  onAbrirNovidades,
  aberto,
  onFechar,
}: PainelDaContaProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const alvoGoogle = useRef<HTMLDivElement>(null);
  const { estado, montarBotao, sincronizacao, preferenciaSincronizada: daConta, sincronizadoEm } =
    conta;

  // Esc fecha, clique fora fecha, e o painel recebe o foco ao abrir — a
  // pessoa que navega por teclado não perde o lugar.
  useEffect(() => {
    if (!aberto) return;
    painelRef.current?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) onFechar();
    }
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto, onFechar]);

  // O botão do Google só existe enquanto o painel está aberto e ninguém
  // entrou: o script precisa de um elemento de fato presente no DOM, e não
  // adianta montá-lo escondido atrás de um `display:none`.
  useEffect(() => {
    if (aberto && !estado.isAuthenticated) montarBotao(alvoGoogle.current);
  }, [aberto, estado.isAuthenticated, montarBotao]);

  if (!aberto) return null;

  const { user } = estado;
  const atual = extrairPreferencia(metadata);
  const podeAplicar = daConta !== null && !mesmaPreferencia(atual, daConta);

  const IconeSinc = sincronizacao === 'erro' ? CloudOff : sincronizacao === 'ocioso' ? Cloud : RefreshCw;

  return (
    <div
      ref={painelRef}
      role="dialog"
      aria-label="Conta"
      tabIndex={-1}
      className="border-line bg-surface-1 absolute right-0 top-full z-50 mt-2 w-80 space-y-4 rounded-panel border p-4 shadow-2xl focus:outline-none"
    >
      {/* Identidade */}
      {estado.isAuthenticated ? (
        <div className="flex items-center gap-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-full"
            />
          ) : (
            <span className="bg-accent text-accent-on flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold">
              {(user?.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-ink-1 truncate text-sm font-bold">
              {user?.name ?? user?.given_name ?? 'Conta Google'}
            </p>
            {user?.email && <p className="text-ink-3 truncate text-[11px]">{user.email}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-ink-1 text-sm font-bold">Entrar com o Google</p>
          <p className="text-ink-3 text-[11px] leading-relaxed">
            Lembra sua bancada entre máquinas — espécie, escala e nome. Opcional; nada é bloqueado
            sem conta.
          </p>
          <div ref={alvoGoogle} className="flex items-center" />
        </div>
      )}

      {/* Estado da sincronização, em palavras — o ícone sozinho já existia na
          pílula; aqui ele vem acompanhado da frase que diz o que está
          acontecendo, porque um ícone de nuvem não é autoexplicativo. */}
      {estado.isAuthenticated && (
        <div className="border-line flex items-center gap-2 border-t pt-3 text-[11px]">
          <IconeSinc
            size={13}
            className={
              sincronizacao === 'erro'
                ? 'text-warn shrink-0'
                : sincronizacao === 'ocioso'
                  ? 'text-ink-3 shrink-0'
                  : 'text-accent shrink-0 animate-spin motion-reduce:animate-none'
            }
            aria-hidden="true"
          />
          <span aria-live="polite" className="text-ink-2">
            {textoDeSincronizacao(sincronizacao, sincronizadoEm)}
          </span>
        </div>
      )}

      {/* A bancada, visível — os três campos que a conta sincroniza, com o
          valor que está em vigor nesta imagem agora. */}
      {estado.isAuthenticated && (
        <div className="border-line space-y-1.5 border-t pt-3">
          <p className="text-ink-3 text-[10px] font-bold uppercase tracking-widest">Bancada</p>
          <LinhaDeBancada rotulo="Espécie" valor={formatarEspecie(atual)} />
          <LinhaDeBancada rotulo="Escala" valor={formatarEscala(atual.umPerPixel)} />
          <LinhaDeBancada rotulo="Pesquisador" valor={atual.pesquisador ?? null} />
        </div>
      )}

      {/* Ação rápida — só existe algo a "aplicar" depois do primeiro
          carregamento (`daConta !== null`); antes disso não há com o que
          comparar. */}
      {estado.isAuthenticated && daConta !== null && (
        <div className="border-line border-t pt-3">
          {podeAplicar ? (
            <button
              type="button"
              onClick={onAplicarBancada}
              className="rounded-control bg-accent text-accent-on hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none w-full cursor-pointer px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
            >
              Aplicar a bancada agora
            </button>
          ) : (
            <p className="text-ink-3 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wide uppercase">
              <CheckCircle2 size={13} className="text-accent" />
              Bancada aplicada
            </p>
          )}
        </div>
      )}

      {/* Atalhos */}
      <div className="border-line grid grid-cols-2 gap-2 border-t pt-3">
        <button
          type="button"
          onClick={() => {
            onFechar();
            onAbrirConfiguracoes();
          }}
          className="rounded-control border-line text-ink-2 hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex cursor-pointer items-center justify-center gap-1.5 border px-2 py-2 text-[10px] font-bold tracking-wide uppercase transition-colors"
        >
          <Settings2 size={13} />
          Configurações
        </button>
        <button
          type="button"
          onClick={() => {
            onFechar();
            onAbrirNovidades();
          }}
          className="rounded-control border-line text-ink-2 hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex cursor-pointer items-center justify-center gap-1.5 border px-2 py-2 text-[10px] font-bold tracking-wide uppercase transition-colors"
        >
          <Sparkles size={13} />
          O que mudou
        </button>
      </div>

      {/* Sair — discreto, no rodapé: é a ação menos provável do painel. */}
      {estado.isAuthenticated && (
        <button
          type="button"
          onClick={async () => {
            await conta.sair();
            onFechar();
          }}
          title="A bancada continua na máquina; só para de sincronizar."
          className="border-line text-ink-3 hover:border-accent hover:text-ink-1 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-control border py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors"
        >
          <LogOut size={12} />
          Sair
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LinhaDeBancada({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-ink-3">{rotulo}</span>
      <span className={valor ? 'text-ink-1 max-w-[70%] truncate font-semibold' : 'text-ink-3 italic'}>
        {valor ?? 'não definido'}
      </span>
    </div>
  );
}

function formatarEspecie(p: PreferenciaDeBancada): string | null {
  if (p.especieNomeCientifico && p.especieNomeComum) {
    return `${p.especieNomeCientifico} (${p.especieNomeComum})`;
  }
  return p.especieNomeCientifico ?? p.especieNomeComum ?? null;
}

function formatarEscala(umPerPixel: number | undefined): string | null {
  if (!umPerPixel || umPerPixel <= 0) return null;
  return `${umPerPixel.toFixed(2).replace('.', ',')} µm/px`;
}

function textoDeSincronizacao(
  sincronizacao: Conta['sincronizacao'],
  sincronizadoEm: number | null
): string {
  if (sincronizacao === 'erro') {
    return 'Sem contato com o servidor — continua salvo nesta máquina';
  }
  if (sincronizacao === 'carregando' || sincronizacao === 'gravando') {
    return 'Sincronizando…';
  }
  // 'ocioso': sem timestamp (nunca sincronizou nesta sessão), mostra só o estado.
  return sincronizadoEm === null
    ? 'Bancada sincronizada'
    : `Bancada sincronizada ${formatarDecorrido(sincronizadoEm)}`;
}

function formatarDecorrido(desde: number): string {
  const minutos = Math.max(0, Math.round((Date.now() - desde) / 60000));
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `há ${horas}h`;
}
