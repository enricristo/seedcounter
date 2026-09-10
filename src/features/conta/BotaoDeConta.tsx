// =============================================================================
// SeedCounter — o botão da conta, no cabeçalho
//
// Três estados, e o primeiro é "nada":
//
//   sem client id     → o componente não renderiza. Não é um botão desabilitado
//                       nem um aviso: é ausência. Instalação sem conta
//                       configurada não deve nem sugerir que existe uma.
//   anônimo           → o botão do Google, discreto, no canto.
//   entrado           → foto, nome, e um jeito de sair.
//
// A conta nunca bloqueia nada. Ela só lembra a bancada.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { LogOut, CloudOff, Cloud, RefreshCw } from 'lucide-react';
import type { Conta } from './useConta';

export function BotaoDeConta({ conta }: { conta: Conta }) {
  const alvo = useRef<HTMLDivElement>(null);
  const { disponivel, estado, montarBotao, sair, sincronizacao } = conta;

  useEffect(() => {
    if (!estado.isAuthenticated) montarBotao(alvo.current);
  }, [estado.isAuthenticated, montarBotao]);

  if (!disponivel) return null;

  if (!estado.isAuthenticated) {
    return (
      <div
        ref={alvo}
        title="Entrar lembra a sua bancada — espécie, escala, nome — entre máquinas. Opcional."
        className="flex items-center"
      />
    );
  }

  const { user } = estado;
  const Sinc =
    sincronizacao === 'erro' ? CloudOff : sincronizacao === 'ocioso' ? Cloud : RefreshCw;

  return (
    <div className="border-line bg-surface-2 flex items-center gap-2 rounded-full border py-1 pr-1 pl-1">
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
        aria-label={
          sincronizacao === 'erro'
            ? 'Sem contato com o servidor — a bancada não está sincronizando'
            : sincronizacao === 'ocioso'
              ? 'Bancada sincronizada'
              : 'Sincronizando…'
        }
      />
      <button
        onClick={sair}
        title="Sair. A bancada continua na máquina; só para de sincronizar."
        aria-label="Sair da conta"
        className="text-ink-3 hover:text-ink-1 hover:bg-surface-1 rounded-full p-1 transition-colors"
      >
        <LogOut size={13} />
      </button>
    </div>
  );
}
