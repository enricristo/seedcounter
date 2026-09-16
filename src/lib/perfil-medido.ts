// =============================================================================
// SeedCounter — perfil morfométrico MEDIDO (Task B4)
//
// POR QUÊ ISTO É DIFERENTE DE `priors-morfometricos.ts`.
//
// Os números de `PERFIS_BIOMETRICOS` vêm de outro scanner e de outra
// segmentação — a solidez 0,987 do feijão de Koklu é a solidez do contorno
// DELES, não do nosso. Aqui é o oposto: `medir-pasta.ts` roda a MESMA onda
// que o app usa no clique sobre um conjunto de classificação já rotulado
// (uma semente por foto, classe conhecida), e o que sai daqui é comparável
// ao que o app mede na bancada, porque foi medido do mesmo jeito.
//
// A REGRA NÃO MUDA POR SER "NOSSO": referência orienta o olho, nunca dá
// veredito. `compararComPerfilMedido` segue a mesma forma de
// `compararComPerfil` — devolve uma nota para a interface, não uma decisão.
//
// `insuficiente` (n < 20) NUNCA é escondido: uma faixa com poucas fotos é
// tão referência quanto uma com muitas, só que mais frágil — e é a nota que
// diz isso, não o código que decide sumir com o número.
// =============================================================================

import type { MetricasContorno } from './priors-morfometricos';

/** Uma medida por foto: o resultado de rodar a onda no maior objeto de uma imagem de um conjunto de classificação. */
export interface MedidaDeUmObjeto {
  /** Caminho relativo ao conjunto — para rastrear qual foto gerou a linha. */
  caminho: string;
  /** Classe declarada da foto (CSV multiclasse, ou nome da subpasta). */
  classe: string;
  areaPx: number;
  feretMaxPx: number;
  feretMinPx: number;
  solidez: number;
  razaoDeAspecto: number;
}

/** Mediana e a faixa 5–95%: robusta a alguma foto mal segmentada no meio do lote. */
export interface Faixa {
  mediana: number;
  p5: number;
  p95: number;
}

export interface PerfilMedido {
  n: number;
  /** Abaixo disto a faixa é referência frágil — a nota tem que dizer, nunca esconder. */
  insuficiente: boolean;
  areaPx: Faixa;
  feretMaxPx: Faixa;
  feretMinPx: Faixa;
  solidez: Faixa;
  razaoDeAspecto: Faixa;
}

/** Abaixo disto, `insuficiente` fica verdadeiro — número arbitrário, mas pequeno o bastante para não fingir precisão de uma faixa de 5 fotos. */
const N_MINIMO = 20;

const FAIXA_VAZIA: Faixa = { mediana: NaN, p5: NaN, p95: NaN };

/** Percentil por interpolação linear (método "linear" do numpy) — `p` em [0,1]. */
function percentil(ordenados: number[], p: number): number {
  const n = ordenados.length;
  if (n === 0) return NaN;
  if (n === 1) return ordenados[0];
  const indice = p * (n - 1);
  const lo = Math.floor(indice);
  const hi = Math.ceil(indice);
  if (lo === hi) return ordenados[lo];
  const fracao = indice - lo;
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * fracao;
}

function faixaDe(valores: number[]): Faixa {
  const validos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (validos.length === 0) return FAIXA_VAZIA;
  return {
    mediana: percentil(validos, 0.5),
    p5: percentil(validos, 0.05),
    p95: percentil(validos, 0.95),
  };
}

/** Agrega uma lista de medidas (de uma classe, ou de um conjunto inteiro) num perfil. */
export function agregarPerfil(medidas: MedidaDeUmObjeto[]): PerfilMedido {
  return {
    n: medidas.length,
    insuficiente: medidas.length < N_MINIMO,
    areaPx: faixaDe(medidas.map((m) => m.areaPx)),
    feretMaxPx: faixaDe(medidas.map((m) => m.feretMaxPx)),
    feretMinPx: faixaDe(medidas.map((m) => m.feretMinPx)),
    solidez: faixaDe(medidas.map((m) => m.solidez)),
    razaoDeAspecto: faixaDe(medidas.map((m) => m.razaoDeAspecto)),
  };
}

/** Agrupa por `classe` e agrega cada grupo — um perfil por classe do conjunto. */
export function agregarPorClasse(medidas: MedidaDeUmObjeto[]): Map<string, PerfilMedido> {
  const porClasse = new Map<string, MedidaDeUmObjeto[]>();
  for (const m of medidas) {
    const lista = porClasse.get(m.classe);
    if (lista) lista.push(m);
    else porClasse.set(m.classe, [m]);
  }
  const resultado = new Map<string, PerfilMedido>();
  for (const [classe, lista] of porClasse) resultado.set(classe, agregarPerfil(lista));
  return resultado;
}

/**
 * Mesma forma que `ComparacaoComPerfil` (priors-morfometricos.ts): um `perfil`
 * (aqui, o medido), dois booleanos de "fora da faixa", e uma `nota` pronta
 * para a interface. Nunca diz "aglomerado" nem "quebrada" — isso é veredito,
 * e quem decide é `aglomerado.ts`.
 */
export interface ComparacaoComPerfilMedido {
  perfil: PerfilMedido | null;
  solidezForaDaFaixa: boolean;
  razaoDeAspectoForaDaFaixa: boolean;
  nota: string;
}

function foraDaFaixa(valor: number, faixa: Faixa): boolean {
  return Number.isFinite(valor) && Number.isFinite(faixa.p5) && Number.isFinite(faixa.p95) &&
    (valor < faixa.p5 || valor > faixa.p95);
}

/**
 * Compara o contorno com um perfil MEDIDO (não de literatura). Mesma regra de
 * `compararComPerfil`: devolve a comparação, não o veredito.
 */
export function compararComPerfilMedido(
  metricas: Pick<MetricasContorno, 'solidez' | 'razaoDeAspecto'>,
  perfil: PerfilMedido | null
): ComparacaoComPerfilMedido {
  if (!perfil || perfil.n === 0) {
    return { perfil: null, solidezForaDaFaixa: false, razaoDeAspectoForaDaFaixa: false, nota: '' };
  }

  const solidezForaDaFaixa = foraDaFaixa(metricas.solidez, perfil.solidez);
  const razaoDeAspectoForaDaFaixa =
    metricas.razaoDeAspecto !== undefined && foraDaFaixa(metricas.razaoDeAspecto, perfil.razaoDeAspecto);

  const sufixoAmostra = perfil.insuficiente ? `n=${perfil.n}, amostra pequena` : `n=${perfil.n}`;

  if (!solidezForaDaFaixa && !razaoDeAspectoForaDaFaixa) {
    return {
      perfil,
      solidezForaDaFaixa,
      razaoDeAspectoForaDaFaixa,
      nota: `Dentro da faixa medida (${sufixoAmostra}).`,
    };
  }

  const partes: string[] = [];
  if (solidezForaDaFaixa) {
    partes.push(
      `solidez ${metricas.solidez.toFixed(2)} fora da faixa medida (${perfil.solidez.p5.toFixed(2)}–${perfil.solidez.p95.toFixed(2)})`
    );
  }
  if (razaoDeAspectoForaDaFaixa && metricas.razaoDeAspecto !== undefined) {
    partes.push(
      `razão de aspecto ${metricas.razaoDeAspecto.toFixed(2)} fora da faixa medida (${perfil.razaoDeAspecto.p5.toFixed(2)}–${perfil.razaoDeAspecto.p95.toFixed(2)})`
    );
  }

  return {
    perfil,
    solidezForaDaFaixa,
    razaoDeAspectoForaDaFaixa,
    nota: `Fora da faixa medida (${sufixoAmostra}): ${partes.join('; ')}. Confira o contorno.`,
  };
}
