// =============================================================================
// SeedCounter — as imagens do laudo
//
// POR QUE DUAS IMAGENS, E NÃO UMA.
//
// O documento anterior levava só a imagem anotada. Quem lê um laudo assim tem
// de acreditar na anotação: não há como conferir se aquele círculo está sobre
// uma semente ou sobre uma sombra, porque o que estava embaixo já não aparece.
//
// Original e analisada lado a lado transformam o laudo em evidência
// verificável. É a mesma razão pela qual um laudo de raios X leva a chapa, e
// não só o parecer.
//
// AS DUAS PRECISAM SER O MESMO RECORTE, NA MESMA ESCALA. Se a original for
// cortada diferente ou tiver outra proporção, a comparação engana em vez de
// informar — por isso as duas saem do MESMO desenho, mudando apenas o que se
// pinta por cima.
//
// AS CORES VÊM DE theme/specimen.ts, E ISSO CORRIGE UM DEFEITO.
//
// O canvas ao vivo migrou para ciano e magenta por um motivo documentado: cor
// biológica ocupa a faixa âmbar–carmim, e desenhar viável em carmim sobre
// embrião carmim é o pior caso de visibilidade numa lâmina corada. O gerador de
// PDF nunca acompanhou: continuava em #ef4444 / #fbbf24. Ou seja, o documento
// que saía do laboratório usava justamente o esquema que a tela abandonou, e
// discordava do que o analista tinha visto.
// =============================================================================

import { ESPECIME, ESPECIME_FILL, corDoEspecime, desenharMarca } from '../../theme/specimen';
import { corpoDaFonte, raioDaMarca } from '../escala-da-marca';
import type { Mark, YoloSegmentation } from '../../types';

/**
 * Lado maior das imagens embutidas, em pixels.
 *
 * O laudo leva a MESMA imagem duas vezes. Em resolução cheia, uma digitalização
 * de 2400 px vira um PDF que não passa por anexo de e-mail — que é exatamente
 * como um laudo circula. 1600 px preserva a leitura de contorno e mantém o
 * arquivo transportável.
 */
export const LADO_MAXIMO = 1600;

export interface ImagensDoLaudo {
  original: string;
  analisada: string;
  largura: number;
  altura: number;
}

interface OpcoesDeRenderizacao {
  imagem: HTMLImageElement;
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  visualMode: 'dots' | 'numbers';
}

/**
 * Produz as duas imagens do laudo, na mesma escala e no mesmo recorte.
 *
 * Devolve `null` quando não há canvas utilizável — quem chama decide o que
 * fazer, em vez de receber um `alert` vindo de dentro de uma biblioteca.
 */
export function renderizarImagensDoLaudo(op: OpcoesDeRenderizacao): ImagensDoLaudo | null {
  const { imagem, marks, segmentacoes, visualMode } = op;

  const larguraFonte = imagem.naturalWidth || imagem.width;
  const alturaFonte = imagem.naturalHeight || imagem.height;
  if (!larguraFonte || !alturaFonte) return null;

  const fator = Math.min(LADO_MAXIMO / Math.max(larguraFonte, alturaFonte), 1);
  const largura = Math.round(larguraFonte * fator);
  const altura = Math.round(alturaFonte * fator);

  const original = desenhar(largura, altura, (ctx) => {
    ctx.drawImage(imagem, 0, 0, largura, altura);
  });
  if (!original) return null;

  const analisada = desenhar(largura, altura, (ctx) => {
    ctx.drawImage(imagem, 0, 0, largura, altura);
    ctx.save();
    ctx.scale(fator, fator);
    // A escala é aplicada ao contexto, não às coordenadas: assim marca e
    // polígono continuam alinhados com o pixel da imagem original, sem
    // arredondamento por objeto.
    pintarSegmentacoes(ctx, segmentacoes, fator);
    pintarMarcas(ctx, marks, visualMode, fator);
    ctx.restore();
  });
  if (!analisada) return null;

  return { original, analisada, largura, altura };
}

function desenhar(
  largura: number,
  altura: number,
  pintar: (ctx: CanvasRenderingContext2D) => void
): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fundo branco: um PNG com transparência vira preto no PDF.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, altura);

  pintar(ctx);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function pintarSegmentacoes(
  ctx: CanvasRenderingContext2D,
  segmentacoes: YoloSegmentation[],
  fator: number
) {
  // A espessura é dividida pelo fator porque o contexto já está escalado —
  // sem isso, o traço engrossaria junto com a redução e engoliria a semente.
  const espessura = 2 / fator;

  for (const seg of segmentacoes) {
    if (seg.visible === false) continue;
    const pontos = seg.polygon_points;
    if (!pontos || pontos.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(pontos[0][0], pontos[0][1]);
    for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i][0], pontos[i][1]);
    ctx.closePath();

    const viavel = seg.category === 'viable';
    ctx.fillStyle = viavel ? ESPECIME_FILL.viable : ESPECIME_FILL.inviable;
    ctx.fill();
    ctx.strokeStyle = corDoEspecime(viavel ? 'viable' : 'inviable');
    ctx.lineWidth = espessura;
    ctx.stroke();
  }
}

function pintarMarcas(
  ctx: CanvasRenderingContext2D,
  marks: Mark[],
  visualMode: 'dots' | 'numbers',
  fator: number
) {
  // Mesma escala do canvas: o raio acompanha a imagem em vez de ser fixo, senao
  // a marca some no laudo de uma digitalizacao grande exatamente como sumia na
  // tela. Dividido pelo fator porque o contexto ja esta escalado.
  const larguraOriginal = ctx.canvas.width / fator;
  const base = raioDaMarca(larguraOriginal);
  const raio = (visualMode === 'dots' ? base : base * 1.8) / fator;
  let viaveis = 0;
  let inviaveis = 0;

  for (const marca of marks) {
    const numero = marca.type === 'viable' ? ++viaveis : ++inviaveis;

    // desenharMarca é a MESMA função do canvas ao vivo — é o que garante que a
    // imagem do laudo não divirja da tela em que a pessoa conferiu.
    desenharMarca(ctx, marca.type, marca.x, marca.y, raio);

    if (visualMode === 'numbers') {
      ctx.save();
      ctx.font = `bold ${corpoDaFonte(raio * fator) / fator}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 / fator;
      ctx.strokeStyle = ESPECIME.halo;
      ctx.strokeText(String(numero), marca.x, marca.y);
      ctx.fillStyle = ESPECIME.tool;
      ctx.fillText(String(numero), marca.x, marca.y);
      ctx.restore();
    }
  }
}
