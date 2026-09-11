// =============================================================================
// SeedCounter — resumo de morfometria (o núcleo do painel ao vivo)
//
// POR QUE ISTO NÃO REIMPLEMENTA NADA DE `measurements.ts`.
//
// `buildMeasurements` já faz o trabalho caro e sutil: PCA sobre o polígono,
// associação marca↔contorno por lançamento de raio, conversão para µm/mm. Este
// arquivo só AGREGA o que `buildMeasurements` já calculou — mediana, p5/p95,
// razão C/L por objeto — para alimentar um painel que atualiza a cada
// marcação, contorno editado ou troca de calibração.
//
// `summarize` (em measurements.ts) já existe e é usado no CSV/SQL, mas serve a
// um público diferente: média + desvio-padrão, para conferência rápida de
// exportação. O painel ao vivo do laboratório quer MEDIANA e PERCENTIS — a
// distribuição sofre menos com o outlier que é justamente o que se quer
// enxergar (um contorno que engoliu a vizinha alonga muito, e uma média deixa
// isso escondido atrás de todos os outros valores; a mediana não). Por isso
// este arquivo não estende `summarize`: define seu próprio agregado, em cima
// dos mesmos `SeedMeasurement[]`.
//
// A RAZÃO C/L É CALCULADA POR OBJETO, NUNCA A RAZÃO DAS MEDIANAS.
//
// median(comprimento) / median(largura) é uma conta diferente de
// median(comprimento_i / largura_i para cada i) — a primeira apaga o próprio
// outlier alongado que a razão existe para denunciar (ver
// `tamanhos-de-semente.ts`: soja isolada ~1,2; orquídea isolada ~3,7; um
// contorno que fundiu duas sementes destoa dessa faixa). Por isso a razão
// entra aqui como um vetor por objeto, agregado como qualquer outra medida.
// =============================================================================

import type { SeedMeasurement } from '../../lib/measurements';

/** Estatística descritiva de um vetor de medidas. */
export interface EstatisticaDeMedida {
  n: number;
  mediana: number;
  media: number;
  p5: number;
  p95: number;
  minimo: number;
  maximo: number;
}

/**
 * Percentil por interpolação linear entre os dois valores ordenados mais
 * próximos — o método "type 7" do R, e o padrão do numpy. Com um valor só,
 * todo percentil é o próprio valor.
 *
 * A mesma função serve para a MEDIANA (p50): com n par, o índice cai exatamente
 * entre os dois vizinhos do meio e a interpolação vira a média deles — que é a
 * definição usual de mediana par. Não há necessidade de um caminho separado.
 */
function percentil(ordenado: number[], p: number): number {
  const n = ordenado.length;
  if (n === 1) return ordenado[0];
  const indice = (p / 100) * (n - 1);
  const inferior = Math.floor(indice);
  const superior = Math.ceil(indice);
  if (inferior === superior) return ordenado[inferior];
  const fracao = indice - inferior;
  return ordenado[inferior] + fracao * (ordenado[superior] - ordenado[inferior]);
}

/**
 * Agrega um vetor de medidas. `null` quando não há nenhum valor válido —
 * distinto de um vetor com um zero legítimo dentro.
 *
 * Valores não finitos (NaN, Infinity, -Infinity) são descartados antes de
 * qualquer conta: uma medida que não pôde ser calculada para um objeto não
 * deve arrastar o resumo inteiro para NaN.
 */
export function estatistica(valores: number[]): EstatisticaDeMedida | null {
  const finitos = valores.filter((v) => Number.isFinite(v));
  const n = finitos.length;
  if (n === 0) return null;

  const ordenado = [...finitos].sort((a, b) => a - b);
  const soma = ordenado.reduce((s, v) => s + v, 0);

  return {
    n,
    mediana: percentil(ordenado, 50),
    media: soma / n,
    p5: percentil(ordenado, 5),
    p95: percentil(ordenado, 95),
    minimo: ordenado[0],
    maximo: ordenado[n - 1],
  };
}

/** O resumo que o painel ao vivo mostra para a imagem aberta. */
export interface ResumoDeMorfometria {
  total: number;
  viaveis: number;
  inviaveis: number;
  percentViaveis: number;
  /** Quantos objetos têm morfometria (contorno associado à marcação). */
  comContorno: number;
  semContorno: number;
  calibrado: boolean;
  umPerPixel?: number;
  comprimentoPx: EstatisticaDeMedida | null;
  larguraPx: EstatisticaDeMedida | null;
  areaPx: EstatisticaDeMedida | null;
  /** Só preenchido quando `calibrado` — null e não `undefined`, de propósito:
   *  "não calculei" é diferente de "esqueci de preencher". */
  comprimentoMm: EstatisticaDeMedida | null;
  larguraMm: EstatisticaDeMedida | null;
  areaMm2: EstatisticaDeMedida | null;
  /** Comprimento/largura por objeto — invariante de escala, vale sem calibração. */
  razaoCL: EstatisticaDeMedida | null;
}

/** Extrai os valores finitos de um campo, um por linha. */
function coluna(rows: SeedMeasurement[], campo: (r: SeedMeasurement) => number | undefined): number[] {
  return rows
    .map(campo)
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
}

/**
 * Monta o resumo a partir da tabela de medidas que `buildMeasurements` produz.
 *
 * `umPerPixel` é opcional de propósito: o painel funciona sem calibração,
 * mostrando só pixels — é a mesma degradação graciosa que `measurements.ts` já
 * pratica.
 */
export function resumir(rows: SeedMeasurement[], umPerPixel?: number): ResumoDeMorfometria {
  const total = rows.length;
  const viaveis = rows.filter((r) => r.classe === 'viavel').length;
  const inviaveis = total - viaveis;
  const percentViaveis = total > 0 ? (viaveis / total) * 100 : 0;

  // "Tem contorno" = tem morfometria — o mesmo teste que `summarize` já usa em
  // measurements.ts (comprimentoPx só existe quando buildMeasurements achou,
  // ou aproximou, um polígono para a marcação).
  const comContorno = rows.filter((r) => Number.isFinite(r.comprimentoPx)).length;
  const semContorno = total - comContorno;

  const calibrado = !!umPerPixel && umPerPixel > 0;

  const comprimentoPxValores = coluna(rows, (r) => r.comprimentoPx);
  const larguraPxValores = coluna(rows, (r) => r.larguraPx);
  const areaPxValores = coluna(rows, (r) => r.areaPx);

  // Razão por objeto: comprimento e largura da MESMA linha, não dois vetores
  // agregados separadamente e depois divididos.
  const razoesCL = rows
    .filter(
      (r) =>
        Number.isFinite(r.comprimentoPx) &&
        Number.isFinite(r.larguraPx) &&
        (r.larguraPx as number) > 0
    )
    .map((r) => (r.comprimentoPx as number) / (r.larguraPx as number));

  // mm derivado diretamente do vetor em px × µm/px ÷ 1000 (área ÷ 1e6), em vez
  // de ler as colunas *Mm de SeedMeasurement — assim o resumo fica coerente
  // mesmo se `rows` tiver sido montada com uma calibração diferente da que se
  // quer usar para exibir agora (ex.: recalibração sem remontar as medidas).
  const comprimentoMmValores = calibrado
    ? comprimentoPxValores.map((px) => (px * (umPerPixel as number)) / 1000)
    : [];
  const larguraMmValores = calibrado
    ? larguraPxValores.map((px) => (px * (umPerPixel as number)) / 1000)
    : [];
  const areaMmValores = calibrado
    ? areaPxValores.map((px) => (px * (umPerPixel as number) * (umPerPixel as number)) / 1e6)
    : [];

  return {
    total,
    viaveis,
    inviaveis,
    percentViaveis,
    comContorno,
    semContorno,
    calibrado,
    umPerPixel: calibrado ? umPerPixel : undefined,
    comprimentoPx: estatistica(comprimentoPxValores),
    larguraPx: estatistica(larguraPxValores),
    areaPx: estatistica(areaPxValores),
    comprimentoMm: calibrado ? estatistica(comprimentoMmValores) : null,
    larguraMm: calibrado ? estatistica(larguraMmValores) : null,
    areaMm2: calibrado ? estatistica(areaMmValores) : null,
    razaoCL: estatistica(razoesCL),
  };
}
