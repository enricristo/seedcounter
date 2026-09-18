// =============================================================================
// SeedCounter — Painel de Comparação entre Bancadas (C2, Task 5)
//
// Só aparece com DUAS OU MAIS bancadas abertas COM IMAGEM — com uma só, a
// aba Resultados continua exatamente como hoje (Global Constraints do plano
// de bancadas: nenhuma mudança visível com uma bancada). É este componente
// que decide isso, retornando `null`, para quem o usa (`RightSidebar` via
// `App.tsx`) não precisar repetir a contagem.
//
// A tabela usa `comparacao.ts` (puro, testado) para as linhas e para a regra
// que não cai: calibrações divergentes (>5%) derrubam a coluna de mm² para
// px², com a frase explicando por quê — nunca finge que áreas de escalas
// diferentes são a mesma unidade.
// =============================================================================

import { Download } from 'lucide-react';
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
import type { Bancadas as BancadasEstado } from '../../hooks/useBancadas';
import {
  compararBancadas,
  decidirEscala,
  serieNoTempo,
  type EntradaDeComparacao,
  type LinhaDeComparacao,
} from './comparacao';
import { baixarArquivo, nomeDeExportacao } from '../../lib/download';

interface PainelDeComparacaoProps {
  bancadas: BancadasEstado;
}

/** `.toFixed` com vírgula decimal — a mesma convenção usada no resto do app (ver `limites-adaptaveis.ts`, `synthetic-data.ts`). */
function numero(v: number, casas: number): string {
  return v.toFixed(casas).replace('.', ',');
}

/**
 * Data de referência de uma bancada, para a série no tempo.
 *
 * `Metadata` não tem campo de data — o app não pede "quando foi tirada esta
 * foto". Na falta dele, `lastModified` do arquivo carregado é a melhor
 * aproximação disponível sem inventar uma UI de data só para isto.
 */
function dataDaBancada(arquivoAtual: File | undefined): string | undefined {
  return arquivoAtual ? new Date(arquivoAtual.lastModified).toISOString() : undefined;
}

function montarEntradas(bancadas: BancadasEstado): EntradaDeComparacao[] {
  const entradas: EntradaDeComparacao[] = [];
  for (let i = 0; i < bancadas.abertas; i++) {
    const b = bancadas.todas[i];
    if (!b || !b.fila.image) continue; // só bancada aberta COM IMAGEM entra na comparação
    const arquivoAtual = b.fila.imageQueue[b.fila.currentImageIndex];
    entradas.push({
      bancada: i + 1,
      arquivo: b.fila.filename || `Bancada ${i + 1}`,
      marks: b.anotacoes.marks,
      segmentacoes: b.anotacoes.yoloSegmentations,
      umPerPixel: b.meta.metadata.umPerPixel,
      placa: b.meta.metadata.plate,
      data: dataDaBancada(arquivoAtual),
    });
  }
  return entradas;
}

function paraCsv(linhas: LinhaDeComparacao[], usarMm2: boolean): string {
  const colunaArea = usarMm2 ? 'area_mediana_mm2' : 'area_mediana_px2';
  const header = ['bancada', 'rotulo', 'total', 'viaveis', 'inviaveis', colunaArea, 'escala_um_por_px'];
  const linhasCsv = linhas.map((l) => {
    const area = usarMm2 ? l.areaMedianaMm2 : l.areaMedianaPx;
    return [
      String(l.bancada),
      l.rotulo,
      String(l.total),
      String(l.viaveis),
      String(l.inviaveis),
      area !== null ? numero(area, usarMm2 ? 4 : 1) : '',
      l.umPorPixel !== undefined ? numero(l.umPorPixel, 2) : '',
    ].join(';');
  });
  // BOM para o Excel reconhecer acentuação — mesma convenção de `measurementsToCSV`.
  return '﻿' + [header.join(';'), ...linhasCsv].join('\r\n');
}

export function PainelDeComparacao({ bancadas }: PainelDeComparacaoProps) {
  const entradas = montarEntradas(bancadas);

  // Regra do plano: só existe comparação com DUAS OU MAIS bancadas com
  // imagem. Com uma (o caso comum), este painel não deve mudar nada na aba
  // Resultados — `null` é o jeito de não mudar nada.
  if (entradas.length < 2) return null;

  const linhas = compararBancadas(entradas);
  const decisao = decidirEscala(linhas);
  const serie = serieNoTempo(
    linhas,
    entradas.map((e) => e.data)
  );

  const exportar = () => {
    const csv = paraCsv(linhas, decisao.usarMm2);
    baixarArquivo(csv, nomeDeExportacao({ tipo: 'comparacao-bancadas' }, 'csv'), 'text/csv;charset=utf-8');
  };

  return (
    <section aria-label="Comparação entre bancadas" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-2">
          Comparação entre bancadas
        </h3>
        <button
          type="button"
          onClick={exportar}
          title="Exportar comparação em CSV"
          aria-label="Exportar comparação em CSV"
          className="flex items-center gap-1 rounded-control border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-2 transition-colors hover:bg-surface-2"
        >
          <Download size={12} aria-hidden="true" />
          CSV
        </button>
      </div>

      {!decisao.usarMm2 && decisao.motivo && (
        <p className="text-[11px] text-ink-3 italic" role="status">
          {decisao.motivo}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Uma coluna por bancada aberta, com total, viáveis, inviáveis, área mediana e escala</caption>
          <thead>
            <tr className="border-b border-line-soft text-left text-ink-3">
              <th scope="col" className="py-1 pr-2 font-medium">Métrica</th>
              {linhas.map((l) => (
                <th
                  key={l.bancada}
                  scope="col"
                  className="py-1 pr-2 text-right font-medium whitespace-nowrap"
                  title={l.rotulo}
                >
                  {l.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums text-ink-1">
            <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80">
              <th scope="row" className="py-1 pr-2 text-left font-sans font-medium text-ink-2">Total</th>
              {linhas.map((l) => (
                <td key={l.bancada} className="py-1 pr-2 text-right">{l.total}</td>
              ))}
            </tr>
            <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80">
              <th scope="row" className="py-1 pr-2 text-left font-sans font-medium text-ink-2">Viáveis</th>
              {linhas.map((l) => (
                <td key={l.bancada} className="py-1 pr-2 text-right">{l.viaveis}</td>
              ))}
            </tr>
            <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80">
              <th scope="row" className="py-1 pr-2 text-left font-sans font-medium text-ink-2">Inviáveis</th>
              {linhas.map((l) => (
                <td key={l.bancada} className="py-1 pr-2 text-right">{l.inviaveis}</td>
              ))}
            </tr>
            <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80">
              <th scope="row" className="py-1 pr-2 text-left font-sans font-medium text-ink-2">
                Área mediana ({decisao.usarMm2 ? 'mm²' : 'px²'})
              </th>
              {linhas.map((l) => {
                const area = decisao.usarMm2 ? l.areaMedianaMm2 : l.areaMedianaPx;
                return (
                  <td key={l.bancada} className="py-1 pr-2 text-right">
                    {area !== null ? numero(area, decisao.usarMm2 ? 4 : 1) : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80">
              <th scope="row" className="py-1 pr-2 text-left font-sans font-medium text-ink-2">Escala (µm/px)</th>
              {linhas.map((l) => (
                <td key={l.bancada} className="py-1 pr-2 text-right">
                  {l.umPorPixel !== undefined ? numero(l.umPorPixel, 2) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {serie && (
        <div className="h-[160px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie.pontos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
        </div>
      )}
    </section>
  );
}
