// =============================================================================
// SeedCounter — os recortes da galeria
//
// A GEOMETRIA QUE MUDA A UNIDADE DE TRABALHO.
//
// Hoje a pessoa trabalha na IMAGEM: procura o erro no meio de duzentos objetos,
// com zoom e pan. Na galeria ela trabalha no OBJETO — e comparação lado a lado
// é o que o olho humano faz bem, e é exatamente o que a imagem inteira impede.
//
// O PONTO SEM CONTORNO É A PARTE FINA.
//
// Uma marcação sem polígono não é um objeto incompleto: é uma REGIÃO PROPOSTA.
// A pessoa já disse "aqui tem uma semente"; falta só o contorno. Recortar uma
// caixa em volta dela transforma o problema de "encontre e contorne" em
// "contorne o que já foi encontrado", que é bem menor.
//
// E o lado dessa caixa não pode ser constante: uma semente de orquídea tem
// dezenas de pixels, uma de soja tem centenas. A caixa sai da MEDIANA dos
// contornos que já existem na mesma cena — a própria imagem diz qual é o
// tamanho de uma semente ali.
// =============================================================================

import type { Mark, YoloSegmentation } from '../../types';

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Margem em volta do contorno, como fração do lado maior. */
export const MARGEM = 0.18;

/** Lado da caixa quando a cena não tem contorno nenhum para servir de escala. */
export const LADO_PADRAO = 96;

/** Quantos contornos bastam para a mediana da cena valer alguma coisa. */
const MINIMO_PARA_MEDIANA = 3;

// ---------------------------------------------------------------------------

/** A caixa que envolve um polígono, sem margem. */
export function envolver(pontos: [number, number][]): Caixa | null {
  if (!pontos || pontos.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of pontos) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY, largura: maxX - minX, altura: maxY - minY };
}

/** Cresce a caixa em todas as direções, proporcional ao lado maior. */
export function comMargem(caixa: Caixa, fracao = MARGEM): Caixa {
  const folga = Math.max(caixa.largura, caixa.altura) * fracao;
  return {
    x: caixa.x - folga,
    y: caixa.y - folga,
    largura: caixa.largura + folga * 2,
    altura: caixa.altura + folga * 2,
  };
}

/**
 * Prende a caixa dentro da imagem, SEM deformar.
 *
 * Desliza a caixa para dentro antes de encolher: uma semente na borda deve
 * aparecer inteira e centrada no que der, não achatada contra o limite.
 */
export function limitarACena(caixa: Caixa, largura: number, altura: number): Caixa {
  const l = Math.min(caixa.largura, largura);
  const a = Math.min(caixa.altura, altura);
  return {
    x: Math.max(0, Math.min(caixa.x, largura - l)),
    y: Math.max(0, Math.min(caixa.y, altura - a)),
    largura: l,
    altura: a,
  };
}

/** Caixa quadrada centrada num ponto. */
export function caixaDoPonto(marca: Mark, lado: number): Caixa {
  return {
    x: marca.x - lado / 2,
    y: marca.y - lado / 2,
    largura: lado,
    altura: lado,
  };
}

/**
 * O lado típico de uma semente NESTA cena.
 *
 * Mediana, não média: um contorno que engoliu a vizinha tem o dobro do tamanho
 * e puxaria a média para cima, fazendo toda caixa de ponto sair grande demais
 * justamente na cena onde há mais erro para conferir.
 */
export function ladoTipico(
  segmentacoes: YoloSegmentation[],
  padrao = LADO_PADRAO
): number {
  const lados: number[] = [];
  for (const seg of segmentacoes) {
    const caixa = envolver(seg.polygon_points);
    if (!caixa) continue;
    const lado = Math.max(caixa.largura, caixa.altura);
    if (lado > 0) lados.push(lado);
  }

  if (lados.length < MINIMO_PARA_MEDIANA) return padrao;

  lados.sort((a, b) => a - b);
  const meio = Math.floor(lados.length / 2);
  const mediana =
    lados.length % 2 === 0 ? (lados[meio - 1] + lados[meio]) / 2 : lados[meio];

  // A folga existe porque o ponto está no centro do objeto, e o contorno que
  // deu a mediana estava inteiro dentro da sua própria caixa.
  return mediana * (1 + MARGEM * 2);
}

// ---------------------------------------------------------------------------

export type ItemDaGaleria =
  | {
      tipo: 'contorno';
      chave: string;
      categoria: 'viable' | 'inviable';
      caixa: Caixa;
      segmentacao: YoloSegmentation;
    }
  | {
      tipo: 'ponto';
      chave: string;
      categoria: 'viable' | 'inviable';
      caixa: Caixa;
      marca: Mark;
    };

export interface Cena {
  largura: number;
  altura: number;
}

/**
 * Monta a lista da galeria: um item por objeto, contornado ou não.
 *
 * Uma marcação só vira item "ponto" quando NÃO existe contorno cobrindo-a —
 * senão a mesma semente apareceria duas vezes, uma como contorno e outra como
 * região a contornar, e a galeria passaria a mentir sobre quantos objetos há.
 */
export function montarGaleria(
  marks: Mark[],
  segmentacoes: YoloSegmentation[],
  cena: Cena
): ItemDaGaleria[] {
  const visiveis = segmentacoes.filter((s) => s.visible !== false);
  const itens: ItemDaGaleria[] = [];

  for (const seg of visiveis) {
    const caixa = envolver(seg.polygon_points);
    if (!caixa || caixa.largura <= 0 || caixa.altura <= 0) continue;
    itens.push({
      tipo: 'contorno',
      chave: `c${seg.id}`,
      categoria: seg.category,
      caixa: limitarACena(comMargem(caixa), cena.largura, cena.altura),
      segmentacao: seg,
    });
  }

  const lado = ladoTipico(visiveis);
  for (const marca of marks) {
    if (dentroDeAlgumContorno(marca, visiveis)) continue;
    itens.push({
      tipo: 'ponto',
      chave: `p${marca.id}`,
      categoria: marca.type,
      caixa: limitarACena(caixaDoPonto(marca, lado), cena.largura, cena.altura),
      marca,
    });
  }

  return itens;
}

/**
 * A marca ja tem contorno?
 *
 * Primeiro pelo VINCULO EXPLICITO (`marcaId`), que e o que vale. O ponto-no-
 * poligono fica como reserva para contorno de modelo e para dado gravado antes
 * de o vinculo existir — sem a reserva, toda sessao antiga apareceria com
 * todas as marcas "faltando contornar".
 */
function dentroDeAlgumContorno(marca: Mark, segmentacoes: YoloSegmentation[]): boolean {
  return segmentacoes.some(
    (s) =>
      s.marcaId === marca.id ||
      (s.marcaId == null && pontoNoPoligono(marca.x, marca.y, s.polygon_points))
  );
}

/**
 * Ponto dentro do polígono, por cruzamento de raio.
 *
 * O `!==` entre as duas comparações de y é o que conta cada aresta uma vez só
 * quando o raio passa exatamente por um vértice.
 */
export function pontoNoPoligono(x: number, y: number, pontos: [number, number][]): boolean {
  if (!pontos || pontos.length < 3) return false;

  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [xi, yi] = pontos[i];
    const [xj, yj] = pontos[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
