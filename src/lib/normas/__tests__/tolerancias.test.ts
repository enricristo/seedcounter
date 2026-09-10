// =============================================================================
// Tolerancias entre repeticoes.
//
// O teste mais importante aqui e o que garante SILENCIO: enquanto a tabela nao
// for conferida contra a RAS publicada, o aplicativo nao pode dizer "dentro da
// tolerancia". Dizer isso com numero nao conferido e pior que nao dizer nada,
// porque parece uma aprovacao.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  TABELA_4_1,
  TABELA_4_1_NAO_CONFERIDA,
  faixaDaMedia,
  verificarGerminacao,
} from '../tolerancias';

describe('a pendencia registrada', () => {
  it('a tabela continua NAO conferida', () => {
    // Enquanto isto for verdade, o teste existe para que ninguem derrube a
    // constante sem conferir os valores. Quando conferir, cai junto.
    expect(TABELA_4_1_NAO_CONFERIDA).toBe(true);
  });

  it('NAO da veredito enquanto a tabela nao for conferida', () => {
    // Quatro repeticoes muito discordantes: seria "estourou" com tabela boa.
    const r = verificarGerminacao([40, 95, 62, 88]);
    expect(r.veredicto).toBe('nao-verificavel');
    expect(r.recado).toMatch(/nao foi conferida|não foi conferida/i);
  });

  it('mesmo assim CALCULA e mostra a amplitude', () => {
    // O numero bruto e util e nao depende da tabela: e o veredito que depende.
    const r = verificarGerminacao([40, 95, 62, 88]);
    expect(r.amplitude).toBe(55);
    expect(r.media).toBeCloseTo(71.25, 2);
    expect(r.recado).toMatch(/55 pontos/);
  });

  it('nao produz texto de Observacoes sem veredito', () => {
    // Registrar "divergencia reconhecida" sem ter verificado seria inventar um
    // ato do Responsavel Tecnico.
    expect(verificarGerminacao([40, 95, 62, 88]).textoParaObservacoes).toBe('');
  });
});

describe('amplitude e extremos', () => {
  it('aponta QUAL repeticao e a mais baixa e a mais alta', () => {
    // Dizer "estourou" sem dizer quais discordam obriga a pessoa a procurar.
    const r = verificarGerminacao([88, 40, 95, 62]);
    expect(r.maisBaixa).toBe(2);
    expect(r.maisAlta).toBe(3);
  });

  it('exige pelo menos duas repeticoes', () => {
    expect(verificarGerminacao([90]).veredicto).toBe('nao-verificavel');
    expect(verificarGerminacao([]).veredicto).toBe('nao-verificavel');
  });

  it('ignora repeticao nao finita em vez de propagar NaN', () => {
    const r = verificarGerminacao([90, NaN, 94]);
    expect(r.amplitude).toBe(4);
    expect(Number.isFinite(r.media)).toBe(true);
  });
});

describe('estrutura da tabela', () => {
  it('cobre de 0 a 100 sem buraco', () => {
    // Um buraco faria uma media cair fora de qualquer faixa e virar
    // "nao-verificavel" por acidente, nao por decisao.
    for (let m = 0; m <= 100; m++) {
      expect(faixaDaMedia(m), `media ${m}`).not.toBeNull();
    }
  });

  it('nenhuma faixa se sobrepoe', () => {
    const ordenadas = [...TABELA_4_1].sort((a, b) => a.de - b.de);
    for (let i = 1; i < ordenadas.length; i++) {
      expect(ordenadas[i].de, `faixa ${i}`).toBeGreaterThan(ordenadas[i - 1].ate);
    }
  });

  it('e simetrica em torno de 50%: os extremos toleram MENOS variacao', () => {
    // Proporcao perto de 0 ou de 100 tem menos variancia binomial. Se esta
    // forma se perder, alguem trocou os valores por engano.
    const perto100 = faixaDaMedia(99)!.amplitudeMaxima;
    const meio = faixaDaMedia(50)!.amplitudeMaxima;
    const perto0 = faixaDaMedia(1)!.amplitudeMaxima;
    expect(meio).toBeGreaterThan(perto100);
    expect(meio).toBeGreaterThan(perto0);
  });

  it('media invalida nao acha faixa', () => {
    expect(faixaDaMedia(NaN)).toBeNull();
    expect(faixaDaMedia(150)).toBeNull();
  });
});
