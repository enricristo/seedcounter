// =============================================================================
// SeedCounter — o modo de visualização como estado (hook + contexto)
//
// PRIORIDADE NA INICIALIZAÇÃO: URL > preferência salva > 'completo'.
//
// A URL vence porque é a forma de mandar alguém para um modo específico —
// "abra este link e grave" — e um link tem que dar o mesmo resultado em
// qualquer máquina, independentemente do que ela lembra. A preferência salva
// vem depois porque é o que a pessoa escolheu da última vez no menu. O modo
// que veio da URL NÃO é gravado: quem recebeu um link de apresentação não
// quer que a máquina dela fique em apresentação para sempre.
//
// SOBRESCRITAS SÃO RELATIVAS AO MODO.
//
// Dentro de um modo, a pessoa liga ou desliga uma parte (o "ligar e desligar
// tal coisa" pedido). Trocar de modo zera as sobrescritas: uma sobrescrita de
// "contagem" não quer dizer nada em "laudo", e carregá-la junto seria a
// surpresa clássica de "por que sumiu o painel?". `redefinir()` só limpa as
// sobrescritas do modo atual — voltar para 'completo' é o rádio, não este botão.
//
// POR QUE UM CONTEXTO, E POR QUE ELE TEM FALLBACK.
//
// `Header`, `Sidebar` e `RightSidebar` são montados por `App.tsx`, que já tem
// dezenas de props. Passar `visibilidade` por lá seria mais prop drilling num
// componente que não aguenta mais. O contexto evita isso. E `useVisibilidade`
// funciona SEM o Provider — devolvendo o modo da URL ou 'completo', sem
// setters — para que o cabeçalho nunca quebre no meio de uma integração e
// para que `?mode=enterprise` continue funcionando mesmo antes de o Provider
// ser montado.
// =============================================================================

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { gravarPreferenciaTexto, lerPreferenciaTexto } from '../settings/preferencias';
import {
  alternarParte,
  ehModoDeVisualizacao,
  lerModoDaUrl,
  lerSobrescritas,
  serializarSobrescritas,
  visibilidadeEfetiva,
  type ModoDeVisualizacao,
  type ParteDaInterface,
  type Visibilidade,
} from './modo';

/** Onde o modo escolhido no menu fica guardado. */
export const CHAVE_MODO = 'sc:modo-de-visualizacao';
/** Onde as sobrescritas individuais ficam guardadas (JSON). */
export const CHAVE_SOBRESCRITAS = 'sc:visibilidade';

export interface ModoDeVisualizacaoApi {
  modo: ModoDeVisualizacao;
  /** Troca o modo e zera as sobrescritas. */
  definirModo: (modo: ModoDeVisualizacao) => void;
  /**
   * Modo E sobrescritas de uma vez — o que uma pré-definição por perfil
   * escreve (`features/perfis`). Existe porque `definirModo` seguido de
   * `alternar` não serve: `alternar` fecha sobre o modo do render anterior e
   * calcularia a sobrescrita contra o modo errado. `persistir: false` aplica
   * só nesta sessão, como o modo vindo da URL — é o caso de "apresentação",
   * que não pode grudar na máquina.
   */
  aplicar: (
    modo: ModoDeVisualizacao,
    sobrescritas: Partial<Visibilidade>,
    opcoes?: { persistir?: boolean }
  ) => void;
  /** A visibilidade efetiva: padrão do modo com as sobrescritas por cima. */
  visibilidade: Visibilidade;
  /** As sobrescritas em vigor — o menu usa para saber se há o que redefinir. */
  sobrescritas: Partial<Visibilidade>;
  /** Liga ou desliga uma parte, dentro do modo atual. */
  alternar: (parte: ParteDaInterface) => void;
  /** Limpa as sobrescritas do modo atual. */
  redefinir: () => void;
  /** true quando o modo veio da URL — o menu avisa que um F5 volta a ele. */
  fixadoPelaUrl: boolean;
}

function modoInicial(): { modo: ModoDeVisualizacao; daUrl: boolean } {
  if (typeof window !== 'undefined') {
    const daUrl = lerModoDaUrl(window.location.search);
    if (daUrl) return { modo: daUrl, daUrl: true };
  }
  const salvo = lerPreferenciaTexto(CHAVE_MODO, 'completo');
  return { modo: ehModoDeVisualizacao(salvo) ? salvo : 'completo', daUrl: false };
}

function sobrescritasIniciais(daUrl: boolean): Partial<Visibilidade> {
  // Sobrescritas gravadas pertencem ao modo gravado. Se a URL impôs outro
  // modo, elas não se aplicam — pela mesma razão que trocar de modo as zera.
  if (daUrl) return {};
  return lerSobrescritas(lerPreferenciaTexto(CHAVE_SOBRESCRITAS, ''));
}

export function useModoDeVisualizacao(): ModoDeVisualizacaoApi {
  const [inicial] = useState(modoInicial);
  const [modo, setModo] = useState<ModoDeVisualizacao>(inicial.modo);
  const [sobrescritas, setSobrescritas] = useState<Partial<Visibilidade>>(() =>
    sobrescritasIniciais(inicial.daUrl)
  );

  const definirModo = useCallback((novo: ModoDeVisualizacao) => {
    setModo(novo);
    setSobrescritas({});
    gravarPreferenciaTexto(CHAVE_MODO, novo);
    gravarPreferenciaTexto(CHAVE_SOBRESCRITAS, serializarSobrescritas({}));
  }, []);

  const aplicar = useCallback(
    (novo: ModoDeVisualizacao, novas: Partial<Visibilidade>, opcoes?: { persistir?: boolean }) => {
      setModo(novo);
      setSobrescritas(novas);
      if (opcoes?.persistir === false) return;
      gravarPreferenciaTexto(CHAVE_MODO, novo);
      gravarPreferenciaTexto(CHAVE_SOBRESCRITAS, serializarSobrescritas(novas));
    },
    []
  );

  const alternar = useCallback(
    (parte: ParteDaInterface) => {
      setSobrescritas((atuais) => {
        const proximas = alternarParte(modo, atuais, parte);
        gravarPreferenciaTexto(CHAVE_SOBRESCRITAS, serializarSobrescritas(proximas));
        return proximas;
      });
    },
    [modo]
  );

  const redefinir = useCallback(() => {
    setSobrescritas({});
    gravarPreferenciaTexto(CHAVE_SOBRESCRITAS, serializarSobrescritas({}));
  }, []);

  const visibilidade = useMemo(() => visibilidadeEfetiva(modo, sobrescritas), [modo, sobrescritas]);

  return useMemo(
    () => ({
      modo,
      definirModo,
      aplicar,
      visibilidade,
      sobrescritas,
      alternar,
      redefinir,
      fixadoPelaUrl: inicial.daUrl && modo === inicial.modo,
    }),
    [modo, definirModo, aplicar, visibilidade, sobrescritas, alternar, redefinir, inicial]
  );
}

// -----------------------------------------------------------------------------
// Contexto
// -----------------------------------------------------------------------------

const ContextoDeVisualizacao = createContext<ModoDeVisualizacaoApi | null>(null);

/**
 * Monte UMA vez, acima de `Header`, `Sidebar`, `RightSidebar` e do rodapé —
 * em `main.tsx` em volta de `<App />`, ou no topo do JSX de `App`.
 */
export function ModoDeVisualizacaoProvider({ children }: { children: React.ReactNode }) {
  const api = useModoDeVisualizacao();
  return React.createElement(ContextoDeVisualizacao.Provider, { value: api }, children);
}

const semSetter = () => {
  // Sem Provider não há onde guardar a escolha. Silencioso de propósito: o
  // cabeçalho continua funcionando, só não muda de modo.
};

/**
 * O que os componentes de layout leem. Fora do Provider devolve o modo da URL
 * (ou 'completo') com setters inertes — ver o cabeçalho do arquivo.
 */
export function useVisibilidade(): ModoDeVisualizacaoApi {
  const doContexto = useContext(ContextoDeVisualizacao);
  const semProvider = useMemo<ModoDeVisualizacaoApi>(() => {
    const { modo, daUrl } = modoInicial();
    return {
      modo,
      definirModo: semSetter,
      aplicar: semSetter,
      visibilidade: visibilidadeEfetiva(modo, {}),
      sobrescritas: {},
      alternar: semSetter,
      redefinir: semSetter,
      fixadoPelaUrl: daUrl,
    };
  }, []);
  return doContexto ?? semProvider;
}
