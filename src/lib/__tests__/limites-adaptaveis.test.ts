// =============================================================================
// SeedCounter — testes de src/lib/limites-adaptaveis.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  paraPx2,
  descreverLimite,
  raioDeFundoSugerido,
  FRACAO_MINIMA_PADRAO,
  type LimiteDeTamanho,
  type ContextoDeLimite,
} from '../limites-adaptaveis';

const ctxBase: ContextoDeLimite = {
  umPerPixel: undefined,
  medianaAreaPx: undefined,
  areaDaImagemPx: 1_000_000,
};

describe('paraPx2', () => {
  it('px2: devolve o próprio valor', () => {
    const limite: LimiteDeTamanho = { modo: 'px2', valor: 60 };
    expect(paraPx2(limite, ctxBase)).toBe(60);
  });

  it('px2 negativo é grampeado em zero', () => {
    expect(paraPx2({ modo: 'px2', valor: -5 }, ctxBase)).toBe(0);
  });

  it('mm2 sem calibração devolve null', () => {
    const limite: LimiteDeTamanho = { modo: 'mm2', valor: 5 };
    expect(paraPx2(limite, ctxBase)).toBeNull();
  });

  it('mm2 com calibração converte corretamente', () => {
    // umPerPixel = 10 µm/px → 1 px² = 100 µm² = 1e-4 mm² → 1 mm² = 10000 px².
    const ctx: ContextoDeLimite = { ...ctxBase, umPerPixel: 10 };
    const limite: LimiteDeTamanho = { modo: 'mm2', valor: 2 };
    expect(paraPx2(limite, ctx)).toBeCloseTo(20000, 6);
  });

  it('fracaoDaMediana com mediana disponível multiplica pela mediana', () => {
    const ctx: ContextoDeLimite = { ...ctxBase, medianaAreaPx: 500 };
    const limite: LimiteDeTamanho = { modo: 'fracaoDaMediana', valor: 0.3 };
    expect(paraPx2(limite, ctx)).toBeCloseTo(150, 6);
  });

  it('fracaoDaMediana sem mediana cai no padrão por fração da área da imagem', () => {
    const limite: LimiteDeTamanho = { modo: 'fracaoDaMediana', valor: 0.3 };
    const esperado = FRACAO_MINIMA_PADRAO * ctxBase.areaDaImagemPx;
    expect(paraPx2(limite, ctxBase)).toBeCloseTo(esperado, 6);
  });

  it('fracaoDaMediana sem mediana não depende do valor escolhido', () => {
    const a = paraPx2({ modo: 'fracaoDaMediana', valor: 0.1 }, ctxBase);
    const b = paraPx2({ modo: 'fracaoDaMediana', valor: 5 }, ctxBase);
    expect(a).toBe(b);
  });

  it('nunca devolve menos que 1 px² no fallback por fração da imagem', () => {
    const ctx: ContextoDeLimite = { areaDaImagemPx: 10 };
    const px2 = paraPx2({ modo: 'fracaoDaMediana', valor: 0.3 }, ctx);
    expect(px2).toBeGreaterThanOrEqual(1);
  });
});

describe('raioDeFundoSugerido', () => {
  it('cresce com a mediana de área (maior semente esperada → raio maior)', () => {
    const pequeno = raioDeFundoSugerido({ ...ctxBase, medianaAreaPx: 100 });
    const grande = raioDeFundoSugerido({ ...ctxBase, medianaAreaPx: 4000 });
    expect(grande).toBeGreaterThan(pequeno);
  });

  it('é aproximadamente o dobro do raio equivalente à mediana', () => {
    const medianaAreaPx = 314; // círculo de raio ~10 px
    const raio = raioDeFundoSugerido({ ...ctxBase, medianaAreaPx });
    expect(raio).toBeCloseTo(20, 0);
  });

  it('sem mediana, cai num padrão positivo derivado da área da imagem', () => {
    const raio = raioDeFundoSugerido(ctxBase);
    expect(raio).toBeGreaterThan(0);
  });

  it('nunca devolve menos que 1', () => {
    expect(raioDeFundoSugerido({ areaDaImagemPx: 0 })).toBeGreaterThanOrEqual(1);
  });
});

describe('descreverLimite', () => {
  it('mm2 sem calibração avisa que não há como converter', () => {
    const texto = descreverLimite({ modo: 'mm2', valor: 5 }, ctxBase);
    expect(texto).toContain('sem calibração');
  });

  it('fracaoDaMediana com mediana e calibração mostra as três formas', () => {
    const ctx: ContextoDeLimite = { areaDaImagemPx: 1_000_000, medianaAreaPx: 4000, umPerPixel: 10 };
    const texto = descreverLimite({ modo: 'fracaoDaMediana', valor: 0.3 }, ctx);
    expect(texto).toContain('0,3× a mediana');
    expect(texto).toContain('px²');
    expect(texto).toContain('mm²');
  });

  it('px2 sem calibração mostra só px²', () => {
    const texto = descreverLimite({ modo: 'px2', valor: 60 }, ctxBase);
    expect(texto).toBe('60 px²');
  });

  it('separador de milhar por espaço', () => {
    const texto = descreverLimite({ modo: 'px2', valor: 12345 }, ctxBase);
    expect(texto).toBe('12 345 px²');
  });
});
