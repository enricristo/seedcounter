import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onUndo: () => void;
  onRedo: () => void;
  onSetVisualMode: (mode: 'dots' | 'numbers') => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSaveSession: () => void;
  onOpenExport: () => void;
  onToggleTheme: () => void;
  /** Cicla a mascara de anotacao (tudo -> so pontos -> nada). */
  onCiclarMascara: () => void;
  /** Abre a galeria de objetos. */
  onAbrirGaleria: () => void;
  /** Ativa a bancada N (0-3) — Ctrl+Alt+1..4 (C2, Task 3). */
  onAtivarBancada: (indice: number) => void;
  /** Abre uma bancada nova — Ctrl+Alt+N (C2, Task 3). */
  onAbrirNovaBancada: () => void;
  /**
   * Não tem tecla: 'H' é da barra de ferramentas (`useTools`), a fonte única
   * do modo de interação. Continua na assinatura porque `App.tsx` ainda o
   * passa; tirar dali é de quem cuida daquela região.
   */
  onTogglePanning: () => void;
  hasImage: boolean;
  hasNextImage: boolean;
  hasPrevImage: boolean;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onSetVisualMode,
  onNextImage,
  onPrevImage,
  onTogglePanning,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSaveSession,
  onOpenExport,
  onToggleTheme,
  onCiclarMascara,
  onAbrirGaleria,
  onAtivarBancada,
  onAbrirNovaBancada,
  hasImage,
  hasNextImage,
  hasPrevImage,
  disabled = false,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      // If user is focused on an input or textarea, skip single-key shortcuts
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true');

      // Ctrl/Meta shortcuts are always allowed or checked carefully
      if (e.ctrlKey || e.metaKey) {
        // Bancadas (C2): Ctrl+Alt+1..4 ativa a bancada N; Ctrl+Alt+N abre
        // uma nova. Era Ctrl+1..4 e Ctrl+Shift+N, mas o navegador e o sistema
        // já são donos dessas combinações (trocar de aba, aba anônima) — o
        // Enrico nunca conseguia disparar. Ctrl+Alt não tem dono. Precisam
        // do `return` aqui — sem ele, Ctrl+Alt+1 cairia no `switch` abaixo e
        // disputaria a tecla '1' com o modo de visualização (que usa '1'/'2'
        // sem Ctrl).
        //
        // Lê `e.code` (a tecla FÍSICA), não `e.key`: em Windows, Ctrl+Alt é
        // AltGr, e no teclado ABNT2 AltGr+2 produz "²", AltGr+4 produz "£" —
        // `e.key` nunca seria o dígito, e o atalho prometido na ajuda não
        // dispararia justamente no teclado de quem usa. `e.key` fica como
        // reserva para eventos sintéticos, que não trazem `code`.
        const digito = /^Digit([1-4])$/.exec(e.code)?.[1] ?? (/^[1-4]$/.test(e.key) ? e.key : null);
        if (!isTyping && e.altKey && digito !== null) {
          e.preventDefault();
          onAtivarBancada(Number(digito) - 1);
          return;
        }
        if (!isTyping && e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          onAbrirNovaBancada();
          return;
        }
        // Desfazer/refazer sao do CAMPO quando ha um campo com foco: Ctrl+Z
        // nas Observacoes tem que desfazer o texto, nao a ultima marca.
        if (!isTyping && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) onRedo();
          else onUndo();
          return;
        }
        if (!isTyping && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          onRedo();
          return;
        }
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (hasImage) onSaveSession();
          return;
        }
        if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          if (hasImage) onOpenExport();
          return;
        }
      }

      // If user is typing in form, don't execute single letter shortcuts
      if (isTyping) return;

      switch (e.key.toLowerCase()) {
        case '1':
          e.preventDefault();
          onSetVisualMode('dots');
          break;
        case '2':
          e.preventDefault();
          onSetVisualMode('numbers');
          break;
        // 'h' é tratado pela barra de ferramentas (useTools), que é a fonte
        // única de verdade do modo de interação. Manter aqui causaria dois
        // estados de "modo mão" concorrentes.
        case '+':
        case '=':
          e.preventDefault();
          if (hasImage) onZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          if (hasImage) onZoomOut();
          break;
        case '0':
          e.preventDefault();
          if (hasImage) onResetZoom();
          break;
        case 'd':
          e.preventDefault();
          onToggleTheme();
          break;
        case 'm':
          // Alternar a mascara precisa ser mais rapido que a duvida: com o
          // overlay ligado nao da para julgar se o contorno esta sobre uma
          // semente ou sobre uma sombra.
          e.preventDefault();
          if (hasImage) onCiclarMascara();
          break;
        case 'g':
          e.preventDefault();
          if (hasImage) onAbrirGaleria();
          break;
        case ' ':
          // Spacebar: next image if we have image queue
          if (hasNextImage) {
            e.preventDefault();
            onNextImage();
          }
          break;
        case 'backspace':
          // Backspace: prev image if we have image queue
          if (hasPrevImage) {
            e.preventDefault();
            onPrevImage();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onUndo,
    onRedo,
    onSetVisualMode,
    onNextImage,
    onPrevImage,
    onTogglePanning,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onSaveSession,
    onCiclarMascara,
    onAbrirGaleria,
    onAtivarBancada,
    onAbrirNovaBancada,
    onOpenExport,
    onToggleTheme,
    hasImage,
    hasNextImage,
    hasPrevImage,
    disabled,
  ]);
}
