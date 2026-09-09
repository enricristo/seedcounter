// =============================================================================
// SeedCounter — recorte das miniaturas
//
// Transforma cada item da galeria numa imagem quadrada.
//
// QUADRADO, MESMO QUE O OBJETO NÃO SEJA.
//
// A grade da galeria só funciona se todas as células tiverem o mesmo tamanho:
// é a igualdade da moldura que deixa a DIFERENÇA entre os objetos saltar. Mas o
// recorte não é esticado para virar quadrado — ele é centrado dentro dele, com
// a proporção preservada. Uma semente alongada precisa parecer alongada; é
// justamente a forma que distingue uma semente de duas encostadas.
//
// "SEM O FUNDO" É RECORTE PELO CONTORNO.
//
// Para itens com polígono, dá para apagar tudo que está fora dele — e aí a
// pessoa vê o objeto isolado, que é o pedido original. Para um ponto sem
// contorno não há o que recortar: ali a caixa inteira aparece, e é isso mesmo
// que se quer ver, porque a pergunta é "o que há nesta região?".
// =============================================================================

import type { ItemDaGaleria } from './recortes';

/** Lado da miniatura, em pixels. */
export const LADO_DA_MINIATURA = 132;

export interface OpcoesDeRecorte {
  /** Apaga o que está fora do contorno. Ignorado em item sem polígono. */
  semFundo: boolean;
  lado?: number;
  /** Cor do vazio: o fundo da célula, para o recorte não parecer flutuar. */
  fundo?: string;
}

/**
 * Recorta um item e devolve a miniatura como data URL.
 *
 * Devolve `null` quando o canvas não está disponível — quem chama mostra a
 * célula vazia em vez de quebrar a grade inteira.
 */
export function recortar(
  imagem: HTMLImageElement | HTMLCanvasElement,
  item: ItemDaGaleria,
  op: OpcoesDeRecorte
): string | null {
  const lado = op.lado ?? LADO_DA_MINIATURA;
  const { caixa } = item;
  if (caixa.largura <= 0 || caixa.altura <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = op.fundo ?? '#0d1416';
  ctx.fillRect(0, 0, lado, lado);

  // Proporção preservada: o recorte cabe no quadrado, centrado.
  const escala = Math.min(lado / caixa.largura, lado / caixa.altura);
  const larguraFinal = caixa.largura * escala;
  const alturaFinal = caixa.altura * escala;
  const deslocX = (lado - larguraFinal) / 2;
  const deslocY = (lado - alturaFinal) / 2;

  ctx.save();

  if (op.semFundo && item.tipo === 'contorno') {
    // O recorte pelo polígono é feito no espaço da MINIATURA: cada vértice é
    // trazido da coordenada da imagem para a da célula pela mesma transformação
    // que a imagem sofre, e por isso máscara e pixel nunca saem de registro.
    const pontos = item.segmentacao.polygon_points;
    if (pontos.length >= 3) {
      ctx.beginPath();
      for (let i = 0; i < pontos.length; i++) {
        const x = deslocX + (pontos[i][0] - caixa.x) * escala;
        const y = deslocY + (pontos[i][1] - caixa.y) * escala;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();
    }
  }

  ctx.drawImage(
    imagem,
    caixa.x,
    caixa.y,
    caixa.largura,
    caixa.altura,
    deslocX,
    deslocY,
    larguraFinal,
    alturaFinal
  );

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.86);
}

/**
 * Recorta a galeria inteira.
 *
 * Devolve um mapa por chave, e não um array, porque a grade filtra e reordena —
 * um índice de array deixaria de apontar para o mesmo objeto assim que a pessoa
 * mudasse o filtro.
 */
export function recortarTodos(
  imagem: HTMLImageElement | HTMLCanvasElement,
  itens: ItemDaGaleria[],
  op: OpcoesDeRecorte
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const item of itens) {
    const url = recortar(imagem, item, op);
    if (url) mapa.set(item.chave, url);
  }
  return mapa;
}
