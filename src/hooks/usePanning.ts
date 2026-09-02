import React, { useState, useCallback, useRef } from 'react';

export function usePanning() {
  const [isPanningMode, setIsPanningMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ left: 0, top: 0 });

  const startDrag = useCallback((e: React.MouseEvent, containerElement: HTMLDivElement | null) => {
    if (!isPanningMode && e.button !== 1) return; // Hand mode or middle click
    setIsDragging(true);
    startPanRef.current = { x: e.pageX, y: e.pageY };
    if (containerElement) {
      scrollStartRef.current = {
        left: containerElement.scrollLeft,
        top: containerElement.scrollTop
      };
    }
  }, [isPanningMode]);

  const handleDrag = useCallback((e: React.MouseEvent, containerElement: HTMLDivElement | null) => {
    if (!isDragging || !containerElement) return;
    e.preventDefault();
    const dx = e.pageX - startPanRef.current.x;
    const dy = e.pageY - startPanRef.current.y;
    containerElement.scrollLeft = scrollStartRef.current.left - dx;
    containerElement.scrollTop = scrollStartRef.current.top - dy;
  }, [isDragging]);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const togglePanningMode = useCallback(() => {
    setIsPanningMode(prev => !prev);
  }, []);

  return {
    isPanningMode,
    setIsPanningMode,
    isDragging,
    startDrag,
    handleDrag,
    stopDrag,
    togglePanningMode
  };
}
