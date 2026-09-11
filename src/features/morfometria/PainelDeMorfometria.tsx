// =============================================================================
// SeedCounter — Painel de Morfometria (ao vivo)
//
// A resposta ao espaço morto ao lado da imagem: em vez de vazio, o número que
// o laboratório quer ver, atualizado a cada marcação, contorno ou calibração.
//
// POR QUE UMA TABELA E NÃO UM GRÁFICO.
//
// O painel cabe em ~280 px ao lado da imagem — largura de barra lateral, não
// de dashboard. Mediana e p5–p95 em texto tabular cabem nessa largura e são
// exatos; um histograma nessa largura não seria nem legível nem exato. O
// gráfico fica para a tela de estatísticas (StatsView), que tem a área para
// isso.
//
// PX E MM SEMPRE JUNTOS.
//
// A régua dupla do projeto (formatLengthDual/formatAreaDual em calibration.ts)
// existe porque o pixel é o que a imagem tem e o milímetro é o que o laudo
// publica — mostrar só um obriga a converter de cabeça. Aqui a mesma ideia
// vira "123 px · 0,869 mm" na mesma célula, em vez de duas tabelas.
//
// POR QUE NÃO `toFixed`.
//
// `(99.85).toFixed(1)` arredonda para baixo por causa da representação binária
// (ver valor-de-boletim.ts). Não é um detalhe de laudo formal: é o mesmo motivo
// pelo qual um número que aparece na tela do laboratório tem de vir de
// `arredondar`/`formatar`, não de `toFixed` direto.
// =============================================================================

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { EstatisticaDeMedida, ResumoDeMorfometria } from './resumo';
import { formatar, medido } from '../../lib/normas/valor-de-boletim';
import { acharPorNome } from '../../lib/normas/tamanhos-de-semente';

interface PainelDeMorfometriaProps {
  resumo: ResumoDeMorfometria | null;
  /** Nome (comum ou científico) da espécie declarada — para a faixa de referência. */
  especie?: string;
  /** Modo compacto: só totais + mediana de comprimento + razão C/L. */
  compacto?: boolean;
  onFechar?: () => void;
}

// Quantos objetos com contorno são necessários para a tabela de medidas fazer
// sentido — com 1 ou 2 pontos, mediana e p5–p95 são só os próprios valores.
const MINIMO_PARA_TABELA = 3;

/** `casas` decimais em pixel — sempre inteiro, mas passa por `arredondar`. */
function px(v: number): string {
  return formatar(medido(v), 0);
}

function mm(v: number, casas: number): string {
  return formatar(medido(v), casas);
}

/** "5–11" sem zero decorativo, para a frase de referência da espécie. */
function faixaCurta(min: number, max: number): string {
  const casas = Number.isInteger(min) && Number.isInteger(max) ? 0 : 1;
  return `${mm(min, casas)}–${mm(max, casas)}`;
}

function Swatch({ cor }: { cor: 'viavel' | 'inviavel' }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        cor === 'viavel' ? 'bg-[var(--color-ov-viable)]' : 'bg-[var(--color-ov-inviable)]'
      }`}
      aria-hidden="true"
    />
  );
}

/**
 * Uma linha da tabela: rótulo, mediana (px · mm) e faixa p5–p95 (px · mm).
 *
 * `area` escolhe a unidade certa dos DOIS lados — px²/mm² — sem depender de um
 * sufixo textual único compartilhado entre px e mm, que era o bug da primeira
 * versão (a área saía com "px²" também no valor em mm).
 */
function LinhaMedida({
  rotulo,
  estatPx,
  estatMm,
  casasMm,
  area = false,
}: {
  rotulo: string;
  estatPx: EstatisticaDeMedida | null;
  estatMm: EstatisticaDeMedida | null;
  casasMm: number;
  area?: boolean;
}) {
  if (!estatPx) return null;

  const unidadePx = area ? 'px²' : 'px';
  const unidadeMm = area ? 'mm²' : 'mm';

  const medianaMm = estatMm ? `${mm(estatMm.mediana, casasMm)} ${unidadeMm}` : null;
  const faixaMm = estatMm
    ? `${mm(estatMm.p5, casasMm)}–${mm(estatMm.p95, casasMm)} ${unidadeMm}`
    : null;

  return (
    <tr className="border-line-soft border-t">
      <td className="text-ink-2 py-1 pr-2 font-medium whitespace-nowrap">{rotulo}</td>
      <td className="text-ink-1 py-1 pr-2 font-mono tabular-nums whitespace-nowrap">
        {px(estatPx.mediana)} {unidadePx}
        {medianaMm && <span className="text-ink-3"> · {medianaMm}</span>}
      </td>
      <td className="text-ink-3 py-1 font-mono tabular-nums whitespace-nowrap">
        {px(estatPx.p5)}–{px(estatPx.p95)} {unidadePx}
        {faixaMm && <span> · {faixaMm}</span>}
      </td>
    </tr>
  );
}

export function PainelDeMorfometria({
  resumo,
  especie,
  compacto = false,
  onFechar,
}: PainelDeMorfometriaProps) {
  const referencia = acharPorNome(especie);

  const semDados = !resumo || resumo.total === 0;

  const razaoForaDoEsperado =
    !semDados &&
    resumo!.razaoCL &&
    referencia?.razaoMinima !== undefined &&
    referencia?.razaoMaxima !== undefined &&
    (resumo!.razaoCL.mediana < referencia.razaoMinima ||
      resumo!.razaoCL.mediana > referencia.razaoMaxima);

  return (
    <section className="rounded-panel border-line bg-surface-1 w-full max-w-[280px] border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">Morfometria</h3>
        {onFechar && (
          <button
            onClick={onFechar}
            aria-label="Fechar painel de morfometria"
            className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded-control -m-1 p-1 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {semDados ? (
        <p className="text-ink-3 text-[11px] leading-snug">
          Marque a primeira semente para ver as medidas.
        </p>
      ) : (
        <div className="space-y-3">
          {/* --- Totais ------------------------------------------------------ */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-surface-2 rounded-control flex flex-col items-center gap-0.5 py-1.5">
              <span className="text-ink-3 flex items-center gap-1 text-[9px] font-bold tracking-wide uppercase">
                <Swatch cor="viavel" /> Viáv.
              </span>
              <span className="text-ink-1 font-mono text-sm font-semibold tabular-nums">
                {resumo!.viaveis}
              </span>
            </div>
            <div className="bg-surface-2 rounded-control flex flex-col items-center gap-0.5 py-1.5">
              <span className="text-ink-3 flex items-center gap-1 text-[9px] font-bold tracking-wide uppercase">
                <Swatch cor="inviavel" /> Inviáv.
              </span>
              <span className="text-ink-1 font-mono text-sm font-semibold tabular-nums">
                {resumo!.inviaveis}
              </span>
            </div>
            <div className="bg-surface-2 rounded-control flex flex-col items-center gap-0.5 py-1.5">
              <span className="text-ink-3 text-[9px] font-bold tracking-wide uppercase">Total</span>
              <span className="text-ink-1 font-mono text-sm font-semibold tabular-nums">
                {resumo!.total}
              </span>
            </div>
          </div>

          <p className="text-center leading-none">
            <span className="text-accent font-mono text-2xl font-bold tabular-nums">
              {formatar(medido(resumo!.percentViaveis), 1)}%
            </span>
            <span className="text-ink-3 mt-1 block text-[9px] tracking-wide uppercase">viáveis</span>
          </p>

          {compacto ? (
            // --- Modo compacto: só mediana de comprimento + razão C/L. ------
            <div className="border-line-soft flex items-baseline justify-between border-t pt-2 text-[10px]">
              {resumo!.comprimentoPx && (
                <span className="text-ink-2 font-mono tabular-nums">
                  C: {px(resumo!.comprimentoPx.mediana)} px
                  {resumo!.comprimentoMm && <> · {mm(resumo!.comprimentoMm.mediana, 2)} mm</>}
                </span>
              )}
              {resumo!.razaoCL && (
                <span className="text-ink-2 font-mono tabular-nums">
                  C/L: {mm(resumo!.razaoCL.mediana, 2)}
                </span>
              )}
            </div>
          ) : (
            <>
              {/* --- Cobertura ------------------------------------------------ */}
              <div>
                <div className="text-ink-3 flex items-baseline justify-between text-[10px]">
                  <span>Cobertura</span>
                  <span className="font-mono tabular-nums">
                    {resumo!.comContorno} de {resumo!.total} com contorno
                  </span>
                </div>
                <div className="bg-surface-2 mt-1 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-accent h-full transition-all"
                    style={{
                      width: `${resumo!.total > 0 ? (resumo!.comContorno / resumo!.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {resumo!.semContorno > 0 && (
                  <p className="text-ink-3 mt-1 text-[9px]">{resumo!.semContorno} sem contorno</p>
                )}
              </div>

              {/* --- Medidas ---------------------------------------------------- */}
              {resumo!.comContorno >= MINIMO_PARA_TABELA && (
                <div className="border-line-soft border-t pt-2">
                  <table className="w-full text-[10.5px]">
                    <thead>
                      <tr className="text-ink-3 text-[9px] tracking-wide uppercase">
                        <th className="pb-1 text-left font-bold">Medida</th>
                        <th className="pb-1 text-left font-bold">Mediana</th>
                        <th className="pb-1 text-left font-bold">p5–p95</th>
                      </tr>
                    </thead>
                    <tbody>
                      <LinhaMedida
                        rotulo="Comprimento"
                        estatPx={resumo!.comprimentoPx}
                        estatMm={resumo!.comprimentoMm}
                        casasMm={2}
                      />
                      <LinhaMedida
                        rotulo="Largura"
                        estatPx={resumo!.larguraPx}
                        estatMm={resumo!.larguraMm}
                        casasMm={2}
                      />
                      <LinhaMedida
                        rotulo="Área"
                        estatPx={resumo!.areaPx}
                        estatMm={resumo!.areaMm2}
                        casasMm={3}
                        area
                      />
                      {resumo!.razaoCL && (
                        <tr className="border-line-soft border-t">
                          <td className="text-ink-2 py-1 pr-2 font-medium whitespace-nowrap">
                            Razão C/L
                          </td>
                          <td className="text-ink-1 py-1 pr-2 font-mono tabular-nums">
                            {mm(resumo!.razaoCL.mediana, 2)}
                          </td>
                          <td className="text-ink-3 py-1 font-mono tabular-nums">
                            {mm(resumo!.razaoCL.p5, 2)}–{mm(resumo!.razaoCL.p95, 2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {!resumo!.calibrado && (
                    <p className="text-ink-3 mt-1.5 text-[9px] leading-snug">
                      Calibre para ver em mm.
                    </p>
                  )}

                  {referencia && (
                    <p className="text-ink-3 mt-1.5 text-[10px] leading-snug">
                      {referencia.nomeComum} costuma ter {faixaCurta(referencia.minimo, referencia.maximo)}{' '}
                      mm de comprimento.
                    </p>
                  )}

                  {razaoForaDoEsperado && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Razão fora do esperado para a espécie — pode haver contornos com duas
                      sementes.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
