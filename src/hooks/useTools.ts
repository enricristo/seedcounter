// =============================================================================
// SeedCounter — useTools
// Ferramentas de marcação estilo editor gráfico: marcar, borracha e seleção.
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';

export type ToolId =
  | 'viable'
  | 'inviable'
  | 'onda'
  | 'contorno'
  | 'desenho'
  | 'cota'
  | 'seta'
  | 'caixa'
  | 'chamada'
  | 'eraser'
  | 'pan';

/**
 * A que grupo a ferramenta pertence. A barra separa os grupos com um fio.
 *
 *   classe       o que a marca SIGNIFICA — viavel, inviavel. Cor do especime.
 *   instrumento  o que faz a MEDIDA — onda, ajuste, desenho, borracha. Acento.
 *   navegacao    mover-se pela imagem sem tocar nela.
 *
 * Nao e so organizacao visual: e a separacao de linguagens do sistema. Uma
 * ferramenta de classe pinta com a cor da marca; uma de instrumento nunca.
 */
export type GrupoDeFerramenta = 'classe' | 'instrumento' | 'navegacao';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  /** Tecla de atalho (minúscula). */
  shortcut: string;
  hint: string;
  grupo: GrupoDeFerramenta;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'viable',
    label: 'Marcar viável',
    shortcut: 'v',
    hint: 'Clique para marcar sementes viáveis',
    grupo: 'classe',
  },
  {
    id: 'inviable',
    label: 'Marcar inviável',
    shortcut: 'i',
    hint: 'Clique para marcar sementes inviáveis',
    grupo: 'classe',
  },
  {
    // A onda marca E contorna no mesmo gesto: o clique é a identidade da
    // semente, e o contorno é o que a máquina responde a partir dele.
    id: 'onda',
    label: 'Segmentar por clique',
    shortcut: 's',
    hint: 'Clique numa semente: a onda cresce até a borda e mede o contorno',
    grupo: 'instrumento',
  },
  {
    // Ajustar o que a onda ja produziu. Um contorno errado nao precisa ser
    // jogado fora: quase sempre so uma parte dele esta errada.
    id: 'contorno',
    label: 'Ajustar contorno',
    shortcut: 'c',
    hint: 'Clique num contorno para selecionar. Arraste as alças; clique na borda para criar vértice; raspe por dentro (Shift acrescenta)',
    grupo: 'instrumento',
  },
  {
    // Para quando a onda falha de vez: fundo igual a semente, semente
    // translucida, borda que nao existe na imagem. A pessoa desenha o que ve.
    id: 'desenho',
    label: 'Desenhar contorno',
    shortcut: 'p',
    hint: 'Clique para colocar vértices; duplo clique fecha o polígono; Esc cancela',
    grupo: 'instrumento',
  },
  {
    id: 'cota',
    label: 'Cota (Régua)',
    shortcut: 'r',
    hint: 'Arraste para criar uma cota de medida dimensional',
    grupo: 'instrumento',
  },
  {
    id: 'seta',
    label: 'Seta',
    shortcut: 'a',
    hint: 'Arraste para desenhar uma seta apontando',
    grupo: 'instrumento',
  },
  {
    id: 'caixa',
    label: 'Área de interesse',
    shortcut: 'b',
    hint: 'Arraste para desenhar uma caixa delimitadora',
    grupo: 'instrumento',
  },
  {
    id: 'chamada',
    label: 'Anotação textual',
    shortcut: 't',
    hint: 'Clique para inserir um texto de chamada',
    grupo: 'instrumento',
  },
  {
    id: 'eraser',
    label: 'Borracha',
    shortcut: 'e',
    hint: 'Clique ou arraste para apagar marcações',
    grupo: 'instrumento',
  },
  {
    id: 'pan',
    label: 'Mover imagem',
    shortcut: 'h',
    hint: 'Arraste para navegar pela imagem',
    grupo: 'navegacao',
  },
];

export function useTools(options?: {
  disabled?: boolean;
  /**
   * Avisa que a PESSOA escolheu uma ferramenta pelo teclado (inclusive o X,
   * que inverte viável↔inviável).
   *
   * Existe por causa da classe fina do protocolo: quem aperta V está dizendo
   * "agora eu marco grosso", e a classe armada tem de cair. Sem este aviso, o
   * App só veria `activeTool` mudar — e não saberia distinguir "apertei V" de
   * "armei a classe normal", que põem a MESMA ferramenta ativa.
   */
  onFerramentaPorTecla?: (id: ToolId) => void;
}) {
  const [activeTool, setActiveTool] = useState<ToolId>('viable');
  const [eraserRadius, setEraserRadius] = useState(20);
  /** Guarda a ferramenta anterior ao segurar Alt (borracha temporária). */
  const [tempTool, setTempTool] = useState<ToolId | null>(null);

  const effectiveTool: ToolId = tempTool ?? activeTool;

  // Por ref: o ouvinte de teclado é registrado uma vez, e uma função nova a
  // cada render do App o faria religar a cada tecla digitada em qualquer campo.
  const avisar = useRef(options?.onFerramentaPorTecla);
  avisar.current = options?.onFerramentaPorTecla;
  const disabled = options?.disabled ?? false;

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (disabled || isTyping(e.target) || e.ctrlKey || e.metaKey) return;

      // Alt segurado = borracha temporária (solta e volta ao normal).
      if (e.key === 'Alt' && !tempTool) {
        e.preventDefault();
        setTempTool('eraser');
        return;
      }

      // X inverte entre viável e inviável (como trocar cores no Photoshop).
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setActiveTool((prev) => {
          const proxima = prev === 'viable' ? 'inviable' : prev === 'inviable' ? 'viable' : prev;
          if (proxima !== prev) avisar.current?.(proxima);
          return proxima;
        });
        return;
      }

      const match = TOOLS.find((t) => t.shortcut === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        setActiveTool(match.id);
        avisar.current?.(match.id);
        return;
      }

      // Colchetes ajustam o tamanho da borracha, como em editores gráficos.
      if (e.key === '[') setEraserRadius((r) => Math.max(5, r - 5));
      if (e.key === ']') setEraserRadius((r) => Math.min(120, r + 5));
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
  }, [tempTool, disabled]);

  const cycleTool = useCallback(() => {
    setActiveTool((prev) => {
      const i = TOOLS.findIndex((t) => t.id === prev);
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
