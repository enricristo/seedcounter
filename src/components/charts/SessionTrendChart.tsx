import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import type { Session } from '../../types';

interface TrendChartProps {
  sessions: Session[];
}

export function SessionTrendChart({ sessions }: TrendChartProps) {
  // Sort sessions chronologically (oldest to newest)
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const data = sorted.map((s, index) => {
    const total = s.viableCount + s.inviableCount;
    const rate = total > 0 ? Number(((s.viableCount / total) * 100).toFixed(1)) : 0;
    
    // Short date representation
    const dateObj = new Date(s.date);
    const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    return {
      index: index + 1,
      dateLabel: label,
      viability: rate,
      viable: s.viableCount,
      total: total,
      plate: s.metadata.plate || 'N/A'
    };
  });

  if (data.length === 0) return null;

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorViability" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis 
            dataKey="dateLabel" 
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
            domain={[0, 100]}
            unit="%"
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
            formatter={(value) => [`${value}%`, 'Taxa de Viabilidade']}
            labelFormatter={(label, payload) => {
              const item = payload[0]?.payload;
              return item ? `Sessão: ${item.dateLabel} (Placa ${item.plate})` : label;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="viability" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorViability)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
