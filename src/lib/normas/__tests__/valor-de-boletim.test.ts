// =============================================================================
// O valor de um campo de boletim.
//
// O que estes testes protegem é uma distinção que um `number` não consegue
// carregar: "não medi" e "medi e deu zero" são situações diferentes para quem
// compra a semente, e o boletim tem símbolos distintos justamente por isso.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  LIMIAR_DE_TRACO,
  NAO_APLICAVEL,
  NAO_REALIZADO,
  TRACO,
  deNumeroAntigo,
  explicar,
  formatar,
  arredondar,
  medido,
  paraCalculo,
  porcentagemDePureza,
  temValor,
} from '../valor-de-boletim';

describe('os quatro estados', () => {
  it('zero medido não é a mesma coisa que não medido', () => {
    // A distinção inteira existe por causa disto.
    expect(formatar(medido(0))).toBe('0,0');
    expect(formatar(NAO_REALIZADO)).toBe('-N-');
    expect(formatar(NAO_APLICAVEL)).toBe('-0-');
    expect(formatar(medido(0))).not.toBe(formatar(NAO_REALIZADO));
  });

  it('cada estado tem o símbolo que a norma usa', () => {
    expect(formatar(NAO_APLICAVEL)).toBe('-0-');
    expect(formatar(NAO_REALIZADO)).toBe('-N-');
    expect(formatar(TRACO)).toBe('Traço');
  });

  it('nenhum campo sai em branco', () => {
    // A IN 40/2010 é explícita: "nenhum campo do Boletim deve ficar em branco".
    for (const v of [medido(0), medido(98.4), NAO_APLICAVEL, NAO_REALIZADO, TRACO]) {
      expect(formatar(v).trim().length).toBeGreaterThan(0);
    }
  });

  it('explica o símbolo em linguagem de gente', () => {
    expect(explicar(NAO_APLICAVEL)).toMatch(/não há o que medir/i);
    expect(explicar(NAO_REALIZADO)).toMatch(/não realizada/i);
    expect(explicar(TRACO)).toMatch(/fora do cálculo/i);
  });
});

describe('formatação', () => {
  it('usa vírgula decimal — é documento brasileiro', () => {
    expect(formatar(medido(98.4))).toBe('98,4');
    expect(formatar(medido(1.5), 2)).toBe('1,50');
  });

  it('respeita as casas que a norma prescreve para cada campo', () => {
    // Pureza usa uma casa; germinação usa inteiros; o PMS varia por espécie.
    expect(formatar(medido(99.85), 1)).toBe('99,9');
    expect(formatar(medido(87.4), 0)).toBe('87');
    expect(formatar(medido(3.4567), 3)).toBe('3,457');
  });

  it('arredonda meio-para-cima onde toFixed erra', () => {
    // Estes três são os casos clássicos em que toFixed devolve o vizinho de
    // baixo, porque o valor não é exatamente representável em binário:
    //   (99.85).toFixed(1) === '99.8'
    //   (1.005).toFixed(2) === '1.00'
    //   (2.675).toFixed(2) === '2.67'
    // Num boletim isso é um número diferente do que o analista acha na
    // calculadora, e a norma prescreve o arredondamento.
    expect(formatar(medido(99.85), 1)).toBe('99,9');
    expect(formatar(medido(1.005), 2)).toBe('1,01');
    expect(formatar(medido(2.675), 2)).toBe('2,68');
  });

  it('completa zeros à direita', () => {
    expect(formatar(medido(98), 1)).toBe('98,0');
    expect(formatar(medido(1.5), 3)).toBe('1,500');
  });
});

describe('arredondar', () => {
  it('é meio-para-cima, e não meio-para-par', () => {
    expect(arredondar(0.5, 0)).toBe(1);
    expect(arredondar(1.5, 0)).toBe(2);
    expect(arredondar(2.5, 0)).toBe(3); // Math.round puro daria 3; toFixed, '3'
  });

  it('trata negativo simetricamente', () => {
    // Sem o tratamento de sinal, Math.round(-0.5) seria -0, e o meio-para-cima
    // de um negativo iria para o lado errado.
    expect(arredondar(-0.5, 0)).toBe(-1);
    expect(arredondar(-99.85, 1)).toBe(-99.9);
  });

  it('não mexe em valor que já está na casa', () => {
    expect(arredondar(98.4, 1)).toBe(98.4);
    expect(arredondar(100, 1)).toBe(100);
  });

  it('não quebra com valor não finito', () => {
    expect(arredondar(NaN, 1)).toBeNaN();
    expect(arredondar(Infinity, 1)).toBe(Infinity);
  });
});

describe('entrada no cálculo', () => {
  it('só o medido entra', () => {
    expect(paraCalculo(medido(12.5))).toBe(12.5);
    expect(paraCalculo(medido(0))).toBe(0);
    expect(paraCalculo(NAO_APLICAVEL)).toBeNull();
    expect(paraCalculo(NAO_REALIZADO)).toBeNull();
  });

  it('Traço fica FORA da soma, e isso é a norma, não arredondamento', () => {
    // Tratá-lo como zero daria o mesmo total e perderia o motivo: ele existe,
    // e por isso aparece no boletim; é menor que 0,05% e por isso não soma.
    expect(paraCalculo(TRACO)).toBeNull();
    expect(formatar(TRACO)).toBe('Traço');
  });

  it('a soma da pureza fecha 100 ignorando o que não é medido', () => {
    const campos = [medido(98.4), medido(1.6), TRACO, NAO_APLICAVEL];
    const soma = campos.reduce((t, c) => t + (paraCalculo(c) ?? 0), 0);
    expect(soma).toBeCloseTo(100, 5);
  });

  it('temValor estreita o tipo', () => {
    const v = medido(7);
    expect(temValor(v)).toBe(true);
    if (temValor(v)) expect(v.valor).toBe(7);
    expect(temValor(TRACO)).toBe(false);
  });
});

describe('porcentagemDePureza', () => {
  it('abaixo de 0,05% vira Traço', () => {
    expect(porcentagemDePureza(0.03).estado).toBe('traco');
    expect(porcentagemDePureza(0.049).estado).toBe('traco');
  });

  it('a partir do limiar é medido', () => {
    expect(porcentagemDePureza(LIMIAR_DE_TRACO).estado).toBe('medido');
    expect(porcentagemDePureza(0.1).estado).toBe('medido');
  });

  it('zero é zero medido, não Traço', () => {
    // Traço significa "existe mas é pouco". Zero significa "não existe".
    expect(porcentagemDePureza(0).estado).toBe('medido');
    expect(formatar(porcentagemDePureza(0))).toBe('0,0');
  });
});

describe('migração do modelo antigo', () => {
  it('número que já existe no banco foi medido', () => {
    // Não havia como registrar outra coisa no modelo antigo.
    expect(deNumeroAntigo(42)).toEqual(medido(42));
    expect(deNumeroAntigo(0)).toEqual(medido(0));
  });

  it('ausência vira "não realizado", que é a leitura conservadora', () => {
    // Afirmar que mediu e deu zero seria inventar um resultado.
    expect(deNumeroAntigo(undefined).estado).toBe('nao-realizado');
    expect(deNumeroAntigo(null).estado).toBe('nao-realizado');
    expect(deNumeroAntigo(NaN).estado).toBe('nao-realizado');
  });
});
