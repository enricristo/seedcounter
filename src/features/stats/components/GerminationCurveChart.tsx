import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CurvePoint {
  day: number;
  [treatmentCode: string]: number; // holds the cumulative % value for each treatment
}

interface GerminationCurveChartProps {
  data: CurvePoint[];
  treatmentCodes: string[];
}

const COLORS = [
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f97316', // orange
];

export function GerminationCurveChart({ data, treatmentCodes }: GerminationCurveChartProps) {
  if (!data || data.length === 0 || treatmentCodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-neutral-50 dark:bg-zinc-900/30 border border-dashed border-neutral-250 dark:border-zinc-800 rounded-2xl">
        <p className="text-xs text-neutral-400 dark:text-zinc-500 font-semibold">
          Dados insuficientes para gerar a curva de germinação.
        </p>
      </div>
    );
  }

  // Sort data points by day index
  const sortedData = [...data].sort((a, b) => a.day - b.day);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={sortedData}
          margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-zinc-800" />
          <XAxis
            dataKey="day"
            label={{
              value: 'Dias Após Semeadura (DAP)',
              position: 'insideBottom',
              offset: -10,
              className: 'fill-neutral-500 dark:fill-zinc-400 font-bold text-[10px]',
            }}
            tick={{ fill: '#888888', fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            label={{
              value: 'Germinação Acumulada (%)',
              angle: -90,
              position: 'insideLeft',
              offset: 0,
              className: 'fill-neutral-500 dark:fill-zinc-400 font-bold text-[10px]',
            }}
            tick={{ fill: '#888888', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(24, 24, 27, 0.95)',
              borderColor: '#3f3f46',
              borderRadius: '12px',
              color: '#e2e8f0',
              fontSize: '11px',
              fontFamily: 'sans-serif',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Germinação']}
            labelFormatter={(label) => `Dia: ${label} DAP`}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
          />
          {treatmentCodes.map((code, index) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              name={`Tratamento ${code}`}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 1 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
