import { describe, it, expect } from 'vitest';
import { lerLabelYolo, centroDaAnotacao } from '../yolo';

describe('lerLabelYolo', () => {
  it('caixa: 5 valores normalizados viram px com centro e tamanho', () => {
    const [a] = lerLabelYolo('1 0.5 0.25 0.2 0.1', 1000, 800);
    expect(a.classe).toBe(1);
    expect(a.caixa).toEqual({ x: 400, y: 160, largura: 200, altura: 80 });
    expect(a.poligono).toBeUndefined();
    expect(centroDaAnotacao(a)).toEqual([500, 200]);
  });
  it('polígono: classe + pares viram pontos em px (formato do conjunto de orquídeas)', () => {
    const linha = '0 0.5112431289640592 0.03574841437632135 0.5024027484143764 0.0765507399577167 0.5062463002114165 0.12884355179704016';
    const [a] = lerLabelYolo(linha, 640, 640);
    expect(a.classe).toBe(0);
    expect(a.poligono).toHaveLength(3);
    expect(a.poligono![0][0]).toBeCloseTo(327.2, 0);
    expect(a.poligono![0][1]).toBeCloseTo(22.9, 0);
    const [cx, cy] = centroDaAnotacao(a);
    expect(cx).toBeGreaterThan(320); expect(cy).toBeGreaterThan(20);
  });
  it('várias linhas, linhas vazias e comentários são tolerados; linha malformada é descartada', () => {
    const r = lerLabelYolo('0 0.5 0.5 0.1 0.1\n\n# c\n1 0.2 0.2 0.05 0.05\n0 0.1 0.2\n', 100, 100);
    expect(r).toHaveLength(2);
  });
});
