// =============================================================================
// A memória de dispensas — só o que dá para testar sem DOM.
//
// Este arquivo roda em Node puro, sem localStorage. Isso não é uma limitação
// do teste: é exatamente o caso que o try/catch existe para cobrir —
// armazenamento indisponível não pode derrubar o aplicativo. O que se testa
// aqui é a queda suave: sem `localStorage`, ler devolve vazio e dispensar não
// lança.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { dispensar, lerDispensadas } from '../dispensadas';

describe('sem localStorage (ambiente Node do teste)', () => {
  it('lerDispensadas nunca lança, e devolve conjunto vazio', () => {
    expect(() => lerDispensadas('img-1')).not.toThrow();
    expect(lerDispensadas('img-1')).toEqual(new Set());
  });

  it('lerDispensadas(null) também não lança', () => {
    expect(() => lerDispensadas(null)).not.toThrow();
  });

  it('dispensar nunca lança, mesmo sem onde persistir', () => {
    expect(() => dispensar('marcas-sem-contorno', 'imagem', 'img-1')).not.toThrow();
    expect(() => dispensar('identificacao-para-laudo', 'sempre', null)).not.toThrow();
  });

  it('dispensar com escopo imagem e sem chave de imagem não lança', () => {
    // Não há o que escopar — a função apenas não grava nada.
    expect(() => dispensar('marcas-sem-contorno', 'imagem', null)).not.toThrow();
  });
});
