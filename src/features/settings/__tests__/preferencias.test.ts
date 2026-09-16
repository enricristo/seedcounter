// =============================================================================
// preferencias.ts — leitura e gravação de flags booleanas em localStorage.
//
// Dois ambientes cobertos: sem `localStorage` (o Node puro deste conjunto de
// testes, ver `vitest.config.ts` — `environment: 'node'`) e com um
// `localStorage` simulado por um objeto, para conferir o formato de
// serialização sem precisar de jsdom.
// =============================================================================

import { afterEach, describe, expect, it } from 'vitest';
import { CHAVE_SOM, CHAVE_SUGESTOES, gravarPreferencia, lerPreferencia } from '../preferencias';

describe('sem localStorage (ambiente Node do teste)', () => {
  it('lerPreferencia nunca lança, e devolve o padrão', () => {
    expect(() => lerPreferencia(CHAVE_SUGESTOES, true)).not.toThrow();
    expect(lerPreferencia(CHAVE_SUGESTOES, true)).toBe(true);
    expect(lerPreferencia(CHAVE_SOM, false)).toBe(false);
  });

  it('gravarPreferencia nunca lança, mesmo sem onde persistir', () => {
    expect(() => gravarPreferencia(CHAVE_SOM, true)).not.toThrow();
  });
});

describe('com um localStorage simulado', () => {
  /** Um `Storage` mínimo, só o que este módulo usa. */
  function criarStorageFalso(): Storage {
    const mapa = new Map<string, string>();
    return {
      getItem: (chave: string) => mapa.get(chave) ?? null,
      setItem: (chave: string, valor: string) => {
        mapa.set(chave, valor);
      },
      removeItem: (chave: string) => {
        mapa.delete(chave);
      },
      clear: () => mapa.clear(),
      key: () => null,
      get length() {
        return mapa.size;
      },
    } as Storage;
  }

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('sem a chave gravada, devolve o padrão de cada preferência', () => {
    globalThis.localStorage = criarStorageFalso();
    expect(lerPreferencia(CHAVE_SUGESTOES, true)).toBe(true);
    expect(lerPreferencia(CHAVE_SOM, false)).toBe(false);
  });

  it('grava e lê de volta, ligado e desligado', () => {
    globalThis.localStorage = criarStorageFalso();
    gravarPreferencia(CHAVE_SUGESTOES, true);
    expect(lerPreferencia(CHAVE_SUGESTOES, false)).toBe(true);

    gravarPreferencia(CHAVE_SUGESTOES, false);
    expect(lerPreferencia(CHAVE_SUGESTOES, true)).toBe(false);
  });

  it('desligar uma preferência com padrão LIGADO não volta a ser o padrão', () => {
    // O bug que o '0' explícito evita: se "desligado" fosse só a ausência da
    // chave, este teste falharia devolvendo `true` de novo.
    globalThis.localStorage = criarStorageFalso();
    gravarPreferencia(CHAVE_SUGESTOES, false);
    expect(lerPreferencia(CHAVE_SUGESTOES, true)).toBe(false);
  });

  it('é compatível com o formato que features/easter/som.ts já usa (só "1" é ligado)', () => {
    globalThis.localStorage = criarStorageFalso();
    localStorage.setItem(CHAVE_SOM, '1');
    expect(lerPreferencia(CHAVE_SOM, false)).toBe(true);

    localStorage.setItem(CHAVE_SOM, 'qualquer-outra-coisa');
    expect(lerPreferencia(CHAVE_SOM, false)).toBe(false);
  });
});
