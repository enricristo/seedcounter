// =============================================================================
// SeedCounter — o botão da conta, no cabeçalho
//
// Três estados, e o primeiro é "nada":
//
//   sem client id     → o componente não renderiza. Não é um botão desabilitado
//                       nem um aviso: é ausência. Instalação sem conta
//                       configurada não deve nem sugerir que existe uma.
//   anônimo           → um gatilho discreto: o botão do Google de fato mora
//                       dentro do painel (ver `PainelDaConta`), porque é lá
//                       que a frase "o que entrar dá" também mora.
//   entrado           → a pílula de sempre — foto, nome, sincronização —
//                       agora um gatilho para o painel em vez de um mostrador.
//
// A conta nunca bloqueia nada. Ela só lembra a bancada.
// =============================================================================

import React, { useRef, useState } from 'react';
import { CircleUserRound, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import type { Conta } from './useConta';
import type { Metadata } from '../../types';
import { PainelDaConta } from './PainelDaConta';

interface BotaoDeContaProps {
  conta: Conta;
  metadata: Metadata;
  /** A preferência da conta difere da bancada atual — chamado ao confirmar no painel. */
  onAplicarBancada: () => void;
  /** Abre o painel de Configurações (FeaturesModal). */
  onAbrirConfiguracoes: () => void;
  /** Abre "O que mudou" (NovidadesModal). */
  onAbrirNovidades: () => void;
}

export function BotaoDeConta({
  conta,
  metadata,
  onAplicarBancada,
  onAbrirConfiguracoes,
  onAbrirNovidades,
}: BotaoDeContaProps) {
  const botaoRef = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const { disponivel, estado, sincronizacao } = conta;

  if (!disponivel) return null;

  const alternar = () => setAberto((v) => !v);
  // Devolve o foco ao gatilho ao fechar — Esc e clique fora passam por aqui,
  // e quem navegava por teclado não perde o lugar.
  const fechar = () => {
    setAberto(false);
    botaoRef.current?.focus();
  };

  const { user } = estado;
  const Sinc =
    sincronizacao === 'erro' ? CloudOff : sincronizacao === 'ocioso' ? Cloud : RefreshCw;

  return (
    <div className="relative">
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        // Impede que este clique chegue ao "clique fora" que o painel escuta
        // no document — sem isto, abrir e fechar brigariam no mesmo clique.
        onMouseDown={(e) => e.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={estado.isAuthenticated ? 'Conta' : 'Entrar'}
        title={
          estado.isAuthenticated
            ? undefined
            : 'Entrar lembra a sua bancada — espécie, escala, nome — entre máquinas. Opcional.'
        }
        className={
          estado.isAuthenticated
            ? 'border-line bg-surface-2 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-2 pl-1 transition-colors'
            : 'border-line bg-surface-2 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-[11px] font-semibold transition-colors'
        }
      >
        {estado.isAuthenticated ? (
          <>
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <span className="bg-accent text-accent-on flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                {(user?.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-ink-1 max-w-[120px] truncate text-[11px] font-semibold">
              {user?.given_name ?? user?.name ?? user?.email}
            </span>
            <Sinc
              size={12}
              className={
                sincronizacao === 'erro'
                  ? 'text-warn'
                  : sincronizacao === 'ocioso'
                    ? 'text-ink-3'
                    : 'text-accent animate-spin motion-reduce:animate-none'
              }
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <span className="bg-surface-1 text-ink-3 flex h-6 w-6 items-center justify-center rounded-full">
              <CircleUserRound size={15} />
            </span>
            <span className="text-ink-2">Entrar</span>
          </>
        )}
      </button>

      <PainelDaConta
        conta={conta}
        metadata={metadata}
        onAplicarBancada={onAplicarBancada}
        onAbrirConfiguracoes={onAbrirConfiguracoes}
        onAbrirNovidades={onAbrirNovidades}
        aberto={aberto}
        onFechar={fechar}
      />
    </div>
  );
}
