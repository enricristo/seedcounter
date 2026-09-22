// =============================================================================
// colunas.ts — nenhuma coluna sem a frase para quem está aprendendo.
// exemplo.ts — a fixture real é lida como a tela vai carregá-la.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIGURACAO_PADRAO, PARAMETROS_RESUMIDOS, UNIFORMIDADES } from '../analise';
import { AJUDA_FIXA, COLUNAS_DE_PARAMETROS } from '../colunas';
import { lerFixtureDoGerminator } from '../exemplo';

describe('colunas de parâmetros', () => {
  it('cobrem todos os parâmetros resumidos, menos o t-x total (que está na exportação)', () => {
    const chaves = COLUNAS_DE_PARAMETROS.map((c) => c.chave);
    const esperadas = PARAMETROS_RESUMIDOS.filter((p) => p !== 'tXTotS');
    expect(chaves).toEqual(esperadas);
  });

  it('cada coluna tem rótulo e uma frase de ajuda completa, em qualquer configuração', () => {
    const configuracoes = [
      CONFIGURACAO_PADRAO,
      { ...CONFIGURACAO_PADRAO, uniformidade: 'u8416' as const, percentualParaTx: 10 },
      { ...CONFIGURACAO_PADRAO, uniformidade: 'u9010' as const, percentualParaTx: 30 },
    ];
    for (const config of configuracoes) {
      for (const c of COLUNAS_DE_PARAMETROS) {
        expect(c.rotulo(config).length, c.chave).toBeGreaterThan(0);
        const ajuda = c.ajuda(config);
        expect(ajuda.length, c.chave).toBeGreaterThan(30);
        expect(ajuda.endsWith('.'), `${c.chave}: "${ajuda}"`).toBe(true);
      }
    }
  });

  it('o rótulo e a ajuda de t-x e da uniformidade seguem a configuração', () => {
    const tX = COLUNAS_DE_PARAMETROS.find((c) => c.chave === 'tXMaxG');
    const u = COLUNAS_DE_PARAMETROS.find((c) => c.chave === 'uniformidade');
    const config = { ...CONFIGURACAO_PADRAO, uniformidade: 'u8416' as const, percentualParaTx: 10 };
    expect(tX?.rotulo(config)).toBe('t10');
    expect(tX?.ajuda(config)).toContain('10 %');
    expect(u?.rotulo(config)).toBe('U8416');
    expect(u?.ajuda(config)).toBe(UNIFORMIDADES.u8416.ajuda);
  });

  it('as colunas fixas também têm ajuda', () => {
    for (const [chave, frase] of Object.entries(AJUDA_FIXA)) {
      expect(frase.length, chave).toBeGreaterThan(20);
      expect(frase.endsWith('.'), chave).toBe(true);
    }
  });
});

describe('lerFixtureDoGerminator', () => {
  const caminho = join(
    __dirname,
    '..',
    '..',
    '..',
    'lib',
    'germinacao',
    '__tests__',
    'fixtures',
    'germinator-llanero.json'
  );

  it('lê as 24 amostras reais com 7 leituras cada', () => {
    const amostras = lerFixtureDoGerminator(readFileSync(caminho, 'utf8'));
    expect(amostras).toHaveLength(24);
    expect(amostras.every((a) => a.leituras.length === 7 && a.sementes === 50)).toBe(true);
    expect(amostras[0]).toEqual({
      codigo: 'T0',
      sementes: 50,
      leituras: [
        { horas: 48, acumulado: 0 },
        { horas: 96, acumulado: 21 },
        { horas: 168, acumulado: 30 },
        { horas: 240, acumulado: 30 },
        { horas: 336, acumulado: 31 },
        { horas: 408, acumulado: 31 },
        { horas: 504, acumulado: 31 },
      ],
    });
  });

  it('lança com formato inesperado, em vez de devolver lixo', () => {
    expect(() => lerFixtureDoGerminator('[]')).toThrow(/fixture/);
    expect(() => lerFixtureDoGerminator('{"tempos_h":[1],"amostras":[{"codigo":"a"}]}')).toThrow(
      /amostra 0/
    );
  });
});
