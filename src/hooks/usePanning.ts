import React, { useState, useCallback, useRef, useEffect } from 'react';

export function usePanning() {
  const [isPanningMode, setIsPanningMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ left: 0, top: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent, containerElement: HTMLDivElement | null) => {
      if (!isPanningMode && e.button !== 1) return; // Hand mode or middle click
      if (e.button === 1) {
        // Evita o cursor de autoscroll circular nativo do Windows
        e.preventDefault();
      }
      setIsDragging(true);
      containerRef.current = containerElement;
      startPanRef.current = { x: e.pageX, y: e.pageY };
      if (containerElement) {
        scrollStartRef.current = {
          left: containerElement.scrollLeft,
          top: containerElement.scrollTop,
        };
      }
    },
    [isPanningMode]
  );

  const handleDrag = useCallback(
    (e: React.MouseEvent | MouseEvent, containerElement: HTMLDivElement | null) => {
      if (!isDragging || !containerElement) return;
      e.preventDefault();
      const dx = e.pageX - startPanRef.current.x;
      const dy = e.pageY - startPanRef.current.y;
      containerElement.scrollLeft = scrollStartRef.current.left - dx;
      containerElement.scrollTop = scrollStartRef.current.top - dy;
    },
    [isDragging]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      handleDrag(e, containerRef.current);
    };
    const onMouseUp = () => {
      stopDrag();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDrag, stopDrag]);

  const togglePanningMode = useCallback(() => {
    setIsPanningMode((prev) => !prev);
  }, []);

  return {
    isPanningMode,
    setIsPanningMode,
    isDragging,
    startDrag,
    handleDrag,
    stopDrag,
    togglePanningMode,
  };
}
