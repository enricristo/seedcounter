import { useState, useCallback } from 'react';

export function useZoom() {
  const [zoomLevel, setZoomLevel] = useState(1);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.2, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const fitToScreen = useCallback((containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) => {
    if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
      setZoomLevel(1);
      return;
    }
    const fitX = (containerWidth - 64) / imageWidth;
    const fitY = (containerHeight - 64) / imageHeight;
    const fitZoom = Math.min(fitX, fitY, 1);
    setZoomLevel(fitZoom);
  }, []);

  return {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen
  };
}
