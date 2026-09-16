// src/lib/__tests__/eixos.test.ts
// =============================================================================
// Eixos de medida (C3.1): PCA e Feret expostos como segmentos desenháveis.
//
// A elipse girada é o caso que decide se a duplicação da conta do PCA em
// eixos.ts está certa: numa elipse os dois métodos DEVEM coincidir, então
// comparar contra calculateSeedDimensions (pca-utils.ts) é um teste de
// equivalência real, não um teste da função contra si mesma.
//
// No retângulo os dois métodos DEVEM discordar no maior eixo: o Feret máximo
// é a diagonal, a PCA não passa disso — é exatamente o caso que o overlay
// sinaliza com "≠".
// =============================================================================

import { describe, it, expect } from 'vitest';
import { eixosDoContorno, discordanciaRelativa } from '../eixos';
import { calculateSeedDimensions } from '../pca-utils';
import { feret } from '../feret';

type P = [number, number];

/** Elipse de semieixos a,b (comprimento total 2a x 2b), centrada em (cx,cy), girada de `rot` rad. */
function elipseGirada(a: number, b: number, rot: number, cx = 200, cy = 200, n = 180): P[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const ex = a * Math.cos(t);
    const ey = b * Math.sin(t);
    const x = ex * Math.cos(rot) - ey * Math.sin(rot);
    const y = ex * Math.sin(rot) + ey * Math.cos(rot);
    return [cx + x, cy + y] as P;
  });
}

const retangulo = (l: number, altura: number): P[] => [
  [0, 0],
  [l, 0],
  [l, altura],
  [0, altura],
];

describe('eixosDoContorno', () => {
  it('devolve nulo para menos de 3 pontos', () => {
    expect(eixosDoContorno([])).toBeNull();
    expect(
      eixosDoContorno([
        [0, 0],
        [1, 1],
      ])
    ).toBeNull();
  });

  it('elipse 40x20 girada 30°: comprimento ≈ 80, largura ≈ 40, ângulo ≈ 30°', () => {
    const rot = Math.PI / 6; // 30°
    const pontos = elipseGirada(40, 20, rot);
    const eixos = eixosDoContorno(pontos)!;

    expect(eixos.comprimento.comprimento).toBeCloseTo(80, 0);
    expect(eixos.largura.comprimento).toBeCloseTo(40, 0);

    // Ângulo do eixo maior, normalizado para [0, pi) — eixo não tem sentido.
    const dx = eixos.comprimento.b[0] - eixos.comprimento.a[0];
    const dy = eixos.comprimento.b[1] - eixos.comprimento.a[1];
    let angulo = Math.atan2(dy, dx);
    if (angulo < 0) angulo += Math.PI;
    if (angulo >= Math.PI) angulo -= Math.PI;
    expect((angulo * 180) / Math.PI).toBeCloseTo(30, 0);
  });

  it('elipse: comprimento/largura da PCA bate com calculateSeedDimensions', () => {
    // O motivo de existir eixos.ts é desenhar a MESMA medida que
    // calculateSeedDimensions calcula — não uma aproximação dela.
    const pontos = elipseGirada(40, 20, 0.5);
    const eixos = eixosDoContorno(pontos)!;
    const dims = calculateSeedDimensions(pontos);

    expect(eixos.comprimento.comprimento).toBeCloseTo(dims.width, 0);
    expect(eixos.largura.comprimento).toBeCloseTo(dims.height, 0);
  });

  it('elipse: Feret máx/mín também batem com PCA (mesma medida ali)', () => {
    const pontos = elipseGirada(40, 20, 0.9);
    const eixos = eixosDoContorno(pontos)!;

    expect(eixos.feretMax.comprimento).toBeCloseTo(eixos.comprimento.comprimento, 0);
    expect(eixos.feretMin.comprimento).toBeCloseTo(eixos.largura.comprimento, 0);

    // E batem com a função feret() já testada — sanity check cruzado.
    const f = feret(pontos)!;
    expect(eixos.feretMax.comprimento).toBeCloseTo(f.maximo, 3);
    expect(eixos.feretMin.comprimento).toBeCloseTo(f.minimo, 3);
  });

  it('retângulo: Feret máximo é a diagonal; a PCA (comprimento) não é', () => {
    // Um retângulo quase quadrado maximiza a discordância relativa entre a
    // diagonal (Feret) e o lado maior (PCA) — por isso 10x8, não 20x10.
    const pontos = retangulo(10, 8);
    const eixos = eixosDoContorno(pontos)!;
    const diagonal = Math.hypot(10, 8);

    expect(eixos.feretMax.comprimento).toBeCloseTo(diagonal, 5);
    // A PCA do retângulo mede a extensão ao longo do lado maior, não a
    // diagonal — é exatamente a discordância que justifica o "≠" no overlay.
    expect(eixos.comprimento.comprimento).toBeLessThan(diagonal - 1);

    const disc = discordanciaRelativa(eixos.comprimento.comprimento, eixos.feretMax.comprimento);
    expect(disc).toBeGreaterThan(0.15);
  });

  it('discordanciaRelativa: zero quando os dois batem, positiva quando divergem', () => {
    expect(discordanciaRelativa(80, 80)).toBe(0);
    expect(discordanciaRelativa(100, 80)).toBeCloseTo(0.25, 5);
    expect(discordanciaRelativa(5, 0)).toBe(0); // feret 0: guarda contra divisão por zero
  });

  it('segmentos têm o mesmo centro para os dois eixos PCA', () => {
    const pontos = elipseGirada(40, 20, 1.1, 50, 70);
    const eixos = eixosDoContorno(pontos)!;
    expect(eixos.centro[0]).toBeCloseTo(50, 0);
    expect(eixos.centro[1]).toBeCloseTo(70, 0);
  });
});
