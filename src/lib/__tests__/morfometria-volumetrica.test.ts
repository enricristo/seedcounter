import { describe, it, expect } from 'vitest';
import {
  volumeDoEmbriao,
  volumeDaSemente,
  volumesDaSemente,
  umPorPixel,
  pixelsPara,
} from '../morfometria-volumetrica';

describe('volumeDoEmbriao — esferoide prolato', () => {
  it('numa esfera (comprimento = largura) cai na fórmula da esfera', () => {
    // Esferoide com a = b = r vira esfera: (4/3)·π·r³.
    const d = 100;
    const r = d / 2;
    expect(volumeDoEmbriao(d, d)).toBeCloseTo((4 / 3) * Math.PI * r ** 3, 6);
  });

  it('cresce linearmente com o comprimento e com o quadrado da largura', () => {
    const base = volumeDoEmbriao(100, 50)!;
    expect(volumeDoEmbriao(200, 50)!).toBeCloseTo(base * 2, 6);
    expect(volumeDoEmbriao(100, 100)!).toBeCloseTo(base * 4, 6);
  });

  it('devolve null para medida ausente, zero ou negativa', () => {
    expect(volumeDoEmbriao(0, 50)).toBeNull();
    expect(volumeDoEmbriao(100, -1)).toBeNull();
    expect(volumeDoEmbriao(NaN, 50)).toBeNull();
  });
});

describe('volumeDaSemente — dois cones pela base', () => {
  it("na convenção 'metade', é o volume de dois cones de altura L/2", () => {
    const L = 600;
    const W = 200;
    const r = W / 2;
    const esperado = 2 * (1 / 3) * Math.PI * r * r * (L / 2);
    expect(volumeDaSemente(L, W)).toBeCloseTo(esperado, 6);
  });

  it("a convenção 'inteiro' dá exatamente o dobro — é a ambiguidade documentada", () => {
    const metade = volumeDaSemente(600, 200, 'metade')!;
    const inteiro = volumeDaSemente(600, 200, 'inteiro')!;
    expect(inteiro).toBeCloseTo(metade * 2, 6);
  });
});

describe('volumesDaSemente', () => {
  it('sem medida de embrião, mede a semente e diz null para o resto — não zero', () => {
    const v = volumesDaSemente({ comprimentoUm: 600, larguraUm: 200 })!;
    expect(v.sementeUm3).toBeGreaterThan(0);
    expect(v.embriaoUm3).toBeNull();
    expect(v.arUm3).toBeNull();
    expect(v.fracaoDeAr).toBeNull();
  });

  it('calcula a fração de ar na ordem de grandeza publicada para Cattleya', () => {
    // Semente ~600 x 200 µm com embrião ~180 x 110 µm: o artigo de referência
    // relata espaços de ar entre 9% e 27% do volume da semente.
    const v = volumesDaSemente({
      comprimentoUm: 600,
      larguraUm: 200,
      embriaoComprimentoUm: 180,
      embriaoLarguraUm: 110,
    })!;
    expect(v.fracaoDeAr).toBeGreaterThan(0);
    expect(v.fracaoDeAr).toBeLessThan(1);
    expect(v.arUm3).toBeCloseTo(v.sementeUm3 - v.embriaoUm3!, 6);
    expect(v.aviso).toBeUndefined();
  });

  it('avisa em vez de esconder quando o embrião sai maior que a semente', () => {
    const v = volumesDaSemente({
      comprimentoUm: 200,
      larguraUm: 60,
      embriaoComprimentoUm: 600,
      embriaoLarguraUm: 200,
    })!;
    expect(v.arUm3!).toBeLessThan(0);
    expect(v.aviso).toMatch(/negativo/i);
  });

  it('a convenção usada viaja junto do resultado, para o laudo declarar', () => {
    expect(volumesDaSemente({ comprimentoUm: 600, larguraUm: 200 })!.convencao).toBe('metade');
    expect(
      volumesDaSemente({ comprimentoUm: 600, larguraUm: 200 }, 'inteiro')!.convencao
    ).toBe('inteiro');
  });
});

describe('resolução: dá para medir isto nesta imagem?', () => {
  it('converte DPI em micrômetros por pixel', () => {
    expect(umPorPixel(4800)).toBeCloseTo(5.2917, 3);
    expect(umPorPixel(3200)).toBeCloseTo(7.9375, 3);
    expect(umPorPixel(1200)).toBeCloseTo(21.1667, 3);
  });

  it('mostra que o embrião de orquídea não cabe em 1200 DPI', () => {
    // Embrião de 76 a 120 µm de diâmetro.
    expect(pixelsPara(76, 1200)!).toBeLessThan(4);
    expect(pixelsPara(120, 1200)!).toBeLessThan(6);
    // A 4800 DPI o mesmo embrião passa de 14 px, que já é forma mensurável.
    expect(pixelsPara(76, 4800)!).toBeGreaterThan(14);
  });
});
