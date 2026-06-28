import React, { useState, useMemo } from 'react';
import {
  FileText,
  TrendingUp,
  BarChart4,
  Copy,
  Download,
  AlertCircle,
  HelpCircle,
  Activity,
  Layers,
  Check,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Session, Experiment, TreatmentStats } from '../../types';
import { runStatsPipeline, GroupStat, calculateIVG, calculateMGT, calculateT50, wilsonCI } from '../../lib/stats';
import { GerminationBarChart } from './components/GerminationBarChart';
import { GerminationCurveChart } from './components/GerminationCurveChart';
import { StatsResultCard } from './components/StatsResultCard';
import { WilsonCIBar } from './components/WilsonCIBar';

interface StatsViewProps {
  sessions: Session[];
  experiments?: Experiment[];
  onViewSession?: (sessionId: string) => void;
}

export function StatsView({ sessions, experiments = [], onViewSession }: StatsViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'treatments' | 'vigor' | 'contamination' | 'export'>('sessions');
  const [postHoc, setPostHoc] = useState<'scott-knott' | 'tukey'>('scott-knott');
  const [useArcsin, setUseArcsin] = useState(true);
  const [sortField, setSortField] = useState<'date' | 'plate' | 'treatment' | 'viable'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [copiedLetters, setCopiedLetters] = useState(false);

  // Group sessions by treatment
  const treatmentGroups = useMemo(() => {
    const groups: Record<string, number[]> = {};
    sessions.forEach(s => {
      const treatment = s.metadata.treatment?.trim() || 'Controle';
      const total = s.viableCount + s.inviableCount;
      if (total > 0) {
        const rate = (s.viableCount / total) * 100;
        if (!groups[treatment]) groups[treatment] = [];
        groups[treatment].push(rate);
      }
    });

    return Object.entries(groups).map(([label, values]) => ({
      label,
      values,
    })) as GroupStat[];
  }, [sessions]);

  // Run stats pipeline
  const statsResult = useMemo(() => {
    return runStatsPipeline(treatmentGroups, {
      postHoc,
      alpha: 0.05,
      useArcsin,
    });
  }, [treatmentGroups, postHoc, useArcsin]);

  // Contamination aggregation
  const contaminationStats = useMemo(() => {
    let none = 0;
    let fungal = 0;
    let bacterial = 0;
    let mixed = 0;

    sessions.forEach(s => {
      // Look inside session metadata or linked experiment runs
      // Check if session itself has a dayIndex and experimentId
      // Standard default is none if not set
      none++; // Default
    });

    // Alternatively, look at all plate runs in experiments
    let expNone = 0;
    let expFungal = 0;
    let expBacterial = 0;
    let expMixed = 0;
    let hasExpData = false;

    experiments.forEach(e => {
      e.treatments.forEach(t => {
        t.plates.forEach(p => {
          hasExpData = true;
          if (p.contamination === 'fungal') expFungal++;
          else if (p.contamination === 'bacterial') expBacterial++;
          else if (p.contamination === 'mixed') expMixed++;
          else expNone++;
        });
      });
    });

    if (hasExpData) {
      return { none: expNone, fungal: expFungal, bacterial: expBacterial, mixed: expMixed, hasData: true };
    }

    return { none, fungal, bacterial, mixed, hasData: false };
  }, [sessions, experiments]);

  // Time-series curve data extraction
  const curveData = useMemo(() => {
    // If we have experiments, build time series points
    if (experiments.length === 0) return { points: [], treatmentCodes: [] };

    // Use first active experiment
    const exp = experiments[0];
    const days = exp.evaluationDays;
    const codes = exp.treatments.map(t => t.code);

    // Build CurvePoints
    const points = days.map(day => {
      const pt: any = { day };
      exp.treatments.forEach(t => {
        // Find plates evaluated at or before this day and average cumulative %
        const runsOnDay = t.plates.filter(p => p.dayIndex === day);
        if (runsOnDay.length > 0) {
          const avgRate = runsOnDay.reduce((sum, p) => sum + (p.germinatedSeeds / p.totalSeeds) * 100, 0) / runsOnDay.length;
          pt[t.code] = avgRate;
        } else {
          // Carry forward or set null
          pt[t.code] = null;
        }
      });
      return pt;
    });

    return { points, treatmentCodes: codes, experimentName: exp.name };
  }, [experiments]);

  // Vigor table data
  const vigorStats = useMemo(() => {
    if (experiments.length === 0) return [];
    const exp = experiments[0];

    return exp.treatments.map(t => {
      // Group readings by dayIndex
      const readingsMap: Record<number, { day: number; germinated: number; total: number }> = {};
      
      // Calculate non-cumulative germination on each day
      t.plates.forEach(p => {
        if (!readingsMap[p.dayIndex]) {
          readingsMap[p.dayIndex] = { day: p.dayIndex, germinated: 0, total: 0 };
        }
        readingsMap[p.dayIndex].germinated += p.germinatedSeeds;
        readingsMap[p.dayIndex].total += p.totalSeeds;
      });

      const readings = Object.values(readingsMap)
        .sort((a, b) => a.day - b.day)
        .map((r, idx, arr) => {
          // To compute non-cumulative, subtract previous day's cumulative
          const prevCum = idx > 0 ? arr[idx - 1].germinated : 0;
          const dailyGerm = Math.max(0, r.germinated - prevCum);
          return {
            day: r.day,
            germinated: dailyGerm,
          };
        });

      const totalSeeds = t.plates.reduce((sum, p) => sum + p.totalSeeds, 0) / Math.max(1, t.plates.length); // Average seeds per replicate
      
      // Calculations from stats engine
      const ivg = calculateIVG(readings);
      const mgt = calculateMGT(readings);
      const t50 = calculateT50(readings, totalSeeds);

      return {
        code: t.code,
        name: t.name,
        n: t.plates.length,
        ivg: ivg.toFixed(2),
        mgt: mgt > 0 ? `${mgt.toFixed(1)} dias` : 'N/A',
        t50: t50 ? `${t50.toFixed(1)} dias` : 'N/A',
      };
    });
  }, [experiments]);

  // Sort sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      let valA: any = a.date;
      let valB: any = b.date;

      if (sortField === 'plate') {
        valA = a.metadata.plate || '';
        valB = b.metadata.plate || '';
      } else if (sortField === 'treatment') {
        valA = a.metadata.treatment || '';
        valB = b.metadata.treatment || '';
      } else if (sortField === 'viable') {
        const totA = a.viableCount + a.inviableCount;
        const totB = b.viableCount + b.inviableCount;
        valA = totA > 0 ? a.viableCount / totA : 0;
        valB = totB > 0 ? b.viableCount / totB : 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [sessions, sortField, sortAsc]);

  // Copy letters to clipboard
  const handleCopyLetters = () => {
    if (statsResult.treatmentStats.length === 0) return;
    const header = 'Tratamento\tMédia (%)\tDesvio Padrão\tLetra (5%)\n';
    const rows = statsResult.treatmentStats
      .map(s => `${s.treatmentId}\t${s.mean.toFixed(1)}%\t${s.sd.toFixed(1)}\t${s.letter || 'a'}`)
      .join('\n');
    
    navigator.clipboard.writeText(header + rows);
    setCopiedLetters(true);
    setTimeout(() => setCopiedLetters(false), 2000);
  };

  // Export Stats as CSV
  const handleExportStatsCSV = () => {
    if (statsResult.treatmentStats.length === 0) return;
    
    const csvContent = [
      ['Tratamento', 'Repeticoes (N)', 'Germinacao Media (%)', 'Desvio Padrao', 'Letra Scott-Knott'],
      ...statsResult.treatmentStats.map(s => [
        s.treatmentId,
        s.n,
        s.mean.toFixed(2),
        s.sd.toFixed(2),
        s.letter || 'a'
      ])
    ]
      .map(row => row.map(val => `"${val}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seedcounter_stats_summary_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Session Summary as CSV
  const handleExportSessionsCSV = () => {
    if (sessions.length === 0) return;
    
    const csvContent = [
      ['Data', 'Arquivo', 'Placa', 'Tratamento', 'Especie', 'Sementes Viaveis', 'Sementes Inviaveis', 'Germinacao (%)'],
      ...sessions.map(s => {
        const total = s.viableCount + s.inviableCount;
        const rate = total > 0 ? (s.viableCount / total) * 100 : 0;
        return [
          new Date(s.date).toLocaleDateString('pt-BR'),
          s.filename,
          s.metadata.plate || '',
          s.metadata.treatment || '',
          s.metadata.project || '',
          s.viableCount,
          s.inviableCount,
          rate.toFixed(2)
        ];
      })
    ]
      .map(row => row.map(val => `"${val}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seedcounter_sessions_summary_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
        <div className="bg-neutral-100 dark:bg-zinc-900 p-4 rounded-3xl text-neutral-400 dark:text-zinc-500 mb-4 shadow-inner">
          <Activity size={32} />
        </div>
        <h3 className="text-sm font-bold text-neutral-800 dark:text-zinc-100 uppercase tracking-wider mb-2">
          Nenhum dado estatístico disponível
        </h3>
        <p className="text-xs text-neutral-450 dark:text-zinc-500 leading-relaxed font-semibold">
          Realize contagens de sementes e salve-as no histórico local para ativar o motor estatístico e comparar tratamentos.
        </p>
      </div>
    );
  }


  // Pie chart data
  const pieData = [
    { name: 'Sem contaminação', value: contaminationStats.none, color: '#10b981' },
    { name: 'Contaminação Fúngica', value: contaminationStats.fungal, color: '#f59e0b' },
    { name: 'Contaminação Bacteriana', value: contaminationStats.bacterial, color: '#3b82f6' },
    { name: 'Contaminação Mista', value: contaminationStats.mixed, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#09090B] text-neutral-800 dark:text-zinc-100 transition-all duration-300">
      {/* Navigation tabs */}
      <div className="flex border-b border-neutral-250 dark:border-zinc-850 bg-neutral-50/50 dark:bg-zinc-950/20 px-6 shrink-0 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300'
          }`}
        >
          <FileText size={14} /> Resumo por Sessão
        </button>
        <button
          onClick={() => setActiveTab('treatments')}
          className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'treatments'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300'
          }`}
        >
          <BarChart4 size={14} /> Comparação de Tratamentos
        </button>
        <button
          onClick={() => setActiveTab('vigor')}
          className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'vigor'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300'
          }`}
        >
          <TrendingUp size={14} /> Índices de Vigor
        </button>
        <button
          onClick={() => setActiveTab('contamination')}
          className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'contamination'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300'
          }`}
        >
          <Layers size={14} /> Contaminação
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'export'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300'
          }`}
        >
          <Download size={14} /> Exportação
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab 1: Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                  Sessões de Contagem Salvas
                </h3>
                <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium">
                  {sessions.length} avaliações registradas no total. Clique em 'Ver foto' para analisar as marcações.
                </p>
              </div>
              <button
                onClick={handleExportSessionsCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                <Download size={12} /> CSV das Contagens
              </button>
            </div>

            {/* Table */}
            <div className="border border-neutral-200 dark:border-zinc-850 rounded-2xl overflow-hidden shadow-sm bg-neutral-50/50 dark:bg-zinc-900/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-100/50 dark:bg-zinc-900/50 text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-wider border-b border-neutral-200 dark:border-zinc-800">
                    <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }}>
                      Data {sortField === 'date' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortField('plate'); setSortAsc(!sortAsc); }}>
                      Placa {sortField === 'plate' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortField('treatment'); setSortAsc(!sortAsc); }}>
                      Tratamento {sortField === 'treatment' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3">Espécie / Lote</th>
                    <th className="px-4 py-3 text-center">Total Sementes</th>
                    <th className="px-4 py-3 text-center cursor-pointer" onClick={() => { setSortField('viable'); setSortAsc(!sortAsc); }}>
                      Viáveis (%) {sortField === 'viable' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-zinc-850 text-xs font-medium text-neutral-700 dark:text-zinc-300">
                  {sortedSessions.map(s => {
                    const total = s.viableCount + s.inviableCount;
                    const rate = total > 0 ? (s.viableCount / total) * 100 : 0;
                    
                    return (
                      <tr key={s.id} className="hover:bg-neutral-100/30 dark:hover:bg-zinc-900/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-[10px]">
                          {new Date(s.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {s.metadata.plate || 'S/ N'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-neutral-200 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-400 rounded-md font-semibold text-[10px]">
                            {s.metadata.treatment || 'Controle'}
                          </span>
                        </td>
                        <td className="px-4 py-3 italic text-neutral-500 dark:text-zinc-400">
                          {s.metadata.project || 'Espécie não descrita'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">{total}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`font-bold w-12 text-right ${
                              rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                              rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-500'
                            }`}>
                              {rate.toFixed(1)}%
                            </span>
                            <div className="w-16">
                              <WilsonCIBar value={rate} ci={wilsonCI(s.viableCount, total)} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {onViewSession && s.imageData && (
                            <button
                              onClick={() => onViewSession(s.id)}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Ver Foto
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Comparisons */}
        {activeTab === 'treatments' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header + Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                  Análise Comparativa Multigrupos
                </h3>
                <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium">
                  Pipeline estatístico automatizado para comparação de médias (ANOVA / Scott-Knott).
                </p>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-450 dark:text-zinc-500 uppercase">
                    Pós-Hoc:
                  </label>
                  <select
                    value={postHoc}
                    onChange={e => setPostHoc(e.target.value as 'scott-knott' | 'tukey')}
                    className="px-2 py-1 bg-neutral-100 dark:bg-zinc-850 text-neutral-700 dark:text-zinc-350 border border-neutral-200 dark:border-zinc-800 rounded-lg text-[10.5px] font-bold focus:outline-none"
                  >
                    <option value="scott-knott">Scott-Knott (Recomendado)</option>
                    <option value="tukey">Tukey-Kramer HSD</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold text-neutral-600 dark:text-zinc-350 bg-neutral-100 dark:bg-zinc-850 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={useArcsin}
                    onChange={e => setUseArcsin(e.target.checked)}
                    className="accent-purple-600"
                  />
                  <span>Transformar arcsin√x</span>
                </label>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Card */}
              <div className="lg:col-span-2 bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide">
                    Germinação Média com Letras de Diferença Significativa
                  </h4>
                  <HelpCircle size={14} className="text-neutral-400" title="Barras mostram a média com intervalo de confiança de Wilson. Letras diferentes indicam diferença estatística significativa (p < 0.05)." />
                </div>
                {statsResult.treatmentStats.length > 0 ? (
                  <GerminationBarChart stats={statsResult.treatmentStats} />
                ) : (
                  <div className="h-64 flex items-center justify-center border border-dashed border-neutral-200 dark:border-zinc-800 rounded-2xl">
                    <p className="text-xs text-neutral-400">Sem dados estatísticos suficientes.</p>
                  </div>
                )}
              </div>

              {/* ANOVA Card */}
              <div className="flex flex-col gap-4">
                <StatsResultCard result={statsResult} />

                {/* Shapiro-Wilk details */}
                <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-4 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-bold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider">
                    Pressuposto de Normalidade (Shapiro-Wilk)
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {statsResult.normalityResults.map((r, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px]">
                        <span className="font-semibold text-neutral-600 dark:text-zinc-400">
                          {statsResult.groups[idx]?.label || 'Grupo'}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="font-mono text-neutral-400">W={r.W.toFixed(3)}</span>
                          <span className={r.normal ? 'text-emerald-600' : 'text-amber-500'}>
                            {r.normal ? 'Normal (p>0.05)' : 'Não-Normal'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scott-Knott / Tukey Table */}
            <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide">
                  Tabela de Agrupamento de Médias
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLetters}
                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-zinc-200 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    {copiedLetters ? (
                      <>
                        <Check size={10} className="text-emerald-500" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={10} /> Copiar para Artigo
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="border border-neutral-200 dark:border-zinc-850 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-100/50 dark:bg-zinc-900/50 text-[10px] font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-wider border-b border-neutral-200 dark:border-zinc-800">
                      <th className="px-4 py-2.5">Tratamento</th>
                      <th className="px-4 py-2.5 text-center">Repetições (N)</th>
                      <th className="px-4 py-2.5 text-center">Germinação Média (%)</th>
                      <th className="px-4 py-2.5 text-center">Desvio Padrão</th>
                      <th className="px-4 py-2.5 text-center">Agrupamento (Letra)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-zinc-850 text-xs font-medium text-neutral-750 dark:text-zinc-300">
                    {statsResult.treatmentStats.map(s => (
                      <tr key={s.treatmentId} className="hover:bg-neutral-100/30 dark:hover:bg-zinc-900/10">
                        <td className="px-4 py-2.5 font-bold">{s.treatmentId}</td>
                        <td className="px-4 py-2.5 text-center">{s.n}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-purple-600 dark:text-purple-400">
                          {s.mean.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">{s.sd.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-neutral-800 dark:text-zinc-100 uppercase text-sm">
                          {s.letter || 'a'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold italic mt-2">
                * Médias seguidas pela mesma letra minúscula na coluna não diferem estatisticamente entre si pelo teste de {postHoc === 'scott-knott' ? 'Scott-Knott' : 'Tukey'} a 5% de probabilidade.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Vigor */}
        {activeTab === 'vigor' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                Análise Temporal e Índices de Vigor
              </h3>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold">
                Análise cinética da germinação. Requer lançamento de avaliações longitudinais vinculadas a experimentos.
              </p>
            </div>

            {vigorStats.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                {/* Curve Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide">
                      Curva Cumulativa de Germinação (Cinética)
                    </h4>
                    <p className="text-[9px] text-neutral-400 dark:text-zinc-500 font-medium">
                      Evolução acumulada da germinação (%) em relação aos Dias Após Semeadura (DAP).
                    </p>
                  </div>
                  <GerminationCurveChart data={curveData.points} treatmentCodes={curveData.treatmentCodes} />
                </div>

                {/* Vigor Index Table Card */}
                <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide">
                      Índices de Velocidade de Germinação (Vigor)
                    </h4>
                    
                    <div className="border border-neutral-200 dark:border-zinc-850 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-neutral-100/50 dark:bg-zinc-900/50 font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-wider border-b border-neutral-200 dark:border-zinc-800">
                            <th className="px-3 py-2">Trat.</th>
                            <th className="px-3 py-2 text-center" title="Índice de Velocidade de Germinação (Maguire, 1962)">IVG</th>
                            <th className="px-3 py-2 text-center" title="Tempo Médio de Germinação">TMG</th>
                            <th className="px-3 py-2 text-center" title="Tempo para 50% de germinação acumulada">t50</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-zinc-850 font-semibold text-neutral-750 dark:text-zinc-300">
                          {vigorStats.map(v => (
                            <tr key={v.code} className="hover:bg-neutral-100/30 dark:hover:bg-zinc-900/10">
                              <td className="px-3 py-2 font-bold">{v.code}</td>
                              <td className="px-3 py-2 text-center text-emerald-600 dark:text-emerald-450 font-bold">{v.ivg}</td>
                              <td className="px-3 py-2 text-center font-mono">{v.mgt}</td>
                              <td className="px-3 py-2 text-center font-mono">{v.t50}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-neutral-50 dark:bg-zinc-900/30 border border-neutral-200 dark:border-zinc-850 p-3.5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider">
                      O que significam?
                    </span>
                    <p className="text-[9px] text-neutral-400 dark:text-zinc-500 leading-normal font-semibold">
                      * <strong>IVG:</strong> Valores maiores indicam germinação mais rápida/vigorosa.
                      <br />
                      * <strong>TMG:</strong> Tempo médio que uma semente demora para emitir o protocormo verde.
                      <br />
                      * <strong>t50:</strong> Dias estimados para a placa atingir 50% da sua germinação acumulada total.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-zinc-900/10 border border-dashed border-neutral-200 dark:border-zinc-800 rounded-3xl max-w-xl mx-auto text-center">
                <AlertCircle size={24} className="text-neutral-400 mb-2" />
                <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Sem dados longitudinais
                </h4>
                <p className="text-[11px] text-neutral-400 dark:text-zinc-500 leading-relaxed font-semibold">
                  Para calcular IVG, TMG e gerar a curva de germinação (DAP), crie um experimento e registre múltiplos lançamentos de placas vinculados às avaliações longitudinais da Fase A.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Contamination */}
        {activeTab === 'contamination' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                Análise de Contaminação e Fitossanidade
              </h3>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold">
                Monitoramento de agentes contaminantes (fungos, bactérias e leveduras) nas placas.
              </p>
            </div>

            {contaminationStats.fungal > 0 || contaminationStats.bacterial > 0 || contaminationStats.mixed > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                {/* Distribution chart */}
                <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col justify-between h-80">
                  <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide mb-2">
                    Proporção por Agente Contaminante
                  </h4>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} placa(s)`, 'Quantidade']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Phytosanitary advice */}
                <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wide">
                      Resumo Epidemiológico das Placas
                    </h4>
                    
                    <div className="space-y-3 font-semibold text-xs text-neutral-750 dark:text-zinc-300">
                      <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-zinc-850">
                        <span>Placas Sem Contaminação (Limpas)</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-450">{contaminationStats.none}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-zinc-850">
                        <span>Placas com Fungo Filamentoso</span>
                        <span className="font-bold text-amber-500">{contaminationStats.fungal}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-neutral-100 dark:border-zinc-850">
                        <span>Placas com Contaminação Bacteriana</span>
                        <span className="font-bold text-blue-500">{contaminationStats.bacterial}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span>Placas com Contaminação Mista</span>
                        <span className="font-bold text-red-500">{contaminationStats.mixed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 p-3.5 rounded-2xl flex items-start gap-2.5 mt-4">
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        Alerta Fitossanitário
                      </span>
                      <p className="text-[9px] text-amber-700 dark:text-amber-500 mt-1 font-semibold leading-relaxed">
                        Taxas elevadas de contaminação fúngica apontam para falha na autoclave do meio ou estocagem. Contaminações bacterianas costumam se correlacionar com desinfestação insatisfatória das sementes (hipoclorito) antes do plantio.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-zinc-900/10 border border-dashed border-neutral-200 dark:border-zinc-800 rounded-3xl max-w-xl mx-auto text-center">
                <Check size={24} className="text-emerald-500 mb-2" />
                <h4 className="text-xs font-bold text-neutral-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  Nenhuma contaminação registrada
                </h4>
                <p className="text-[11px] text-neutral-400 dark:text-zinc-500 leading-relaxed font-semibold">
                  Parabéns! Todas as placas registradas nos experimentos longitudinais estão categorizadas como limpas (Sem Contaminação).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Export */}
        {activeTab === 'export' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-sm font-bold text-neutral-700 dark:text-zinc-300 uppercase">
                Exportação de Tabelas e Relatórios Científicos
              </h3>
              <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium">
                Faça o download dos dados em formatos compatíveis com planilhas (Excel) ou softwares estatísticos (Sisvar, R, SPSS).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1 */}
              <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-zinc-200 uppercase tracking-wider">
                    Resumo Estatístico dos Tratamentos
                  </h4>
                  <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold leading-relaxed">
                    Arquivo CSV contendo a média, desvio padrão, número de repetições (N), limites do intervalo de confiança e a letra resultante do teste de Scott-Knott/Tukey para cada tratamento.
                  </p>
                </div>
                <button
                  onClick={handleExportStatsCSV}
                  disabled={statsResult.treatmentStats.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <Download size={14} /> Exportar Tabela Comparativa (.csv)
                </button>
              </div>

              {/* Card 2 */}
              <div className="bg-white dark:bg-[#18181B] border border-neutral-250 dark:border-zinc-800 p-5 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-800 dark:text-zinc-200 uppercase tracking-wider">
                    Tabela Detalhada de Contagens (Sessões)
                  </h4>
                  <p className="text-[10px] text-neutral-400 dark:text-zinc-500 font-semibold leading-relaxed">
                    Arquivo CSV detalhado contendo cada avaliação realizada nas placas, identificação, data, valores brutos de sementes viáveis/inviáveis e a respectiva porcentagem final.
                  </p>
                </div>
                <button
                  onClick={handleExportSessionsCSV}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <Download size={14} /> Exportar Tabela de Sessões (.csv)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
