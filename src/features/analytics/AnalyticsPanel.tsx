import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import type { SeedMeasurement } from '../../lib/measurements';
import { CollapsibleSection } from '../../components/shared/CollapsibleSection';
import { PieChart as PieChartIcon, Activity } from 'lucide-react';

interface AnalyticsPanelProps {
  medicoes: SeedMeasurement[];
  totalCount: number;
  viableCount: number;
  inviableCount: number;
  onExpand?: () => void;
}

const COLORS = ['#2ecc71', '#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#34495e'];

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  medicoes,
  totalCount,
  inviableCount,
  onExpand,
}) => {
  // --- 1. Distribuição de Classes ---
  const classDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of medicoes) {
      const nomeDaClasse = m.classeExterna || m.classe; // usa a classe externa se existir (multiclasse/yolo)
      counts[nomeDaClasse] = (counts[nomeDaClasse] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [medicoes]);

  // --- 2. Perfil Morfométrico (Área vs Max Feret) ---
  const scatterData = useMemo(() => {
    // Recharts Scatter aceita arrays de objetos. Se quisermos separar por cor, 
    // agrupamos as séries (Scatters separados por classe).
    const grupos: Record<string, { x: number; y: number; name: string }[]> = {};
    for (const m of medicoes) {
      if (m.areaPx == null || m.feretMaxPx == null) continue;
      const nomeDaClasse = m.classeExterna || m.classe;
      if (!grupos[nomeDaClasse]) grupos[nomeDaClasse] = [];
      grupos[nomeDaClasse].push({
        x: m.feretMaxPx,
        y: m.areaPx,
        name: nomeDaClasse,
      });
    }
    return Object.entries(grupos).map(([name, data]) => ({
      name,
      data,
    }));
  }, [medicoes]);

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="flex gap-2">
        <div className="flex-1 bg-surface-1 border border-line p-3 rounded-lg flex flex-col items-center justify-center shadow-sm">
          <div className="text-[10px] text-ink-3 uppercase font-bold tracking-wider">Total</div>
          <div className="text-xl font-bold text-accent">{totalCount}</div>
        </div>
        <div className="flex-1 bg-surface-1 border border-line p-3 rounded-lg flex flex-col items-center justify-center shadow-sm">
          <div className="text-[10px] text-ink-3 uppercase font-bold tracking-wider">Defeitos / Inviável</div>
          <div className="text-xl font-bold text-red-500">
            {totalCount > 0 ? Math.round((inviableCount / totalCount) * 100) : 0}%
          </div>
        </div>
      </div>

      <hr className="border-neutral-100 dark:border-zinc-800" />
      
      {onExpand && (
        <button
          onClick={onExpand}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
        >
          <Activity size={16} />
          Expandir Dashboard do Lote
        </button>
      )}
      {/* Gráfico de Distribuição */}
      <CollapsibleSection
        title="Distribuição de Classes"
        icon={<PieChartIcon size={14} className="text-ink-3" />}
        summary={`${classDistribution.length} classes`}
        defaultOpen={true}
      >
        <div className="bg-surface-1 border border-line rounded-lg p-2 shadow-sm" style={{ height: 220 }}>
          {classDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {classDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} sementes`, 'Quantidade']}
                  contentStyle={{ fontSize: '12px', borderRadius: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-ink-3 text-xs">Sem dados classificados</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Gráfico de Dispersão */}
      <CollapsibleSection
        title="Perfil Morfométrico"
        icon={<Activity size={14} className="text-ink-3" />}
        summary="Área vs Comprimento"
        defaultOpen={true}
      >
        <div className="bg-surface-1 border border-line rounded-lg p-2 shadow-sm" style={{ height: 250 }}>
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Max Feret" 
                  unit="px" 
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Comprimento (px)', position: 'insideBottom', offset: -5, fontSize: 10 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Área" 
                  unit="px²" 
                  tick={{ fontSize: 10 }} 
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ fontSize: '11px', borderRadius: '4px' }}
                />
                {scatterData.map((serie, index) => (
                  <Scatter 
                    key={serie.name} 
                    name={serie.name} 
                    data={serie.data} 
                    fill={COLORS[index % COLORS.length]} 
                    opacity={0.7}
                    shape="circle"
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-ink-3 text-xs text-center px-4">
              Nenhuma semente com contorno para extrair morfometria.
            </div>
          )}
        </div>
      </CollapsibleSection>

    </div>
  );
};
