import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { GroupStat } from '../../../lib/stats';
import { analisarFatorQuantitativo, numeroParaTela } from '../fator-quantitativo';

/**
 * O cartão da regressão, ao lado da ANOVA.
 *
 * Aparece só quando os rótulos dos tratamentos têm um número dentro (T0, T8,
 * T16; −0,3 MPa…). Não substitui a comparação de médias — responde a outra
 * pergunta: como a resposta varia com o nível, e onde está o ótimo. A tabela
 * de níveis lidos fica visível de propósito: é onde a pessoa vê que "T8"
 * virou 8, e discorda se for o caso.
 */
interface Props {
  grupos: GroupStat[];
  /** O que está sendo medido, para a legenda: "germinação (%)". */
  resposta?: string;
}

export function CardFatorQuantitativo({ grupos, resposta = 'germinação (%)' }: Props) {
  const a = analisarFatorQuantitativo(grupos);
  if (a.comNivel === 0) return null;

  const r = a.regressao;
  const escolhido = r ? r.ajustes.find((x) => x.grau === r.recomendado) : null;

  return (
    <div className="bg-surface-1 border-line rounded-panel overflow-hidden border shadow-sm">
      <div className="border-line-soft flex items-center gap-2 border-b px-4 py-3">
        <TrendingUp size={15} className="text-accent shrink-0" />
        <div>
          <h4 className="text-ink-2 text-[11px] font-bold tracking-wider uppercase">
            Fator quantitativo — regressão polinomial
          </h4>
          <p className="text-ink-3 text-[10px]">
            Quando o tratamento é um nível numérico, a pergunta não é &ldquo;quais diferem&rdquo;, é
            &ldquo;como a {resposta} varia com o nível, e onde está o ótimo&rdquo;.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Os níveis lidos, para conferir. */}
        <div className="text-ink-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums">
          {a.niveis.map((n) => (
            <span key={n.rotulo} title={n.trecho ? `lido "${n.trecho}" em "${n.rotulo}"` : 'sem número no rótulo'}>
              {n.rotulo} → {n.nivel === null ? <span className="text-warn">sem nível</span> : numeroParaTela(n.nivel, 2)}
            </span>
          ))}
        </div>

        {!r || !escolhido ? (
          <p className="text-ink-2 text-[11px] leading-snug">{a.motivoSemRegressao}</p>
        ) : (
          <>
            <p className="text-ink-1 font-mono text-[13px] font-semibold tabular-nums">{a.equacao}</p>
            <p className="text-ink-2 text-[11px] leading-snug">
              Grau {r.recomendado} recomendado — {r.motivo} R² = {numeroParaTela(escolhido.r2, 3)} · R²
              ajustado = {numeroParaTela(escolhido.r2Ajustado, 3)} · n = {r.n}.
            </p>

            {/* O ótimo — ou a razão de não haver um. */}
            {r.otimo ? (
              r.otimo.dentroDaFaixa ? (
                <p className="text-accent text-[11px] font-semibold">
                  {r.otimo.tipo === 'maximo' ? 'Máximo' : 'Mínimo'} estimado em x ={' '}
                  {numeroParaTela(r.otimo.x, 2)} ({resposta} ≈ {numeroParaTela(r.otimo.y, 1)}), dentro
                  da faixa testada [{numeroParaTela(r.faixaDeX[0], 2)}; {numeroParaTela(r.faixaDeX[1], 2)}].
                </p>
              ) : (
                <p className="text-warn text-[11px] leading-snug">
                  O {r.otimo.tipo === 'maximo' ? 'máximo' : 'mínimo'} da curva cai em x ={' '}
                  {numeroParaTela(r.otimo.x, 2)}, <strong>fora</strong> da faixa testada [
                  {numeroParaTela(r.faixaDeX[0], 2)}; {numeroParaTela(r.faixaDeX[1], 2)}]. Isso é
                  extrapolação, não resultado: o ótimo está além dos níveis ensaiados.
                </p>
              )
            ) : (
              <p className="text-ink-3 text-[11px]">
                Grau 1: a resposta {escolhido.coeficientes[1] >= 0 ? 'cresce' : 'cai'} com o nível em toda a
                faixa; não há ótimo interior.
              </p>
            )}

            {/* Os três graus, para quem quer ver o teste. */}
            <table className="text-ink-2 w-full font-mono text-[10px] tabular-nums">
              <thead>
                <tr className="text-ink-3 text-left">
                  <th className="pr-2 font-semibold">grau</th>
                  <th className="pr-2 font-semibold">R²</th>
                  <th className="pr-2 font-semibold">R² aj.</th>
                  <th className="pr-2 font-semibold" title="F do termo de maior grau contra o grau anterior">F seq.</th>
                  <th className="font-semibold">p</th>
                </tr>
              </thead>
              <tbody>
                {r.ajustes.map((aj) => (
                  <tr key={aj.grau} className={aj.grau === r.recomendado ? 'text-ink-1 font-semibold' : ''}>
                    <td className="pr-2">{aj.grau}</td>
                    <td className="pr-2">{numeroParaTela(aj.r2, 3)}</td>
                    <td className="pr-2">{numeroParaTela(aj.r2Ajustado, 3)}</td>
                    <td className="pr-2">{aj.fSequencial === null ? '—' : numeroParaTela(aj.fSequencial, 2)}</td>
                    <td>{aj.pSequencial === null ? '—' : aj.pSequencial < 0.001 ? '< 0,001' : numeroParaTela(aj.pSequencial, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
