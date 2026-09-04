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
  useDifferential: false,
};

const METADATA_ID = 'current_metadata';

/**
 * Fila de escrita dos metadados.
 *
 * Gravar um campo é ler-modificar-gravar. Duas chamadas concorrentes leem a
 * MESMA base antes de qualquer uma gravar, então a segunda sobrescreve o campo
 * que a primeira acabou de definir — e como cada tecla dispara uma gravação,
 * digitar rápido em dois campos fazia um deles simplesmente não ser salvo.
 *
 * A fila é de módulo, não de componente: precisa sobreviver às re-renderizações
 * para de fato serializar.
 */
let filaDeEscrita: Promise<unknown> = Promise.resolve();

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  // O catch mantém a fila viva: uma gravação que falhe não pode travar as
  // seguintes.
  const proxima = filaDeEscrita.catch(() => {}).then(tarefa);
  filaDeEscrita = proxima.catch(() => {});
  return proxima;
}

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
        console.error('Failed to migrate metadata from localStorage', e);
      }
    };
    migrate();
  }, []);

  const setMetadata = useCallback(
    (newMetadata: Metadata | ((prev: Metadata) => Metadata)) =>
      enfileirar(async () => {
        if (typeof newMetadata === 'function') {
          const existing = await db.metadataStore.get(METADATA_ID);
          const current = existing?.data ?? defaultMetadata;
          await db.metadataStore.put({ id: METADATA_ID, data: newMetadata(current) });
        } else {
          await db.metadataStore.put({ id: METADATA_ID, data: newMetadata });
        }
      }),
    []
  );

  const updateMetadata = useCallback(
    <K extends keyof Metadata>(key: K, value: Metadata[K]) =>
      enfileirar(async () => {
        const existing = await db.metadataStore.get(METADATA_ID);
        const current = existing?.data ?? defaultMetadata;
        await db.metadataStore.put({
          id: METADATA_ID,
          data: { ...current, [key]: value },
        });
      }),
    []
  );

  const resetMetadata = useCallback(async () => {
    await db.metadataStore.put({ id: METADATA_ID, data: defaultMetadata });
  }, []);

  return {
    metadata,
    setMetadata,
    updateMetadata,
    resetMetadata,
  };
}
