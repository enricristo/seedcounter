import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Experiment, Treatment, PlateRun } from '../types';
import { db } from '../lib/db';

// ---------------------------------------------------------------------------
// useExperiments — CRUD for longitudinal experiment tracking
// ---------------------------------------------------------------------------

export function useExperiments() {
  const experiments = useLiveQuery(
    () => db.experiments.orderBy('createdAt').reverse().toArray(),
    []
  ) ?? [];

  // ---------------------------------------------------------------------------
  // Create / Update
  // ---------------------------------------------------------------------------

  const addExperiment = useCallback(async (exp: Experiment) => {
    await db.experiments.put(exp);
  }, []);

  const updateExperiment = useCallback(async (id: string, updates: Partial<Experiment>) => {
    const existing = await db.experiments.get(id);
    if (!existing) return;
    await db.experiments.put({
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const deleteExperiment = useCallback(async (id: string) => {
    if (!window.confirm('Deseja excluir este experimento e todos os seus tratamentos?')) return;
    await db.experiments.delete(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Treatment management (mutations within an experiment)
  // ---------------------------------------------------------------------------

  const addTreatment = useCallback(async (experimentId: string, treatment: Treatment) => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) return;
    await db.experiments.put({
      ...exp,
      treatments: [...exp.treatments, treatment],
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const updateTreatment = useCallback(async (
    experimentId: string,
    treatmentId: string,
    updates: Partial<Treatment>
  ) => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) return;
    await db.experiments.put({
      ...exp,
      treatments: exp.treatments.map(t =>
        t.id === treatmentId ? { ...t, ...updates, id: treatmentId, experimentId } : t
      ),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteTreatment = useCallback(async (experimentId: string, treatmentId: string) => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) return;
    await db.experiments.put({
      ...exp,
      treatments: exp.treatments.filter(t => t.id !== treatmentId),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // ---------------------------------------------------------------------------
  // PlateRun management (add an evaluation day to a treatment)
  // ---------------------------------------------------------------------------

  const addPlateRun = useCallback(async (
    experimentId: string,
    treatmentId: string,
    plateRun: PlateRun
  ) => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) return;
    await db.experiments.put({
      ...exp,
      treatments: exp.treatments.map(t =>
        t.id === treatmentId
          ? { ...t, plates: [...t.plates, plateRun] }
          : t
      ),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const updatePlateRun = useCallback(async (
    experimentId: string,
    treatmentId: string,
    dayIndex: number,
    updates: Partial<PlateRun>
  ) => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) return;
    await db.experiments.put({
      ...exp,
      treatments: exp.treatments.map(t =>
        t.id === treatmentId
          ? {
              ...t,
              plates: t.plates.map(p =>
                p.dayIndex === dayIndex ? { ...p, ...updates } : p
              ),
            }
          : t
      ),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------

  const importExperiments = useCallback(async (imported: Experiment[]) => {
    if (!Array.isArray(imported)) return false;
    try {
      await db.experiments.bulkPut(imported);
      return true;
    } catch (error) {
      console.error('Failed to import experiments:', error);
      return false;
    }
  }, []);

  const exportExperiments = useCallback(async () => {
    return await db.experiments.toArray();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Get a single experiment by ID */
  const getExperiment = useCallback(async (id: string) => {
    return await db.experiments.get(id);
  }, []);

  /** Compute DAP (Dias Após Plantio) from sowingDate and evaluationDate */
  const computeDAP = useCallback((sowingDate: string, evaluationDate: string): number => {
    const sowing = new Date(sowingDate);
    const evaluation = new Date(evaluationDate);
    const diffMs = evaluation.getTime() - sowing.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }, []);

  return {
    experiments,
    addExperiment,
    updateExperiment,
    deleteExperiment,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    addPlateRun,
    updatePlateRun,
    importExperiments,
    exportExperiments,
    getExperiment,
    computeDAP,
  };
}
