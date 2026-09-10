// =============================================================================
// Geometria do laudo.
//
// O teste que importa aqui é o da PROPORÇÃO: o gerador anterior encaixava toda
// imagem em 4:3 por chute, e qualquer imagem com outra proporção saía esticada
// no documento. Uma semente deformada no papel não é detalhe estético — é uma
// forma que não corresponde à amostra.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { ajustarNaCaixa, centralizar, colunas, larguraDaColuna } from '../layout';

const proporcao = (c: { largura: number; altura: number }) => c.largura / c.altura;

describe('ajustarNaCaixa', () => {
  it('PRESERVA a proporção — o erro que o gerador anterior cometia', () => {
    // Digitalização quase quadrada de scanner, numa caixa larga.
    const imagem = { largura: 2400, altura: 2200 };
    const ajustada = ajustarNaCaixa(imagem, { largura: 515, altura: 400 });
    expect(proporcao(ajustada)).toBeCloseTo(proporcao(imagem), 6);
  });

  it('preserva a proporção também no retrato', () => {
    const imagem = { largura: 900, altura: 1600 };
    const ajustada = ajustarNaCaixa(imagem, { largura: 515, altura: 400 });
    expect(proporcao(ajustada)).toBeCloseTo(proporcao(imagem), 6);
  });

  it('cabe dentro da caixa nos dois eixos', () => {
    const caixa = { largura: 515, altura: 400 };
    for (const imagem of [
      { largura: 4000, altura: 300 },
      { largura: 300, altura: 4000 },
      { largura: 2400, altura: 2200 },
    ]) {
      const a = ajustarNaCaixa(imagem, caixa);
      expect(a.largura).toBeLessThanOrEqual(caixa.largura + 1e-9);
      expect(a.altura).toBeLessThanOrEqual(caixa.altura + 1e-9);
    }
  });

  it('limita pela altura quando é a altura que aperta', () => {
    const ajustada = ajustarNaCaixa({ largura: 100, altura: 400 }, { largura: 515, altura: 200 });
    expect(ajustada.altura).toBeCloseTo(200, 6);
    expect(ajustada.largura).toBeCloseTo(50, 6);
  });

  it('NÃO amplia imagem menor que a caixa', () => {
    // Ampliar não acrescenta informação — só interpola pixel e sugere uma
    // resolução que a amostra não tem.
    const imagem = { largura: 120, altura: 90 };
    expect(ajustarNaCaixa(imagem, { largura: 515, altura: 400 })).toEqual(imagem);
  });

  it('devolve caixa nula para dimensão inválida em vez de NaN', () => {
    // Um NaN aqui vira uma imagem invisível no PDF, sem erro nenhum.
    expect(ajustarNaCaixa({ largura: 0, altura: 100 }, { largura: 515, altura: 400 })).toEqual({
      largura: 0,
      altura: 0,
    });
    expect(ajustarNaCaixa({ largura: NaN, altura: 100 }, { largura: 515, altura: 400 })).toEqual({
      largura: 0,
      altura: 0,
    });
  });
});

describe('centralizar', () => {
  it('sobra igual dos dois lados', () => {
    const d = centralizar({ largura: 300, altura: 100 }, { largura: 500, altura: 200 });
    expect(d).toEqual({ x: 100, y: 50 });
  });
});

describe('colunas', () => {
  it('as duas imagens ficam com larguras IGUAIS', () => {
    // Colunas de larguras diferentes fazem a mesma semente parecer maior de um
    // lado, e a comparação original/analisada deixa de ser honesta.
    const l = larguraDaColuna(515, 2, 15);
    expect(l).toBeCloseTo(250, 6);
  });

  it('a última coluna termina exatamente na largura útil', () => {
    const util = 515;
    const vao = 15;
    const xs = colunas(util, 2, vao);
    const l = larguraDaColuna(util, 2, vao);
    expect(xs[xs.length - 1] + l).toBeCloseTo(util, 6);
  });

  it('uma coluna só ocupa tudo', () => {
    expect(larguraDaColuna(515, 1, 15)).toBeCloseTo(515, 6);
    expect(colunas(515, 1, 15)).toEqual([0]);
  });

  it('quantidade inválida não quebra', () => {
    expect(colunas(515, 0, 15)).toEqual([]);
    expect(larguraDaColuna(515, 0, 15)).toBe(0);
  });
});
