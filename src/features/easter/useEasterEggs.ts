// =============================================================================
// SeedCounter — o gancho que liga os easter eggs
//
// Um charme não se anuncia: por isso este gancho tem seu PRÓPRIO listener de
// teclado, separado de `useKeyboardShortcuts`. Ele não chama
// `preventDefault` nem `stopPropagation` em nada — só observa o que já
// passou por cima dele, sem competir pelo controle do teclado com as
// ferramentas de verdade.
//
// O critério de "não interferir em campo de texto" é o MESMO de
// `useKeyboardShortcuts.ts` (input, textarea, contenteditable) — repetido
// aqui de propósito: um easter egg capturando a tecla enquanto a pessoa
// escreve as Observações do laudo seria o oposto de charmoso.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { criarDetector } from './sequencia';
import { somLigado, ligarSom, desligarSom } from './som';

/** As duas descobertas. O nome de cada uma é o que `criarDetector` devolve. */
const SEQUENCIAS: Record<string, string> = {
  semente: 'semente',
  orquidea: 'orquidea',
};

/** Quanto tempo o recado fica na tela antes de sumir sozinho. */
const DURACAO_RECADO_MS = 2500;

export interface UseEasterEggsResultado {
  /** A orquídea deve florescer agora — passe direto para `Florescer`. */
  florescendo: boolean;
  /** Chamar quando a animação da orquídea termina (onFim de `Florescer`). */
  encerrarFlorescer: () => void;
  /** Uma frase breve para mostrar; some sozinho em ~2,5s. null quando não há nada a dizer. */
  recado: string | null;
}

export function useEasterEggs(): UseEasterEggsResultado {
  const [florescendo, setFlorescendo] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  // O detector é criado uma vez só e vive pela vida do gancho — ref, não
  // state, porque seu conteúdo (o buffer de teclas) não deve disparar
  // re-render.
  const detectorRef = useRef(criarDetector(SEQUENCIAS));
  const recadoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarRecado = useCallback((texto: string) => {
    if (recadoTimeoutRef.current) clearTimeout(recadoTimeoutRef.current);
    setRecado(texto);
    recadoTimeoutRef.current = setTimeout(() => setRecado(null), DURACAO_RECADO_MS);
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Ctrl/Meta/Alt marcam um ATALHO, não digitação — "Ctrl+S" não deve
      // alimentar o detector com um 's', nem "Alt" (borracha, ver
      // useKeyboardShortcuts) virar ruído no buffer.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ativo = document.activeElement;
      const digitando =
        ativo &&
        (ativo.tagName === 'INPUT' ||
          ativo.tagName === 'TEXTAREA' ||
          ativo.getAttribute('contenteditable') === 'true');
      if (digitando) return;

      // As duas sequências só usam letras — teclas de mais de um caractere
      // ("Backspace", "Shift" etc.) nunca fazem parte delas.
      if (e.key.length !== 1) return;

      const completou = detectorRef.current.registrar(e.key);
      if (completou === 'semente') {
        if (somLigado()) {
          desligarSom();
          mostrarRecado('Som desligado.');
        } else {
          ligarSom();
          mostrarRecado('Som ligado — cada semente marcada faz um tic.');
        }
      } else if (completou === 'orquidea') {
        setFlorescendo(true);
      }
    };

    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      if (recadoTimeoutRef.current) clearTimeout(recadoTimeoutRef.current);
    };
  }, [mostrarRecado]);

  const encerrarFlorescer = useCallback(() => setFlorescendo(false), []);

  return { florescendo, encerrarFlorescer, recado };
}
