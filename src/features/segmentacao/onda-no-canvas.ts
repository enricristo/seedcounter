// =============================================================================
// SeedCounter — a onda aplicada a uma imagem carregada
//
// Ponte entre `lib/region-growing.ts`, que é puro e recebe pixels, e o
// aplicativo, que tem um HTMLImageElement.
//
// POR QUE RECORTAR EM VEZ DE LER A IMAGEM INTEIRA.
//
// Uma digitalização de scanner a 3600 DPI tem 6800 × 9359 pixels. Ler tudo com
// getImageData são 254 MB de RGBA — por clique. Guardar em cache resolveria o
// tempo mas não a memória, e o app já mantém a imagem, o histórico e as
// anotações no mesmo processo.
//
// Como a onda trabalha numa janela ao redor do clique de qualquer forma, basta
// recortar essa janela do canvas. O custo passa a ser proporcional à janela,
// não à imagem: 512 × 512 são 1 MB, independentemente do tamanho do scan.
//
// O preço é ter que devolver as coordenadas ao espaço da imagem no fim. É uma
// soma, e está isolada aqui.
// =============================================================================

import {
  segmentarPorClique,
  type OpcoesDaOnda,
  type ResultadoDaOnda,
} from '../../lib/region-growing';

/** Lado da janela recortada. Igual ao padrão da onda, para ela usar tudo. */
const LADO_PADRAO = 512;

/**
 * Segmenta a semente sob o ponto clicado.
 *
 * Devolve `null` quando o clique cai fora da imagem ou o recorte é degenerado.
 * Um resultado com `tocouBorda` verdadeiro não é erro — é aviso de que o
 * contorno não é confiável, e quem chama decide o que fazer com isso.
 */
export function segmentarNoCanvas(
  imagem: HTMLImageElement | HTMLCanvasElement,
  clique: { x: number; y: number },
  opcoes: OpcoesDaOnda = {}
): ResultadoDaOnda | null {
  const largura = imagem instanceof HTMLImageElement ? imagem.naturalWidth : imagem.width;
  const altura = imagem instanceof HTMLImageElement ? imagem.naturalHeight : imagem.height;

  const cx = Math.round(clique.x);
  const cy = Math.round(clique.y);
  if (cx < 0 || cy < 0 || cx >= largura || cy >= altura) return null;

  const lado = opcoes.janela ?? LADO_PADRAO;
  const meio = Math.floor(lado / 2);

  // Origem do recorte: centrada no clique, empurrada para dentro quando o
  // clique está perto da borda — assim a janela continua com o tamanho cheio
  // em vez de encolher justamente onde já há menos contexto.
  const ox = Math.max(0, Math.min(Math.max(0, largura - lado), cx - meio));
  const oy = Math.max(0, Math.min(Math.max(0, altura - lado), cy - meio));
  const w = Math.min(lado, largura - ox);
  const h = Math.min(lado, altura - oy);
  if (w < 3 || h < 3) return null;

  const tela = document.createElement('canvas');
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagem, ox, oy, w, h, 0, 0, w, h);

  let dados: ImageData;
  try {
    dados = ctx.getImageData(0, 0, w, h);
  } catch {
    // Imagem de outra origem contamina o canvas e getImageData lança. Sem
    // pixels não há segmentação — e o app continua funcionando no manual.
    return null;
  }

  const resultado = segmentarPorClique(
    dados,
    { x: cx - ox, y: cy - oy },
    // A janela da onda é o recorte inteiro: recortar de novo por dentro só
    // encolheria o contexto sem ganho nenhum.
    { ...opcoes, janela: Math.max(w, h) }
  );
  if (!resultado) return null;

  // De volta ao espaço da imagem. Tudo que sai daqui é medido pelo resto do
  // aplicativo, que não conhece o recorte.
  return {
    ...resultado,
    contorno: resultado.contorno.map(([x, y]) => [x + ox, y + oy] as [number, number]),
    janela: {
      ...resultado.janela,
      x: resultado.janela.x + ox,
      y: resultado.janela.y + oy,
    },
  };
}
