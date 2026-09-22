// =============================================================================
// SeedCounter — germinação: os pontos que o gráfico desenha
//
// Separado do componente por dois motivos. O primeiro é teste: o que vai
// para cada série (curva ajustada amostrada numa grade, pontos observados,
// médias por tratamento) é aritmética, e aritmética se testa sem DOM. O
// segundo é o carregamento sob demanda: o componente do gráfico só existe
// quando o `recharts` chega; este módulo é leve e chega com o painel.
//
// AS REGRAS DO GRÁFICO (skill dataviz, aplicada aqui e não no componente):
//
//   • Uma escala só: horas no x, % de germinação no y. Sem eixo duplo.
//   • A cor segue o TRATAMENTO, na ordem de primeira aparição, série 1..8 do
//     sistema (`--color-series-n`). A 9ª em diante não ganha cor nova: vira o
//     neutro `--color-ink-3`. Filtrar não repinta: o índice é do tratamento.
//   • Etiqueta direta só com até 4 tratamentos — acima disso as etiquetas
//     colidem no fim das curvas, e a legenda (sempre presente) responde.
//   • A curva ajustada para no ÚLTIMO TEMPO OBSERVADO. Depois dele é
//     extrapolação, e a planilha também não desenha além.
// =============================================================================

import { hill } from '../../lib/germinacao';
import type { Analise, LinhaAnalisada } from './analise';

/** Quantos tratamentos têm cor própria. Acima disso, neutro. */
export const TETO_DE_CORES = 8;

/** Passos da grade em que a curva ajustada é amostrada. */
const PASSOS_DA_GRADE = 120;

export type ModoDoGrafico = 'amostras' | 'tratamentos';

export interface SerieDoGrafico {
  /** A chave do valor em cada linha de dados. */
  chave: string;
  tratamento: string;
  indiceDaCor: number;
  tipo: 'curva' | 'observado';
  /** "T0 · 2": para o tooltip e a lista de séries. */
  rotulo: string;
}

export interface TratamentoDoGrafico {
  nome: string;
  indiceDaCor: number;
  /** Quantas amostras entram (ajustadas ou só observadas). */
  amostras: number;
}

/** Uma linha de dados: `horas` mais uma chave por série presente naquele instante. */
export type LinhaDoGrafico = { horas: number } & Record<string, number>;

export interface DadosDoGrafico {
  linhas: LinhaDoGrafico[];
  series: SerieDoGrafico[];
  tratamentos: TratamentoDoGrafico[];
  /** As séries que recebem etiqueta direta no fim (≤ 4 tratamentos). */
  etiquetas: { chave: string; texto: string }[];
  /** Último tempo observado — o fim do eixo x. */
  tFim: number;
}

/** `var(--color-series-n)` para o tratamento, ou o neutro além do teto. */
export function corDoTratamento(indiceDaCor: number): string {
  return indiceDaCor < TETO_DE_CORES ? `var(--color-series-${indiceDaCor + 1})` : 'var(--color-ink-3)';
}

const pct = (fracao: number) => Math.round(fracao * 10000) / 100;

function gradeDeTempos(tFim: number): number[] {
  const grade: number[] = [];
  for (let k = 0; k <= PASSOS_DA_GRADE; k++) grade.push((tFim * k) / PASSOS_DA_GRADE);
  return grade;
}

function fracaoAjustada(linha: LinhaAnalisada, t: number): number | null {
  if (linha.parametros === null) return null;
  const { y0, a, b, c } = linha.parametros.ajuste;
  return hill(y0, a, b, c, t);
}

export function dadosDoGrafico(analise: Analise, modo: ModoDoGrafico): DadosDoGrafico {
  const comAmostra = analise.linhas.filter((l) => l.amostra !== null);
  const tFim = Math.max(0, ...comAmostra.flatMap((l) => (l.amostra ?? { leituras: [] }).leituras.map((r) => r.horas)));

  const tratamentos: TratamentoDoGrafico[] = analise.tratamentos
    .map((t) => ({ nome: t.tratamento, indiceDaCor: t.indiceDaCor, amostras: comAmostra.filter((l) => l.tratamento === t.tratamento).length }))
    .filter((t) => t.amostras > 0);
  const corDe = new Map(tratamentos.map((t) => [t.nome, t.indiceDaCor]));

  if (comAmostra.length === 0 || tFim <= 0) return { linhas: [], series: [], tratamentos: [], etiquetas: [], tFim: 0 };

  // Um mapa horas → linha, para que grade e observações no mesmo instante
  // caiam na mesma linha e o eixo x numérico fique ordenado.
  const porHora = new Map<number, LinhaDoGrafico>();
  const linhaEm = (h: number): LinhaDoGrafico => {
    let l = porHora.get(h);
    if (l === undefined) {
      l = { horas: h };
      porHora.set(h, l);
    }
    return l;
  };
  const series: SerieDoGrafico[] = [];
  const grade = gradeDeTempos(tFim);

  if (modo === 'amostras') {
    for (const l of comAmostra) {
      const amostra = l.amostra;
      if (amostra === null) continue;
      const indiceDaCor = corDe.get(l.tratamento) ?? TETO_DE_CORES;
      const rotulo = `${l.tratamento} · ${l.repeticao}`;
      const chaveObs = `o${l.indice}`;
      series.push({ chave: chaveObs, tratamento: l.tratamento, indiceDaCor, tipo: 'observado', rotulo });
      for (const r of amostra.leituras) linhaEm(r.horas)[chaveObs] = pct(r.acumulado / amostra.sementes);

      if (l.parametros === null) continue;
      const chaveCurva = `c${l.indice}`;
      series.push({ chave: chaveCurva, tratamento: l.tratamento, indiceDaCor, tipo: 'curva', rotulo });
      // A curva é avaliada na grade E nos instantes observados, para que
      // nenhuma linha de dados fique sem o valor da curva (um buraco
      // quebraria o traço).
      for (const t of [...grade, ...amostra.leituras.map((r) => r.horas)]) {
        const y = fracaoAjustada(l, t);
        if (y !== null) linhaEm(t)[chaveCurva] = pct(y);
      }
    }
  } else {
    for (const t of tratamentos) {
      const proprias = comAmostra.filter((l) => l.tratamento === t.nome);
      const ajustadas = proprias.filter((l) => l.parametros !== null);
      const chaveObs = `n${t.indiceDaCor}`;
      series.push({ chave: chaveObs, tratamento: t.nome, indiceDaCor: t.indiceDaCor, tipo: 'observado', rotulo: `${t.nome} · média` });
      // Média observada em cada instante em que ao menos uma repetição leu.
      const somas = new Map<number, { soma: number; n: number }>();
      for (const l of proprias) {
        const amostra = l.amostra;
        if (amostra === null) continue;
        for (const r of amostra.leituras) {
          const s = somas.get(r.horas) ?? { soma: 0, n: 0 };
          s.soma += r.acumulado / amostra.sementes;
          s.n += 1;
          somas.set(r.horas, s);
        }
      }
      for (const [h, s] of somas) linhaEm(h)[chaveObs] = pct(s.soma / s.n);

      if (ajustadas.length === 0) continue;
      const chaveCurva = `m${t.indiceDaCor}`;
      series.push({ chave: chaveCurva, tratamento: t.nome, indiceDaCor: t.indiceDaCor, tipo: 'curva', rotulo: `${t.nome} · média` });
      const instantes = [...grade, ...somas.keys()];
      for (const tempo of instantes) {
        let soma = 0;
        for (const l of ajustadas) soma += fracaoAjustada(l, tempo) ?? 0;
        linhaEm(tempo)[chaveCurva] = pct(soma / ajustadas.length);
      }
    }
  }

  const linhas = [...porHora.values()].sort((a, b) => a.horas - b.horas);

  // Etiqueta direta: uma por tratamento, na curva que termina mais alto
  // (fica acima do feixe das repetições), só com até 4 tratamentos.
  const etiquetas: { chave: string; texto: string }[] = [];
  if (tratamentos.length <= 4) {
    const ultima = linhas[linhas.length - 1];
    for (const t of tratamentos) {
      const curvas = series.filter((s) => s.tipo === 'curva' && s.tratamento === t.nome);
      let melhor: SerieDoGrafico | null = null;
      for (const s of curvas) {
        if (melhor === null || (ultima[s.chave] ?? -1) > (ultima[melhor.chave] ?? -1)) melhor = s;
      }
      if (melhor !== null) etiquetas.push({ chave: melhor.chave, texto: t.nome });
    }
  }

  return { linhas, series, tratamentos, etiquetas, tFim };
}
