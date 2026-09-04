import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
} from 'recharts';
import {
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  ChevronDown,
  CalendarDays,
  Microscope,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import type { Experiment, Treatment, PlateRun, ProtocormStage } from '../../types';
import { CONTAMINATION_LABELS, PLATE_STATUS_LABELS, PROTOCORM_STAGE_LABELS } from '../../types';
import { useExperiments } from '../../hooks/useExperiments';
import { MOTIVO_SEM_INDICES_DE_VIGOR, rotulosDoEixo } from '../../lib/time-axis';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TREATMENT_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
];

const STAGE_COLORS: Record<ProtocormStage, string> = {
  0: '#9ca3af', // gray-400
  1: '#fde68a', // yellow-200
  2: '#86efac', // green-300
  3: '#4ade80', // green-400
  4: '#22c55e', // green-500
  5: '#16a34a', // green-600
  6: '#166534', // green-800
};

const STAGE_LABELS_SHORT: Record<ProtocormStage, string> = {
  0: 'Est. 0',
  1: 'Est. 1',
  2: 'Est. 2',
  3: 'Est. 3',
  4: 'Est. 4',
  5: 'Est. 5',
  6: 'Est. 6+',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcGerminationPct(run: PlateRun): number {
  if (!run.totalSeeds || run.totalSeeds === 0) return 0;
  return Math.round((run.germinatedSeeds / run.totalSeeds) * 1000) / 10;
}

function calcIVG(treatment: Treatment): number {
  // Índice de Velocidade de Germinação (Maguire, 1962)
  // IVG = Σ (Ni / Di) where Ni = germinated on day i, Di = day i
  let ivg = 0;
  let prevGerminated = 0;
  const sortedPlates = [...treatment.plates].sort((a, b) => a.dayIndex - b.dayIndex);
  for (const plate of sortedPlates) {
    if (plate.dayIndex > 0 && plate.germinatedSeeds > prevGerminated) {
      const newGerminated = plate.germinatedSeeds - prevGerminated;
      ivg += newGerminated / plate.dayIndex;
    }
    prevGerminated = plate.germinatedSeeds;
  }
  return Math.round(ivg * 100) / 100;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LongitudinalViewProps {
  onCreateExperiment: () => void;
  onEditExperiment: (experiment: Experiment) => void;
  onAddPlateRun: (experimentId: string, treatmentId: string, existingRun?: PlateRun) => void;
  onViewSession: (sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface ChartTooltipPayload {
  name: string;
  value: number;
  color: string;
  payload: {
    dap: number;
    [key: string]: number | string;
  };
}

function GerminationTooltip({
  active,
  payload,
  label,
  experiment,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: number;
  experiment: Experiment | null;
}) {
  if (!active || !payload?.length || !experiment) return null;

  return (
    <div className="bg-surface-1 border border-line rounded-xl shadow-xl p-3 min-w-[200px]">
      <div className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-2">
        {rotulosDoEixo(experiment).prefixo} {label} dias
      </div>
      {payload.map((entry, i) => {
        const treatment = experiment.treatments.find(
          (t) => t.code === entry.name || t.name === entry.name
        );
        // IVG so descreve a mesma placa reavaliada. Em armazenamento cada
        // data e uma amostra nova: o numero existiria sem significar nada.
        const mostraIvg = rotulosDoEixo(experiment).aplicaIndicesDeVigor;
        const ivg = treatment && mostraIvg ? calcIVG(treatment) : 0;
        return (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <div className="flex-1">
              <div className="text-xs font-bold text-ink-1">{entry.name}</div>
              <div className="text-[10px] text-ink-3">
                <span className="font-mono text-accent">{entry.value}%</span>
                {mostraIvg && (
                  <>
                    {' · IVG: '}
                    <span className="font-mono">{ivg}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Table
// ---------------------------------------------------------------------------

function GerminationTable({
  experiment,
  selectedTreatmentId,
}: {
  experiment: Experiment;
  selectedTreatmentId: string | null;
}) {
  const eixo = rotulosDoEixo(experiment);
  const allDays = useMemo(() => {
    const days = new Set<number>();
    experiment.evaluationDays.forEach((d) => days.add(d));
    experiment.treatments.forEach((t) => t.plates.forEach((p) => days.add(p.dayIndex)));
    return [...days].sort((a, b) => a - b);
  }, [experiment]);

  if (allDays.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-ink-3">
        Nenhum dado de avaliação registrado ainda.
      </div>
    );
  }

  const filteredTreatments = selectedTreatmentId
    ? experiment.treatments.filter((t) => t.id === selectedTreatmentId)
    : experiment.treatments;

  // Precompute plate lookups by treatment ID and dayIndex to avoid O(N) finds in nested loops
  const plateByDayPerTreatment = new Map();
  filteredTreatments.forEach((t) => {
    const tMap = new Map();
    t.plates.forEach((p) => tMap.set(p.dayIndex, p));
    plateByDayPerTreatment.set(t.id, tMap);
  });

  // Find the highest germination % per column (day)
  const maxByDay: Record<number, number> = {};
  allDays.forEach((day) => {
    let max = 0;
    filteredTreatments.forEach((t) => {
      const run = plateByDayPerTreatment.get(t.id)?.get(day);
      if (run) {
        const pct = calcGerminationPct(run);
        if (pct > max) max = pct;
      }
    });
    maxByDay[day] = max;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <thead className="bg-surface-2 border-b border-line text-ink-3 uppercase text-[9px] font-bold tracking-widest">
          <tr>
            <th className="px-4 py-3 sticky left-0 bg-surface-2 z-10">Tratamento</th>
            {allDays.map((day) => (
              <th key={day} className="px-3 py-3 text-center">
                {eixo.prefixo} {day}
              </th>
            ))}
            {eixo.aplicaIndicesDeVigor && <th className="px-3 py-3 text-center">IVG</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {filteredTreatments.map((treatment, ti) => {
            const ivg = calcIVG(treatment);
            return (
              <tr key={treatment.id} className="hover:bg-surface-2/50 transition-colors">
                <td className="px-4 py-2.5 sticky left-0 bg-surface-1 z-10">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: TREATMENT_COLORS[ti % TREATMENT_COLORS.length] }}
                    />
                    <div>
                      <div className="font-bold text-ink-1">{treatment.code}</div>
                      <div className="text-[10px] text-ink-3 truncate max-w-[160px]">
                        {treatment.name}
                      </div>
                    </div>
                  </div>
                </td>
                {allDays.map((day) => {
                  const run = plateByDayPerTreatment.get(treatment.id)?.get(day);
                  const pct = run ? calcGerminationPct(run) : null;
                  const isHighest = pct !== null && pct > 0 && pct === maxByDay[day];
                  return (
                    <td key={day} className="px-3 py-2.5 text-center">
                      {pct !== null ? (
                        <span
                          className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                            isHighest ? 'bg-accent-tint text-accent' : 'text-ink-2'
                          }`}
                        >
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center font-mono font-bold text-xs text-ink-2">
                  {ivg > 0 ? ivg : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plate runs list per treatment
// ---------------------------------------------------------------------------

function PlateRunsList({
  treatment,
  experimentId,
  prefixoDoEixo,
  onAddPlateRun,
  onViewSession,
}: {
  treatment: Treatment;
  experimentId: string;
  /** "DAP" ou "Arm." — o que o dayIndex mede neste experimento. */
  prefixoDoEixo: string;
  onAddPlateRun: (experimentId: string, treatmentId: string, existingRun?: PlateRun) => void;
  onViewSession: (sessionId: string) => void;
}) {
  if (treatment.plates.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-ink-3 italic">
        Nenhuma avaliação registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {[...treatment.plates]
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((run, i) => {
          const pct = calcGerminationPct(run);
          const hasContamination = run.contamination !== 'none';
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-lg border border-line-soft hover:border-accent/30 transition-all group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-bold font-mono bg-surface-2 text-ink-2 px-2 py-0.5 rounded">
                  {prefixoDoEixo} {run.dayIndex}
                </span>
                <span className="text-[10px] text-ink-3">
                  {new Date(run.evaluationDate).toLocaleDateString('pt-BR')}
                </span>
                <span className="font-mono font-bold text-xs text-accent">{pct}%</span>
                <span className="text-[10px] text-ink-3">
                  ({run.germinatedSeeds}/{run.totalSeeds})
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Contamination badge */}
                {hasContamination && (
                  <span
                    className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
                    title={CONTAMINATION_LABELS[run.contamination]}
                  >
                    <AlertTriangle size={9} />
                    {run.contamination}
                  </span>
                )}

                {/* Plate status */}
                {run.status !== 'active' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                    {PLATE_STATUS_LABELS[run.status]}
                  </span>
                )}

                {/* Ver foto button */}
                {run.sessionId && (
                  <button
                    onClick={() => onViewSession(run.sessionId!)}
                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-accent-tint text-accent border border-accent/30 rounded hover:bg-accent-tint transition-colors cursor-pointer"
                    title="Ver foto desta avaliação"
                  >
                    <ImageIcon size={10} />
                    <span>Ver foto</span>
                  </button>
                )}

                {/* Edit run */}
                <button
                  onClick={() => onAddPlateRun(experimentId, treatment.id, run)}
                  className="p-1 text-ink-3 hover:text-accent hover:bg-accent-tint rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Editar avaliação"
                >
                  <Pencil size={12} />
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LongitudinalView({
  onCreateExperiment,
  onEditExperiment,
  onAddPlateRun,
  onViewSession,
}: LongitudinalViewProps) {
  const { experiments, deleteExperiment } = useExperiments();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const [selectedDap, setSelectedDap] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'stages' | 'table' | 'runs'>('chart');

  const selectedExperiment = useMemo(
    () => experiments.find((e) => e.id === selectedExperimentId) ?? null,
    [experiments, selectedExperimentId]
  );

  /** DAP ou dias de armazenamento — decide rotulo e o que faz sentido calcular. */
  const eixoDoTempo = useMemo(() => rotulosDoEixo(selectedExperiment), [selectedExperiment]);

  // Auto-select first experiment when list loads
  React.useEffect(() => {
    if (!selectedExperimentId && experiments.length > 0) {
      setSelectedExperimentId(experiments[0].id);
    }
  }, [experiments, selectedExperimentId]);

  // Auto-select last DAP when experiment changes
  React.useEffect(() => {
    if (selectedExperiment) {
      const allDaps = new Set<number>();
      selectedExperiment.treatments.forEach((t) =>
        t.plates.forEach((p) => allDaps.add(p.dayIndex))
      );
      const sorted = [...allDaps].sort((a, b) => b - a);
      setSelectedDap(sorted[0] ?? null);
      setSelectedTreatmentId(null);
    }
  }, [selectedExperiment?.id]);

  // ── Germination curve data ─────────────────────────────────────────────
  const germinationCurveData = useMemo(() => {
    if (!selectedExperiment) return [];
    const allDays = new Set<number>();
    selectedExperiment.evaluationDays.forEach((d) => allDays.add(d));

    // Precompute map for O(1) lookups: treatment.code -> (dayIndex -> run)
    const platesByTreatmentAndDay = new Map();
    selectedExperiment.treatments.forEach((t) => {
      const tMap = new Map();
      t.plates.forEach((p) => {
        allDays.add(p.dayIndex);
        tMap.set(p.dayIndex, p);
      });
      platesByTreatmentAndDay.set(t.code, tMap);
    });

    const days = [...allDays].sort((a, b) => a - b);

    return days.map((day) => {
      const point: Record<string, number | string> = { dap: day };
      platesByTreatmentAndDay.forEach((tMap, tCode) => {
        const run = tMap.get(day);
        point[tCode] = run ? calcGerminationPct(run) : 0;
      });
      return point;
    });
  }, [selectedExperiment]);

  // ── Stage distribution data at selected DAP ───────────────────────────
  const stageData = useMemo(() => {
    if (!selectedExperiment || selectedDap === null) return [];

    const treatmentsToShow = selectedTreatmentId
      ? selectedExperiment.treatments.filter((t) => t.id === selectedTreatmentId)
      : selectedExperiment.treatments;

    // Build map for quick lookup
    const plateByTreatment = new Map<string, PlateRun | undefined>(
      treatmentsToShow.map((t) => {
        return [t.id, t.plates.find((p) => p.dayIndex === selectedDap)];
      })
    );

    return treatmentsToShow.map((t) => {
      const run = plateByTreatment.get(t.id);
      const total = run?.totalSeeds || 1;
      const point: Record<string, number | string> = { treatment: t.code };
      for (let stage = 0; stage <= 6; stage++) {
        const count = run?.stageDistribution[stage as ProtocormStage] ?? 0;
        point[`Est.${stage}`] = Math.round((count / total) * 1000) / 10;
      }
      return point;
    });
  }, [selectedExperiment, selectedDap, selectedTreatmentId]);

  const hasData =
    selectedExperiment && selectedExperiment.treatments.some((t) => t.plates.length > 0);

  // ────────────────────────────────────────────────────────────────────────
  // Empty state
  // ────────────────────────────────────────────────────────────────────────
  if (experiments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-16 text-center">
        <div className="w-16 h-16 bg-accent-tint rounded-2xl flex items-center justify-center">
          <FlaskConical size={32} className="text-accent" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-ink-1">Nenhum Experimento Registrado</h2>
          <p className="text-sm text-ink-3 max-w-sm">
            Crie o primeiro experimento longitudinal para rastrear a germinação de sementes ao longo
            do tempo.
          </p>
        </div>
        <button
          onClick={onCreateExperiment}
          className="flex items-center gap-2 bg-accent hover:bg-accent-strong text-accent-on px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Criar Primeiro Experimento
        </button>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Main layout
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-line bg-surface-2 shrink-0">
        {/* Experiment selector */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
            Experimento
          </label>
          <div className="relative">
            <select
              value={selectedExperimentId ?? ''}
              onChange={(e) => setSelectedExperimentId(e.target.value || null)}
              className="appearance-none bg-surface-1 border border-line text-ink-1 text-xs font-semibold px-3 py-1.5 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            >
              {experiments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
          </div>
        </div>

        {/* Treatment filter */}
        {selectedExperiment && selectedExperiment.treatments.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
              Tratamento
            </label>
            <div className="relative">
              <select
                value={selectedTreatmentId ?? ''}
                onChange={(e) => setSelectedTreatmentId(e.target.value || null)}
                className="appearance-none bg-surface-1 border border-line text-ink-1 text-xs font-semibold px-3 py-1.5 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                <option value="">Todos</option>
                {selectedExperiment.treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* DAP selector for stage chart */}
        {hasData && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
              Ponto ({eixoDoTempo.prefixo})
            </label>
            <div className="relative">
              <select
                value={selectedDap ?? ''}
                onChange={(e) => setSelectedDap(e.target.value ? Number(e.target.value) : null)}
                className="appearance-none bg-surface-1 border border-line text-ink-1 text-xs font-semibold px-3 py-1.5 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
              >
                {selectedExperiment &&
                  (() => {
                    const allDaps = new Set<number>();
                    selectedExperiment.treatments.forEach((t) =>
                      t.plates.forEach((p) => allDaps.add(p.dayIndex))
                    );
                    return [...allDaps]
                      .sort((a, b) => a - b)
                      .map((d) => (
                        <option key={d} value={d}>
                          {eixoDoTempo.prefixo} {d}
                        </option>
                      ));
                  })()}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
              />
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Action buttons */}
        {selectedExperiment && (
          <>
            <button
              onClick={() =>
                onAddPlateRun(
                  selectedExperiment.id,
                  selectedTreatmentId ?? selectedExperiment.treatments[0]?.id ?? ''
                )
              }
              disabled={selectedExperiment.treatments.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus size={12} />
              Avaliação
            </button>
            <button
              onClick={() => onEditExperiment(selectedExperiment)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Pencil size={12} />
              Editar
            </button>
            <button
              onClick={() => deleteExperiment(selectedExperiment.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-ink-3 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}

        <button
          onClick={onCreateExperiment}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-accent-strong text-accent-on rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
        >
          <Plus size={12} />
          Novo Experimento
        </button>
      </div>

      {/* ── Experiment info banner ────────────────────────────────────────── */}
      {selectedExperiment && (
        <div className="px-6 py-3 border-b border-line bg-surface-1 shrink-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div className="flex items-center gap-1.5">
              <Microscope size={13} className="text-accent" />
              <span className="text-xs font-bold italic text-ink-2">
                {selectedExperiment.species}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-ink-3" />
              <span className="text-[11px] text-ink-3">
                Semeadura:{' '}
                <span className="font-semibold">
                  {new Date(selectedExperiment.sowingDate).toLocaleDateString('pt-BR')}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-ink-3" />
              <span className="text-[11px] text-ink-3">
                Meio: <span className="font-semibold">{selectedExperiment.cultureMedia}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClipboardList size={13} className="text-ink-3" />
              <span className="text-[11px] text-ink-3">
                {selectedExperiment.treatments.length} tratamento(s) · Lote:{' '}
                <span className="font-mono font-semibold">{selectedExperiment.seedLot}</span>
              </span>
            </div>
            <span className="text-[11px] text-ink-3">
              {selectedExperiment.responsible} · {selectedExperiment.institution}
            </span>
          </div>
        </div>
      )}

      {/* ── Tab selector ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-line shrink-0 bg-surface-1">
        {(
          [
            { key: 'chart', label: 'Curva de Germinação', icon: '📈' },
            { key: 'stages', label: 'Distribuição de Estágios', icon: '🔬' },
            { key: 'table', label: 'Tabela de Dados', icon: '📊' },
            { key: 'runs', label: 'Avaliações por Placa', icon: '🧫' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border-b-2 ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 bg-surface-1">
        {!selectedExperiment ? (
          <div className="flex items-center justify-center h-full text-ink-3 text-sm">
            Selecione um experimento acima.
          </div>
        ) : !hasData && activeTab !== 'runs' ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center">
              <FlaskConical size={24} className="text-ink-3" />
            </div>
            <div>
              <p className="font-bold text-ink-2 text-sm">Nenhum dado de avaliação</p>
              <p className="text-xs text-ink-3 mt-1 max-w-sm">
                Adicione avaliações de placa clicando em "+ Avaliação" acima para começar a rastrear
                a germinação.
              </p>
            </div>
            <button
              onClick={() =>
                onAddPlateRun(
                  selectedExperiment.id,
                  selectedTreatmentId ?? selectedExperiment.treatments[0]?.id ?? ''
                )
              }
              disabled={selectedExperiment.treatments.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-strong text-accent-on rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            >
              <Plus size={13} />
              Registrar Primeira Avaliação
            </button>
          </div>
        ) : (
          <>
            {/* ── Germination curve chart ─── */}
            {activeTab === 'chart' && (
              <div className="space-y-4">
                <div className="bg-surface-1 rounded-2xl border border-line p-4 shadow-sm">
                  <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-4">
                    {eixoDoTempo.aplicaIndicesDeVigor
                      ? '% Germinação Acumulada por Tratamento'
                      : '% Germinação por Tratamento ao Longo do Armazenamento'}
                  </h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                      data={germinationCurveData}
                      margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" />
                      <XAxis
                        dataKey="dap"
                        tickFormatter={(v) => `${eixoDoTempo.prefixo} ${v}`}
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                        label={{
                          value: eixoDoTempo.eixo,
                          position: 'insideBottom',
                          offset: -4,
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                        width={48}
                      />
                      <Tooltip content={<GerminationTooltip experiment={selectedExperiment} />} />
                      <Legend
                        wrapperStyle={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      />
                      {(selectedTreatmentId
                        ? selectedExperiment.treatments.filter((t) => t.id === selectedTreatmentId)
                        : selectedExperiment.treatments
                      ).map((treatment, i) => (
                        <Line
                          key={treatment.id}
                          type="monotone"
                          dataKey={treatment.code}
                          stroke={TREATMENT_COLORS[i % TREATMENT_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Stage distribution chart ─── */}
            {activeTab === 'stages' && (
              <div className="space-y-4">
                <div className="bg-surface-1 rounded-2xl border border-line p-4 shadow-sm">
                  <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1">
                    Distribuição de Estágios Protocórmicos — {eixoDoTempo.prefixo}{' '}
                    {selectedDap ?? '—'}
                  </h3>
                  <p className="text-[10px] text-ink-3 mb-4">
                    Arditti (1967) adaptado pelo Lab. GPEOrq
                  </p>

                  {stageData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-ink-3 text-xs">
                      Selecione um ponto de avaliação ({eixoDoTempo.prefixo}) com dados
                      registrados.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={stageData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(150,150,150,0.15)"
                          vertical={false}
                        />
                        <XAxis dataKey="treatment" tick={{ fontSize: 10 }} />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10 }}
                          width={48}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value}%`, name]}
                          contentStyle={{
                            background: 'var(--tooltip-bg, #fff)',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderRadius: '0.75rem',
                            fontSize: '11px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        {([0, 1, 2, 3, 4, 5, 6] as ProtocormStage[]).map((stage) => (
                          <Bar
                            key={stage}
                            dataKey={`Est.${stage}`}
                            name={STAGE_LABELS_SHORT[stage]}
                            stackId="stages"
                            fill={STAGE_COLORS[stage]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Stage legend */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {([0, 1, 2, 3, 4, 5, 6] as ProtocormStage[]).map((stage) => (
                      <div key={stage} className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: STAGE_COLORS[stage] }}
                        />
                        <span className="text-[10px] text-ink-2">
                          {PROTOCORM_STAGE_LABELS[stage]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Data table ─── */}
            {activeTab === 'table' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">
                  % Germinação Acumulada por Tratamento e Dia de Avaliação
                </h3>
                <GerminationTable
                  experiment={selectedExperiment}
                  selectedTreatmentId={selectedTreatmentId}
                />
                <p className="text-[10px] text-ink-3 italic">
                  * Valores em verde = maior porcentagem de germinação para aquele dia de avaliação.{' '}
                  {eixoDoTempo.aplicaIndicesDeVigor
                    ? 'IVG calculado pelo índice de Maguire (1962).'
                    : MOTIVO_SEM_INDICES_DE_VIGOR}
                </p>
              </div>
            )}

            {/* ── Plate runs list ─── */}
            {activeTab === 'runs' && (
              <div className="space-y-6">
                {(selectedTreatmentId
                  ? selectedExperiment.treatments.filter((t) => t.id === selectedTreatmentId)
                  : selectedExperiment.treatments
                ).map((treatment, ti) => (
                  <div key={treatment.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: TREATMENT_COLORS[ti % TREATMENT_COLORS.length] }}
                      />
                      <div>
                        <span className="text-sm font-bold text-ink-1">{treatment.code}</span>
                        <span className="text-xs text-ink-3 ml-2">{treatment.name}</span>
                        {treatment.description && (
                          <span className="text-[10px] text-ink-3 ml-2 italic">
                            — {treatment.description}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onAddPlateRun(selectedExperiment.id, treatment.id)}
                        className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-surface-2 hover:bg-accent-tint text-ink-2 hover:text-accent rounded-lg transition-all cursor-pointer"
                      >
                        <Plus size={10} />
                        Avaliar
                      </button>
                    </div>
                    <div className="ml-5">
                      <PlateRunsList
                        treatment={treatment}
                        experimentId={selectedExperiment.id}
                        prefixoDoEixo={eixoDoTempo.prefixo}
                        onAddPlateRun={onAddPlateRun}
                        onViewSession={onViewSession}
                      />
                    </div>
                  </div>
                ))}

                {selectedExperiment.treatments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <FlaskConical size={32} className="text-line" />
                    <p className="text-sm font-bold text-ink-3">Nenhum tratamento cadastrado</p>
                    <p className="text-xs text-ink-3 max-w-xs">
                      Edite o experimento para adicionar tratamentos.
                    </p>
                    <button
                      onClick={() => onEditExperiment(selectedExperiment)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-line text-ink-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Pencil size={12} />
                      Editar Experimento
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
