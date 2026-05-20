import { useState, useEffect, useCallback } from 'react';
import type { Session } from '../types';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('seedCounterSessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('seedCounterSessions', JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions to localStorage", e);
    }
  }, [sessions]);

  const addSession = useCallback((session: Session) => {
    setSessions(prev => [session, ...prev]);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const clearSessions = useCallback(() => {
    if (window.confirm("Deseja realmente limpar todo o histórico de contagens?")) {
      setSessions([]);
    }
  }, []);

  const importSessions = useCallback((imported: Session[]) => {
    if (Array.isArray(imported)) {
      setSessions(prev => {
        // Prevent duplicate IDs by keeping unique ones
        const combined = [...imported, ...prev];
        const unique = combined.filter(
          (session, index, self) => self.findIndex(s => s.id === session.id) === index
        );
        return unique;
      });
      return true;
    }
    return false;
  }, []);

  return {
    sessions,
    setSessions,
    addSession,
    deleteSession,
    clearSessions,
    importSessions
  };
}
