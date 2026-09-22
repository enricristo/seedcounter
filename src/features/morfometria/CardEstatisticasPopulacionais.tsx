// =============================================================================
// SeedCounter — Card de Estatísticas Descritivas Populacionais
//
// Apresenta mediana e intervalo interquartil (p5–p95) para todas as métricas
// morfológicas da cena. Baseado nas recomendações de valor-de-boletim.ts.
// =============================================================================

import React from 'react';
import type { ResumoDeMorfometria, EstatisticaDeMedida } from './resumo';
import { formatar, medido } from '../../lib/normas/valor-de-boletim';

interface CardEstatisticasPopulacionaisProps {
  resumo: ResumoDeMorfometria | null;
  especie?: string;
}

function px(v: number): string {
  return formatar(medido(v), 0);
}

function mm(v: number, casas: number): string {
  return formatar(medido(v), casas);
}

function LinhaMetrica({
  rotulo,
  estatPx,
  estatMm,
  casasMm = 2,
  unidadeMm = 'mm',
  unidadePx = 'px',
}: {
  rotulo: string;
  estatPx?: EstatisticaDeMedida | null;
  estatMm?: EstatisticaDeMedida | null;
  casasMm?: number;
  unidadeMm?: string;
  unidadePx?: string;
}) {
  if (!estatPx && !estatMm) return null;

  const secundario = estatMm ? estatPx : null;

  const valorMediana = estatMm ? mm(estatMm.mediana, casasMm) : px(estatPx!.mediana);
  const valorP5 = estatMm ? mm(estatMm.p5, casasMm) : px(estatPx!.p5);
  const valorP95 = estatMm ? mm(estatMm.p95, casasMm) : px(estatPx!.p95);
  const unidade = estatMm ? unidadeMm : unidadePx;

  return (
    <tr className="border-t border-neutral-200/60 dark:border-zinc-800/80 text-xs">
      <td className="py-1.5 pr-2 font-medium text-ink-2 whitespace-nowrap">{rotulo}</td>
      <td className="py-1.5 pr-2 font-mono tabular-nums text-ink-1 whitespace-nowrap text-right">
        {valorMediana} <span className="text-[10px] text-ink-3">{unidade}</span>
        {secundario && (
          <span className="text-[10px] text-ink-3 block font-sans">
            {px(secundario.mediana)} px
          </span>
        )}
      </td>
      <td className="py-1.5 font-mono tabular-nums text-ink-3 whitespace-nowrap text-right">
        {valorP5}–{valorP95}
      </td>
    </tr>
  );
}

export function CardEstatisticasPopulacionais({
  resumo,
  especie,
}: CardEstatisticasPopulacionaisProps) {
  if (!resumo || resumo.comContorno === 0) {
    return (
      <div className="p-3 text-xs text-ink-3 italic text-center">
        Nenhum contorno medido ainda. Detecte ou contorne sementes para ver a biometria.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {especie && (
        <div className="text-[11px] font-sans text-ink-2 bg-surface-2/60 border border-line-soft px-2 py-1 rounded">
          Referência da espécie: <span className="font-semibold italic text-ink-1">{especie}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase font-bold tracking-wider text-ink-3 pb-1 border-b border-line">
              <th className="font-semibold pb-1">Métrica</th>
              <th className="font-semibold pb-1 text-right">Mediana</th>
              <th className="font-semibold pb-1 text-right">IQR (p5–p95)</th>
            </tr>
          </thead>
          <tbody>
            <LinhaMetrica
              rotulo="Área"
              estatMm={resumo.areaMm2}
              estatPx={resumo.areaPx}
              unidadeMm="mm²"
              unidadePx="px²"
              casasMm={2}
            />
            <LinhaMetrica
              rotulo="Comprimento"
              estatMm={resumo.comprimentoMm}
              estatPx={resumo.comprimentoPx}
              unidadeMm="mm"
              unidadePx="px"
              casasMm={2}
            />
            <LinhaMetrica
              rotulo="Largura"
              estatMm={resumo.larguraMm}
              estatPx={resumo.larguraPx}
              unidadeMm="mm"
              unidadePx="px"
              casasMm={2}
            />
            <LinhaMetrica
              rotulo="Razão C/L"
              estatPx={resumo.razaoCL}
              unidadePx=""
              casasMm={2}
            />
            {resumo.circularidade && (
              <LinhaMetrica
                rotulo="Circularidade"
                estatPx={resumo.circularidade}
                unidadePx=""
                casasMm={2}
              />
            )}
            {resumo.solidez && (
              <LinhaMetrica
                rotulo="Solidez"
                estatPx={resumo.solidez}
                unidadePx=""
                casasMm={2}
              />
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-ink-3 pt-1 border-t border-line-soft flex items-center justify-between">
        <span>Contornos avaliados:</span>
        <span className="font-mono font-bold text-ink-2">{resumo.comContorno} de {resumo.total}</span>
      </div>
    </div>
  );
}
