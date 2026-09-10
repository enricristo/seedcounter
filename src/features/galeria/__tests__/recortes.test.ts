// =============================================================================
// Recortes da galeria.
//
// O que estes testes protegem: a galeria precisa mostrar CADA objeto UMA vez.
// Se uma marcação que já tem contorno virasse também um item "ponto", a mesma
// semente apareceria duas vezes e a galeria mentiria sobre quantos objetos há —
// exatamente o erro que a onda já cometeu uma vez na contagem.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  LADO_PADRAO,
  caixaDoPonto,
  comMargem,
  envolver,
  ladoTipico,
  limitarACena,
  montarGaleria,
  pontoNoPoligono,
} from '../recortes';
import type { Mark, YoloSegmentation } from '../../../types';

const quadrado = (
  id: number,
  x: number,
  y: number,
  lado: number,
  category: 'viable' | 'inviable' = 'viable'
): YoloSegmentation => ({
  id,
  category,
  class_name: 'semente',
  confidence: 0.9,
  polygon_points: [
    [x, y],
    [x + lado, y],
    [x + lado, y + lado],
    [x, y + lado],
  ],
});

const marca = (id: number, x: number, y: number, type: 'viable' | 'inviable' = 'viable'): Mark => ({
  id,
  x,
  y,
  type,
});

const CENA = { largura: 1000, altura: 800 };

describe('envolver', () => {
  it('acha a caixa do polígono', () => {
    expect(envolver(quadrado(1, 10, 20, 30).polygon_points)).toEqual({
      x: 10,
      y: 20,
      largura: 30,
      altura: 30,
    });
  });

  it('ignora coordenada não finita em vez de produzir NaN', () => {
    const caixa = envolver([
      [10, 10],
      [NaN, 50],
      [40, 40],
    ]);
    expect(caixa).toEqual({ x: 10, y: 10, largura: 30, altura: 30 });
  });

  it('polígono vazio devolve nulo', () => {
    expect(envolver([])).toBeNull();
  });
});

describe('comMargem', () => {
  it('cresce proporcional ao lado maior, nos dois eixos', () => {
    const c = comMargem({ x: 100, y: 100, largura: 50, altura: 20 }, 0.1);
    // folga = 50 * 0,1 = 5
    expect(c).toEqual({ x: 95, y: 95, largura: 60, altura: 30 });
  });
});

describe('limitarACena', () => {
  it('DESLIZA para dentro em vez de achatar', () => {
    // Uma semente na borda deve aparecer inteira, não espremida contra o limite.
    const c = limitarACena({ x: -20, y: -30, largura: 100, altura: 100 }, 1000, 800);
    expect(c).toEqual({ x: 0, y: 0, largura: 100, altura: 100 });
  });

  it('desliza também na borda oposta', () => {
    const c = limitarACena({ x: 960, y: 770, largura: 100, altura: 100 }, 1000, 800);
    expect(c).toEqual({ x: 900, y: 700, largura: 100, altura: 100 });
  });

  it('só encolhe quando a caixa é maior que a cena inteira', () => {
    const c = limitarACena({ x: -50, y: -50, largura: 2000, altura: 2000 }, 1000, 800);
    expect(c).toEqual({ x: 0, y: 0, largura: 1000, altura: 800 });
  });
});

describe('ladoTipico', () => {
  it('usa a MEDIANA, para um contorno gigante não inflar as caixas', () => {
    // O contorno que engoliu a vizinha tem o dobro do tamanho. Na média ele
    // puxaria todas as caixas para cima — justo na cena com mais erro para
    // conferir.
    const segs = [quadrado(1, 0, 0, 50), quadrado(2, 0, 0, 50), quadrado(3, 0, 0, 400)];
    const lado = ladoTipico(segs);
    // mediana 50, com a folga de margem
    expect(lado).toBeCloseTo(50 * 1.36, 5);
    expect(lado).toBeLessThan(100);
  });

  it('cai no padrão quando a cena não tem contorno suficiente', () => {
    expect(ladoTipico([])).toBe(LADO_PADRAO);
    expect(ladoTipico([quadrado(1, 0, 0, 50)])).toBe(LADO_PADRAO);
  });

  it('a mediana par é a média dos dois do meio', () => {
    const segs = [
      quadrado(1, 0, 0, 10),
      quadrado(2, 0, 0, 20),
      quadrado(3, 0, 0, 30),
      quadrado(4, 0, 0, 40),
    ];
    expect(ladoTipico(segs)).toBeCloseTo(25 * 1.36, 5);
  });
});

describe('pontoNoPoligono', () => {
  const q = quadrado(1, 100, 100, 100).polygon_points;

  it('acha o ponto dentro', () => {
    expect(pontoNoPoligono(150, 150, q)).toBe(true);
  });

  it('rejeita o ponto fora', () => {
    expect(pontoNoPoligono(50, 150, q)).toBe(false);
    expect(pontoNoPoligono(250, 150, q)).toBe(false);
  });

  it('polígono degenerado não é uma região', () => {
    expect(
      pontoNoPoligono(0, 0, [
        [0, 0],
        [1, 1],
      ])
    ).toBe(false);
  });
});

describe('montarGaleria', () => {
  it('cada contorno vira um item', () => {
    const itens = montarGaleria([], [quadrado(1, 100, 100, 60), quadrado(2, 300, 300, 60)], CENA);
    expect(itens).toHaveLength(2);
    expect(itens.every((i) => i.tipo === 'contorno')).toBe(true);
  });

  it('marcação SEM contorno vira região proposta', () => {
    const itens = montarGaleria([marca(1, 500, 500)], [], CENA);
    expect(itens).toHaveLength(1);
    expect(itens[0].tipo).toBe('ponto');
  });

  it('marcação DENTRO de um contorno NÃO vira item — não conta duas vezes', () => {
    // A mesma semente apareceria como contorno e como "falta contornar".
    const itens = montarGaleria([marca(1, 130, 130)], [quadrado(1, 100, 100, 60)], CENA);
    expect(itens).toHaveLength(1);
    expect(itens[0].tipo).toBe('contorno');
  });

  it('mistura: contorno com marca dentro, mais uma marca solta', () => {
    const itens = montarGaleria(
      [marca(1, 130, 130), marca(2, 700, 700)],
      [quadrado(1, 100, 100, 60)],
      CENA
    );
    expect(itens).toHaveLength(2);
    expect(itens.filter((i) => i.tipo === 'contorno')).toHaveLength(1);
    expect(itens.filter((i) => i.tipo === 'ponto')).toHaveLength(1);
  });

  it('contorno oculto não entra, e a marca que ele cobria volta a ser região', () => {
    // Ocultar um contorno é dizer que ele não vale; a semente continua ali.
    const oculto = { ...quadrado(1, 100, 100, 60), visible: false };
    const itens = montarGaleria([marca(1, 130, 130)], [oculto], CENA);
    expect(itens).toHaveLength(1);
    expect(itens[0].tipo).toBe('ponto');
  });

  it('toda caixa fica dentro da cena', () => {
    const itens = montarGaleria(
      [marca(1, 5, 5), marca(2, 995, 795)],
      [quadrado(1, 0, 0, 40), quadrado(2, 960, 760, 40)],
      CENA
    );
    for (const item of itens) {
      expect(item.caixa.x).toBeGreaterThanOrEqual(0);
      expect(item.caixa.y).toBeGreaterThanOrEqual(0);
      expect(item.caixa.x + item.caixa.largura).toBeLessThanOrEqual(CENA.largura + 1e-9);
      expect(item.caixa.y + item.caixa.altura).toBeLessThanOrEqual(CENA.altura + 1e-9);
    }
  });

  it('a chave distingue contorno de ponto com o mesmo id', () => {
    // Os dois ids vêm de contadores independentes e colidem o tempo todo.
    const itens = montarGaleria([marca(1, 700, 700)], [quadrado(1, 100, 100, 60)], CENA);
    const chaves = itens.map((i) => i.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('preserva a categoria de cada objeto', () => {
    const itens = montarGaleria(
      [marca(1, 700, 700, 'inviable')],
      [quadrado(1, 100, 100, 60, 'inviable')],
      CENA
    );
    expect(itens.every((i) => i.categoria === 'inviable')).toBe(true);
  });

  it('caixa do ponto é quadrada e centrada', () => {
    expect(caixaDoPonto(marca(1, 100, 200), 40)).toEqual({
      x: 80,
      y: 180,
      largura: 40,
      altura: 40,
    });
  });
});

describe('vinculo explicito marca <-> contorno', () => {
  it('marca VINCULADA nao aparece como pendente, mesmo fora do poligono', () => {
    // Depois de mover um vertice ou cortar, a marca pode ficar fora do
    // poligono geometricamente. O vinculo e que diz de quem ele e.
    const seg = { ...quadrado(1, 100, 100, 60), marcaId: 7 };
    const itens = montarGaleria([marca(7, 900, 700)], [seg], CENA);
    expect(itens.filter((i) => i.tipo === 'ponto')).toHaveLength(0);
  });

  it('contorno vinculado a OUTRA marca nao adota a que caiu dentro', () => {
    // Dois poligonos que se sobrepoem: sem o vinculo, a mesma marca cairia
    // dentro dos dois. Com o vinculo, cada contorno sabe de quem e.
    const seg = { ...quadrado(1, 100, 100, 60), marcaId: 7 };
    const itens = montarGaleria([marca(7, 900, 700), marca(8, 130, 130)], [seg], CENA);
    const pendentes = itens.filter((i) => i.tipo === 'ponto');
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tipo === 'ponto' && pendentes[0].marca.id).toBe(8);
  });

  it('dado ANTIGO sem marcaId continua funcionando pelo ponto-no-poligono', () => {
    const itens = montarGaleria([marca(1, 130, 130)], [quadrado(1, 100, 100, 60)], CENA);
    expect(itens.filter((i) => i.tipo === 'ponto')).toHaveLength(0);
  });
});
