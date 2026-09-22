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
import { fecharDuas, arredondarGerminacao } from '../normas/arredondamento';
import {
  CLASSES,
  consolidar,
  contarPorClasse,
  descreverEscarificacao,
  protocoloPorChave,
  type MarcaClassificavel,
} from '../normas/classes-de-semente';
import type { Metadata } from '../../types';
import type { SeedMeasurement } from '../measurements';

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
  /**
   * As marcas, para o protocolo de germinacao consolidar por classe.
   * Ausente = o laudo fica so com viavel/inviavel.
   */
  marcas?: MarcaClassificavel[];
  /**
   * O bloco de métricas por classe (área média, a*, L*, b*), já montado por
   * `montarMetricasAvancadas`. Ausente = o laudo não fala de cor nem de área.
   */
  metricasAvancadas?: Bloco;
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
    marcas,
  } = entrada;

  const amostra: IdentificacaoDaAmostra = metadata.amostra ?? {};
  const total = viableCount + inviableCount;

  const pendencias = conferirParaEmissao(laboratorio, amostra);
  const especie: EspecieDeDocumento = pendencias.length === 0 ? 'boletim' : 'relatorio';

  // As duas porcentagens FECHAM 100,0 por construção: a principal mantém o
  // próprio arredondamento e o complemento absorve. Arredondar cada uma por
  // conta própria imprimia 33,4 + 66,7 = 100,1.
  const fechadas = fecharDuas(viableCount, total);

  // O protocolo de germinacao, quando ha um com classes finas. Sai das MARCAS
  // classificadas na galeria, e os avisos que ele produz (espigueta vazia fora
  // do denominador, tetrazolio obrigatorio, escarificacao) vao para
  // Observacoes — que e onde a IN 40/2010 manda declarar.
  const germinacao = montarGerminacao(metadata, marcas);
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
          instituicao: 'GPEOrq / GPSEM',
          linhas: [
            'Laboratório de Sementes e Tecido Vegetal — Campus II, Presidente Prudente/SP',
            'Grupo de Pesquisa em Orquídeas • Grupo de Estudos e Pesquisas em Sementes',
          ],
        },

    blocos: [
      montarBlocoDaAmostra(amostra, ehBoletim),
      montarBlocoDaPesquisa(metadata, filename),
      ...(germinacao ? [germinacao.bloco] : []),
      ...(entrada.metricasAvancadas ? [entrada.metricasAvancadas] : []),
    ],

    resultados: [
      {
        rotulo: 'Viáveis',
        contagem: viableCount,
        porcentagem: fechadas ? formatar(medido(fechadas.principal), 1) + ' %' : AUSENTE,
        papel: 'viavel',
      },
      {
        rotulo: 'Inviáveis',
        contagem: inviableCount,
        porcentagem: fechadas ? formatar(medido(fechadas.complemento), 1) + ' %' : AUSENTE,
        papel: 'inviavel',
      },
      { rotulo: 'Total', contagem: total, papel: 'total' },
    ],

    observacoes: montarObservacoes(metadata, especie, norma, germinacao?.observacoes ?? []),

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

/**
 * O bloco de germinacao por classe, e o que ele manda para Observacoes.
 *
 * Devolve `null` no protocolo simples: ali viavel/inviavel ja e o resultado, e
 * um bloco "normal 92 / morta 8" repetiria o que os cartoes ja dizem.
 */
function montarGerminacao(
  metadata: Metadata,
  marcas: MarcaClassificavel[] | undefined
): { bloco: Bloco; observacoes: string[] } | null {
  const protocolo = protocoloPorChave(metadata.protocolo);
  if (protocolo.classes.length <= 2 || !marcas || marcas.length === 0) return null;

  const { contagens, naoClassificadas } = contarPorClasse(marcas, protocolo);
  const c = consolidar(contagens, protocolo);
  if (c.denominador <= 0) return null;

  // Inteiros que somam 100, com o desempate da norma. E o mesmo modulo que
  // fecha a pureza: o boletim nao pode somar 99.
  const fechado = arredondarGerminacao({
    normais: c.porcentagens.normal ?? 0,
    anormais: c.porcentagens.anormal ?? 0,
    duras: c.porcentagens.dura ?? 0,
    dormentes: c.porcentagens.dormente ?? 0,
    mortas: c.porcentagens.morta ?? 0,
  }).valores;

  const campos: Campo[] = [
    { rotulo: 'Protocolo', valor: protocolo.nome },
    { rotulo: 'Sementes examinadas', valor: String(c.denominador) },
  ];
  if (c.unidadesExaminadas !== c.denominador) {
    campos.push({
      rotulo: 'Unidades vazias',
      valor: `${contagens.vazia ?? 0} (inerte, fora do denominador)`,
    });
  }
  const linha = (rotulo: string, n: number | undefined, pct: number) =>
    campos.push({ rotulo, valor: `${n ?? 0}  —  ${pct}%` });
  linha(CLASSES.normal.rotulo, contagens.normal, fechado.normais);
  if (protocolo.classes.includes('anormal')) linha(CLASSES.anormal.rotulo, contagens.anormal, fechado.anormais);
  if (protocolo.classes.includes('dura')) linha(CLASSES.dura.rotulo, contagens.dura, fechado.duras);
  if (protocolo.classes.includes('dormente')) linha(CLASSES.dormente.rotulo, contagens.dormente, fechado.dormentes);
  linha(CLASSES.morta.rotulo, contagens.morta, fechado.mortas);

  const observacoes = c.avisos.map((a) => a.textoParaObservacoes).filter((t) => t.length > 0);
  const esc = descreverEscarificacao(metadata.escarificacao);
  if (esc) observacoes.push(esc);
  if (naoClassificadas > 0) {
    observacoes.push(
      `${naoClassificadas} ${naoClassificadas === 1 ? 'semente contada' : 'sementes contadas'} pela classe ` +
        'implicita (viavel como normal, inviavel como morta) por nao ter classificacao fina atribuida.'
    );
  }

  return { bloco: { titulo: 'Teste de germinacao', campos }, observacoes };
}

function montarObservacoes(
  metadata: Metadata,
  especie: EspecieDeDocumento,
  norma?: VersaoDaNorma,
  doProtocolo: string[] = []
): string {
  const partes: string[] = [];
  if (metadata.notes?.trim()) partes.push(metadata.notes.trim());
  partes.push(...doProtocolo);

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

// ---------------------------------------------------------------------------
// Métricas avançadas — área e cor, POR CLASSE
// ---------------------------------------------------------------------------

/** Média aritmética; `null` para lista vazia — nunca NaN num campo de laudo. */
function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Número com vírgula decimal e sinal explícito quando pedido — "+18,4" diz "vermelho" sem legenda. */
function numeroBR(valor: number, casas: number, comSinal = false): string {
  const texto = formatar(medido(valor), casas);
  return comSinal && valor > 0 ? `+${texto}` : texto;
}

/**
 * O bloco "Métricas avançadas" do laudo, a partir da tabela de medidas.
 *
 * POR CLASSE, NÃO UMA MÉDIA SÓ. No tetrazólio o que interessa é a distância
 * entre o a* das viáveis (embrião vermelho, a* alto) e o das inviáveis
 * (branco, a* perto de zero). Uma média única mistura as duas e diz nada:
 * 60 viáveis a +20 com 40 inviáveis a +2 dão +12,8 — um número que não
 * descreve nenhuma semente da placa. A primeira versão fazia exatamente isso.
 *
 * A UNIDADE DIZ O QUE É. Sem calibração a área sai em px², e o laudo escreve
 * "px²" — uma área sem unidade num documento é um número que alguém vai ler
 * como mm². Com calibração sai em mm² (é assim que o lote é descrito).
 *
 * SEM PIXELS, SEM COR. As colunas de cor só existem quando `buildMeasurements`
 * recebeu a imagem; num laudo só de contagem elas não existem e as linhas de
 * cor somem — não saem "NaN", nem "0,0". A área continua, porque vem do
 * contorno e não da foto.
 *
 * O que entra é a MESMA tabela do CSV: se o laudo e a planilha divergissem
 * na área média, um dos dois estaria errado.
 *
 * Devolve `null` quando não há nenhuma semente com contorno: sem contorno não
 * há área nem cor, e um bloco vazio só ocuparia lugar.
 */
export function montarMetricasAvancadas(medicoes: SeedMeasurement[]): Bloco | null {
  const comContorno = medicoes.filter((m) => m.areaPx !== undefined);
  if (comContorno.length === 0) return null;

  // Calibrado = toda linha com contorno tem `areaMm2` (buildMeasurements só
  // preenche quando há µm/px). Meio calibrado não existe: é a mesma imagem.
  const calibrado = comContorno.every((m) => m.areaMm2 !== undefined);
  const campos: Campo[] = [];

  for (const classe of ['viavel', 'inviavel'] as const) {
    const rotulo = classe === 'viavel' ? 'Viáveis' : 'Inviáveis';
    const linhas = comContorno.filter((m) => m.classe === classe);
    if (linhas.length === 0) continue;

    const areaMedia = calibrado
      ? media(linhas.map((m) => m.areaMm2 ?? 0))
      : media(linhas.map((m) => m.areaPx ?? 0));
    if (areaMedia !== null) {
      campos.push({
        rotulo: `${rotulo} — área média (n = ${linhas.length})`,
        valor: calibrado ? `${numeroBR(areaMedia, 3)} mm²` : `${quantidadeBR(Math.round(areaMedia))} px² (não calibrado)`,
      });
    }

    const comCor = linhas.filter((m) => m.aMean !== undefined);
    const a = media(comCor.map((m) => m.aMean ?? 0));
    const l = media(comCor.map((m) => m.lMean ?? 0));
    const b = media(comCor.map((m) => m.labBMean ?? 0));
    if (a !== null && l !== null && b !== null) {
      const n = comCor.length !== linhas.length ? ` (cor em ${comCor.length} de ${linhas.length})` : '';
      campos.push({ rotulo: `${rotulo} — a* CIELAB, sinal do tetrazólio${n}`, valor: numeroBR(a, 1, true) });
      campos.push({ rotulo: `${rotulo} — L* CIELAB, luminosidade`, valor: numeroBR(l, 1) });
      campos.push({ rotulo: `${rotulo} — b* CIELAB, eixo azul–amarelo`, valor: numeroBR(b, 1, true) });
    }
  }

  const haCor = campos.some((c) => c.rotulo.includes('a* CIELAB'));
  campos.push({
    rotulo: 'Leitura',
    valor:
      'Médias por classe, sobre as sementes com contorno. ' +
      (haCor
        ? 'a* positivo = vermelho (tetrazólio); a* próximo de zero = sem coloração. Cor medida dentro do contorno.'
        : 'Sem medidas de cor: o laudo foi gerado sem a imagem.'),
  });

  return { titulo: 'Métricas avançadas', campos };
}

/** O nome do arquivo que sai. */
export function nomeDoArquivo(doc: DocumentoDeLaudo, filename: string): string {
  const base = (filename.split('.')[0] || 'laudo').replace(/[^\w-]+/g, '_');
  const prefixo = doc.especie === 'boletim' ? 'BAS' : 'relatorio';
  const numero = doc.numero !== AUSENTE ? `_${doc.numero.replace('/', '-')}` : '';
  return `${prefixo}${numero}_${base}.pdf`;
}
