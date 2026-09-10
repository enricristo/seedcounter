// =============================================================================
// SeedCounter — geometria do laudo
//
// A aritmética de página, separada do desenho. Não é zelo de arquitetura: o
// gerador anterior tinha um erro que só existia por essa mistura.
//
// O laudo em lote ENCAIXAVA TODA IMAGEM EM 4:3, com este comentário no código:
// "We don't know the exact aspect ratio of the base64 string, so we'll guess a
// 4:3 standard microscope ratio". Uma digitalização de scanner é quase
// quadrada; uma lâmina de lupa é frequentemente 3:2. Toda imagem que não fosse
// 4:3 saía ESTICADA no documento — e um laudo com a imagem deformada é um laudo
// em que a semente medida não tem a forma que o papel mostra.
//
// Separado aqui, o encaixe é uma função de duas caixas, e um teste responde se
// ela deforma.
// =============================================================================

export interface Caixa {
  largura: number;
  altura: number;
}

/**
 * Encaixa uma imagem dentro de uma caixa PRESERVANDO a proporção.
 *
 * Reduz para caber; nunca amplia — ampliar uma digitalização pequena não
 * acrescenta informação, só interpola pixel e sugere uma resolução que a
 * amostra não tem.
 */
export function ajustarNaCaixa(imagem: Caixa, caixa: Caixa): Caixa {
  if (
    !Number.isFinite(imagem.largura) ||
    !Number.isFinite(imagem.altura) ||
    imagem.largura <= 0 ||
    imagem.altura <= 0
  ) {
    return { largura: 0, altura: 0 };
  }

  const fator = Math.min(caixa.largura / imagem.largura, caixa.altura / imagem.altura, 1);
  return { largura: imagem.largura * fator, altura: imagem.altura * fator };
}

/** Centraliza uma caixa dentro de outra, devolvendo o deslocamento. */
export function centralizar(conteudo: Caixa, caixa: Caixa): { x: number; y: number } {
  return {
    x: (caixa.largura - conteudo.largura) / 2,
    y: (caixa.altura - conteudo.altura) / 2,
  };
}

/**
 * Divide a largura útil em N colunas com um vão entre elas.
 *
 * Usado pelas duas imagens lado a lado — original e analisada — que precisam
 * ter EXATAMENTE a mesma largura para que a comparação visual seja honesta.
 * Colunas de larguras diferentes fazem a mesma semente parecer maior num lado.
 */
export function colunas(larguraUtil: number, quantidade: number, vao: number): number[] {
  if (quantidade <= 0) return [];
  const larguraDaColuna = (larguraUtil - vao * (quantidade - 1)) / quantidade;
  return Array.from({ length: quantidade }, (_, i) => i * (larguraDaColuna + vao));
}

/** A largura de cada coluna produzida por `colunas`. */
export function larguraDaColuna(larguraUtil: number, quantidade: number, vao: number): number {
  if (quantidade <= 0) return 0;
  return (larguraUtil - vao * (quantidade - 1)) / quantidade;
}
