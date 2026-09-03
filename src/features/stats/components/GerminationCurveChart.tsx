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

/**
 * Series de dados na ordem fixa do sistema Bancada Optica. Ver CHART_PALETTE
 * em GerminationBarChart para a nota sobre validacao de daltonismo.
 */
const COLORS = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
  'var(--color-series-6)',
  'var(--color-series-7)',
  'var(--color-series-8)',
];

/** Acima da 8a serie a cor deixa de identificar: o excedente vira "Outros". */
const SERIE_EXCEDENTE = 'var(--color-ink-3)';

export function GerminationCurveChart({ data, treatmentCodes }: GerminationCurveChartProps) {
  if (!data || data.length === 0 || treatmentCodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-surface-2 border border-dashed border-line rounded-2xl">
        <p className="text-xs text-ink-3 font-semibold">
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
        <LineChart data={sortedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-soft)" />
          <XAxis
            dataKey="day"
            label={{
              value: 'Dias Após Semeadura (DAP)',
              position: 'insideBottom',
              offset: -10,
              className: 'fill-neutral-500 dark:fill-zinc-400 font-bold text-[10px]',
            }}
            tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
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
            tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-1)',
              borderColor: 'var(--color-line)',
              borderRadius: '12px',
              color: 'var(--color-ink-1)',
              fontSize: '11px',
              fontFamily: 'sans-serif',
              boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.28)',
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
              stroke={COLORS[index] ?? SERIE_EXCEDENTE}
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
