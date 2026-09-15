// =============================================================================
// SeedCounter — Card de Histogramas e Dispersão Biométrica
//
// Distribuição estatística com divisão por classe (viável vs inviável),
// linha de mediana e alternador para gráfico de dispersão Comprimento × Largura.
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import type { SeedMeasurement } from '../../lib/measurements';

export type VariavelMorfometrica =
  | 'area'
  | 'comprimento'
  | 'largura'
  | 'razaoCL'
  | 'circularidade'
  | 'solidez';

interface CardHistogramasProps {
  medicoes: SeedMeasurement[];
  calibrado?: boolean;
}

interface ItemHistograma {
  faixa: string;
  inicio: number;
  fim: number;
  centro: number;
  total: number;
  viaveis: number;
  inviaveis: number;
}

export function CardHistogramas({ medicoes, calibrado = false }: CardHistogramasProps) {
  const [variavel, setVariavel] = useState<VariavelMorfometrica>('area');
  const [modo, setModo] = useState<'histograma' | 'dispersao'>('histograma');

  // Filtra as medições que têm valor válido para a variável selecionada
  const dadosValidos = useMemo(() => {
    return medicoes
      .map((m) => {
        let v: number | undefined;
        switch (variavel) {
          case 'area':
            v = calibrado && m.areaMm2 ? m.areaMm2 : m.areaPx;
            break;
          case 'comprimento':
            v = calibrado && m.comprimentoMm ? m.comprimentoMm : m.comprimentoPx;
            break;
          case 'largura':
            v = calibrado && m.larguraMm ? m.larguraMm : m.larguraPx;
            break;
          case 'razaoCL':
            v = m.razaoAspecto;
            break;
          case 'circularidade':
            v = m.circularidade;
            break;
          case 'solidez':
            v = m.solidez;
            break;
        }
        return {
          ...m,
          valor: v,
        };
      })
      .filter((d): d is typeof d & { valor: number } => d.valor != null && Number.isFinite(d.valor));
  }, [medicoes, variavel, calibrado]);

  // Estatística básica para a linha de corte/mediana
  const estat = useMemo(() => {
    if (dadosValidos.length === 0) return null;
    const vals = dadosValidos.map((d) => d.valor).sort((a, b) => a - b);
    const n = vals.length;
    const med = vals[Math.floor(n / 2)];
    const min = vals[0];
    const max = vals[n - 1];
    const media = vals.reduce((s, x) => s + x, 0) / n;
    return { min, max, mediana: med, media };
  }, [dadosValidos]);

  // Agrupa em Bins para o Histograma
  const bins = useMemo((): ItemHistograma[] => {
    if (!estat || dadosValidos.length === 0) return [];
    const numBins = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(dadosValidos.length))));
    const amplitude = estat.max - estat.min;
    if (amplitude === 0) {
      return [
        {
          faixa: estat.min.toFixed(1),
          inicio: estat.min,
          fim: estat.min,
          centro: estat.min,
          total: dadosValidos.length,
          viaveis: dadosValidos.filter((d) => d.classe === 'viavel').length,
          inviaveis: dadosValidos.filter((d) => d.classe !== 'viavel').length,
        },
      ];
    }

    const larguraBin = amplitude / numBins;
    const resultado: ItemHistograma[] = [];

    for (let i = 0; i < numBins; i++) {
      const inicio = estat.min + i * larguraBin;
      const fim = i === numBins - 1 ? estat.max : inicio + larguraBin;
      const centro = (inicio + fim) / 2;
      const casas = amplitude > 10 ? 0 : 2;
      resultado.push({
        faixa: `${inicio.toFixed(casas)}`,
        inicio,
        fim,
        centro,
        total: 0,
        viaveis: 0,
        inviaveis: 0,
      });
    }

    dadosValidos.forEach((d) => {
      const idx = Math.min(
        numBins - 1,
        Math.floor((d.valor - estat.min) / larguraBin)
      );
      if (resultado[idx]) {
        resultado[idx].total++;
        if (d.classe === 'viavel') resultado[idx].viaveis++;
        else resultado[idx].inviaveis++;
      }
    });

    return resultado;
  }, [estat, dadosValidos]);

  // Dados para o Gráfico de Dispersão C × L
  const dadosDispersao = useMemo(() => {
    return medicoes
      .filter((m) => m.comprimentoPx != null && m.larguraPx != null)
      .map((m) => ({
        comp: calibrado && m.comprimentoMm ? m.comprimentoMm : m.comprimentoPx!,
        larg: calibrado && m.larguraMm ? m.larguraMm : m.larguraPx!,
        classe: m.classe,
        id: m.objectId,
      }));
  }, [medicoes, calibrado]);

  if (medicoes.length === 0) {
    return (
      <div className="p-3 text-xs text-ink-3 italic text-center">
        Nenhuma semente para construir o histograma.
      </div>
    );
  }

  const rotuloUnidade = (v: VariavelMorfometrica) => {
    switch (v) {
      case 'area':
        return calibrado ? 'mm²' : 'px²';
      case 'comprimento':
      case 'largura':
        return calibrado ? 'mm' : 'px';
      case 'razaoCL':
      case 'circularidade':
      case 'solidez':
        return '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Controles do Card */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={variavel}
          onChange={(e) => setVariavel(e.target.value as VariavelMorfometrica)}
          className="border-line bg-surface-1 text-ink-1 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-accent outline-none font-medium flex-1"
        >
          <option value="area">Área ({rotuloUnidade('area')})</option>
          <option value="comprimento">Comprimento ({rotuloUnidade('comprimento')})</option>
          <option value="largura">Largura ({rotuloUnidade('largura')})</option>
          <option value="razaoCL">Razão C/L (Alongamento)</option>
          <option value="circularidade">Circularidade (Ψ)</option>
          <option value="solidez">Solidez (Convexidade)</option>
        </select>

        <div className="flex items-center bg-surface-2 border border-line-soft rounded p-0.5 text-[10px] font-bold">
          <button
            onClick={() => setModo('histograma')}
            className={`px-2 py-0.5 rounded transition-colors ${
              modo === 'histograma' ? 'bg-accent text-accent-on' : 'text-ink-3 hover:text-ink-1'
            }`}
          >
            Histograma
          </button>
          <button
            onClick={() => setModo('dispersao')}
            className={`px-2 py-0.5 rounded transition-colors ${
              modo === 'dispersao' ? 'bg-accent text-accent-on' : 'text-ink-3 hover:text-ink-1'
            }`}
          >
            C × L
          </button>
        </div>
      </div>

      {/* Gráfico */}
      {modo === 'histograma' ? (
        <div className="h-44 w-full pt-2">
          {bins.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="faixa"
                  tick={{ fontSize: 9, fill: 'var(--color-ink-3, #71717a)' }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 9, fill: 'var(--color-ink-3, #71717a)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-1, #18181b)',
                    borderColor: 'var(--color-line, #3f3f46)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--color-ink-1, #f4f4f5)',
                  }}
                  formatter={(val: any, name: string) => [
                    `${val} sementes`,
                    name === 'viaveis' ? 'Viáveis' : 'Inviáveis',
                  ]}
                  labelFormatter={(l) => `Faixa a partir de: ${l}`}
                />
                {estat && (
                  <ReferenceLine
                    x={bins.find((b) => estat.mediana >= b.inicio && estat.mediana <= b.fim)?.faixa}
                    stroke="var(--color-accent, #10b981)"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Mediana',
                      fill: 'var(--color-accent, #10b981)',
                      fontSize: 9,
                      position: 'top',
                    }}
                  />
                )}
                <Bar
                  dataKey="viaveis"
                  stackId="a"
                  fill="var(--color-ov-viable, #00d2ff)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="inviaveis"
                  stackId="a"
                  fill="var(--color-ov-inviable, #ff007f)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-ink-3">
              Sem dados suficientes
            </div>
          )}
        </div>
      ) : (
        <div className="h-44 w-full pt-2">
          {dadosDispersao.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  type="number"
                  dataKey="comp"
                  name="Comprimento"
                  tick={{ fontSize: 9, fill: 'var(--color-ink-3, #71717a)' }}
                  unit={calibrado ? 'mm' : 'px'}
                />
                <YAxis
                  type="number"
                  dataKey="larg"
                  name="Largura"
                  tick={{ fontSize: 9, fill: 'var(--color-ink-3, #71717a)' }}
                  unit={calibrado ? 'mm' : 'px'}
                />
                <ZAxis range={[20, 20]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-1, #18181b)',
                    borderColor: 'var(--color-line, #3f3f46)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--color-ink-1, #f4f4f5)',
                  }}
                  formatter={(val: any, name: string) => [
                    `${val} ${calibrado ? 'mm' : 'px'}`,
                    name,
                  ]}
                />
                <Scatter
                  name="Viáveis"
                  data={dadosDispersao.filter((d) => d.classe === 'viavel')}
                  fill="var(--color-ov-viable, #00d2ff)"
                  opacity={0.7}
                />
                <Scatter
                  name="Inviáveis"
                  data={dadosDispersao.filter((d) => d.classe !== 'viavel')}
                  fill="var(--color-ov-inviable, #ff007f)"
                  opacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-ink-3">
              Sem dados de dispersão
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-ink-3 flex items-center justify-between border-t border-line-soft pt-1 font-mono">
        {estat && (
          <>
            <span>Mediana: {estat.mediana.toFixed(2)}</span>
            <span>Média: {estat.media.toFixed(2)}</span>
          </>
        )}
      </div>
    </div>
  );
}
