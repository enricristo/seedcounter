// =============================================================================
// SeedCounter — o gráfico de linha da comparação entre bancadas
//
// Separado de `PainelDeComparacao.tsx` por uma razão só: é a única parte do
// painel que depende do `recharts`, e o painel inteiro ficava preso ao
// pedaço da biblioteca por causa dela. Aqui o gráfico é carregado sob demanda
// (ver `lib/sob-demanda.tsx`); a tabela, que é o que a comparação tem de
// essencial, continua no pacote principal e aparece na hora.
// =============================================================================

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { PontoDaSerie } from './comparacao';

export interface GraficoDaComparacaoProps {
  pontos: PontoDaSerie[];
}

export function GraficoDaComparacao({ pontos }: GraficoDaComparacaoProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={pontos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-soft)" />
        <XAxis
          dataKey="rotulo"
          stroke="var(--color-ink-3)"
          fontSize={10}
          tickLine={false}
          fontFamily="monospace"
        />
        <YAxis stroke="var(--color-ink-3)" fontSize={10} tickLine={false} fontFamily="monospace" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface-1)',
            borderColor: 'var(--color-line)',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--color-ink-1)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '10px' }} />
        <Line type="monotone" dataKey="total" name="Total" stroke="var(--color-series-1)" strokeWidth={2} dot />
        <Line type="monotone" dataKey="viaveis" name="Viáveis" stroke="var(--color-ov-viable)" strokeWidth={2} dot />
        <Line type="monotone" dataKey="inviaveis" name="Inviáveis" stroke="var(--color-ov-inviable)" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
