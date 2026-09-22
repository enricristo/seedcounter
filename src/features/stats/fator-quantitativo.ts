// =============================================================================
// SeedCounter — quando o tratamento é um NÚMERO, a análise muda
//
// POR QUE ESTE MÓDULO EXISTE.
//
// A vista de Estatísticas agrupa sessões por tratamento e compara as médias
// (ANOVA, Tukey, Scott-Knott). Isso é o certo quando os tratamentos são
// rótulos — cultivar A, cultivar B. Mas nos ensaios do grupo o tratamento
// costuma ser um NÍVEL de um fator contínuo: "T0, T8, T16, T24" (horas de
// embebição), "0, −0,3, −0,6, −0,9 MPa" (potencial osmótico), "0, 3, 6, 12
// meses" (armazenamento). Para esses, separar médias por letras responde a
// pergunta errada; a certa é "como a resposta varia com o nível, e onde está o
// ótimo" — e a resposta é uma curva ajustada, não uma letra.
//
// Este módulo faz a ponte: lê o número que está dentro do rótulo do
// tratamento, e quando três ou mais tratamentos têm nível numérico, entrega
// os pontos para `lib/regressao-polinomial`. Não substitui a ANOVA — vem ao
// lado dela, porque as duas perguntas são diferentes.
//
// A LEITURA DO NÚMERO É CONSERVADORA.
//
// "T8" → 8; "-0,6 MPa" → −0,6; "12 meses" → 12; "controle" → sem nível. Um
// rótulo com dois números ("T8 rep2") é ambíguo e NÃO vira nível — melhor a
// regressão não aparecer do que aparecer com x errado. A pessoa vê, na tabela,
// qual número foi lido de qual rótulo, e pode discordar.
// =============================================================================

import type { GroupStat } from '../../lib/stats';
import {
  regressaoPolinomial,
  equacaoComoTexto,
  type ResultadoDaRegressao,
  type PontoDeRegressao,
} from '../../lib/regressao-polinomial';

export interface NivelLido {
  rotulo: string;
  /** O número lido do rótulo, ou `null` quando não há um número inequívoco. */
  nivel: number | null;
  /** O trecho de onde o número saiu, para a pessoa conferir. */
  trecho: string | null;
}

/**
 * O número dentro do rótulo do tratamento.
 *
 * Aceita vírgula decimal, sinal, e um sufixo de unidade. Recusa rótulos sem
 * número ou com mais de um — ambiguidade não vira eixo x.
 */
export function nivelDoTratamento(rotulo: string): NivelLido {
  const numeros = [...rotulo.matchAll(/[-−]?\d+(?:[.,]\d+)?/g)];
  if (numeros.length !== 1) return { rotulo, nivel: null, trecho: null };
  const trecho = numeros[0][0];
  const valor = Number(trecho.replace('−', '-').replace(',', '.'));
  if (!Number.isFinite(valor)) return { rotulo, nivel: null, trecho: null };
  return { rotulo, nivel: valor, trecho };
}

export interface AnaliseDeFatorQuantitativo {
  niveis: NivelLido[];
  /** Quantos tratamentos tinham nível numérico. */
  comNivel: number;
  /** `null` quando há menos de três níveis distintos — a curva não existe. */
  regressao: ResultadoDaRegressao | null;
  /** A equação do grau recomendado, como num artigo. */
  equacao: string | null;
  /** Por que não houve regressão, quando não houve. */
  motivoSemRegressao: string | null;
}

/**
 * Da tabela de grupos (rótulo → repetições em %) para a regressão.
 *
 * Cada repetição vira um ponto (x = nível, y = %): a dispersão dentro do
 * nível é o que dá o resíduo, e sem ela o teste F não existe. Usar só a
 * média por nível esconderia a variação que decide se o grau é significativo.
 */
export function analisarFatorQuantitativo(grupos: GroupStat[]): AnaliseDeFatorQuantitativo {
  const niveis = grupos.map((g) => nivelDoTratamento(g.label));
  const comNivel = niveis.filter((n) => n.nivel !== null).length;
  const distintos = new Set(niveis.filter((n) => n.nivel !== null).map((n) => n.nivel)).size;

  if (distintos < 3) {
    return {
      niveis,
      comNivel,
      regressao: null,
      equacao: null,
      motivoSemRegressao:
        distintos === 0
          ? 'Nenhum tratamento tem um número no rótulo. A regressão precisa de níveis numéricos (ex.: T0, T8, T16; ou −0,3, −0,6 MPa).'
          : `Só ${distintos} nível${distintos === 1 ? '' : 'is'} numérico${distintos === 1 ? '' : 's'} distinto${distintos === 1 ? '' : 's'}; a curva precisa de pelo menos três.`,
    };
  }

  const pontos: PontoDeRegressao[] = [];
  grupos.forEach((g, i) => {
    const x = niveis[i].nivel;
    if (x === null) return;
    for (const y of g.values) if (Number.isFinite(y)) pontos.push({ x, y });
  });

  const regressao = regressaoPolinomial(pontos);
  if (regressao === null) {
    return {
      niveis,
      comNivel,
      regressao: null,
      equacao: null,
      motivoSemRegressao: 'Pontos insuficientes para ajustar (menos de três repetições no total).',
    };
  }
  const escolhido = regressao.ajustes.find((a) => a.grau === regressao.recomendado) ?? regressao.ajustes[0];
  return {
    niveis,
    comNivel,
    regressao,
    equacao: equacaoComoTexto(escolhido, 3),
    motivoSemRegressao: null,
  };
}

/** "−0,52" com vírgula decimal e o sinal tipográfico, para a tela. */
export function numeroParaTela(v: number, casas = 2): string {
  const s = Math.abs(v).toFixed(casas).replace('.', ',');
  return v < 0 ? `−${s}` : s;
}
