// =============================================================================
// SeedCounter — as marcas sobre a lâmina, em qualquer canvas
//
// POR QUE EXISTE. O canvas ao vivo e o PNG exportado desenhavam cada um do
// seu jeito, e a imagem que saía do aplicativo não era a que a pessoa tinha
// conferido na tela. Este módulo é o único lugar que sabe pôr marca em
// contexto 2D: os dois chamam daqui e não podem divergir.
//
// DUAS DECISÕES QUE ELE CARREGA.
//
// 1. Ele desenha O QUE `enumerarObjetos` enumera, com o índice que ela dá.
//    Não existe contador próprio: o número dentro da marca é o mesmo da linha
//    do CSV e do inspetor. Por isso `desenharObjetos` recebe a lista pronta —
//    quem quer omitir uma classe (a exportação) filtra a lista e os índices
//    dos que ficam continuam os de sempre.
//
// 2. A forma vem de `desenharMarca`, e só dela. A lei de que viável e
//    inviável diferem na FORMA (não só na cor) mora lá; aqui ninguém escolhe
//    cor nem traço para uma classe. No modo de índices, o crachá do número é
//    disco para viável e disco com anel externo para inviável — mesma lei.
//
// Contorno proposto sem marcação (natureza 'contorno') NÃO ganha ponto no
// modo de pontos: o polígono já está desenhado e um disco por cima taparia
// exatamente a semente que a pessoa precisa conferir. No modo de índices ele
// ganha número, porque o número é a única forma de achá-lo na tabela.
// =============================================================================

import type { Mark, YoloSegmentation } from '../types';
import {
  corDoEspecime,
  ESPECIME,
  desenharMarca,
  OPACIDADE_MINIMA,
  type EstiloDaMarca,
} from '../theme/specimen';
import { AJUSTE_PADRAO, raioDaMarca, espessuraNaImagem, corpoDaFonte } from './escala-da-marca';
import { enumerarObjetos, type ObjetoDaCena } from './objetos';

export type ModoVisual = 'dots' | 'numbers';

/** Cor do algarismo dentro do crachá: grafite, para ler sobre ciano e magenta. */
const TINTA_DO_INDICE = '#101719';

export interface OpcoesDeDesenho {
  modo: ModoVisual;
  /** Largura da imagem em px — a marca é anotação e escala com ela. */
  larguraDaImagem: number;
  ajusteDaMarca?: number;
  estiloDaMarca?: EstiloDaMarca;
  opacidadeDaMarca?: number;
}

/**
 * A opacidade que de fato vai para o canvas.
 *
 * Mesma regra de `desenharMarca`: presa entre o mínimo útil e 1. Valor não
 * numérico (sessão antiga, campo vazio) cai em 1 em vez de virar NaN — canvas
 * ignora `globalAlpha = NaN` em silêncio, e a marca sairia com a opacidade que
 * estivesse no contexto antes, isto é, imprevisível.
 */
export function opacidadeEfetiva(opacidade: number | undefined): number {
  if (opacidade === undefined || !Number.isFinite(opacidade)) return 1;
  return Math.max(OPACIDADE_MINIMA, Math.min(1, opacidade));
}

/**
 * Desenha uma lista de objetos já enumerada. É a função que a exportação usa
 * quando precisa omitir uma classe sem renumerar o resto.
 *
 * Objeto com coordenada não finita é pulado: `arc(NaN, …)` não lança, mas
 * corrompe o caminho corrente e engole o traço do objeto seguinte.
 */
export function desenharObjetos(
  ctx: CanvasRenderingContext2D,
  objetos: readonly ObjetoDaCena[],
  opcoes: OpcoesDeDesenho
): void {
  if (objetos.length === 0) return;

  const { modo, larguraDaImagem } = opcoes;
  const raio = raioDaMarca(larguraDaImagem, opcoes.ajusteDaMarca ?? AJUSTE_PADRAO);
  const traco = espessuraNaImagem(larguraDaImagem, 1.5);
  const estilo = opcoes.estiloDaMarca ?? 'disco';
  const opacidade = opacidadeEfetiva(opcoes.opacidadeDaMarca);

  // O modo de índices não passa por `desenharMarca`, então o alfa é aplicado
  // aqui — e restaurado no fim, porque o contexto é do chamador e o que vem
  // depois (régua, legenda) não pode herdar a transparência da marca.
  const alfaAnterior = ctx.globalAlpha;

  for (const objeto of objetos) {
    const { x, y, categoria } = objeto;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    if (modo === 'dots') {
      if (objeto.natureza === 'contorno') continue;
      desenharMarca(ctx, categoria, x, y, raio, estilo, opacidade);
      continue;
    }

    ctx.globalAlpha = opacidade;
    const cor = corDoEspecime(categoria);
    const raioDoIndice = raio * 1.8;

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, raioDoIndice, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.strokeStyle = ESPECIME.halo;
    ctx.lineWidth = traco;
    ctx.stroke();

    // A forma redundante do modo de índices: inviável ganha um anel externo.
    if (categoria === 'inviable') {
      ctx.beginPath();
      ctx.arc(x, y, raioDoIndice * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = cor;
      ctx.lineWidth = traco;
      ctx.stroke();
    }

    ctx.fillStyle = TINTA_DO_INDICE;
    ctx.font = `bold ${corpoDaFonte(raioDoIndice)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(objeto.indice), x, y + 0.5);
  }

  ctx.globalAlpha = alfaAnterior;
}

/**
 * A entrada de sempre: enumera a cena e desenha tudo. A assinatura posicional
 * é a que o canvas ao vivo chama; quem precisa filtrar usa `desenharObjetos`.
 */
export function renderMarksToContext(
  ctx: CanvasRenderingContext2D,
  marks: Mark[],
  mode: ModoVisual,
  larguraDaImagem: number,
  ajusteDaMarca = AJUSTE_PADRAO,
  segmentacoes: YoloSegmentation[] = [],
  estiloDaMarca: EstiloDaMarca = 'disco',
  opacidadeDaMarca = 1
): void {
  const objetos = enumerarObjetos(marks, segmentacoes);
  desenharObjetos(ctx, objetos, {
    modo: mode,
    larguraDaImagem,
    ajusteDaMarca,
    estiloDaMarca,
    opacidadeDaMarca,
  });
}
