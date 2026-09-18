// =============================================================================
// SeedCounter — comparação entre bancadas (C2, Task 5)
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Com duas a quatro bancadas abertas, a pergunta natural é "qual das duas
// tem mais sementes viáveis?" ou "essa placa está germinando mais rápido do
// que na semana passada?". Isto não é uma tela — é lógica pura, testável sem
// navegador: uma linha por bancada, e uma série no tempo quando faz sentido.
//
// A REGRA QUE NÃO CAI. Duas bancadas podem ter calibrações diferentes — uma
// veio de um scanner a 1200 dpi, outra de uma foto de celular calibrada por
// régua. Comparar as ÁREAS em mm² nesse caso é comparar coisas que não usam
// a mesma unidade de verdade: um "1 mm²" calculado com µm/px errado não é um
// mm² de verdade. Por isso `decidirEscala` verifica a divergência entre as
// calibrações presentes e, se ela passar de 5%, manda a interface mostrar
// px² — a unidade que não depende de calibração nenhuma — e diz por quê.
//
// Puro, sem DOM, sem Dexie: só o que dá para testar em `node` (ver
// `Global Constraints` do plano de bancadas).
// =============================================================================

import type { Mark, YoloSegmentation } from '../../types';
import { enumerarObjetos } from '../../lib/objetos';
import { areaDoPoligono, medianaDaCena } from '../../lib/aglomerado';

/**
 * O que uma bancada aberta com imagem contribui para a comparação. Quem monta
 * isto (o painel) já filtrou para só bancadas com imagem — `compararBancadas`
 * não filtra de novo.
 */
export interface EntradaDeComparacao {
  /** Índice de exibição da bancada (1..4), na ordem que aparece na tela. */
  bancada: number;
  /** Nome do arquivo — rótulo padrão, usado quando não há série no tempo. */
  arquivo: string;
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  /** Calibração espacial desta bancada, se houver (`metadata.umPerPixel`). */
  umPerPixel?: number;
  /** `metadata.plate` desta bancada, sem normalizar — `compararBancadas` normaliza. */
  placa?: string;
  /**
   * Data de referência desta imagem (ISO), quando existir — hoje vem do
   * `lastModified` do arquivo carregado, na falta de um campo de data
   * explícito em `Metadata`. Usada só para decidir o rótulo "D0/D7…" e para
   * alimentar `serieNoTempo`.
   */
  data?: string;
}

export interface LinhaDeComparacao {
  /** Nome do arquivo, ou "D0", "D7"… quando todas as bancadas são a mesma placa com data. */
  rotulo: string;
  bancada: number;
  total: number;
  viaveis: number;
  inviaveis: number;
  areaMedianaPx: number | null;
  /** `null` sem calibração — não inventa mm² de uma imagem sem escala. */
  areaMedianaMm2: number | null;
  umPorPixel?: number;
  /**
   * Placa normalizada (`trim` + minúsculas) desta linha, para `serieNoTempo`
   * confirmar "mesma placa" — não é uma coluna da tabela.
   */
  placa?: string;
}

/** `trim` + minúsculas: "Placa 1" e " placa 1 " são a mesma placa. */
function normalizarPlaca(p: string | undefined): string {
  return (p ?? '').trim().toLowerCase();
}

/**
 * Uma linha por bancada aberta com imagem. Ordem = ordem das bancadas (a
 * ordem de `entradas`, que quem chama já monta na ordem de exibição).
 */
export function compararBancadas(entradas: EntradaDeComparacao[]): LinhaDeComparacao[] {
  // "D0/D7…" só quando NÃO HÁ ambiguidade: todas as bancadas são a mesma
  // placa e todas têm data. Faltando qualquer uma das duas condições, o nome
  // do arquivo já identifica a imagem sem arriscar rotular errado.
  const placaComum =
    entradas.length > 1 && normalizarPlaca(entradas[0]?.placa) !== ''
      ? normalizarPlaca(entradas[0].placa)
      : '';
  const mesmaPlaca = placaComum !== '' && entradas.every((e) => normalizarPlaca(e.placa) === placaComum);
  const todasComData = entradas.length > 1 && entradas.every((e) => !!e.data);
  const usarDia = mesmaPlaca && todasComData;
  const baseDia = usarDia ? Math.min(...entradas.map((e) => new Date(e.data as string).getTime())) : 0;

  return entradas.map((e) => {
    const objetos = enumerarObjetos(e.marks, e.segmentacoes);
    const viaveis = objetos.filter((o) => o.categoria === 'viable').length;
    const inviaveis = objetos.filter((o) => o.categoria === 'inviable').length;

    // Área só existe para objetos com contorno — uma marcação sem onda não
    // tem forma para medir.
    const areas = objetos
      .filter((o): o is typeof o & { contorno: YoloSegmentation } => !!o.contorno)
      .map((o) => areaDoPoligono(o.contorno.polygon_points));
    const medianaPx = medianaDaCena(areas);
    const areaMedianaPx = Number.isFinite(medianaPx) ? medianaPx : null;
    const areaMedianaMm2 =
      areaMedianaPx !== null && e.umPerPixel && e.umPerPixel > 0
        ? (areaMedianaPx * e.umPerPixel * e.umPerPixel) / 1e6
        : null;

    const rotulo = usarDia
      ? `D${Math.round((new Date(e.data as string).getTime() - baseDia) / 86_400_000)}`
      : e.arquivo;

    return {
      rotulo,
      bancada: e.bancada,
      total: objetos.length,
      viaveis,
      inviaveis,
      areaMedianaPx,
      areaMedianaMm2,
      umPorPixel: e.umPerPixel,
      placa: normalizarPlaca(e.placa) || undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// A regra que não cai: mm² só quando as calibrações concordam
// ---------------------------------------------------------------------------

/** Acima disto, duas calibrações são "diferentes" — não é a mesma câmera/scanner. */
const DIVERGENCIA_MAXIMA = 0.05;

export interface DecisaoDeEscala {
  /** `true`: a tabela mostra área em mm². `false`: mostra em px². */
  usarMm2: boolean;
  /** Frase para a interface exibir — só presente quando a causa é divergência (não falta de calibração). */
  motivo?: string;
}

/**
 * Decide se a comparação pode usar mm² ou se precisa cair para px².
 *
 * Sem pelo menos duas linhas calibradas não há o que divergir: usa mm² se
 * alguma linha tiver calibração (é a unidade que a pessoa lê), px² se
 * nenhuma tiver. Com duas ou mais, compara a MAIOR contra a MENOR — se a
 * diferença relativa passar de 5%, as bancadas não são a mesma câmera/scanner
 * calibrado do mesmo jeito, e converter tudo para mm² esconderia esse fato
 * atrás de um número que parece comparável e não é.
 */
export function decidirEscala(linhas: LinhaDeComparacao[]): DecisaoDeEscala {
  const calibradas = linhas
    .map((l) => l.umPorPixel)
    .filter((u): u is number => typeof u === 'number' && u > 0);

  if (calibradas.length < 2) {
    return { usarMm2: calibradas.length > 0 };
  }

  const menor = Math.min(...calibradas);
  const maior = Math.max(...calibradas);
  const divergencia = (maior - menor) / menor;

  if (divergencia > DIVERGENCIA_MAXIMA) {
    return {
      usarMm2: false,
      motivo:
        `As bancadas têm calibrações diferentes (${menor.toFixed(2)}–${maior.toFixed(2)} µm/px, ` +
        `${(divergencia * 100).toFixed(0)}% de diferença) — comparando em px² para não converter ` +
        'medidas de escalas distintas para a mesma unidade.',
    };
  }

  return { usarMm2: true };
}

// ---------------------------------------------------------------------------
// Série no tempo — só quando é a mesma placa
// ---------------------------------------------------------------------------

export interface PontoDaSerie {
  data: string;
  rotulo: string;
  bancada: number;
  total: number;
  viaveis: number;
  inviaveis: number;
}

export interface SerieNoTempo {
  /** Placa normalizada que todas as linhas compartilham. */
  placa: string;
  /** Em ordem crescente de data. */
  pontos: PontoDaSerie[];
}

/**
 * Série no tempo: só quando as bancadas são a MESMA placa (mesmo
 * `metadata.plate`, ignorando espaços e caixa) em datas diferentes. Devolve
 * `null` quando não são — a comparação lado a lado (`compararBancadas`)
 * continua valendo, a série não.
 *
 * `datas[i]` é a data da bancada da linha `linhas[i]` — os dois arrays andam
 * juntos pelo índice, na mesma ordem que `compararBancadas` devolveu.
 */
export function serieNoTempo(
  linhas: LinhaDeComparacao[],
  datas: (string | undefined)[]
): SerieNoTempo | null {
  if (linhas.length !== datas.length) return null; // desencontrados — não arrisca casar errado
  if (linhas.length < 2) return null;

  const placaNormalizada = normalizarPlaca(linhas[0]?.placa);
  if (placaNormalizada === '') return null;
  if (!linhas.every((l) => normalizarPlaca(l.placa) === placaNormalizada)) return null;

  if (datas.some((d) => !d)) return null;
  const datasValidas = datas as string[];

  const diasDistintos = new Set(datasValidas.map((d) => new Date(d).toISOString().slice(0, 10)));
  if (diasDistintos.size < 2) return null; // mesma placa, mesma data: não é série no tempo

  const pontos = linhas
    .map((l, i) => ({
      data: datasValidas[i],
      rotulo: l.rotulo,
      bancada: l.bancada,
      total: l.total,
      viaveis: l.viaveis,
      inviaveis: l.inviaveis,
    }))
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  return { placa: placaNormalizada, pontos };
}
