// =============================================================================
// Tamanho da marca.
//
// O caso que originou tudo: numa digitalizacao de soja de 2400 px, o raio fixo
// de 4,5 px virava um ponto de 1,5 pixel de tela. O teste que importa e o que
// compara imagem pequena com imagem grande.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  AJUSTE_MAXIMO,
  AJUSTE_MINIMO,
  AJUSTE_PADRAO,
  corpoDaFonte,
  espessuraNaImagem,
  raioDaMarca,
  raioDoAlvo,
} from '../escala-da-marca';

describe('raio da marca', () => {
  it('CRESCE com a imagem — o defeito era ser fixo', () => {
    const orquidea = raioDaMarca(900);
    const soja = raioDaMarca(2400);
    expect(soja).toBeGreaterThan(orquidea);
    // A proporcao aparente tem de se manter: dobrar a imagem dobra o raio.
    expect(raioDaMarca(1800) / raioDaMarca(900)).toBeCloseTo(2, 5);
  });

  it('numa digitalizacao de soja a marca deixa de ser invisivel', () => {
    // Com 4,5 px fixos, exibida a 800 px de largura, dava 1,5 px de tela.
    // O criterio: pelo menos 3 px de tela na mesma exibicao.
    const raio = raioDaMarca(2400);
    const naTela = raio * (800 / 2400);
    expect(naTela).toBeGreaterThanOrEqual(3);
  });

  it('mantem o tamanho aparente entre imagens de tamanhos diferentes', () => {
    // Exibidas na mesma largura de tela, as duas devem dar quase o mesmo ponto.
    const larguraNaTela = 800;
    const aparente = (larguraDaImagem: number) =>
      raioDaMarca(larguraDaImagem) * (larguraNaTela / larguraDaImagem);
    expect(aparente(900)).toBeCloseTo(aparente(2400), 5);
    expect(aparente(1200)).toBeCloseTo(aparente(4800), 5);
  });

  it('nao some em imagem minuscula nem tapa a semente em imagem enorme', () => {
    expect(raioDaMarca(200)).toBeGreaterThanOrEqual(3);
    expect(raioDaMarca(60000)).toBeLessThanOrEqual(40);
  });

  it('respeita o ajuste manual', () => {
    const base = raioDaMarca(2400, AJUSTE_PADRAO);
    expect(raioDaMarca(2400, 2)).toBeCloseTo(base * 2, 5);
    expect(raioDaMarca(2400, 0.5)).toBeCloseTo(base * 0.5, 5);
  });

  it('prende o ajuste na faixa em vez de recusar', () => {
    // Um valor herdado de sessao antiga nao pode impedir a imagem de desenhar.
    expect(raioDaMarca(2400, 99)).toBeCloseTo(raioDaMarca(2400, AJUSTE_MAXIMO), 5);
    expect(raioDaMarca(2400, 0)).toBeCloseTo(raioDaMarca(2400, AJUSTE_MINIMO), 5);
    expect(raioDaMarca(2400, NaN)).toBeCloseTo(raioDaMarca(2400, AJUSTE_PADRAO), 5);
  });

  it('largura invalida devolve o piso, nao NaN', () => {
    // NaN aqui vira uma marca que nao desenha, sem erro nenhum.
    expect(raioDaMarca(0)).toBe(3);
    expect(raioDaMarca(NaN)).toBe(3);
    expect(raioDaMarca(-100)).toBe(3);
  });
});

describe('alvo de clique', () => {
  it('e SEMPRE maior que o desenho', () => {
    for (const largura of [200, 900, 2400, 6000]) {
      for (const ajuste of [AJUSTE_MINIMO, AJUSTE_PADRAO, AJUSTE_MAXIMO]) {
        expect(raioDoAlvo(largura, ajuste), `${largura}/${ajuste}`).toBeGreaterThan(
          raioDaMarca(largura, ajuste)
        );
      }
    }
  });

  it('continua generoso quando a pessoa deixa a marca minuscula', () => {
    // E justamente ai que o alvo grande mais importa.
    expect(raioDoAlvo(900, AJUSTE_MINIMO)).toBeGreaterThanOrEqual(6);
  });
});

describe('espessura e fonte', () => {
  it('a espessura acompanha a escala', () => {
    expect(espessuraNaImagem(2400)).toBeGreaterThan(espessuraNaImagem(900));
  });

  it('a espessura nunca chega a zero', () => {
    expect(espessuraNaImagem(10)).toBeGreaterThan(0);
    expect(espessuraNaImagem(0)).toBeGreaterThan(0);
  });

  it('o numero cabe dentro da marca', () => {
    // Fonte fixa num raio que cresce deixa o numero perdido no meio do disco.
    for (const largura of [900, 2400, 6000]) {
      const raio = raioDaMarca(largura);
      const fonte = corpoDaFonte(raio);
      expect(fonte).toBeGreaterThan(raio);
      expect(fonte).toBeLessThan(raio * 2.5);
    }
  });

  it('a fonte tem piso legivel', () => {
    expect(corpoDaFonte(1)).toBeGreaterThanOrEqual(7);
  });
});
