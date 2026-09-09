// =============================================================================
// SeedCounter — montagem do documento
//
// O QUE ESTE MÓDULO DECIDE, E POR QUE É UMA DECISÃO E NÃO UMA FORMATAÇÃO.
//
// O aplicativo exportava um papel só, chamado ora "Relatório de Contagem" ora
// "Laudo de Sementes", com o cabeçalho de um grupo de pesquisa. Isso é um
// problema, porque "laudo" tem significado legal: o Boletim de Análise de
// Sementes é o documento que a IN 40/2010 regula, que só um laboratório
// credenciado emite, e que um Responsável Técnico assina.
//
// Um PDF de pesquisa com a palavra "Laudo" no topo pode acabar circulando como
// se fosse um BAS. O caminho honesto não é proibir o documento de pesquisa —
// ele é útil e é o que o laboratório usa todo dia. É fazer o papel DIZER O QUE
// ELE É:
//
//   - identidade normativa completa  → BOLETIM DE ANÁLISE DE SEMENTES
//   - identidade incompleta          → RELATÓRIO DE CONTAGEM, com a ressalva
//                                      impressa de que não é um BAS
//
// Quem decide não é uma opção de menu: é `conferirParaEmissao`, a mesma função
// que alimenta o painel de pendências. Não existe caminho para imprimir
// "Boletim" sem os campos que o boletim exige.
//
// A OUTRA REGRA: NENHUM CAMPO EM BRANCO.
//
// A IN 40/2010 é explícita. Um valor ausente vira travessão, nunca espaço —
// espaço em branco num laudo é indistinguível de campo que alguém apagou.
// =============================================================================

import {
  conferirParaEmissao,
  escreverEspecie,
  CATEGORIAS,
  type IdentificacaoDaAmostra,
  type IdentificacaoDoLaboratorio,
} from '../normas/identificacao';
import { descrever, type VersaoDaNorma } from '../normas/versao';
import { formatar, medido } from '../normas/valor-de-boletim';
import type { Metadata } from '../../types';

/** O que se escreve onde não há valor. Nunca espaço em branco. */
export const AUSENTE = '—';

export type EspecieDeDocumento = 'boletim' | 'relatorio';

export interface Campo {
  rotulo: string;
  valor: string;
}

export interface Bloco {
  titulo: string;
  campos: Campo[];
}

export interface Resultado {
  rotulo: string;
  contagem: number;
  /** Já formatada com vírgula decimal. Ausente no total. */
  porcentagem?: string;
  /** 'viavel' | 'inviavel' | 'total' — quem desenha escolhe a cor. */
  papel: 'viavel' | 'inviavel' | 'total';
}

export interface DocumentoDeLaudo {
  especie: EspecieDeDocumento;
  titulo: string;
  /**
   * A ressalva impressa quando o documento NÃO é um Boletim. Vazia quando é.
   * Vai no corpo do documento, não no rodapé: rodapé é onde se põe o que não
   * se quer que leiam.
   */
  ressalva: string;
  /** O que falta para virar Boletim. Vazio quando já é. */
  pendencias: string[];
  numero: string;
  emitidoEm: string;
  cabecalho: {
    instituicao: string;
    linhas: string[];
  };
  blocos: Bloco[];
  resultados: Resultado[];
  observacoes: string;
  rastreabilidade: Campo[];
  assinatura: {
    nome: string;
    cargo: string;
  };
}

export interface EntradaDoLaudo {
  filename: string;
  metadata: Metadata;
  viableCount: number;
  inviableCount: number;
  laboratorio?: IdentificacaoDoLaboratorio;
  /** Número do boletim, já formatado. Ausente = documento sem numeração. */
  numero?: string;
  /** Data de emissão. Injetada para o teste não depender do relógio. */
  emitidoEm?: Date;
  /** Versão do código que produziu os números. */
  versaoDoApp?: string;
  commitDoBuild?: string;
  /** Capítulo da RAS aplicado, quando houver. */
  norma?: VersaoDaNorma;
  /** µm por pixel, quando calibrado. */
  umPerPixel?: number;
  /** Quantos contornos vieram de detecção automática. */
  contornosDoModelo?: number;
  /** Quantos vieram de clique da pessoa. */
  contornosDoClique?: number;
}

// ---------------------------------------------------------------------------

/** Texto, ou travessão. Nunca string vazia. */
function ou(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return AUSENTE;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : AUSENTE;
}

/**
 * Data ISO no formato brasileiro, ou travessão.
 *
 * A validação não é paranoia: a primeira versão só separava por hífen, então
 * `dataBR('nao-e-data')` devolvia **"data/e/nao"** — um texto inventado ocupando
 * um campo de data do laudo. Um travessão diz "não há"; uma data falsa mente.
 */
export function dataBR(iso: string | undefined): string {
  if (!iso) return AUSENTE;
  const casa = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!casa) return AUSENTE;

  const [, ano, mes, dia] = casa;
  // Rejeita 2026-13-40: o formato bate, a data não existe.
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.getUTCMonth() + 1 !== Number(mes)) return AUSENTE;

  return `${dia}/${mes}/${ano}`;
}

/**
 * Quantidade com separador de milhar brasileiro.
 *
 * A representatividade de um lote é dada em toneladas de semente: "25000,0 kg"
 * obriga a pessoa a contar zeros com o dedo na tela. "25.000 kg" se lê.
 */
export function quantidadeBR(valor: number): string {
  if (!Number.isFinite(valor)) return AUSENTE;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor);
}

/** Porcentagem com vírgula decimal e arredondamento correto. */
export function porcentagem(parte: number, todo: number, casas = 1): string {
  if (!Number.isFinite(todo) || todo <= 0) return AUSENTE;
  return formatar(medido((parte / todo) * 100), casas) + ' %';
}

// ---------------------------------------------------------------------------

/**
 * Monta o documento a partir do que existe.
 *
 * Puro de propósito: dá para testar o que o papel vai dizer sem abrir um PDF.
 */
export function montarLaudo(entrada: EntradaDoLaudo): DocumentoDeLaudo {
  const {
    filename,
    metadata,
    viableCount,
    inviableCount,
    laboratorio,
    numero,
    emitidoEm = new Date(),
    versaoDoApp,
    commitDoBuild,
    norma,
    umPerPixel,
    contornosDoModelo,
    contornosDoClique,
  } = entrada;

  const amostra: IdentificacaoDaAmostra = metadata.amostra ?? {};
  const total = viableCount + inviableCount;

  const pendencias = conferirParaEmissao(laboratorio, amostra);
  const especie: EspecieDeDocumento = pendencias.length === 0 ? 'boletim' : 'relatorio';
  const ehBoletim = especie === 'boletim';

  return {
    especie,
    titulo: ehBoletim ? 'Boletim de Análise de Sementes' : 'Relatório de Contagem',
    ressalva: ehBoletim
      ? ''
      : 'Documento de pesquisa. NÃO é um Boletim de Análise de Sementes: a identificação ' +
        'exigida pela IN 40/2010 está incompleta e este resultado não tem valor fiscal ou ' +
        'comercial.',
    pendencias: pendencias.map((p) => p.descricao),
    numero: ou(numero),
    emitidoEm: emitidoEm.toLocaleString('pt-BR'),

    cabecalho: ehBoletim
      ? {
          instituicao: laboratorio!.nome,
          linhas: [
            `RENASEM ${laboratorio!.renasem}` +
              (laboratorio!.validadeDoRenasem
                ? `  •  válido até ${dataBR(laboratorio!.validadeDoRenasem)}`
                : ''),
            laboratorio!.portariaDeCredenciamento,
            laboratorio!.endereco,
          ],
        }
      : {
          instituicao: 'GPEOrq / GPSEM — Unoeste',
          linhas: [
            'Laboratório de Sementes e Tecido Vegetal — Campus II, Presidente Prudente/SP',
            'Grupo de Pesquisa em Orquídeas • Grupo de Estudos e Pesquisas em Sementes',
          ],
        },

    blocos: [montarBlocoDaAmostra(amostra, ehBoletim), montarBlocoDaPesquisa(metadata, filename)],

    resultados: [
      {
        rotulo: 'Viáveis',
        contagem: viableCount,
        porcentagem: porcentagem(viableCount, total),
        papel: 'viavel',
      },
      {
        rotulo: 'Inviáveis',
        contagem: inviableCount,
        porcentagem: porcentagem(inviableCount, total),
        papel: 'inviavel',
      },
      { rotulo: 'Total', contagem: total, papel: 'total' },
    ],

    observacoes: montarObservacoes(metadata, especie, norma),

    rastreabilidade: montarRastreabilidade({
      versaoDoApp,
      commitDoBuild,
      norma,
      umPerPixel,
      contornosDoModelo,
      contornosDoClique,
      total,
    }),

    assinatura: ehBoletim
      ? {
          nome: laboratorio!.responsavelTecnico,
          cargo: laboratorio!.crea
            ? `Responsável Técnico — CREA ${laboratorio!.crea}`
            : 'Responsável Técnico',
        }
      : { nome: ou(metadata.researcher), cargo: 'Responsável pela contagem' },
  };
}

function montarBlocoDaAmostra(amostra: IdentificacaoDaAmostra, ehBoletim: boolean): Bloco {
  const especieEscrita = escreverEspecie(amostra);
  const campos: Campo[] = [
    { rotulo: 'Espécie', valor: ou(especieEscrita) },
    { rotulo: 'Cultivar', valor: ou(amostra.cultivar) },
    { rotulo: 'Lote', valor: ou(amostra.lote) },
    { rotulo: 'Categoria', valor: amostra.categoria ? CATEGORIAS[amostra.categoria] : AUSENTE },
    { rotulo: 'Safra', valor: ou(amostra.safra) },
    {
      rotulo: 'Representatividade',
      valor:
        amostra.representatividadeKg !== undefined
          ? `${quantidadeBR(amostra.representatividadeKg)} kg`
          : AUSENTE,
    },
    { rotulo: 'Peneira', valor: ou(amostra.peneira) },
    { rotulo: 'Procedência', valor: ou(amostra.procedencia) },
    { rotulo: 'Nº da amostra', valor: ou(amostra.numeroDaAmostra) },
    { rotulo: 'Recebimento', valor: dataBR(amostra.dataDeRecebimento) },
    { rotulo: 'Amostragem', valor: dataBR(amostra.dataDaAmostragem) },
    {
      rotulo: 'Amostrador',
      valor: amostra.amostrador
        ? amostra.amostrador + (amostra.renasemDoAmostrador ? ` (${amostra.renasemDoAmostrador})` : '')
        : AUSENTE,
    },
    { rotulo: 'Requerente', valor: ou(amostra.requerente) },
  ];

  // No documento de pesquisa, campos que ninguém preencheu só ocupam espaço e
  // fazem o papel parecer um formulário abandonado. No Boletim eles ficam:
  // ali o travessão é informação — diz que não há, e a norma exige que diga.
  return {
    titulo: 'Identificação da amostra',
    campos: ehBoletim ? campos : campos.filter((c) => c.valor !== AUSENTE),
  };
}

function montarBlocoDaPesquisa(metadata: Metadata, filename: string): Bloco {
  const campos: Campo[] = [
    { rotulo: 'Pesquisador', valor: ou(metadata.researcher) },
    { rotulo: 'Projeto', valor: ou(metadata.project) },
    { rotulo: 'Tratamento', valor: ou(metadata.treatment) },
    { rotulo: 'Placa', valor: ou(metadata.plate) },
    { rotulo: 'Quadrante', valor: ou(metadata.quadrant) },
    { rotulo: 'Arquivo', valor: ou(filename) },
    {
      rotulo: 'Contagem',
      valor: metadata.useDifferential
        ? `Diferencial (base ${ou(metadata.baselineCount)})`
        : 'Direta',
    },
  ];
  return { titulo: 'Contexto do ensaio', campos: campos.filter((c) => c.valor !== AUSENTE) };
}

function montarObservacoes(
  metadata: Metadata,
  especie: EspecieDeDocumento,
  norma?: VersaoDaNorma
): string {
  const partes: string[] = [];
  if (metadata.notes?.trim()) partes.push(metadata.notes.trim());

  // A IN 40/2010 manda declarar em Observações a metodologia de toda
  // determinação sem método na RAS. Contagem de sementes por imagem é
  // exatamente esse caso, e omitir a declaração é o que torna o laudo
  // contestável.
  if (!norma) {
    partes.push(
      'Contagem realizada por análise de imagem digital, sem método correspondente na RAS. ' +
        'O operador conferiu e ajustou cada objeto identificado; a contagem final é do operador.'
    );
  }

  if (especie === 'relatorio') {
    partes.push(
      'Resultado de pesquisa, sem validade fiscal ou comercial.'
    );
  }

  return partes.join('\n\n');
}

function montarRastreabilidade(dados: {
  versaoDoApp?: string;
  commitDoBuild?: string;
  norma?: VersaoDaNorma;
  umPerPixel?: number;
  contornosDoModelo?: number;
  contornosDoClique?: number;
  total: number;
}): Campo[] {
  const campos: Campo[] = [
    { rotulo: 'Método', valor: 'Contagem assistida por imagem digital (SeedCounter)' },
    {
      rotulo: 'Norma aplicada',
      valor: dados.norma ? descrever(dados.norma) : 'Sem método correspondente na RAS',
    },
    {
      rotulo: 'Calibração',
      valor:
        dados.umPerPixel && dados.umPerPixel > 0
          ? `${formatar(medido(dados.umPerPixel), 2)} µm/px`
          : 'Não calibrado — medidas em pixels',
    },
  ];

  // Quem propôs cada objeto é dado de auditoria: um laudo em que a máquina
  // propôs tudo e outro em que a pessoa marcou tudo têm o mesmo número e
  // procedências diferentes.
  const doModelo = dados.contornosDoModelo ?? 0;
  const doClique = dados.contornosDoClique ?? 0;
  if (doModelo > 0 || doClique > 0) {
    campos.push({
      rotulo: 'Procedência dos contornos',
      valor: `${doModelo} por detecção automática, ${doClique} por marcação do operador`,
    });
  }

  campos.push({
    rotulo: 'Versão do software',
    valor:
      [dados.versaoDoApp, dados.commitDoBuild].filter(Boolean).join(' • ') || AUSENTE,
  });

  return campos;
}

/** O nome do arquivo que sai. */
export function nomeDoArquivo(doc: DocumentoDeLaudo, filename: string): string {
  const base = (filename.split('.')[0] || 'laudo').replace(/[^\w-]+/g, '_');
  const prefixo = doc.especie === 'boletim' ? 'BAS' : 'relatorio';
  const numero = doc.numero !== AUSENTE ? `_${doc.numero.replace('/', '-')}` : '';
  return `${prefixo}${numero}_${base}.pdf`;
}
