import { describe, it, expect } from 'vitest';
import { escalaGrafica, valorRedondo, rotuloDeComprimento } from '../escala-grafica';

describe('valorRedondo', () => {
  it('cai em 1, 2 ou 5 × 10ⁿ, sempre ≤ x', () => {
    expect(valorRedondo(1417)).toBe(1000);
    expect(valorRedondo(2999)).toBe(2000);
    expect(valorRedondo(7)).toBe(5);
    expect(valorRedondo(0.34)).toBeCloseTo(0.2, 9);
    expect(valorRedondo(0)).toBe(1);
  });
});

describe('rotuloDeComprimento', () => {
  it('escolhe a unidade com menos dígitos e vírgula decimal', () => {
    expect(rotuloDeComprimento(500)).toBe('500 µm');
    expect(rotuloDeComprimento(1000)).toBe('1 mm');
    expect(rotuloDeComprimento(2500)).toBe('2,5 mm');
    expect(rotuloDeComprimento(20000)).toBe('2 cm');
  });
});

describe('escalaGrafica', () => {
  it('a 7,06 µm/px e zoom 1, a barra de ~140 px vira 500 µm com ~71 px', () => {
    const e = escalaGrafica(25400 / 3600, 1);
    expect(e.rotulo).toBe('500 µm');
    expect(e.larguraPx).toBeCloseTo(70.9, 0);
    expect(e.semCalibracao).toBe(false);
  });
  it('a barra em tela fica entre metade do alvo e o alvo, em qualquer zoom', () => {
    for (const zoom of [0.05, 0.13, 0.5, 1, 2.8, 8]) {
      const e = escalaGrafica(5.365, zoom);
      expect(e.larguraPx, `zoom ${zoom}`).toBeGreaterThan(140 / 5);
      expect(e.larguraPx, `zoom ${zoom}`).toBeLessThanOrEqual(140 + 1e-9);
    }
  });
  it('sem calibração a barra é em px da imagem e diz isso', () => {
    const e = escalaGrafica(undefined, 0.5);
    expect(e.semCalibracao).toBe(true);
    expect(e.rotulo).toBe('200 px');
    expect(e.larguraPx).toBe(100);
  });
});
