import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ErrorBar,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import type { TreatmentStats } from '../../../types';

// Publication-quality palette
/**
 * Series de dados na ordem fixa do sistema Bancada Optica. A ordem e o
 * mecanismo de seguranca para daltonismo, nao decoracao: foi validada por
 * script nos dois temas (pior par adjacente delta-E 11,7 claro / 10,0 escuro).
 * Nunca reordenar, nunca ciclar.
 */
export const CHART_PALETTE = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
  'var(--color-series-6)',
  'var(--color-series-7)',
  'var(--color-series-8)',
];

interface GerminationBarChartProps {
  stats: TreatmentStats[];
  /** If true, render letter labels on top of bars */
  showLetters?: boolean;
  height?: number;
}

interface ChartDatum {
  label: string;
  mean: number;
  errorY: [number, number]; // [lower_margin, upper_margin] from mean
  lower: number;
  upper: number;
  letter: string;
  color: string;
}

// Custom label on top of bar — shows Scott-Knott letter
function LetterLabel(props: any) {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="var(--color-ink-1)"
      textAnchor="middle"
      fontSize={13}
      fontWeight={700}
      fontFamily="ui-monospace, monospace"
    >
      {value}
    </text>
  );
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as ChartDatum;
  if (!d) return null;
  return (
    <div className="bg-surface-1 border border-line rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-bold text-ink-1 mb-1">{d.label}</p>
      <p className="text-ink-2">
        Média:{' '}
        <span className="font-mono font-bold" style={{ color: d.color }}>
          {d.mean.toFixed(1)}%
        </span>
      </p>
      <p className="text-ink-3">
        IC 95%: {d.lower.toFixed(1)}% – {d.upper.toFixed(1)}%
      </p>
      {d.letter && (
        <p className="text-accent font-bold mt-1">
          Grupo: <span className="font-mono">{d.letter}</span>
        </p>
      )}
    </div>
  );
}

export function GerminationBarChart({
  stats,
  showLetters = true,
  height = 320,
}: GerminationBarChartProps) {
  if (stats.length === 0) return null;

  const data: ChartDatum[] = stats.map((s, i) => {
    const lowerPct = s.ci.lower * 100;
    const upperPct = s.ci.upper * 100;
    return {
      label: s.treatmentName,
      mean: s.mean,
      // ErrorBar expects [lowerDiff, upperDiff] from the data value
      errorY: [s.mean - lowerPct, upperPct - s.mean] as [number, number],
      lower: lowerPct,
      upper: upperPct,
      letter: s.letter ?? '',
      color: CHART_PALETTE[i] ?? 'var(--color-ink-3)',
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 28, right: 20, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-line-soft)"
          strokeOpacity={0.5}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--color-ink-3)', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <ReferenceLine
          y={80}
          stroke="var(--color-ok)"
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          label={{ value: '80%', fill: 'var(--color-ok)', fontSize: 9, position: 'insideRight' }}
        />
        <ReferenceLine
          y={50}
          stroke="var(--color-warn)"
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          label={{ value: '50%', fill: 'var(--color-warn)', fontSize: 9, position: 'insideRight' }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-line-soft)' }} />
        <Bar dataKey="mean" radius={[6, 6, 0, 0]} maxBarSize={72}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color} fillOpacity={0.85} />
          ))}
          <ErrorBar dataKey="errorY" width={5} strokeWidth={2} stroke="var(--color-ink-2)" />
          {showLetters && <LabelList dataKey="letter" content={<LetterLabel />} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
