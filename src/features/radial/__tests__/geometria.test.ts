import { describe, it, expect } from 'vitest';
import { fatiaDoAngulo, RAIO_MORTO } from '../geometria';

describe('fatia do angulo', () => {
  it('quatro fatias: direita, baixo, esquerda, cima', () => {
    expect(fatiaDoAngulo(30, 0, 4)).toBe(0);
    expect(fatiaDoAngulo(0, 30, 4)).toBe(1);
    expect(fatiaDoAngulo(-30, 0, 4)).toBe(2);
    expect(fatiaDoAngulo(0, -30, 4)).toBe(3);
  });
  it('dentro do raio morto nao escolhe — soltar no centro cancela', () => {
    expect(fatiaDoAngulo(RAIO_MORTO - 1, 0, 4)).toBeNull();
  });
  it('a fronteira entre fatias fica a 45 graus, nao no eixo', () => {
    // Um gesto quase reto para a direita nao pode cair em "baixo".
    expect(fatiaDoAngulo(30, 5, 4)).toBe(0);
    expect(fatiaDoAngulo(30, -5, 4)).toBe(0);
  });
});
