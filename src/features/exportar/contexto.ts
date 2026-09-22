// =============================================================================
// SeedCounter — o que sai do aplicativo, sem tocar o navegador
//
// A parte PURA da exportação: nome de arquivo, procedência, o contexto de
// medição que CSV, SQL, laudo e analytics compartilham, os textos dos
// formatos simples (relatório .txt, JSON da sessão, CSV de contagem, CSV do
// histórico) e as decisões de "com ou sem imagem". Nada aqui lê pixel,
// cronômetro ou canvas — é `useExportacoes.ts` quem faz isso e baixa o
// arquivo. É esta separação que deixa a exportação ser testada em node.
//
// POR QUE OS TEXTOS SÃO FUNÇÕES COM `agora` DE ENTRADA. O relatório e o CSV
// carimbam a hora; sem o parâmetro, dois testes seguidos produziriam dois
// textos diferentes e a igualdade byte a byte — que é o que interessa numa
// extração que promete não mudar conteúdo — não teria como ser provada.
// =============================================================================

import type { Mark, Metadata, ProcedenciaDaAnalise, Session, YoloSegmentation } from '../../types';
import type { MeasurementContext } from '../../lib/measurements';
import type { DadosImagem } from '../../lib/color-features';
import type { TempoDaAnalise } from '../../lib/cronometro-de-analise';
import { nomeDeExportacao } from '../../lib/download';

/** A contagem como o App já a calculou — os percentuais vêm formatados. */
export interface ResultadoDaContagem {
  viableCount: number;
  inviableCount: number;
  totalCount: number;
  /** Já com uma casa decimal (`toFixed(1)`), como aparece na tela. */
  viablePercent: string;
  inviablePercent: string;
}

/** O que a régua conferiu na última calibração — vira coluna de procedência. */
export interface CalibracaoConferida {
  dpiMedido: number;
  leituras: number;
  cvPercent?: number;
}

// ---------------------------------------------------------------------------
// Nome de arquivo
// ---------------------------------------------------------------------------

/**
 * Nome de arquivo rastreável: projeto, tratamento, placa, quadrante, amostra,
 * tipo e carimbo de data.
 *
 * Ordenar a pasta por nome passa a agrupar por projeto e depois por
 * tratamento — que é como o pesquisador procura — em vez de por ordem de
 * exportação, que não significa nada. A composição mora em `lib/download.ts`;
 * aqui só se decide o que da cena entra nela.
 */
export function nomeDoArquivoExportado(
  cena: {
    filename: string;
    metadata: Pick<Metadata, 'project' | 'treatment' | 'plate' | 'quadrant'>;
  },
  extensao: string,
  tipo?: string,
  data?: Date
): string {
  return nomeDeExportacao(
    {
      arquivo: cena.filename,
      projeto: cena.metadata.project,
      tratamento: cena.metadata.treatment,
      placa: cena.metadata.plate,
      quadrante: cena.metadata.quadrant,
      tipo,
      data,
    },
    extensao
  );
}

/** O PNG anotado de uma sessão do histórico: mesmo nome da imagem, com sufixo. */
export function nomeDoPngDaSessao(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '') + `_anotada.png`;
}

// ---------------------------------------------------------------------------
// Procedência e contexto de medição
// ---------------------------------------------------------------------------

export interface EntradaDaProcedencia {
  /** O cronômetro, LIDO no instante da exportação (ver `useExportacoes`). */
  tempo: TempoDaAnalise;
  paginasDoTiff: number;
  /** Base 0, como a fila guarda; sai em base 1 só quando há mais de uma. */
  paginaDoTiff: number;
  dpiDeclarado: number | null;
  calibracaoConferida: CalibracaoConferida | null;
  versaoDoApp?: string;
  commit?: string;
}

/**
 * O que produziu estes números: versão, página, escala e custo.
 *
 * Página e total só entram quando o arquivo tem mais de uma — num JPEG
 * comum "página 1 de 1" seria ruído que parece informação.
 */
export function procedenciaDaCena(e: EntradaDaProcedencia): ProcedenciaDaAnalise {
  return {
    versaoDoApp: e.versaoDoApp,
    commit: e.commit,
    paginaDaImagem: e.paginasDoTiff > 1 ? e.paginaDoTiff + 1 : undefined,
    totalDePaginas: e.paginasDoTiff > 1 ? e.paginasDoTiff : undefined,
    dpiDeclarado: e.dpiDeclarado ?? undefined,
    dpiMedido: e.calibracaoConferida?.dpiMedido,
    leiturasDeCalibracao: e.calibracaoConferida?.leituras,
    cvDaCalibracaoPercent: e.calibracaoConferida?.cvPercent,
    modo: e.tempo.modo,
    tempoAtivoMs: e.tempo.ativoMs,
    tempoParedeMs: e.tempo.paredeMs,
  };
}

export interface EntradaDoContexto {
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  metadata: Metadata;
  filename: string;
  procedencia: ProcedenciaDaAnalise | undefined;
  imageData: DadosImagem | undefined;
}

/**
 * O contexto que `buildMeasurements` recebe — o único por onde CSV, SQL,
 * laudo e analytics passam. A procedência é acrescentada AQUI, na saída, e
 * não guardada no estado.
 */
export function contextoDeMedicao(e: EntradaDoContexto): MeasurementContext {
  return {
    marks: e.marks,
    segmentations: e.segmentacoes,
    metadata: { ...e.metadata, procedencia: e.procedencia },
    filename: e.filename,
    imageData: e.imageData,
    // Uma semente de orquídea a 3600 DPI tem milhares de pixels; ler um de
    // cada quatro não muda a média e corta o custo em 4x.
    colorSampling: 2,
  };
}

// ---------------------------------------------------------------------------
// Decisões de "com ou sem"
// ---------------------------------------------------------------------------

/**
 * O que entra no laudo. Métricas por classe só quando há objeto — sem marca
 * nem contorno não há o que resumir, e `montarMetricasAvancadas` de uma
 * lista vazia seria um bloco em branco. A imagem entra quando existe; sem
 * ela a área ainda sai (vem do contorno), só a cor não.
 */
export function oQueEntraNoLaudo(cena: {
  marks: readonly Mark[];
  segmentacoes: readonly YoloSegmentation[];
  temImagem: boolean;
}): { temImagem: boolean; comMetricas: boolean } {
  return {
    temImagem: cena.temImagem,
    comMetricas: cena.segmentacoes.length > 0 || cena.marks.length > 0,
  };
}

/**
 * As sessões que têm foto guardada — as únicas que viram PNG anotado no
 * lote. Sessão antiga sem `imageData` é pulada em silêncio, como sempre foi:
 * não há o que desenhar.
 */
export function sessoesComImagem(
  sessions: readonly Session[]
): (Session & { imageData: string })[] {
  return sessions.filter((s): s is Session & { imageData: string } => !!s.imageData);
}

// ---------------------------------------------------------------------------
// Os formatos simples: texto, JSON e CSV
// ---------------------------------------------------------------------------

/** As colunas do CSV de contagem — as mesmas na sessão atual e no histórico. */
export const COLUNAS_DO_CSV_DE_CONTAGEM = [
  'Data',
  'Imagem',
  'Pesquisador',
  'Projeto',
  'Tratamento',
  'Placa',
  'Quadrante',
  'Viaveis',
  'Inviaveis',
  'Total',
  '% Viavel',
  '% Inviavel',
  'Comentarios',
] as const;

/** Uma linha de CSV: cada campo entre aspas, aspa interna dobrada. */
function linhaDeCSV(campos: readonly string[]): string {
  return campos.map((item) => `"${(item || '').replace(/"/g, '""')}"`).join(',');
}

/** Comentário numa célula só: quebra de linha viraria linha nova no CSV. */
function numaLinhaSo(texto: string): string {
  return texto.replace(/(\r\n|\n|\r)/gm, ' ');
}

export interface CenaParaTexto {
  filename: string;
  metadata: Metadata;
  contagem: ResultadoDaContagem;
}

/** O relatório em texto puro — o formato que abre em qualquer lugar. */
export function relatorioEmTexto(cena: CenaParaTexto, agora: Date = new Date()): string {
  const { filename, metadata, contagem } = cena;
  return (
    `Relatório de Contagem de Sementes\n` +
    `----------------------------------\n` +
    `Arquivo da Imagem: ${filename}\n` +
    `Data: ${agora.toLocaleString()}\n\n` +
    `[ Metadados ]\n` +
    `Usuário / Pesquisador: ${metadata.researcher || '-'}\n` +
    `Projeto de Pesquisa: ${metadata.project || '-'}\n` +
    `Tratamento / Experimento: ${metadata.treatment || '-'}\n` +
    `Placa: ${metadata.plate || '-'}\n` +
    `Quadrante: ${metadata.quadrant || '-'}\n` +
    `Comentários: ${metadata.notes || '-'}\n\n` +
    `[ Resultados ]\n` +
    `Sementes Viáveis (Vermelho): ${contagem.viableCount} (${contagem.viablePercent}%)\n` +
    `Sementes Inviáveis/Detritos (Amarelo): ${contagem.inviableCount} (${contagem.inviablePercent}%)\n` +
    `Total: ${contagem.totalCount}\n`
  );
}

/**
 * A sessão inteira em JSON — o que o importador lê de volta. A ordem das
 * chaves é a de sempre; um diff entre duas exportações precisa continuar
 * legível.
 */
export function sessaoEmJSON(
  cena: CenaParaTexto & { marks: Mark[]; segmentacoes: YoloSegmentation[] },
  agora: Date = new Date()
): string {
  const { contagem } = cena;
  const data = {
    filename: cena.filename,
    date: agora.toISOString(),
    metadata: cena.metadata,
    results: {
      viableCount: contagem.viableCount,
      inviableCount: contagem.inviableCount,
      totalCount: contagem.totalCount,
      viablePercent: Number(contagem.viablePercent),
      inviablePercent: Number(contagem.inviablePercent),
    },
    marks: cena.marks,
    yoloSegmentations: cena.segmentacoes,
  };
  return JSON.stringify(data, null, 2);
}

/** Uma linha por placa: cabeçalho e a sessão atual. */
export function csvDeContagem(cena: CenaParaTexto, agora: Date = new Date()): string {
  const { filename, metadata, contagem } = cena;
  const linha = [
    agora.toLocaleString(),
    filename,
    metadata.researcher,
    metadata.project,
    metadata.treatment,
    metadata.plate,
    metadata.quadrant,
    contagem.viableCount.toString(),
    contagem.inviableCount.toString(),
    contagem.totalCount.toString(),
    contagem.viablePercent,
    contagem.inviablePercent,
    numaLinhaSo(metadata.notes),
  ];
  return [COLUNAS_DO_CSV_DE_CONTAGEM, linha].map(linhaDeCSV).join('\n');
}

/**
 * O histórico inteiro, uma linha por sessão. Os percentuais são refeitos a
 * partir do que a sessão guardou — a sessão não grava percentual.
 */
export function csvDoHistorico(sessions: readonly Session[]): string {
  const linhas = sessions.map((s) => {
    const total = s.viableCount + s.inviableCount;
    const vPct = total > 0 ? ((s.viableCount / total) * 100).toFixed(1) : '0';
    const iPct = total > 0 ? ((s.inviableCount / total) * 100).toFixed(1) : '0';
    return [
      new Date(s.date).toLocaleString(),
      s.filename,
      s.metadata.researcher,
      s.metadata.project,
      s.metadata.treatment,
      s.metadata.plate,
      s.metadata.quadrant,
      s.viableCount.toString(),
      s.inviableCount.toString(),
      total.toString(),
      vPct,
      iPct,
      numaLinhaSo(s.metadata.notes),
    ];
  });
  return [COLUNAS_DO_CSV_DE_CONTAGEM, ...linhas].map(linhaDeCSV).join('\n');
}

/** O nome do backup do histórico: um por dia, pela data ISO. */
export function nomeDoBackupDoHistorico(agora: Date = new Date()): string {
  return `seed-counter-backup-${agora.toISOString().split('T')[0]}.json`;
}
