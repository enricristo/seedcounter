// =============================================================================
// A máscara de anotação.
//
// O estado intermediário — só pontos — é o mais útil dos três, e é o que um
// botão de liga-desliga não consegue oferecer. Estes testes existem para que
// ninguém "simplifique" o ciclo para dois estados achando que economiza.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  CICLO,
  ESTADO_INICIAL,
  descrever,
  mostraContornos,
  mostraPontos,
  proxima,
  temOverlay,
  type Mascara,
} from '../mascara';

describe('o ciclo', () => {
  it('começa mostrando tudo', () => {
    expect(ESTADO_INICIAL).toBe('tudo');
  });

  it('gira tudo → pontos → nada → tudo', () => {
    expect(proxima('tudo')).toBe('pontos');
    expect(proxima('pontos')).toBe('nada');
    expect(proxima('nada')).toBe('tudo');
  });

  it('três acionamentos voltam ao começo', () => {
    let m: Mascara = ESTADO_INICIAL;
    for (let i = 0; i < CICLO.length; i++) m = proxima(m);
    expect(m).toBe(ESTADO_INICIAL);
  });

  it('são TRÊS estados, não dois', () => {
    // "Tudo ou nada" não resolve a dúvida mais comum: este contorno pegou uma
    // semente ou duas? Para julgar isso é preciso ver os pontos sobre a imagem
    // crua, sem o polígono por cima.
    expect(CICLO).toHaveLength(3);
    expect(CICLO).toContain('pontos');
  });
});

describe('o que cada estado mostra', () => {
  it('tudo mostra pontos e contornos', () => {
    expect(mostraPontos('tudo')).toBe(true);
    expect(mostraContornos('tudo')).toBe(true);
  });

  it('pontos mostra ponto SEM contorno — é o estado que resolve a dúvida', () => {
    expect(mostraPontos('pontos')).toBe(true);
    expect(mostraContornos('pontos')).toBe(false);
  });

  it('nada devolve a imagem crua', () => {
    expect(mostraPontos('nada')).toBe(false);
    expect(mostraContornos('nada')).toBe(false);
    expect(temOverlay('nada')).toBe(false);
  });

  it('contorno nunca aparece sem ponto', () => {
    // Um contorno sozinho, sem a marcação que o originou, esconderia quantas
    // sementes a pessoa identificou ali.
    for (const m of CICLO) {
      if (mostraContornos(m)) expect(mostraPontos(m)).toBe(true);
    }
  });
});

describe('descrição', () => {
  it('todo estado se explica em uma frase', () => {
    for (const m of CICLO) {
      const d = descrever(m);
      expect(d.rotulo.length).toBeGreaterThan(0);
      expect(d.explicacao.length).toBeGreaterThan(0);
    }
  });
});
