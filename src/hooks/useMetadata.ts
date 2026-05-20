import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Metadata } from '../types';
import { db } from '../lib/db';

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

const METADATA_ID = 'current_metadata';

export function useMetadata() {
  const storedMetadata = useLiveQuery(() => db.metadataStore.get(METADATA_ID));
  const metadata = storedMetadata?.data ?? defaultMetadata;

  // Migration from localStorage
  useEffect(() => {
    const migrate = async () => {
      try {
        const saved = localStorage.getItem('lastMetadata');
        if (saved) {
          const parsed: Metadata = JSON.parse(saved);
          const existing = await db.metadataStore.get(METADATA_ID);
          if (!existing) {
            await db.metadataStore.put({ id: METADATA_ID, data: parsed });
            localStorage.removeItem('lastMetadata');
            console.log('Migrated metadata to IndexedDB successfully');
          }
        }
      } catch (e) {
        console.error("Failed to migrate metadata from localStorage", e);
      }
    };
    migrate();
  }, []);

  const setMetadata = useCallback(async (newMetadata: Metadata | ((prev: Metadata) => Metadata)) => {
    if (typeof newMetadata === 'function') {
      const existing = await db.metadataStore.get(METADATA_ID);
      const current = existing?.data ?? defaultMetadata;
      await db.metadataStore.put({ id: METADATA_ID, data: newMetadata(current) });
    } else {
      await db.metadataStore.put({ id: METADATA_ID, data: newMetadata });
    }
  }, []);

  const updateMetadata = useCallback(async <K extends keyof Metadata>(key: K, value: Metadata[K]) => {
    const existing = await db.metadataStore.get(METADATA_ID);
    const current = existing?.data ?? defaultMetadata;
    await db.metadataStore.put({ 
      id: METADATA_ID, 
      data: { ...current, [key]: value } 
    });
  }, []);

  const resetMetadata = useCallback(async () => {
    await db.metadataStore.put({ id: METADATA_ID, data: defaultMetadata });
  }, []);

  return {
    metadata,
    setMetadata,
    updateMetadata,
    resetMetadata
  };
}

