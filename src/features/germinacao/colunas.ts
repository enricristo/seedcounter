// =============================================================================
// SeedCounter — germinação: as colunas da tabela de parâmetros, com a frase
// que explica cada uma
//
// "Não sei o que é U7525": cada coluna leva uma frase no `title`, escrita
// para quem está aprendendo e não para quem escreveu o artigo. As frases
// moram aqui, fora do componente, para que um teste garanta que nenhuma
// coluna fica sem explicação — e para que a exportação e a tela usem o
// mesmo vocabulário.
//
// A ordem é a da aba `output` da planilha, com as colunas de configuração
// (yo, x, tMAX) retiradas, porque já estão na caixa de configuração.
// =============================================================================

import {
  UNIFORMIDADES,
  type ConfiguracaoDaAnalise,
  type LinhaAnalisada,
  type ParametroResumido,
} from './analise';

export interface ColunaDeParametro {
  chave: ParametroResumido;
  rotulo: (config: ConfiguracaoDaAnalise) => string;
  ajuda: (config: ConfiguracaoDaAnalise) => string;
  unidade: 'h' | '%' | 'fração·h' | '';
  casas: number;
  valor: (linha: LinhaAnalisada) => number | null;
  /** Mostrar em % (fração × 100) em vez do valor bruto. */
  emPercentual?: boolean;
}

export const COLUNAS_DE_PARAMETROS: readonly ColunaDeParametro[] = [
  {
    chave: 'gMax',
    rotulo: () => 'gMAX',
    ajuda: () =>
      'Germinação máxima observada: a última contagem dividida pelo total de sementes, em %.',
    unidade: '%',
    casas: 0,
    valor: (l) => l.parametros?.gMax ?? null,
    emPercentual: true,
  },
  {
    chave: 't50MaxG',
    rotulo: () => 't50',
    ajuda: () =>
      'Horas até a curva ajustada atingir metade da sua própria germinação máxima (o parâmetro c da curva de Hill). Menor = germina mais cedo.',
    unidade: 'h',
    casas: 1,
    valor: (l) => l.parametros?.t50MaxG ?? null,
  },
  {
    chave: 'tXMaxG',
    rotulo: (c) => `t${c.percentualParaTx}`,
    ajuda: (c) =>
      `Horas até a curva ajustada atingir ${c.percentualParaTx} % da sua germinação máxima: o começo da germinação. Configurável em "x de t-x".`,
    unidade: 'h',
    casas: 1,
    valor: (l) => l.parametros?.tXMaxG ?? null,
  },
  {
    chave: 't50TotS',
    rotulo: () => 't50 total',
    ajuda: () =>
      'Horas até metade do TOTAL de sementes ter germinado. Fica vazio quando a curva nunca chega a 50 % das sementes.',
    unidade: 'h',
    casas: 1,
    valor: (l) => l.parametros?.t50TotS ?? null,
  },
  {
    chave: 'uniformidade',
    rotulo: (c) => UNIFORMIDADES[c.uniformidade].rotulo,
    ajuda: (c) => UNIFORMIDADES[c.uniformidade].ajuda,
    unidade: 'h',
    casas: 1,
    valor: (l) => l.uniformidade,
  },
  {
    chave: 'r2',
    rotulo: () => 'r²',
    ajuda: () =>
      'Quanto a curva ajustada explica dos pontos observados (1 = perfeito). Abaixo de 0,4 a planilha considera o ajuste pouco confiável.',
    unidade: '',
    casas: 3,
    valor: (l) => l.parametros?.r2 ?? null,
  },
  {
    chave: 'auc',
    rotulo: () => 'AUC',
    ajuda: () =>
      'Área sob a curva ajustada de 0 até tMAX, em fração × hora. Junta velocidade e capacidade num número só; só é comparável entre amostras com o mesmo tMAX.',
    unidade: 'fração·h',
    casas: 1,
    valor: (l) => l.parametros?.auc ?? null,
  },
  {
    chave: 'mgt',
    rotulo: () => 'MGT',
    ajuda: () =>
      'Tempo médio de germinação da curva ajustada, em horas. Menor = a população germina mais cedo, em média.',
    unidade: 'h',
    casas: 1,
    valor: (l) => l.parametros?.mgt ?? null,
  },
  {
    chave: 'assimetria',
    rotulo: () => 't50 / MGT',
    ajuda: () =>
      'Assimetria da curva: t50 dividido pelo MGT. Perto de 1 a curva é simétrica; abaixo de 1 há uma cauda de sementes que germinam tarde.',
    unidade: '',
    casas: 3,
    valor: (l) => l.parametros?.assimetria ?? null,
  },
];

/** Ajuda das colunas fixas, para o mesmo teste cobrir. */
export const AJUDA_FIXA = {
  codigo: 'Código da amostra. Linhas com o mesmo código são repetições do mesmo tratamento.',
  repeticao: 'Ordem da linha entre as de mesmo código.',
  sementes: 'Total de sementes semeadas na amostra.',
  estado:
    'Se o núcleo ajustou a curva, ou por que recusou. Uma amostra recusada continua na tabela.',
  n: 'Repetições ajustadas sobre o total de linhas com este código.',
  letras: 'Tukey a 5 %: tratamentos com uma letra em comum não diferem. "a" é a maior média.',
} as const;
