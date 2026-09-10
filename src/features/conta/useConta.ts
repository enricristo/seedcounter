// =============================================================================
// SeedCounter — o gancho da conta
//
// Liga o cliente de autenticação ao React e cuida do que o cliente não cuida:
// inicializar o botão do Google, carregar a preferência ao entrar, e gravá-la
// de volta quando a bancada muda.
//
// A GRAVAÇÃO É ADIADA E SÓ QUANDO MUDOU.
//
// Cada tecla no campo de pesquisador mudaria o `metadata`. Gravar a cada
// mudança seria uma requisição por tecla. O adiamento junta a rajada num único
// envio, e `mesmaPreferencia` evita mandar o que o servidor já tem.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { gisClient, type AuthState } from '../../lib/auth/gis-client';
import type { Metadata } from '../../types';
import {
  aplicarPreferencia,
  contaDisponivel,
  extrairPreferencia,
  lerPreferencia,
  mesmaPreferencia,
  type PreferenciaDeBancada,
} from './conta';

/** Espera depois da última mudança antes de gravar. */
const ADIAMENTO_MS = 1500;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (r: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export interface Conta {
  disponivel: boolean;
  estado: AuthState;
  /** Renderiza o botão do Google dentro do elemento. */
  montarBotao: (el: HTMLElement | null) => void;
  sair: () => Promise<void>;
  /** Estado da última sincronização, para a interface dizer o que houve. */
  sincronizacao: 'ocioso' | 'carregando' | 'gravando' | 'erro';
}

export function useConta(
  metadata: Metadata,
  setMetadata: (fn: (prev: Metadata) => Metadata) => void
): Conta {
  const disponivel = contaDisponivel();
  const [estado, setEstado] = useState<AuthState>(() => gisClient.getState());
  const [sincronizacao, setSincronizacao] = useState<Conta['sincronizacao']>('ocioso');

  // O que o servidor tem, para não gravar de volta o que acabou de vir dele.
  const noServidor = useRef<PreferenciaDeBancada | null>(null);
  const temporizador = useRef<number | null>(null);

  useEffect(() => gisClient.onAuthStateChanged(setEstado), []);

  // --- Ao entrar: carrega a preferência e preenche o que estiver vazio ------
  useEffect(() => {
    if (!estado.isAuthenticated) {
      noServidor.current = null;
      return;
    }
    let cancelado = false;
    setSincronizacao('carregando');

    gisClient
      .syncPreferences()
      .then((bruto) => {
        if (cancelado) return;
        const p = lerPreferencia(bruto);
        noServidor.current = p;
        setMetadata((prev) => aplicarPreferencia(prev, p));
        setSincronizacao('ocioso');
      })
      .catch(() => {
        // Sem servidor a conta continua "entrada"; só não sincroniza. O app
        // funciona igual — é a promessa de ser opcional.
        if (!cancelado) setSincronizacao('erro');
      });

    return () => {
      cancelado = true;
    };
  }, [estado.isAuthenticated, setMetadata]);

  // --- Quando a bancada muda: grava, adiado, só se mudou -------------------
  useEffect(() => {
    if (!estado.isAuthenticated || noServidor.current === null) return;

    const atual = extrairPreferencia(metadata);
    if (mesmaPreferencia(atual, noServidor.current)) return;

    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(async () => {
      setSincronizacao('gravando');
      try {
        // O cliente aceita JSON livre; a nossa preferencia e um subconjunto
        // tipado dele. A copia e o que satisfaz a assinatura de indice.
        await gisClient.syncPreferences({ ...atual });
        noServidor.current = atual;
        setSincronizacao('ocioso');
      } catch {
        setSincronizacao('erro');
      }
    }, ADIAMENTO_MS);

    return () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    };
  }, [metadata, estado.isAuthenticated]);

  // --- O botão do Google -----------------------------------------------------
  const montarBotao = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !disponivel) return;
      const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID);

      gisClient.loadGisScript().then((ok) => {
        const id = window.google?.accounts?.id;
        if (!ok || !id) return;

        id.initialize({
          client_id: clientId,
          // Sem One Tap automático: um pop-up na primeira visita é o oposto de
          // "opcional". A pessoa clica quando quiser.
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (r) => {
            if (r.credential) gisClient.signInWithToken(r.credential);
          },
        });

        id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'medium',
          text: 'signin',
          shape: 'pill',
          locale: 'pt-BR',
        });
      });
    },
    [disponivel]
  );

  const sair = useCallback(async () => {
    window.google?.accounts?.id?.disableAutoSelect();
    await gisClient.signOut();
    noServidor.current = null;
  }, []);

  return { disponivel, estado, montarBotao, sair, sincronizacao };
}
