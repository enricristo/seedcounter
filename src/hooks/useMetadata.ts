import { useState, useEffect, useCallback } from 'react';
import type { Metadata } from '../types';

const defaultMetadata: Metadata = {
  researcher: '',
  project: '',
  treatment: '',
  plate: '',
  quadrant: '',
  notes: '',
  baselineCount: 0,
  useDifferential: false
};

export function useMetadata() {
  const [metadata, setMetadata] = useState<Metadata>(() => {
    try {
      const saved = localStorage.getItem('lastMetadata');
      return saved ? JSON.parse(saved) : defaultMetadata;
    } catch {
      return defaultMetadata;
    }
  });

  // Keep localStorage in sync
  useEffect(() => {
    try {
      localStorage.setItem('lastMetadata', JSON.stringify(metadata));
    } catch (e) {
      console.error("Failed to save metadata to localStorage", e);
    }
  }, [metadata]);

  const updateMetadata = useCallback(<K extends keyof Metadata>(key: K, value: Metadata[K]) => {
    setMetadata(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const resetMetadata = useCallback(() => {
    setMetadata(defaultMetadata);
  }, []);

  return {
    metadata,
    setMetadata,
    updateMetadata,
    resetMetadata
  };
}
