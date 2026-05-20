import { useState, useCallback } from 'react';
import type { Mark, YoloSegmentation } from '../types';

export function useMarks() {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [yoloSegmentations, setYoloSegmentations] = useState<YoloSegmentation[]>([]);
  const [segmentsVisible, setSegmentsVisible] = useState(true);

  // Manual Marks actions
  const addMark = useCallback((x: number, y: number, type: 'viable' | 'inviable') => {
    setMarks(prev => [
      ...prev,
      { x, y, type, id: Date.now() + Math.random() }
    ]);
  }, []);

  const undoMark = useCallback(() => {
    setMarks(prev => prev.slice(0, -1));
  }, []);

  const removeMark = useCallback((id: number) => {
    setMarks(prev => prev.filter(m => m.id !== id));
  }, []);

  const resetMarks = useCallback(() => {
    setMarks([]);
  }, []);

  // YOLO segmentations actions
  const addYoloSegmentations = useCallback((segs: YoloSegmentation[]) => {
    setYoloSegmentations(segs);
  }, []);

  const toggleSegmentationClass = useCallback((id: number) => {
    setYoloSegmentations(prev =>
      prev.map(seg => {
        if (seg.id === id) {
          const newCategory = seg.category === 'viable' ? 'inviable' : 'viable';
          return {
            ...seg,
            category: newCategory,
            class_name: newCategory === 'viable' ? 'viavel' : 'inviavel',
            edited: true
          };
        }
        return seg;
      })
    );
  }, []);

  const deleteSegmentation = useCallback((id: number) => {
    setYoloSegmentations(prev =>
      prev.map(seg => {
        if (seg.id === id) {
          return { ...seg, visible: false, edited: true };
        }
        return seg;
      })
    );
  }, []);

  const toggleSegmentsVisibility = useCallback(() => {
    setSegmentsVisible(prev => !prev);
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
    toggleSegmentationClass,
    deleteSegmentation,
    toggleSegmentsVisibility,
    resetYoloSegmentations,

    // Combined
    resetAllAnnotations
  };
}
