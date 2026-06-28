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
export const CHART_PALETTE = [
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f97316', // orange
  '#06b6d4', // cyan
  '#a855f7', // purple
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
      fill="#6366f1"
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">{d.label}</p>
      <p className="text-zinc-600 dark:text-zinc-300">
        Média:{' '}
        <span className="font-mono font-bold" style={{ color: d.color }}>
          {d.mean.toFixed(1)}%
        </span>
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        IC 95%: {d.lower.toFixed(1)}% – {d.upper.toFixed(1)}%
      </p>
      {d.letter && (
        <p className="text-indigo-500 dark:text-indigo-400 font-bold mt-1">
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
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 28, right: 20, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#a1a1aa' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.4} label={{ value: '80%', fill: '#10b981', fontSize: 9, position: 'insideRight' }} />
        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.4} label={{ value: '50%', fill: '#f59e0b', fontSize: 9, position: 'insideRight' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
        <Bar dataKey="mean" radius={[6, 6, 0, 0]} maxBarSize={72}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={d.color} fillOpacity={0.85} />
          ))}
          <ErrorBar dataKey="errorY" width={5} strokeWidth={2} stroke="#52525b" />
          {showLetters && (
            <LabelList dataKey="letter" content={<LetterLabel />} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
