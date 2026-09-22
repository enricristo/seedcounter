// =============================================================================
// analise.ts — as três abas da planilha a partir da grade, mais a comparação.
//
// A fixture do Llanero é o teste de aceitação: 24 linhas, 6 tratamentos com
// 4 repetições, ANOVA com 5 e 18 graus de liberdade, e as letras de Tukey
// que a pesquisadora vai ler na tabela. Os valores dos parâmetros em si já
// têm oráculo em `lib/germinacao/__tests__`; aqui o que se testa é a
// MONTAGEM: tratamento, repetição, médias, recusas que não somem, e a
// comparação que só existe quando tem o que comparar.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerTabelaColada } from '../entrada';
import {
  analisar,
  CONFIGURACAO_PADRAO,
  ultimoTempoObservado,
  type EntradaDeAmostra,
} from '../analise';
import type { AmostraDeGerminacao } from '../../../lib/germinacao';

interface Fixture {
  tempos_h: number[];
  amostras: { codigo: string; sementes: number; contagens: number[] }[];
}
const fixture = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'lib',
      'germinacao',
      '__tests__',
      'fixtures',
      'germinator-llanero.json'
    ),
    'utf8'
  )
) as Fixture;

function entradasDaFixture(): EntradaDeAmostra[] {
  const cabecalho = ['t', '', ...fixture.tempos_h].join('\t');
  const linhas = fixture.amostras.map((a) => [a.codigo, a.sementes, ...a.contagens].join('\t'));
  const r = lerTabelaColada([cabecalho, ...linhas].join('\n'));
  return (r.amostras ?? []).map((a) => ({ codigo: a.codigo, amostra: a, erro: null }));
}

const entrada = (
  codigo: string,
  amostra: AmostraDeGerminacao | null,
  erro: string | null = null
): EntradaDeAmostra => ({ codigo, amostra, erro });

/** Uma amostra sintética com curva razoável, com um deslocamento para diferenciar repetições. */
function amostra(codigo: string, atraso: number, gMax = 0.8): AmostraDeGerminacao {
  const tempos = [24, 48, 72, 96, 120, 144, 168];
  const sementes = 50;
  return {
    codigo,
    sementes,
    leituras: tempos.map((h) => {
      const x = Math.pow(h / (60 + atraso), 6);
      return { horas: h, acumulado: Math.round((sementes * gMax * x) / (1 + x)) };
    }),
  };
}

describe('analisar — a fixture do Llanero', () => {
  const analise = analisar(entradasDaFixture(), { ...CONFIGURACAO_PADRAO, tMaxParaAuc: 504 });

  it('24 linhas, todas ajustadas, 6 tratamentos com 4 repetições', () => {
    expect(analise.linhas).toHaveLength(24);
    expect(analise.linhas.every((l) => l.parametros !== null && l.motivo === null)).toBe(true);
    expect(analise.tratamentos.map((t) => t.tratamento)).toEqual([
      'T0',
      'T8',
      'T16',
      'T24',
      'T32',
      'T48',
    ]);
    expect(analise.tratamentos.every((t) => t.n === 4 && t.nAjustadas === 4)).toBe(true);
    expect(analise.linhas.slice(0, 4).map((l) => l.repeticao)).toEqual([1, 2, 3, 4]);
    expect(analise.linhas[4].repeticao).toBe(1);
  });

  it('a cor segue a ordem de primeira aparição do tratamento', () => {
    expect(analise.tratamentos.map((t) => t.indiceDaCor)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('gMAX médio por tratamento é a média das contagens finais', () => {
    const t0 = analise.tratamentos[0].medias.gMax;
    expect(t0?.n).toBe(4);
    expect(t0?.media).toBeCloseTo((0.62 + 0.52 + 0.66 + 0.52) / 4, 12);
  });

  it('a uniformidade padrão é u7525 e bate com o núcleo', () => {
    for (const l of analise.linhas) {
      expect(l.uniformidade).toBeCloseTo(l.parametros?.uniformidade ?? NaN, 12);
    }
  });

  it('ANOVA de t50, gMAX e AUC com 5 e 18 graus de liberdade', () => {
    expect(analise.comparacoes.map((c) => c.parametro)).toEqual(['t50MaxG', 'gMax', 'auc']);
    for (const c of analise.comparacoes) {
      expect(c.anova.dfBetween).toBe(5);
      expect(c.anova.dfWithin).toBe(18);
      expect(c.excluidos).toEqual([]);
    }
    expect(analise.motivoSemComparacao).toBeNull();
  });

  it('as letras de Tukey (5 %) para t50, gMAX e AUC entre T0…T48', () => {
    const letras = (p: string) => {
      const c = analise.comparacoes.find((x) => x.parametro === p);
      return c ? Object.fromEntries(c.letras) : {};
    };
    // t50: o priming mais longo (T48) é o mais lento; T0 e T24 os mais rápidos.
    expect(letras('t50MaxG')).toEqual({
      T48: 'a',
      T16: 'ab',
      T32: 'ab',
      T8: 'ab',
      T24: 'b',
      T0: 'b',
    });
    // gMAX: sem priming germina mais; T24 e T32 menos.
    expect(letras('gMax')).toEqual({ T0: 'a', T8: 'ab', T48: 'bc', T16: 'bc', T32: 'c', T24: 'c' });
    expect(letras('auc')).toEqual({ T0: 'a', T8: 'ab', T48: 'bc', T16: 'c', T32: 'c', T24: 'c' });
  });

  it('o tMAX configurado vale para AUC e MGT', () => {
    expect(analise.tMax).toBe(504);
    expect(analise.linhas[0].parametros?.tMax).toBe(504);
  });
});

describe('analisar — recusas e linhas ilegíveis não somem', () => {
  it('uma linha ilegível fica com o erro da grade como motivo', () => {
    const a = analisar(
      [entrada('A', amostra('A', 0)), entrada('B', null, 'número de sementes inválido ("x")')],
      CONFIGURACAO_PADRAO
    );
    expect(a.linhas).toHaveLength(2);
    expect(a.linhas[1].parametros).toBeNull();
    expect(a.linhas[1].motivo).toMatch(/sementes inválido/);
    expect(a.linhas[1].sementes).toBeNull();
  });

  it('uma amostra com poucas germinadas fica com o motivo do núcleo', () => {
    const poucas: AmostraDeGerminacao = {
      codigo: 'P',
      sementes: 50,
      leituras: [
        { horas: 24, acumulado: 0 },
        { horas: 48, acumulado: 1 },
        { horas: 72, acumulado: 2 },
      ],
    };
    const a = analisar([entrada('P', poucas)], CONFIGURACAO_PADRAO);
    expect(a.linhas[0].parametros).toBeNull();
    expect(a.linhas[0].motivo).toMatch(/germinaram 2 sementes/);
    expect(a.linhas[0].sementes).toBe(50);
    // O tratamento existe, com n = 1 e nenhuma ajustada — e média nula.
    expect(a.tratamentos[0]).toMatchObject({ tratamento: 'P', n: 1, nAjustadas: 0 });
    expect(a.tratamentos[0].medias.gMax).toBeNull();
  });

  it('germinação mínima configurável muda o que é recusado', () => {
    const poucas: AmostraDeGerminacao = {
      codigo: 'P',
      sementes: 50,
      leituras: [
        { horas: 24, acumulado: 0 },
        { horas: 48, acumulado: 1 },
        { horas: 72, acumulado: 2 },
        { horas: 96, acumulado: 2 },
      ],
    };
    expect(
      analisar([entrada('P', poucas)], { ...CONFIGURACAO_PADRAO, germinacaoMinima: 2 }).linhas[0]
        .parametros
    ).not.toBeNull();
  });
});

describe('analisar — quando há comparação', () => {
  it('um tratamento só: sem comparação, com o motivo', () => {
    const a = analisar(
      [entrada('A', amostra('A', 0)), entrada('A', amostra('A', 3))],
      CONFIGURACAO_PADRAO
    );
    expect(a.comparacoes).toEqual([]);
    expect(a.motivoSemComparacao).toMatch(/dois ou mais tratamentos/);
  });

  it('dois tratamentos com uma repetição cada: sem comparação, com o motivo', () => {
    const a = analisar(
      [entrada('A', amostra('A', 0)), entrada('B', amostra('B', 30))],
      CONFIGURACAO_PADRAO
    );
    expect(a.comparacoes).toEqual([]);
    expect(a.motivoSemComparacao).toMatch(/duas ou mais repetições/);
  });

  it('dois tratamentos com duas repetições: comparação, e o terceiro com uma só fica excluído com motivo', () => {
    const a = analisar(
      [
        entrada('A', amostra('A', 0)),
        entrada('A', amostra('A', 2)),
        entrada('B', amostra('B', 40)),
        entrada('B', amostra('B', 44)),
        entrada('C', amostra('C', 20)),
      ],
      CONFIGURACAO_PADRAO
    );
    expect(a.comparacoes).toHaveLength(3);
    const t50 = a.comparacoes[0];
    expect(t50.anova.dfBetween).toBe(1);
    expect(t50.anova.dfWithin).toBe(2);
    expect([...t50.letras.keys()].sort()).toEqual(['A', 'B']);
    expect(t50.letras.has('C')).toBe(false);
    expect(t50.excluidos).toEqual([{ tratamento: 'C', motivo: 'só uma repetição ajustada' }]);
    // B é 40 h mais lento com repetições quase iguais: difere de A.
    expect(t50.letras.get('B')).toBe('a');
    expect(t50.letras.get('A')).toBe('b');
  });
});

describe('ultimoTempoObservado', () => {
  it('o maior tempo entre as amostras legíveis; null sem nenhuma', () => {
    expect(ultimoTempoObservado([])).toBeNull();
    expect(ultimoTempoObservado([entrada('x', null, 'erro')])).toBeNull();
    expect(ultimoTempoObservado([entrada('A', amostra('A', 0))])).toBe(168);
  });

  it('sem tMAX configurado, a AUC vai até o último tempo observado', () => {
    const a = analisar([entrada('A', amostra('A', 0))], CONFIGURACAO_PADRAO);
    expect(a.tMax).toBe(168);
    expect(a.linhas[0].parametros?.tMax).toBe(168);
  });
});
