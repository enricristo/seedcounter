import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import type { Session } from '../../types';

interface PlateChartProps {
  sessions: Session[];
}

export function PlateViabilityChart({ sessions }: PlateChartProps) {
  // Aggregate stats by plate
  const plateMap: Record<string, { viable: number; inviable: number }> = {};

  sessions.forEach(s => {
    const plate = s.metadata.plate || 'Indefinida';
    if (!plateMap[plate]) {
      plateMap[plate] = { viable: 0, inviable: 0 };
    }
    plateMap[plate].viable += s.viableCount;
    plateMap[plate].inviable += s.inviableCount;
  });

  const data = Object.entries(plateMap).map(([plateName, counts]) => {
    const total = counts.viable + counts.inviable;
    return {
      name: plateName,
      viable: counts.viable,
      inviable: counts.inviable,
      viablePercent: total > 0 ? Number(((counts.viable / total) * 100).toFixed(1)) : 0,
      inviablePercent: total > 0 ? Number(((counts.inviable / total) * 100).toFixed(1)) : 0
    };
  });

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false} 
            fontFamily="monospace"
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false}
            fontFamily="monospace"
          />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              borderColor: '#374151',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#fff',
              fontFamily: 'sans-serif'
            }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend 
            verticalAlign="top" 
            height={32}
            iconSize={10}
            formatter={(value) => (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-zinc-400">
                {value === 'viable' ? 'Viáveis' : 'Inviáveis'}
              </span>
            )}
          />
          <Bar dataKey="viable" name="viable" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="inviable" name="inviable" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
