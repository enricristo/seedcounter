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

/**
 * O registro de metadados é POR BANCADA.
 *
 * Era um só (`current_metadata`) porque só havia uma cena. Com quatro, as
 * quatro instâncias do hook escreveriam no mesmo registro — e metadados
 * carregam a CALIBRAÇÃO: duas digitalizações de escalas diferentes abertas
 * lado a lado se sobrescreveriam, e as medidas em mm de uma sairiam com o
 * µm/px da outra. Um erro silencioso, do tipo que só aparece no laudo.
 *
 * A bancada 1 mantém a chave antiga de propósito: é a bancada de quem já usa
 * o app, e a identificação da bancada (pesquisador, projeto, laboratório) que
 * ele deixou salva continua aparecendo onde sempre apareceu.
 */
const METADATA_ID_PADRAO = 'current_metadata';

export function idDoRegistroDeMetadados(bancada?: string): string {
  return !bancada || bancada === 'b1' ? METADATA_ID_PADRAO : `metadata_${bancada}`;
}

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
const filasDeEscrita = new Map<string, Promise<unknown>>();

function enfileirar<T>(registro: string, tarefa: () => Promise<T>): Promise<T> {
  // Uma fila POR REGISTRO: serializar gravações da mesma bancada é o que
  // corrige o bug de digitação; serializar bancadas diferentes entre si seria
  // fazer uma esperar a outra sem nenhum motivo.
  const anterior = filasDeEscrita.get(registro) ?? Promise.resolve();
  // O catch mantém a fila viva: uma gravação que falhe não pode travar as
  // seguintes.
  const proxima = anterior.catch(() => {}).then(tarefa);
  filasDeEscrita.set(registro, proxima.catch(() => {}));
  return proxima;
}

export function useMetadata(bancada?: string) {
  const METADATA_ID = idDoRegistroDeMetadados(bancada);
  const storedMetadata = useLiveQuery(() => db.metadataStore.get(METADATA_ID), [METADATA_ID]);
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
      enfileirar(METADATA_ID, async () => {
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
      enfileirar(METADATA_ID, async () => {
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
