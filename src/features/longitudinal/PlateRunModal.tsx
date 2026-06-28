import React, { useState, useEffect } from 'react';
import { X, Save, Link2, Check, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import type { Experiment, PlateRun, ProtocormStage, ContaminationType, PlateStatus, Session } from '../../types';
import { useExperiments } from '../../hooks/useExperiments';
import { PROTOCORM_STAGE_LABELS, CONTAMINATION_LABELS, PLATE_STATUS_LABELS } from '../../types';

interface PlateRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  experiment: Experiment;
  plateRun?: PlateRun;      // If provided, we are editing
  treatmentId?: string;     // If provided, preselected treatment
  sessions: Session[];      // Available count sessions to link
  onSave?: () => void;
}

export function PlateRunModal({
  isOpen,
  onClose,
  experiment,
  plateRun,
  treatmentId: initialTreatmentId,
  sessions,
  onSave,
}: PlateRunModalProps) {
  const { addPlateRun, updatePlateRun, computeDAP } = useExperiments();

  // Form states
  const [selectedTreatmentId, setSelectedTreatmentId] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [evaluationDate, setEvaluationDate] = useState('');
  const [totalSeeds, setTotalSeeds] = useState(100);
  const [germinatedSeeds, setGerminatedSeeds] = useState(0);
  const [stages, setStages] = useState<Record<ProtocormStage, number>>({
    0: 100,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  });
  const [contamination, setContamination] = useState<ContaminationType>('none');
  const [status, setStatus] = useState<PlateStatus>('active');
  const [observerName, setObserverName] = useState('');
  const [linkedSessionId, setLinkedSessionId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  // Show session selector
  const [showSessionSelector, setShowSessionSelector] = useState(false);

  // Load defaults or edit values
  useEffect(() => {
    if (plateRun) {
      // Find treatment that has this plateRun
      const tx = experiment.treatments.find(t =>
        t.plates.some(p => p.dayIndex === plateRun.dayIndex && p.evaluationDate === plateRun.evaluationDate)
      );
      setSelectedTreatmentId(tx ? tx.id : experiment.treatments[0]?.id || '');
      setDayIndex(plateRun.dayIndex);
      setEvaluationDate(plateRun.evaluationDate.split('T')[0]);
      setTotalSeeds(plateRun.totalSeeds);
      setGerminatedSeeds(plateRun.germinatedSeeds);
      setStages({
        0: plateRun.stageDistribution[0] || 0,
        1: plateRun.stageDistribution[1] || 0,
        2: plateRun.stageDistribution[2] || 0,
        3: plateRun.stageDistribution[3] || 0,
        4: plateRun.stageDistribution[4] || 0,
        5: plateRun.stageDistribution[5] || 0,
        6: plateRun.stageDistribution[6] || 0,
      });
      setContamination(plateRun.contamination);
      setStatus(plateRun.status);
      setObserverName(plateRun.observerName || '');
      setLinkedSessionId(plateRun.sessionId);
      setNotes(plateRun.notes || '');
    } else {
      setSelectedTreatmentId(initialTreatmentId || experiment.treatments[0]?.id || '');
      const todayStr = new Date().toISOString().split('T')[0];
      setEvaluationDate(todayStr);
      setDayIndex(computeDAP(experiment.sowingDate, todayStr));
      setTotalSeeds(experiment.seedsPerPlate || 100);
      setGerminatedSeeds(0);
      setStages({
        0: experiment.seedsPerPlate || 100,
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
      });
      setContamination('none');
      setStatus('active');
      setObserverName(experiment.responsible || '');
      setLinkedSessionId(undefined);
      setNotes('');
    }
    setShowSessionSelector(false);
  }, [plateRun, experiment, isOpen, initialTreatmentId]);

  // Recalculate DAP when evaluationDate changes
  const handleDateChange = (dateStr: string) => {
    setEvaluationDate(dateStr);
    if (experiment.sowingDate) {
      setDayIndex(computeDAP(experiment.sowingDate, dateStr));
    }
  };

  // Stage updates helper
  const handleStageChange = (stage: ProtocormStage, value: number) => {
    const val = Math.max(0, value);
    const newStages = { ...stages, [stage]: val };
    setStages(newStages);

    // Recompute total and germinated seeds
    const newTotal = (Object.values(newStages) as number[]).reduce((a, b) => a + b, 0);
    const newGerminated = (Object.entries(newStages) as [string, number][])
      .filter(([st]) => st !== '0')
      .reduce((a, [, b]) => a + b, 0);

    setTotalSeeds(newTotal);
    setGerminatedSeeds(newGerminated);
  };

  // Link selected session
  const handleLinkSession = (session: Session) => {
    setLinkedSessionId(session.id);
    const germ = session.viableCount;
    const inv = session.inviableCount;
    const tot = germ + inv;

    setTotalSeeds(tot);
    setGerminatedSeeds(germ);
    setStages({
      0: inv,
      1: germ, // Default all germinated seeds to Stage 1, researcher can distribute manually
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    });

    if (session.metadata.researcher) {
      setObserverName(session.metadata.researcher);
    }
    if (session.metadata.notes) {
      setNotes(prev => (prev ? `${prev}\n[Sessão vinculada]: ${session.metadata.notes}` : `[Sessão vinculada]: ${session.metadata.notes}`));
    }
    setShowSessionSelector(false);
  };

  const handleUnlinkSession = () => {
    setLinkedSessionId(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTreatmentId || !evaluationDate) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Verify stages sum matches total seeds
    const stageSum = (Object.values(stages) as number[]).reduce((a, b) => a + b, 0);
    if (stageSum !== totalSeeds) {
      if (!window.confirm(`A soma das sementes nos estágios (${stageSum}) é diferente do total informado (${totalSeeds}). Deseja ajustar o total automaticamente?`)) {
        return;
      }
      setTotalSeeds(stageSum);
    }

    const runData: PlateRun = {
      sessionId: linkedSessionId,
      dayIndex,
      evaluationDate,
      totalSeeds,
      germinatedSeeds,
      stageDistribution: stages,
      contamination,
      status,
      observerName: observerName || undefined,
      notes: notes || undefined,
    };

    if (plateRun) {
      // Find the old treatment where this was located and edit it
      // In this v3 hook, we update by experimentId, treatmentId, dayIndex
      await updatePlateRun(experiment.id, selectedTreatmentId, plateRun.dayIndex, runData);
    } else {
      await addPlateRun(experiment.id, selectedTreatmentId, runData);
    }

    // Also link the session database entry back to this experiment
    if (linkedSessionId) {
      // Find the linked session and update its experimentId / treatmentId
      const session = sessions.find(s => s.id === linkedSessionId);
      if (session) {
        import('../../lib/db').then(({ db }) => {
          db.sessions.update(linkedSessionId, {
            experimentId: experiment.id,
            treatmentId: selectedTreatmentId,
            dayIndex: dayIndex,
          });
        });
      }
    }

    if (onSave) onSave();
    onClose();
  };

  // Find linked session if any
  const linkedSession = sessions.find(s => s.id === linkedSessionId);

  // Filter sessions that can be linked (not already linked, or matches current)
  const linkableSessions = sessions.filter(
    s => !s.experimentId || s.experimentId === experiment.id || s.id === linkedSessionId
  );

  return (
    <div className="fixed inset-0 bg-neutral-900/80 dark:bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white dark:bg-[#18181B] flex flex-col rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-neutral-200 dark:border-zinc-800 transition-all duration-300"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-450 shadow-inner">
              <Link2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-neutral-800 dark:text-zinc-100 uppercase tracking-wide">
                {plateRun ? 'Editar Avaliação' : 'Registrar Avaliação'}
              </h2>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                {experiment.name} • {experiment.species}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Linked Session Info */}
          <div className="bg-neutral-50 dark:bg-zinc-900/50 border border-neutral-200 dark:border-zinc-800 p-4 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider">
                Vincular Sessão de Contagem (YOLO/Manual)
              </h3>
              {linkedSessionId ? (
                <button
                  type="button"
                  onClick={handleUnlinkSession}
                  className="text-[10px] text-red-500 hover:underline font-bold uppercase tracking-wider"
                >
                  Desvincular
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSessionSelector(true)}
                  className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-bold uppercase tracking-wider"
                >
                  <Link2 size={12} /> Vincular Sessão
                </button>
              )}
            </div>

            {linkedSession ? (
              <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/30 p-3 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-zinc-200">
                    {linkedSession.filename}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium">
                    Data: {new Date(linkedSession.date).toLocaleString('pt-BR')} • {linkedSession.viableCount} Viáveis / {linkedSession.inviableCount} Inviáveis
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider">
                  <Check size={12} /> Vinculado
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 dark:text-zinc-500 font-medium">
                Nenhuma imagem ou contagem do aplicativo vinculada a esta avaliação. Os dados podem ser inseridos de forma totalmente manual abaixo.
              </p>
            )}
          </div>

          {/* Session Selector Drawer */}
          {showSessionSelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-neutral-200 dark:border-zinc-800 p-4 rounded-2xl bg-neutral-100/50 dark:bg-zinc-900 space-y-3"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-neutral-600 dark:text-zinc-400 uppercase">
                  Selecione uma Contagem Recente
                </span>
                <button
                  type="button"
                  onClick={() => setShowSessionSelector(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200"
                >
                  Fechar
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {linkableSessions.length === 0 ? (
                  <p className="text-xs text-neutral-400 dark:text-zinc-600 text-center py-4 font-semibold">
                    Nenhuma contagem disponível para vincular.
                  </p>
                ) : (
                  linkableSessions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleLinkSession(s)}
                      className="w-full text-left p-2.5 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-750 hover:border-purple-400 hover:ring-1 hover:ring-purple-400 rounded-xl text-xs flex justify-between items-center transition-all"
                    >
                      <div>
                        <span className="font-semibold text-neutral-800 dark:text-zinc-200 block truncate max-w-xs sm:max-w-md">
                          {s.filename}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-zinc-500">
                          {new Date(s.date).toLocaleDateString('pt-BR')} • {s.metadata.treatment || 'S/ Tratamento'}
                        </span>
                      </div>
                      <div className="font-bold text-neutral-700 dark:text-zinc-300">
                        {s.viableCount + s.inviableCount} sementes ({s.viableCount} viáveis)
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Form Fields: Treatment, Date, DAP, Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Tratamento <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTreatmentId}
                onChange={e => setSelectedTreatmentId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {experiment.treatments.map(t => (
                  <option key={t.id} value={t.id}>
                    [{t.code}] {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Data da Avaliação <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={evaluationDate}
                onChange={e => handleDateChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                DAP (Dias Após Plantio)
              </label>
              <input
                type="number"
                value={dayIndex}
                onChange={e => setDayIndex(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              />
            </div>
          </div>

          {/* Section: Stage Distribution (0-6) */}
          <div className="border-t border-neutral-200 dark:border-zinc-800 pt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider">
                Distribuição por Estágios de Desenvolvimento (Arditti Scale)
              </h3>
              <span className="text-xs text-neutral-400 dark:text-zinc-500 font-semibold">
                Total sementes: {totalSeeds} • Germinadas (Estágio ≥ 1): {germinatedSeeds}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {(Object.keys(stages) as string[]).map(stageKey => {
                const stageNum = parseInt(stageKey, 10) as ProtocormStage;
                return (
                  <div
                    key={stageKey}
                    className="p-3 bg-neutral-50 dark:bg-zinc-900/50 border border-neutral-200 dark:border-zinc-850 rounded-2xl flex flex-col items-center"
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-2 ${
                        stageNum === 0
                          ? 'bg-neutral-200 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400'
                          : stageNum === 1
                          ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400'
                          : stageNum === 2 || stageNum === 3
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450'
                          : 'bg-emerald-600 text-white shadow-sm'
                      }`}
                      title={PROTOCORM_STAGE_LABELS[stageNum]}
                    >
                      E{stageNum}
                    </span>
                    <input
                      type="number"
                      value={stages[stageNum]}
                      onChange={e => handleStageChange(stageNum, parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center px-1 py-1 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-xs text-neutral-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-neutral-400 dark:text-zinc-500 mt-2 font-medium">
              * E0: sementes não alteradas / inviáveis. E1: semente intumescida com embrião verde (ruptura da testa). E2+: estágios de formação de protocormo globular e plântula.
            </p>
          </div>

          {/* Section: Contamination, Status, Observer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-neutral-200 dark:border-zinc-800 pt-6">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Contaminação Visual
              </label>
              <select
                value={contamination}
                onChange={e => setContamination(e.target.value as ContaminationType)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(CONTAMINATION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Status Operacional da Placa
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as PlateStatus)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(PLATE_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Avaliador / Observador
              </label>
              <input
                type="text"
                value={observerName}
                onChange={e => setObserverName(e.target.value)}
                placeholder="Ex: Profa. Ceci Custódio"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
              Observações da Avaliação
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Formação de colônias brancas isoladas, protocormos saudáveis..."
              className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end items-center gap-2 px-6 py-4 border-t border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
          >
            <Save size={14} />
            Salvar Avaliação
          </button>
        </div>
      </motion.div>
    </div>
  );
}
