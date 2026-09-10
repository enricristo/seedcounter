// =============================================================================
// Arredondamento que fecha a soma.
//
// O que estes testes protegem é o determinismo. Dois analistas com os mesmos
// números têm de imprimir o MESMO boletim — e um desempate "pelo que vier
// primeiro no array" faria o resultado depender da ordem de digitação.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  ORDEM_DE_DESEMPATE,
  arredondarGerminacao,
  arredondarPureza,
  fecha100,
  fecharDuas,
  type FracoesDeGerminacao,
} from '../arredondamento';

const germ = (
  normais: number,
  anormais: number,
  duras: number,
  dormentes: number,
  mortas: number
): FracoesDeGerminacao => ({ normais, anormais, duras, dormentes, mortas });

describe('germinação — inteiros que somam 100', () => {
  it('o caso que motiva o módulo: arredondar sozinho não fecha', () => {
    // 33,3 + 33,3 + 33,4 arredondados isoladamente dariam 99.
    const r = arredondarGerminacao(germ(33.3, 33.3, 33.4, 0, 0));
    expect(fecha100(r.valores)).toBe(true);
  });

  it('fecha 100 em qualquer entrada que já some 100', () => {
    const casos: FracoesDeGerminacao[] = [
      germ(87.5, 6.25, 3.75, 1.25, 1.25),
      germ(91.4, 4.3, 2.1, 1.1, 1.1),
      germ(50, 20, 15, 10, 5),
      germ(99.6, 0.1, 0.1, 0.1, 0.1),
      germ(0, 25, 25, 25, 25),
    ];
    for (const c of casos) {
      const r = arredondarGerminacao(c);
      expect(fecha100(r.valores), JSON.stringify(c)).toBe(true);
    }
  });

  it('as NORMAIS mantêm o próprio inteiro', () => {
    // É a fração que o comprador lê primeiro e que a fiscalização confere.
    // Deixá-la absorver o resto faria a germinação subir por arredondamento.
    const r = arredondarGerminacao(germ(87.6, 6.2, 3.1, 1.6, 1.5));
    expect(r.valores.normais).toBe(87);
    expect(r.ajustes.some((a) => a.campo === 'normais')).toBe(false);
  });

  it('o ajuste vai para a MAIOR parte fracionária', () => {
    // pisos: 90 + 4 + 2 + 1 + 1 = 98, faltam 2.
    // restos: anormais 0,9 | duras 0,8 | dormentes 0,2 | mortas 0,1
    const r = arredondarGerminacao(germ(90.0, 4.9, 2.8, 1.2, 1.1));
    expect(fecha100(r.valores)).toBe(true);
    expect(r.valores.anormais).toBe(5);
    expect(r.valores.duras).toBe(3);
    expect(r.valores.dormentes).toBe(1);
    expect(r.valores.mortas).toBe(1);
  });

  it('EMPATE segue a ordem da norma: anormais → duras → dormentes → mortas', () => {
    // Quatro restos idênticos de 0,25; pisos somam 99, falta 1.
    // Sem regra, o vencedor dependeria da ordem de digitação.
    const r = arredondarGerminacao(germ(97, 0.25, 0.25, 0.25, 2.25));
    expect(fecha100(r.valores)).toBe(true);
    expect(r.ajustes[0].campo).toBe('anormais');
  });

  it('a ordem de desempate é a que a norma prescreve', () => {
    expect([...ORDEM_DE_DESEMPATE]).toEqual(['anormais', 'duras', 'dormentes', 'mortas']);
  });

  it('é DETERMINÍSTICO — a mesma entrada dá sempre o mesmo boletim', () => {
    const entrada = germ(88.4, 5.4, 3.4, 1.4, 1.4);
    const primeiro = arredondarGerminacao(entrada);
    for (let i = 0; i < 20; i++) {
      expect(arredondarGerminacao(entrada).valores).toEqual(primeiro.valores);
    }
  });

  it('nenhum valor fica negativo', () => {
    const r = arredondarGerminacao(germ(99.9, 0.1, 0, 0, 0));
    for (const v of Object.values(r.valores)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('entrada que NÃO soma 100 não é forçada a fechar', () => {
    // Inventar um total que a medição não produziu esconderia a inconsistência,
    // que é justamente o que o analista precisa ver.
    const r = arredondarGerminacao(germ(50, 10, 10, 10, 10));
    expect(r.ajustes).toEqual([]);
    expect(fecha100(r.valores)).toBe(false);
  });

  it('não quebra com valor não finito', () => {
    const r = arredondarGerminacao(germ(NaN, 10, 10, 10, 10));
    expect(r.ajustes).toEqual([]);
  });
});

describe('pureza — uma decimal somando 100,0', () => {
  it('fecha quando falta um décimo', () => {
    const r = arredondarPureza({ puras: 98.44, outrasSementes: 1.24, inerte: 0.32 });
    const soma = r.valores.puras + r.valores.outrasSementes + r.valores.inerte;
    expect(Number(soma.toFixed(1))).toBe(100);
  });

  it('o ajuste vai para o MAIOR valor', () => {
    // Sobre 98% o décimo é irrelevante; sobre 0,3% de inerte seria um terço.
    const r = arredondarPureza({ puras: 98.44, outrasSementes: 1.24, inerte: 0.32 });
    expect(r.ajustes[0]?.campo).toBe('puras');
  });

  it('não mexe quando já fecha', () => {
    const r = arredondarPureza({ puras: 98.4, outrasSementes: 1.3, inerte: 0.3 });
    expect(r.ajustes).toEqual([]);
    expect(r.valores.puras).toBe(98.4);
  });

  it('a entrada de teste soma 100 de verdade', () => {
    // Guarda contra o proprio teste: um input que ja nao fecha faria a funcao
    // recusar o ajuste, e o teste passaria a medir outra coisa.
    expect(98.44 + 1.24 + 0.32).toBeCloseTo(100, 6);
  });

  it('RECUSA ajuste maior que um décimo — isso é conta errada, não arredondamento', () => {
    // Empurrar 3% para o maior valor produziria um boletim que fecha 100% sem
    // que a medição feche.
    const r = arredondarPureza({ puras: 95, outrasSementes: 1, inerte: 1 });
    expect(r.ajustes).toEqual([]);
  });

  it('usa arredondamento meio-para-cima, não toFixed', () => {
    // (0.25).toFixed(1) devolve '0.2'.
    const r = arredondarPureza({ puras: 99.65, outrasSementes: 0.25, inerte: 0.1 });
    expect(r.valores.outrasSementes).toBe(0.3);
  });
});

describe('fecharDuas', () => {
  it('as duas somam exatamente 100 em qualquer proporcao', () => {
    for (let v = 0; v <= 30; v++) {
      for (let i = 0; i <= 30; i++) {
        if (v + i === 0) continue;
        const r = fecharDuas(v, v + i)!;
        expect(r.principal + r.complemento, `${v}/${i}`).toBeCloseTo(100, 9);
      }
    }
  });

  it('o caso que motivou: 1 de 3', () => {
    const r = fecharDuas(1, 3)!;
    expect(r.principal).toBe(33.3);
    expect(r.complemento).toBe(66.7);
  });

  it('total zero devolve nulo, nao NaN', () => {
    expect(fecharDuas(0, 0)).toBeNull();
    expect(fecharDuas(5, NaN)).toBeNull();
  });
});
