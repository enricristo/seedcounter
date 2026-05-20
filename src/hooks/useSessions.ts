import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '../types';
import { db } from '../lib/db';

export function useSessions() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), []) ?? [];

  // Migration from localStorage to Dexie (runs once)
  useEffect(() => {
    const migrate = async () => {
      try {
        const saved = localStorage.getItem('seedCounterSessions');
        if (saved) {
          const parsed: Session[] = JSON.parse(saved);
          if (parsed.length > 0) {
            const count = await db.sessions.count();
            if (count === 0) {
              await db.sessions.bulkAdd(parsed);
              localStorage.removeItem('seedCounterSessions'); // cleanup after successful migration
              console.log('Migrated sessions to IndexedDB successfully');
            }
          }
        }
      } catch (e) {
        console.error("Failed to migrate sessions from localStorage", e);
      }
    };
    migrate();
  }, []);

  const addSession = useCallback(async (session: Session) => {
    await db.sessions.put(session);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await db.sessions.delete(id);
  }, []);

  const clearSessions = useCallback(async () => {
    if (window.confirm("Deseja realmente limpar todo o histórico de contagens?")) {
      await db.sessions.clear();
    }
  }, []);

  const importSessions = useCallback(async (imported: Session[]) => {
    if (Array.isArray(imported)) {
      try {
        await db.sessions.bulkPut(imported);
        return true;
      } catch (error) {
        console.error("Failed to import sessions:", error);
        return false;
      }
    }
    return false;
  }, []);

  return {
    sessions,
    addSession,
    deleteSession,
    clearSessions,
    importSessions
  };
}

