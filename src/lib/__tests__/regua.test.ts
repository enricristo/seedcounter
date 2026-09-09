// =============================================================================
// A escala da régua.
//
// A régua TROCAVA de unidade: sem calibração mostrava pixel, com calibração
// mostrava milímetro e o pixel sumia. Mas as duas respondem a perguntas
// diferentes — pixel é o que a imagem tem, milímetro é como o lote é descrito —
// e são precisas ao mesmo tempo.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { escalaDaRegua, escreverMm, passoBonito } from '../regua';

describe('passoBonito', () => {
  it('arredonda para 1, 2, 5 ou 10 vezes uma potência de dez', () => {
    expect(passoBonito(0.9)).toBe(1);
    expect(passoBonito(1.7)).toBe(2);
    expect(passoBonito(3.2)).toBe(5);
    expect(passoBonito(7.4)).toBe(10);
    expect(passoBonito(180)).toBe(200);
    expect(passoBonito(0.017)).toBeCloseTo(0.02, 10);
  });

  it('arredonda para CIMA — a régua nunca fica mais densa que o pedido', () => {
    // Traço mais junto que o alvo amontoa rótulo e vira borrão. O pior caso da
    // escala 1/2/5/10 é logo acima de 2, que sobe para 5: fator 2,5.
    for (const bruto of [0.3, 1.1, 2.01, 4.9, 23, 187, 940]) {
      const passo = passoBonito(bruto);
      expect(passo, `${bruto}`).toBeGreaterThanOrEqual(bruto);
      expect(passo, `${bruto}`).toBeLessThanOrEqual(bruto * 2.5);
    }
  });

  it('valor inválido não derruba a régua', () => {
    expect(passoBonito(0)).toBe(1);
    expect(passoBonito(-5)).toBe(1);
    expect(passoBonito(NaN)).toBe(1);
  });
});

describe('escreverMm', () => {
  it('abaixo de 1 mm usa micrômetro, que é a unidade que a pessoa usa', () => {
    expect(escreverMm(0.5)).toBe('500µm');
    expect(escreverMm(0.05)).toBe('50µm');
  });

  it('derruba o zero à direita', () => {
    expect(escreverMm(2)).toBe('2mm');
    expect(escreverMm(2.5)).toBe('2.5mm');
    expect(escreverMm(2.0)).toBe('2mm');
  });

  it('zero é zero, sem unidade repetida', () => {
    expect(escreverMm(0)).toBe('0');
  });
});

describe('escala sem calibração', () => {
  const escala = escalaDaRegua({ zoom: 1 });

  it('mostra pixel', () => {
    expect(escala.unidade).toBe('px');
    expect(escala.principal(0)).toBe('0');
    expect(escala.principal(1)).toBe('100');
  });

  it('NÃO inventa a segunda escala', () => {
    // Milímetro sem calibração seria um número fabricado.
    expect(escala.secundario).toBeNull();
  });
});

describe('escala com calibração — as DUAS unidades', () => {
  // 21,2 µm/px é a digitalização de 1200 DPI.
  const escala = escalaDaRegua({ zoom: 1, umPerPixel: 21.2 });

  it('o passo segue o MILÍMETRO, não o pixel', () => {
    // Um traço a cada 283,7 px não ajuda ninguém; a cada 2 mm ajuda.
    expect(escala.unidade).toBe('mm');
    expect(escala.principal(1)).toBe('2mm');
    expect(escala.principal(2)).toBe('4mm');
  });

  it('o pixel continua visível como segunda escala', () => {
    expect(escala.secundario).not.toBeNull();
    expect(escala.secundario!(0)).toBe('0px');
    // 2 mm a 21,2 µm/px = 94,3 px
    expect(escala.secundario!(1)).toBe('94px');
  });

  it('as duas escalas descrevem o MESMO ponto', () => {
    // É o que torna a régua dupla honesta: o rótulo de baixo tem de ser a
    // conversão exata do de cima, não uma aproximação separada.
    const umPerPixel = 21.2;
    for (const i of [1, 2, 5]) {
      const px = Number(escala.secundario!(i).replace('px', ''));
      const mm = Number(escala.principal(i).replace('mm', ''));
      expect((px * umPerPixel) / 1000).toBeCloseTo(mm, 1);
    }
  });

  it('em escala fina cai para micrômetro', () => {
    // Orquídea a 7,06 µm/px com zoom alto: o passo fica abaixo de 1 mm.
    const fina = escalaDaRegua({ zoom: 8, umPerPixel: 7.06 });
    expect(fina.principal(1)).toMatch(/µm$/);
  });
});

describe('o zoom muda o passo, não a unidade', () => {
  it('aproximar dá traços mais finos na mesma unidade', () => {
    const longe = escalaDaRegua({ zoom: 0.5, umPerPixel: 21.2 });
    const perto = escalaDaRegua({ zoom: 4, umPerPixel: 21.2 });
    expect(perto.pixelsPorTraco).toBeLessThan(longe.pixelsPorTraco);
    expect(perto.unidade).toBe(longe.unidade);
  });

  it('zoom inválido não produz passo infinito', () => {
    // Um zoom zero dividiria por zero e a régua tentaria desenhar infinitos
    // traços.
    for (const zoom of [0, -1, NaN]) {
      const e = escalaDaRegua({ zoom, umPerPixel: 21.2 });
      expect(Number.isFinite(e.pixelsPorTraco)).toBe(true);
      expect(e.pixelsPorTraco).toBeGreaterThan(0);
    }
  });
});
