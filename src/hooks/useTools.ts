// =============================================================================
// SeedCounter — useTools
// Ferramentas de marcação estilo editor gráfico: marcar, borracha e seleção.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';

export type ToolId = 'viable' | 'inviable' | 'eraser' | 'pan';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  /** Tecla de atalho (minúscula). */
  shortcut: string;
  hint: string;
}

export const TOOLS: ToolDefinition[] = [
  { id: 'viable',   label: 'Marcar viável',   shortcut: 'v', hint: 'Clique para marcar sementes viáveis' },
  { id: 'inviable', label: 'Marcar inviável', shortcut: 'i', hint: 'Clique para marcar sementes inviáveis' },
  { id: 'eraser',   label: 'Borracha',        shortcut: 'e', hint: 'Clique ou arraste para apagar marcações' },
  { id: 'pan',      label: 'Mover imagem',    shortcut: 'h', hint: 'Arraste para navegar pela imagem' },
];

export function useTools() {
  const [activeTool, setActiveTool] = useState<ToolId>('viable');
  const [eraserRadius, setEraserRadius] = useState(20);
  /** Guarda a ferramenta anterior ao segurar Alt (borracha temporária). */
  const [tempTool, setTempTool] = useState<ToolId | null>(null);

  const effectiveTool: ToolId = tempTool ?? activeTool;

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey) return;

      // Alt segurado = borracha temporária (solta e volta ao normal).
      if (e.key === 'Alt' && !tempTool) {
        e.preventDefault();
        setTempTool('eraser');
        return;
      }

      // X inverte entre viável e inviável (como trocar cores no Photoshop).
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setActiveTool(prev =>
          prev === 'viable' ? 'inviable' : prev === 'inviable' ? 'viable' : prev
        );
        return;
      }

      const match = TOOLS.find(t => t.shortcut === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        setActiveTool(match.id);
        return;
      }

      // Colchetes ajustam o tamanho da borracha, como em editores gráficos.
      if (e.key === '[') setEraserRadius(r => Math.max(5, r - 5));
      if (e.key === ']') setEraserRadius(r => Math.min(120, r + 5));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setTempTool(null);
    };

    // Se a janela perder o foco com Alt pressionado, desfaz o modo temporário.
    const onBlur = () => setTempTool(null);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [tempTool]);

  const cycleTool = useCallback(() => {
    setActiveTool(prev => {
      const i = TOOLS.findIndex(t => t.id === prev);
      return TOOLS[(i + 1) % TOOLS.length].id;
    });
  }, []);

  return {
    activeTool: effectiveTool,
    selectedTool: activeTool,
    setActiveTool,
    cycleTool,
    eraserRadius,
    setEraserRadius,
    isTemporary: tempTool !== null,
  };
}
