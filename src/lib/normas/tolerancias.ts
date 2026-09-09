// =============================================================================
// SeedCounter — tolerâncias entre repetições
//
// O QUE A TOLERÂNCIA DECIDE.
//
// Um teste de germinação são quatro repetições de 100 sementes. Elas nunca dão
// o mesmo número, e a norma diz **quanta discordância é aceitável**: acima
// disso o teste não vale, e a análise tem de ser repetida.
//
// Sem essa verificação, o aplicativo aceita quatro repetições de 40, 95, 62 e
// 88 e imprime uma média de 71% como se fosse um resultado. É a diferença entre
// uma média e uma medição.
//
// A POLÍTICA: AVISA E EXIGE RECONHECIMENTO. NÃO BLOQUEIA.
//
// Decisão do laboratório, e ela preserva a autoridade do Responsável Técnico —
// o software não decide por quem assina. Mas o estouro não sai em silêncio: a
// pessoa precisa marcar que está ciente, e **o reconhecimento vai para o campo
// Observações do boletim**, que é justamente o que uma fiscalização quer ver.
//
// Bloqueio duro pode existir depois como configuração que o RT liga — nunca
// como padrão, porque travaria o pesquisador que só quer o número bruto e o
// analista que sabe que a repetição está a caminho.
//
// ─────────────────────────────────────────────────────────────────────────────
// SOBRE OS NÚMEROS DESTA TABELA — LEIA ANTES DE USAR EM LAUDO
//
// Os valores abaixo NÃO foram conferidos contra a RAS publicada. Eles seguem a
// ESTRUTURA da Tabela 4.1 (amplitude máxima entre quatro repetições de 100, em
// função da média), que é o que dá para afirmar com segurança.
//
// Inventar tolerância é pior que não ter: uma tolerância folgada demais aprova
// teste inválido, e apertada demais manda repetir análise boa. As duas erram
// para o lado caro.
//
// Por isso existe `TABELA_4_1_NAO_CONFERIDA`, com teste próprio, e
// `verificarGerminacao` recusa-se a dar veredito enquanto ela for verdadeira —
// devolve `nao-verificavel` e diz por quê. Quem conferir contra o Wikisda troca
// os valores e derruba a constante junto.
// ─────────────────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * A tabela ainda não foi conferida contra a RAS publicada.
 *
 * Enquanto for `true`, nenhuma verificação devolve veredito. Derrubar esta
 * constante sem conferir os valores é o caminho mais curto para um laudo com
 * tolerância inventada.
 */
export const TABELA_4_1_NAO_CONFERIDA = true;

/** Uma faixa de média e a amplitude máxima admitida nela. */
export interface FaixaDeTolerancia {
  /** Média mínima da faixa, em porcentagem. */
  de: number;
  /** Média máxima da faixa, em porcentagem. */
  ate: number;
  /** Amplitude máxima admitida entre a maior e a menor repetição. */
  amplitudeMaxima: number;
}

/**
 * Estrutura da Tabela 4.1 — quatro repetições de 100 sementes.
 *
 * A forma é simétrica em torno de 50%: quanto mais perto dos extremos, menor a
 * variação esperada, porque uma proporção perto de 0 ou de 100 tem menos
 * variância binomial. É essa forma que está codificada; os valores exatos
 * aguardam conferência.
 */
export const TABELA_4_1: FaixaDeTolerancia[] = [
  { de: 99, ate: 100, amplitudeMaxima: 5 },
  { de: 97, ate: 98, amplitudeMaxima: 6 },
  { de: 94, ate: 96, amplitudeMaxima: 7 },
  { de: 91, ate: 93, amplitudeMaxima: 8 },
  { de: 87, ate: 90, amplitudeMaxima: 9 },
  { de: 82, ate: 86, amplitudeMaxima: 10 },
  { de: 76, ate: 81, amplitudeMaxima: 11 },
  { de: 70, ate: 75, amplitudeMaxima: 12 },
  { de: 60, ate: 69, amplitudeMaxima: 13 },
  { de: 51, ate: 59, amplitudeMaxima: 14 },
  { de: 41, ate: 50, amplitudeMaxima: 14 },
  { de: 31, ate: 40, amplitudeMaxima: 13 },
  { de: 25, ate: 30, amplitudeMaxima: 12 },
  { de: 19, ate: 24, amplitudeMaxima: 11 },
  { de: 14, ate: 18, amplitudeMaxima: 10 },
  { de: 10, ate: 13, amplitudeMaxima: 9 },
  { de: 7, ate: 9, amplitudeMaxima: 8 },
  { de: 4, ate: 6, amplitudeMaxima: 7 },
  { de: 2, ate: 3, amplitudeMaxima: 6 },
  { de: 0, ate: 1, amplitudeMaxima: 5 },
];

export type VeredictoDaTolerancia = 'dentro' | 'estourou' | 'nao-verificavel';

export interface VerificacaoDeTolerancia {
  veredicto: VeredictoDaTolerancia;
  media: number;
  amplitude: number;
  amplitudeMaxima?: number;
  /** Índice (base 1) da repetição mais baixa e da mais alta. */
  maisBaixa?: number;
  maisAlta?: number;
  /** Frase para a interface. */
  recado: string;
  /**
   * O texto que vai para o campo Observações quando a pessoa reconhece o
   * estouro. Vazio quando não há o que registrar.
   */
  textoParaObservacoes: string;
}

/**
 * Verifica a amplitude entre repetições de germinação.
 *
 * Recebe as porcentagens de cada repetição (normalmente quatro de 100
 * sementes). Devolve `nao-verificavel` enquanto a tabela não for conferida —
 * dizer "dentro da tolerância" com número não conferido é a pior saída
 * possível, porque parece uma aprovação.
 */
export function verificarGerminacao(repeticoes: number[]): VerificacaoDeTolerancia {
  const validas = repeticoes.filter((v) => Number.isFinite(v));

  if (validas.length < 2) {
    return {
      veredicto: 'nao-verificavel',
      media: NaN,
      amplitude: NaN,
      recado: 'São necessárias pelo menos duas repetições para verificar a tolerância.',
      textoParaObservacoes: '',
    };
  }

  const media = validas.reduce((t, v) => t + v, 0) / validas.length;
  const menor = Math.min(...validas);
  const maior = Math.max(...validas);
  const amplitude = maior - menor;
  const maisBaixa = validas.indexOf(menor) + 1;
  const maisAlta = validas.indexOf(maior) + 1;

  if (TABELA_4_1_NAO_CONFERIDA) {
    return {
      veredicto: 'nao-verificavel',
      media,
      amplitude,
      maisBaixa,
      maisAlta,
      recado:
        `Amplitude de ${formatar(amplitude)} pontos entre as repetições (média ${formatar(media)}%). ` +
        'A tabela de tolerância ainda não foi conferida contra a RAS publicada, ' +
        'então o aplicativo não emite veredito — confira manualmente no Cap. 4.',
      textoParaObservacoes: '',
    };
  }

  const faixa = faixaDaMedia(media);
  if (!faixa) {
    return {
      veredicto: 'nao-verificavel',
      media,
      amplitude,
      maisBaixa,
      maisAlta,
      recado: `Média de ${formatar(media)}% fora das faixas da tabela.`,
      textoParaObservacoes: '',
    };
  }

  if (amplitude <= faixa.amplitudeMaxima) {
    return {
      veredicto: 'dentro',
      media,
      amplitude,
      amplitudeMaxima: faixa.amplitudeMaxima,
      maisBaixa,
      maisAlta,
      recado: '',
      textoParaObservacoes: '',
    };
  }

  const recado =
    `Amplitude de ${formatar(amplitude)} pontos entre as repetições ${maisBaixa} e ${maisAlta}, ` +
    `acima do máximo de ${faixa.amplitudeMaxima} para a média de ${formatar(media)}%. ` +
    'A RAS pede repetição da análise.';

  return {
    veredicto: 'estourou',
    media,
    amplitude,
    amplitudeMaxima: faixa.amplitudeMaxima,
    maisBaixa,
    maisAlta,
    recado,
    textoParaObservacoes:
      `Amplitude entre repetições de ${formatar(amplitude)} pontos, acima da tolerância de ` +
      `${faixa.amplitudeMaxima} pontos (Cap. 4, Tabela 4.1). Divergência reconhecida pelo ` +
      'Responsável Técnico.',
  };
}

/** A faixa que contém esta média, ou `null` quando nenhuma contém. */
export function faixaDaMedia(media: number): FaixaDeTolerancia | null {
  if (!Number.isFinite(media)) return null;
  const m = Math.round(media);
  return TABELA_4_1.find((f) => m >= f.de && m <= f.ate) ?? null;
}

function formatar(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}
