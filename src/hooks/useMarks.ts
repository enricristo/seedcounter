import { useState, useCallback } from 'react';
import type { Mark, YoloSegmentation } from '../types';

export function useMarks() {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [yoloSegmentations, setYoloSegmentations] = useState<YoloSegmentation[]>([]);
  const [segmentsVisible, setSegmentsVisible] = useState(true);

  // Manual Marks actions
  // Devolve o id: quem cria um contorno no mesmo gesto precisa dele para
  // VINCULAR os dois. Sem o id, o vinculo ficava implicito (ponto dentro do
  // poligono), e implicito quebra quando o poligono e cortado ao meio.
  const addMark = useCallback((x: number, y: number, type: 'viable' | 'inviable'): number => {
    const id = Date.now() + Math.random();
    setMarks((prev) => [...prev, { x, y, type, id }]);
    return id;
  }, []);

  /**
   * Apagar a marca apaga o contorno DELA.
   *
   * A marca e a identidade da semente; o contorno e a medida dessa semente.
   * Quem apaga a marca esta dizendo "isto nao e uma semente" — e um contorno
   * medindo uma semente que nao existe seria area e comprimento de nada no
   * CSV. So o contorno VINCULADO cai: contorno de modelo, sem marca, fica.
   */
  const removerContornosDe = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    const alvo = new Set(ids);
    setYoloSegmentations((prev) => prev.filter((s) => s.marcaId == null || !alvo.has(s.marcaId)));
  }, []);

  const undoMark = useCallback(() => {
    setMarks((prev) => {
      const ultima = prev[prev.length - 1];
      if (ultima) removerContornosDe([ultima.id]);
      return prev.slice(0, -1);
    });
  }, [removerContornosDe]);

  const removeMark = useCallback(
    (id: number) => {
      removerContornosDe([id]);
      setMarks((prev) => prev.filter((m) => m.id !== id));
    },
    [removerContornosDe]
  );

  const resetMarks = useCallback(() => {
    setMarks([]);
  }, []);

  // YOLO segmentations actions
  const addYoloSegmentations = useCallback((segs: YoloSegmentation[]) => {
    setYoloSegmentations(segs);
  }, []);

  /**
   * Acrescenta UMA segmentação, preservando as demais.
   *
   * `addYoloSegmentations` substitui a lista inteira — é o que a detecção em
   * lote precisa. A segmentação por clique é o oposto: uma semente de cada
   * vez, e cada clique tem que somar ao que já foi curado.
   */
  const appendYoloSegmentation = useCallback((seg: YoloSegmentation) => {
    setYoloSegmentations((prev) => [...prev, seg]);
  }, []);

  const toggleSegmentationClass = useCallback((id: number) => {
    setYoloSegmentations((prev) =>
      prev.map((seg) => {
        if (seg.id === id) {
          const newCategory = seg.category === 'viable' ? 'inviable' : 'viable';
          return {
            ...seg,
            category: newCategory,
            class_name: newCategory === 'viable' ? 'viavel' : 'inviavel',
            edited: true,
          };
        }
        return seg;
      })
    );
  }, []);

  const deleteSegmentation = useCallback((id: number) => {
    setYoloSegmentations((prev) =>
      prev.map((seg) => {
        if (seg.id === id) {
          return { ...seg, visible: false, edited: true };
        }
        return seg;
      })
    );
  }, []);

  const toggleSegmentsVisibility = useCallback(() => {
    setSegmentsVisible((prev) => !prev);
  }, []);

  const resetYoloSegmentations = useCallback(() => {
    setYoloSegmentations([]);
    setSegmentsVisible(true);
  }, []);

  const resetAllAnnotations = useCallback(() => {
    resetMarks();
    resetYoloSegmentations();
  }, [resetMarks, resetYoloSegmentations]);

  return {
    marks,
    setMarks,
    yoloSegmentations,
    setYoloSegmentations,
    segmentsVisible,
    setSegmentsVisible,

    // Manual
    addMark,
    undoMark,
    removeMark,
    resetMarks,

    // YOLO
    addYoloSegmentations,
    appendYoloSegmentation,
    toggleSegmentationClass,
    deleteSegmentation,
    toggleSegmentsVisibility,
    resetYoloSegmentations,

    // Combined
    resetAllAnnotations,
  };
}
