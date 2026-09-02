import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Beaker } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Experiment, Treatment, CultureMedium } from '../../types';
import { useExperiments } from '../../hooks/useExperiments';
import { CULTURE_MEDIUM_LABELS } from '../../types';

interface ExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  experiment?: Experiment; // If present, we are editing
  onSave?: () => void;
}

export function ExperimentModal({
  isOpen,
  onClose,
  experiment,
  onSave,
}: ExperimentModalProps) {
  const { addExperiment, updateExperiment } = useExperiments();

  // Form states
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [seedLot, setSeedLot] = useState('');
  const [responsible, setResponsible] = useState('');
  const [institution, setInstitution] = useState('GPEOrq / Unoeste');
  const [sowingDate, setSowingDate] = useState('');
  const [cultureMedia, setCultureMedia] = useState<CultureMedium>('KC');
  const [cultureMediaNotes, setCultureMediaNotes] = useState('');
  const [sterilizationProtocol, setSterilizationProtocol] = useState('');
  const [preconditioningTreatment, setPreconditioningTreatment] = useState('');
  const [seedsPerPlate, setSeedsPerPlate] = useState(100);
  const [replicates, setReplicates] = useState(4);
  const [evaluationDaysInput, setEvaluationDaysInput] = useState('0,14,30,45,60,90');
  const [notes, setNotes] = useState('');
  const [treatments, setTreatments] = useState<Omit<Treatment, 'plates' | 'experimentId'>[]>([]);

  // Load experiment if editing
  useEffect(() => {
    if (experiment) {
      setName(experiment.name);
      setSpecies(experiment.species);
      setSeedLot(experiment.seedLot);
      setResponsible(experiment.responsible);
      setInstitution(experiment.institution);
      setSowingDate(experiment.sowingDate.split('T')[0]);
      setCultureMedia(experiment.cultureMedia);
      setCultureMediaNotes(experiment.cultureMediaNotes || '');
      setSterilizationProtocol(experiment.sterilizationProtocol || '');
      setPreconditioningTreatment(experiment.preconditioningTreatment || '');
      setSeedsPerPlate(experiment.seedsPerPlate);
      setReplicates(experiment.replicates);
      setEvaluationDaysInput(experiment.evaluationDays.join(','));
      setNotes(experiment.notes || '');
      setTreatments(
        experiment.treatments.map(({ id, name, code, description }) => ({
          id,
          name,
          code,
          description,
        }))
      );
    } else {
      // Defaults for new experiment
      setName('');
      setSpecies('');
      setSeedLot('');
      setResponsible('');
      setInstitution('GPEOrq / Unoeste');
      setSowingDate(new Date().toISOString().split('T')[0]);
      setCultureMedia('KC');
      setCultureMediaNotes('');
      setSterilizationProtocol('');
      setPreconditioningTreatment('');
      setSeedsPerPlate(100);
      setReplicates(4);
      setEvaluationDaysInput('0,14,30,45,60,90');
      setNotes('');
      setTreatments([{ id: 't1', code: 'T1', name: 'Controle', description: 'Tratamento controle' }]);
    }
  }, [experiment, isOpen]);

  if (!isOpen) return null;

  const handleAddTreatment = () => {
    const nextIdx = treatments.length + 1;
    setTreatments([
      ...treatments,
      {
        id: `t${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        code: `T${nextIdx}`,
        name: `Tratamento ${nextIdx}`,
        description: '',
      },
    ]);
  };

  const handleRemoveTreatment = (id: string) => {
    if (treatments.length <= 1) {
      alert('O experimento deve conter pelo menos um tratamento.');
      return;
    }
    setTreatments(treatments.filter(t => t.id !== id));
  };

  const handleTreatmentChange = (id: string, field: keyof typeof treatments[0], value: string) => {
    setTreatments(
      treatments.map(t => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !species || !seedLot || !responsible || !sowingDate) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const evaluationDays = evaluationDaysInput
      .split(',')
      .map(day => parseInt(day.trim(), 10))
      .filter(day => !isNaN(day))
      .sort((a, b) => a - b);

    if (evaluationDays.length === 0) {
      alert('Insira pelo menos um dia de avaliação (ex: 0, 14, 30).');
      return;
    }

    const expId = experiment ? experiment.id : `exp_${Date.now()}`;

    const completeTreatments: Treatment[] = treatments.map(t => {
      // Preserve existing plates if editing, otherwise start empty
      const existingTreatment = experiment?.treatments.find(et => et.id === t.id);
      return {
        ...t,
        experimentId: expId,
        plates: existingTreatment ? existingTreatment.plates : [],
      };
    });

    const expData: Experiment = {
      id: expId,
      name,
      species,
      seedLot,
      responsible,
      institution,
      sowingDate,
      cultureMedia,
      cultureMediaNotes: cultureMediaNotes || undefined,
      sterilizationProtocol: sterilizationProtocol || undefined,
      preconditioningTreatment: preconditioningTreatment || undefined,
      seedsPerPlate,
      replicates,
      evaluationDays,
      treatments: completeTreatments,
      notes: notes || undefined,
      createdAt: experiment ? experiment.createdAt : new Date().toISOString(),
      updatedAt: experiment ? new Date().toISOString() : undefined,
    };

    if (experiment) {
      await updateExperiment(experiment.id, expData);
    } else {
      await addExperiment(expData);
    }

    if (onSave) onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/80 dark:bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white dark:bg-[#18181B] flex flex-col rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-neutral-200 dark:border-zinc-800 transition-all duration-300"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-xl text-purple-600 dark:text-purple-400 shadow-inner">
              <Beaker size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-neutral-800 dark:text-zinc-100 uppercase tracking-wide">
                {experiment ? 'Editar Experimento' : 'Novo Experimento'}
              </h2>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                GPEOrq / Unoeste • Lab. de Sementes e Tecido Vegetal
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
          {/* Row 1: Name & Species */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Nome do Experimento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Germinação de Cattleya labiata — Ensaio Luz"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Espécie (Nome científico) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={species}
                onChange={e => setSpecies(e.target.value)}
                placeholder="Ex: Cattleya labiata"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 italic"
              />
            </div>
          </div>

          {/* Row 2: Lot, Responsible, Institution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Identificador do Lote de Sementes <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={seedLot}
                onChange={e => setSeedLot(e.target.value)}
                placeholder="Ex: CL-2024-03"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Pesquisador Responsável <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                placeholder="Ex: Dr. Nelson Barbosa Machado Neto"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Instituição
              </label>
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ex: GPEOrq / Unoeste"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Row 3: Sowing, Culture Media */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Data de Semeadura <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={sowingDate}
                onChange={e => setSowingDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Meio de Cultura base
              </label>
              <select
                value={cultureMedia}
                onChange={e => setCultureMedia(e.target.value as CultureMedium)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {Object.entries(CULTURE_MEDIUM_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Aditivos/Notas do Meio
              </label>
              <input
                type="text"
                value={cultureMediaNotes}
                onChange={e => setCultureMediaNotes(e.target.value)}
                placeholder="Ex: Sacarose 20g/L + Carvão 2g/L"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Row 4: Protocols */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Protocolo de Assepsia / Esterilização
              </label>
              <input
                type="text"
                value={sterilizationProtocol}
                onChange={e => setSterilizationProtocol(e.target.value)}
                placeholder="Ex: NaOCl 1% por 10 min + lavagens"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Tratamento Pré-condicionante
              </label>
              <input
                type="text"
                value={preconditioningTreatment}
                onChange={e => setPreconditioningTreatment(e.target.value)}
                placeholder="Ex: Hidratação em água destilada 24h"
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Row 5: Replicates, Seeds, Evaluation Days */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Alvo de sementes / placa
              </label>
              <input
                type="number"
                value={seedsPerPlate}
                onChange={e => setSeedsPerPlate(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
                Repetições por tratamento (Placas)
              </label>
              <input
                type="number"
                value={replicates}
                onChange={e => setReplicates(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5" title="Dias após a semeadura em que ocorrem as avaliações">
                Dias de Avaliação (DAP) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={evaluationDaysInput}
                onChange={e => setEvaluationDaysInput(e.target.value)}
                placeholder="Ex: 0,14,30,45,60,90"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Treatments Section */}
          <div className="border-t border-neutral-200 dark:border-zinc-800 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                Tratamentos do Experimento
              </h3>
              <button
                type="button"
                onClick={handleAddTreatment}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-all"
              >
                <Plus size={14} /> Adicionar Tratamento
              </button>
            </div>

            <div className="space-y-3">
              {treatments.map((t, idx) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row gap-3 p-4 bg-neutral-50 dark:bg-zinc-900/50 border border-neutral-200 dark:border-zinc-850 rounded-2xl relative"
                >
                  <div className="w-full sm:w-20">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase mb-1">
                      Código
                    </label>
                    <input
                      type="text"
                      value={t.code}
                      onChange={e => handleTreatmentChange(t.id, 'code', e.target.value)}
                      required
                      placeholder="Ex: T1"
                      className="w-full px-2 py-1.5 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-sm text-neutral-800 dark:text-zinc-100 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase mb-1">
                      Nome Descritivo
                    </label>
                    <input
                      type="text"
                      value={t.name}
                      onChange={e => handleTreatmentChange(t.id, 'name', e.target.value)}
                      required
                      placeholder="Ex: Knudson C + Sacarose 2%"
                      className="w-full px-3 py-1.5 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase mb-1">
                      Descrição Adicional
                    </label>
                    <input
                      type="text"
                      value={t.description || ''}
                      onChange={e => handleTreatmentChange(t.id, 'description', e.target.value)}
                      placeholder="Ex: Sem luz nas primeiras 2 semanas"
                      className="w-full px-3 py-1.5 border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg text-sm text-neutral-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-end justify-end sm:justify-start">
                    <button
                      type="button"
                      onClick={() => handleRemoveTreatment(t.id)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">
              Observações Adicionais do Experimento
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descreva observações gerais de ambiente, condições de câmara de crescimento (fotoperíodo, irradiância, temperatura)..."
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
            className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-purple-500/20"
          >
            <Save size={14} />
            Salvar Experimento
          </button>
        </div>
      </motion.div>
    </div>
  );
}
