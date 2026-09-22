import { describe, it, expect } from 'vitest';
import { nivelDoTratamento, analisarFatorQuantitativo } from '../fator-quantitativo';

describe('nivelDoTratamento — o número dentro do rótulo', () => {
  it('lê os formatos que o laboratório usa', () => {
    expect(nivelDoTratamento('T8').nivel).toBe(8);
    expect(nivelDoTratamento('-0,6 MPa').nivel).toBe(-0.6);
    expect(nivelDoTratamento('−0.9 MPa').nivel).toBe(-0.9);
    expect(nivelDoTratamento('12 meses').nivel).toBe(12);
    expect(nivelDoTratamento('0').nivel).toBe(0);
  });

  it('recusa rótulo sem número e rótulo ambíguo — ambiguidade não vira eixo x', () => {
    expect(nivelDoTratamento('Controle').nivel).toBeNull();
    expect(nivelDoTratamento('T8 rep2').nivel).toBeNull();
  });

  it('diz de onde o número saiu', () => {
    expect(nivelDoTratamento('T16').trecho).toBe('16');
  });
});

describe('analisarFatorQuantitativo', () => {
  it('com menos de três níveis distintos, explica em vez de ajustar', () => {
    const r = analisarFatorQuantitativo([
      { label: 'Controle', values: [80, 82] },
      { label: 'Tratado', values: [70, 71] },
    ]);
    expect(r.regressao).toBeNull();
    expect(r.motivoSemRegressao).toMatch(/Nenhum tratamento/);
  });

  it('com níveis numéricos, ajusta e escreve a equação do grau recomendado', () => {
    // Potencial osmótico: resposta em parábola com ótimo em −0,5 MPa.
    const y = (x: number) => 80 - 60 * x - 60 * x * x;
    const grupos = [0, -0.3, -0.6, -0.9, -1.2].map((x, i) => ({
      label: `${x} MPa`,
      values: [y(x) + [0.4, -0.3, 0.2, -0.5, 0.1][i], y(x) - [0.2, 0.3, -0.1, 0.5, -0.4][i]],
    }));
    const r = analisarFatorQuantitativo(grupos);
    expect(r.comNivel).toBe(5);
    expect(r.regressao).not.toBeNull();
    expect(r.regressao!.recomendado).toBe(2);
    expect(r.regressao!.otimo!.x).toBeCloseTo(-0.5, 1);
    expect(r.regressao!.otimo!.dentroDaFaixa).toBe(true);
    expect(r.equacao).toMatch(/^ŷ = /);
  });

  it('cada repetição vira um ponto — a dispersão dentro do nível é o resíduo', () => {
    const grupos = [
      { label: 'T0', values: [50, 52, 48] },
      { label: 'T8', values: [60, 61, 59] },
      { label: 'T16', values: [70, 69, 71] },
    ];
    const r = analisarFatorQuantitativo(grupos);
    expect(r.regressao!.n).toBe(9);
  });
});
