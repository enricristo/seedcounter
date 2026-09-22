// =============================================================================
// SeedCounter — germinação: da grade de entrada às três tabelas da planilha
//
// A planilha do Germinator tem três abas: INPUT (a grade), output (uma linha
// de parâmetros por amostra) e statistics (médias por tratamento). Este
// módulo é o que liga as três: recebe as entradas da grade, chama o núcleo
// (`lib/germinacao`) para cada amostra, e devolve as linhas do output, os
// resumos do statistics e — o que a planilha não faz — a comparação entre
// tratamentos por ANOVA + Tukey, com letras.
//
// O QUE É "TRATAMENTO".
//
// Na aba INPUT o `code` se repete: quatro linhas "T0" são as quatro
// repetições do tratamento T0. A aba statistics agrupa pelo código exato.
// Aqui é igual: tratamento = código, repetição = a ordem em que a linha
// aparece entre as de mesmo código. Não há inferência de "T0-r1 é T0" —
// quem quiser agrupar escreve o mesmo código, como já faz na planilha.
//
// A COMPARAÇÃO.
//
// Só existe quando há o que comparar: dois ou mais tratamentos com duas ou
// mais repetições AJUSTADAS cada. Um tratamento com uma repetição só entra
// nas médias, mas fica fora da ANOVA (e recebe "—" na coluna de letras, com
// o motivo). Os parâmetros comparados são os que a pesquisadora pediu: t50,
// gMAX e AUC. Nos valores brutos, sem transformação, como a planilha faz nas
// médias — gMAX é proporção, e a transformação arco-seno é uma decisão que
// fica registrada no texto de ajuda da coluna, não tomada em silêncio.
// =============================================================================

import {
  calcularParametros,
  uniformidadeEntre,
  type AmostraDeGerminacao,
  type ParametrosDeGerminacao,
} from '../../lib/germinacao';
import { oneWayANOVA, tukeyHSD, type GroupStat } from '../../lib/stats';
import type { ANOVAResult } from '../../types';
import { letrasDeComparacao } from './letras';

export type Uniformidade = 'u7525' | 'u8416' | 'u9010';

export const UNIFORMIDADES: Record<
  Uniformidade,
  { inferior: number; superior: number; rotulo: string; ajuda: string }
> = {
  u7525: {
    inferior: 25,
    superior: 75,
    rotulo: 'U7525',
    ajuda:
      'Horas entre 25 % e 75 % da germinação máxima ajustada: o padrão da planilha. Menor = mais uniforme.',
  },
  u8416: {
    inferior: 16,
    superior: 84,
    rotulo: 'U8416',
    ajuda:
      'Horas entre 16 % e 84 % da germinação máxima ajustada (±1 desvio de uma normal). Menor = mais uniforme.',
  },
  u9010: {
    inferior: 10,
    superior: 90,
    rotulo: 'U9010',
    ajuda:
      'Horas entre 10 % e 90 % da germinação máxima ajustada: quase toda a curva. Menor = mais uniforme.',
  },
};

export interface ConfiguracaoDaAnalise {
  /** Mínimo de sementes germinadas ao fim para ajustar. Planilha: 3. */
  germinacaoMinima: number;
  /** Limite da AUC e do MGT, em horas. null = o último tempo observado. */
  tMaxParaAuc: number | null;
  /** O x de t-x, em %. Planilha: 20. */
  percentualParaTx: number;
  uniformidade: Uniformidade;
}

export const CONFIGURACAO_PADRAO: ConfiguracaoDaAnalise = {
  germinacaoMinima: 3,
  tMaxParaAuc: null,
  percentualParaTx: 20,
  uniformidade: 'u7525',
};

export interface EntradaDeAmostra {
  codigo: string;
  amostra: AmostraDeGerminacao | null;
  /** O que impediu de ler a linha da grade (não é recusa do núcleo). */
  erro: string | null;
}

/** Uma linha da aba output. `parametros` null quando a amostra foi recusada — e `motivo` diz por quê. */
export interface LinhaAnalisada {
  indice: number;
  codigo: string;
  tratamento: string;
  /** 1, 2, 3… entre as linhas de mesmo código. */
  repeticao: number;
  sementes: number | null;
  amostra: AmostraDeGerminacao | null;
  parametros: ParametrosDeGerminacao | null;
  /** A uniformidade escolhida na configuração (não necessariamente u7525). */
  uniformidade: number | null;
  motivo: string | null;
}

/** As colunas numéricas que a aba statistics resume. */
export type ParametroResumido =
  | 'gMax'
  | 't50MaxG'
  | 'tXMaxG'
  | 't50TotS'
  | 'tXTotS'
  | 'uniformidade'
  | 'r2'
  | 'auc'
  | 'mgt'
  | 'assimetria';

export const PARAMETROS_RESUMIDOS: readonly ParametroResumido[] = [
  'gMax',
  't50MaxG',
  'tXMaxG',
  't50TotS',
  'tXTotS',
  'uniformidade',
  'r2',
  'auc',
  'mgt',
  'assimetria',
];

export interface MediaComDesvio {
  media: number;
  /** Desvio padrão amostral; 0 com n = 1. */
  sd: number;
  n: number;
}

export interface ResumoDoTratamento {
  tratamento: string;
  /** Linhas com este código, ajustadas ou não. */
  n: number;
  /** Linhas ajustadas (as que entram nas médias). */
  nAjustadas: number;
  indiceDaCor: number;
  medias: Record<ParametroResumido, MediaComDesvio | null>;
}

export type ParametroComparado = 't50MaxG' | 'gMax' | 'auc';

export const PARAMETROS_COMPARADOS: readonly ParametroComparado[] = ['t50MaxG', 'gMax', 'auc'];

export interface Comparacao {
  parametro: ParametroComparado;
  anova: ANOVAResult;
  /** Tratamento → letras. Tratamentos fora da ANOVA não aparecem aqui. */
  letras: Map<string, string>;
  /** Tratamentos que ficaram de fora, com o motivo. */
  excluidos: { tratamento: string; motivo: string }[];
}

export interface Analise {
  linhas: LinhaAnalisada[];
  tratamentos: ResumoDoTratamento[];
  comparacoes: Comparacao[];
  /** Por que não há comparação, quando `comparacoes` está vazio. */
  motivoSemComparacao: string | null;
  /** O tMAX efetivo da AUC e do MGT, em horas. null sem amostras. */
  tMax: number | null;
}

/** O último tempo observado entre todas as amostras legíveis. */
export function ultimoTempoObservado(entradas: readonly EntradaDeAmostra[]): number | null {
  let maior: number | null = null;
  for (const e of entradas) {
    if (e.amostra === null) continue;
    for (const l of e.amostra.leituras) if (maior === null || l.horas > maior) maior = l.horas;
  }
  return maior;
}

function valorDoParametro(linha: LinhaAnalisada, p: ParametroResumido): number | null {
  if (linha.parametros === null) return null;
  if (p === 'uniformidade') return linha.uniformidade;
  return linha.parametros[p];
}

function mediaComDesvio(valores: readonly number[]): MediaComDesvio | null {
  const n = valores.length;
  if (n === 0) return null;
  const media = valores.reduce((s, v) => s + v, 0) / n;
  const sd =
    n > 1 ? Math.sqrt(valores.reduce((s, v) => s + (v - media) * (v - media), 0) / (n - 1)) : 0;
  return { media, sd, n };
}

export function analisar(
  entradas: readonly EntradaDeAmostra[],
  config: ConfiguracaoDaAnalise
): Analise {
  const tMax = config.tMaxParaAuc ?? ultimoTempoObservado(entradas);
  const u = UNIFORMIDADES[config.uniformidade];

  // Tratamentos na ordem de primeira aparição: é a ordem da cor, e a cor
  // segue o tratamento, nunca a posição na tabela.
  const ordemDosTratamentos: string[] = [];
  const repeticoes = new Map<string, number>();

  const linhas: LinhaAnalisada[] = entradas.map((e, indice) => {
    const tratamento = e.codigo;
    if (!ordemDosTratamentos.includes(tratamento)) ordemDosTratamentos.push(tratamento);
    const repeticao = (repeticoes.get(tratamento) ?? 0) + 1;
    repeticoes.set(tratamento, repeticao);

    const base = { indice, codigo: e.codigo, tratamento, repeticao, amostra: e.amostra };
    if (e.amostra === null) {
      return {
        ...base,
        sementes: null,
        parametros: null,
        uniformidade: null,
        motivo: e.erro ?? 'linha ilegível',
      };
    }
    const resultado = calcularParametros(e.amostra, {
      germinacaoMinima: config.germinacaoMinima,
      tMaxParaAuc: tMax ?? undefined,
      percentualParaTx: config.percentualParaTx,
    });
    if (resultado.parametros === null) {
      return {
        ...base,
        sementes: e.amostra.sementes,
        parametros: null,
        uniformidade: null,
        motivo: resultado.motivo,
      };
    }
    return {
      ...base,
      sementes: e.amostra.sementes,
      parametros: resultado.parametros,
      uniformidade: uniformidadeEntre(resultado.parametros.ajuste, u.inferior, u.superior),
      motivo: null,
    };
  });

  const tratamentos: ResumoDoTratamento[] = ordemDosTratamentos.map((tratamento, indiceDaCor) => {
    const proprias = linhas.filter((l) => l.tratamento === tratamento);
    const ajustadas = proprias.filter((l) => l.parametros !== null);
    const medias = {} as Record<ParametroResumido, MediaComDesvio | null>;
    for (const p of PARAMETROS_RESUMIDOS) {
      const valores = ajustadas
        .map((l) => valorDoParametro(l, p))
        .filter((v): v is number => v !== null);
      medias[p] = mediaComDesvio(valores);
    }
    return { tratamento, n: proprias.length, nAjustadas: ajustadas.length, indiceDaCor, medias };
  });

  const { comparacoes, motivoSemComparacao } = comparar(linhas, tratamentos);
  return { linhas, tratamentos, comparacoes, motivoSemComparacao, tMax };
}

function comparar(
  linhas: readonly LinhaAnalisada[],
  tratamentos: readonly ResumoDoTratamento[]
): { comparacoes: Comparacao[]; motivoSemComparacao: string | null } {
  const elegiveis = tratamentos.filter((t) => t.nAjustadas >= 2);
  if (tratamentos.length < 2) {
    return {
      comparacoes: [],
      motivoSemComparacao: 'A comparação precisa de dois ou mais tratamentos (códigos diferentes).',
    };
  }
  if (elegiveis.length < 2) {
    return {
      comparacoes: [],
      motivoSemComparacao:
        'A comparação precisa de pelo menos dois tratamentos com duas ou mais repetições ajustadas cada. Repita o código para marcar repetições.',
    };
  }
  const excluidos = tratamentos
    .filter((t) => t.nAjustadas < 2)
    .map((t) => ({
      tratamento: t.tratamento,
      motivo: t.nAjustadas === 0 ? 'nenhuma repetição ajustada' : 'só uma repetição ajustada',
    }));

  const comparacoes: Comparacao[] = PARAMETROS_COMPARADOS.map((parametro) => {
    const grupos: GroupStat[] = elegiveis.map((t) => ({
      label: t.tratamento,
      values: linhas
        .filter((l) => l.tratamento === t.tratamento && l.parametros !== null)
        .map((l) => (l.parametros as ParametrosDeGerminacao)[parametro]),
    }));
    const anova = oneWayANOVA(grupos);
    const pares = tukeyHSD(grupos, 0.05);
    const letras = letrasDeComparacao(
      grupos.map((g) => ({
        rotulo: g.label,
        media: g.values.reduce((s, v) => s + v, 0) / g.values.length,
      })),
      pares
    );
    return { parametro, anova, letras, excluidos };
  });
  return { comparacoes, motivoSemComparacao: null };
}
