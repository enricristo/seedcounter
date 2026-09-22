import { describe, it, expect } from 'vitest';
import { deveReduzir, dimensoesReduzidas, LADO_MAXIMO_REDUZIDO, LADO_MINIMO_PARA_REDUZIR } from '../reduzir-imagem';

describe('deveReduzir', () => {
  it('não reduz uma imagem pequena (o caso de 640px do enunciado)', () => {
    expect(deveReduzir(640, 480)).toBe(false);
  });

  it('não reduz exatamente no piso', () => {
    expect(deveReduzir(LADO_MINIMO_PARA_REDUZIR, 1000)).toBe(false);
  });

  it('reduz uma digitalização grande (6800×9359)', () => {
    expect(deveReduzir(6800, 9359)).toBe(true);
  });

  it('olha o maior lado, não um lado fixo — retrato ou paisagem tanto faz', () => {
    expect(deveReduzir(1000, 9359)).toBe(true);
    expect(deveReduzir(9359, 1000)).toBe(true);
  });
});

describe('dimensoesReduzidas', () => {
  it('preserva a proporção ao reduzir uma digitalização grande', () => {
    const { width, height } = dimensoesReduzidas(6800, 9359);
    expect(Math.max(width, height)).toBe(LADO_MAXIMO_REDUZIDO);
    // Proporção original: 6800/9359. A reduzida deve manter a mesma razão,
    // com folga de arredondamento de 1px.
    const razaoOriginal = 6800 / 9359;
    const razaoReduzida = width / height;
    expect(Math.abs(razaoOriginal - razaoReduzida)).toBeLessThan(0.001);
  });

  it('não aumenta uma imagem que já está dentro do teto', () => {
    expect(dimensoesReduzidas(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('nunca devolve uma dimensão menor que 1px', () => {
    const { width, height } = dimensoesReduzidas(1, 20000);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });
});
