// =============================================================================
// curvas.ts e saida.ts — o que o gráfico desenha e o que sai para o Excel.
// =============================================================================

import { describe, expect, it } from 'vitest';
import type { AmostraDeGerminacao } from '../../../lib/germinacao';
import { analisar, CONFIGURACAO_PADRAO, type EntradaDeAmostra } from '../analise';
import { corDoTratamento, dadosDoGrafico, TETO_DE_CORES } from '../curvas';
import { celulaNumerica, escreverCsv, escreverTabelaOUTPUT } from '../saida';
import { escreverTabelaINPUT, lerTabelaColada } from '../entrada';

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
const entrada = (
  codigo: string,
  a: AmostraDeGerminacao | null,
  erro: string | null = null
): EntradaDeAmostra => ({ codigo, amostra: a, erro });

const poucas: AmostraDeGerminacao = {
  codigo: 'P',
  sementes: 50,
  leituras: [
    { horas: 24, acumulado: 0 },
    { horas: 96, acumulado: 1 },
    { horas: 168, acumulado: 2 },
  ],
};

describe('dadosDoGrafico — por amostra', () => {
  const analise = analisar(
    [
      entrada('A', amostra('A', 0)),
      entrada('A', amostra('A', 4)),
      entrada('B', amostra('B', 30)),
      entrada('P', poucas),
    ],
    CONFIGURACAO_PADRAO
  );
  const dados = dadosDoGrafico(analise, 'amostras');

  it('uma série de pontos por amostra e uma curva por amostra ajustada', () => {
    const observadas = dados.series.filter((s) => s.tipo === 'observado');
    const curvas = dados.series.filter((s) => s.tipo === 'curva');
    expect(observadas).toHaveLength(4); // a recusada também mostra os pontos
    expect(curvas).toHaveLength(3); // mas não tem curva
    expect(curvas.map((c) => c.chave)).toEqual(['c0', 'c1', 'c2']);
  });

  it('a cor é do tratamento, na ordem de aparição', () => {
    expect(dados.tratamentos.map((t) => [t.nome, t.indiceDaCor])).toEqual([
      ['A', 0],
      ['B', 1],
      ['P', 2],
    ]);
    expect(dados.series.filter((s) => s.tratamento === 'A').every((s) => s.indiceDaCor === 0)).toBe(
      true
    );
  });

  it('o eixo vai até o último tempo observado, e as linhas estão ordenadas', () => {
    expect(dados.tFim).toBe(168);
    const horas = dados.linhas.map((l) => l.horas);
    expect(horas[0]).toBe(0);
    expect(horas[horas.length - 1]).toBe(168);
    for (let i = 1; i < horas.length; i++) expect(horas[i]).toBeGreaterThan(horas[i - 1]);
  });

  it('a curva tem valor em TODA linha (senão o traço quebra); os pontos só nos tempos observados', () => {
    expect(dados.linhas.every((l) => typeof l.c0 === 'number')).toBe(true);
    const comPonto = dados.linhas.filter((l) => typeof l.o0 === 'number').map((l) => l.horas);
    expect(comPonto).toEqual([24, 48, 72, 96, 120, 144, 168]);
  });

  it('os valores são em % de germinação', () => {
    const ultima = dados.linhas[dados.linhas.length - 1];
    expect(ultima.o0).toBe(80); // 40 de 50
    expect(ultima.c0).toBeGreaterThan(70);
    expect(ultima.c0).toBeLessThanOrEqual(80.01);
  });

  it('com até 4 tratamentos há uma etiqueta por tratamento, na curva que termina mais alto', () => {
    expect(dados.etiquetas.map((e) => e.texto)).toEqual(['A', 'B']); // P não tem curva
    expect(dados.etiquetas[0].chave).toMatch(/^c[01]$/);
  });
});

describe('dadosDoGrafico — por tratamento', () => {
  const analise = analisar(
    [entrada('A', amostra('A', 0)), entrada('A', amostra('A', 4)), entrada('B', amostra('B', 30))],
    CONFIGURACAO_PADRAO
  );
  const dados = dadosDoGrafico(analise, 'tratamentos');

  it('uma curva média e uma série de pontos médios por tratamento', () => {
    expect(dados.series.map((s) => [s.chave, s.tipo])).toEqual([
      ['n0', 'observado'],
      ['m0', 'curva'],
      ['n1', 'observado'],
      ['m1', 'curva'],
    ]);
  });

  it('o ponto médio é a média das frações observadas das repetições', () => {
    const em168 = dados.linhas.find((l) => l.horas === 168);
    const a1 = amostra('A', 0).leituras[6].acumulado / 50;
    const a2 = amostra('A', 4).leituras[6].acumulado / 50;
    expect(em168?.n0).toBeCloseTo(((a1 + a2) / 2) * 100, 6);
  });
});

describe('dadosDoGrafico — vazio e teto de cores', () => {
  it('sem amostras legíveis não há nada a desenhar', () => {
    const analise = analisar([entrada('x', null, 'erro')], CONFIGURACAO_PADRAO);
    expect(dadosDoGrafico(analise, 'amostras')).toEqual({
      linhas: [],
      series: [],
      tratamentos: [],
      etiquetas: [],
      tFim: 0,
    });
  });

  it('com mais de 4 tratamentos não há etiqueta direta — a legenda responde', () => {
    const entradas = ['A', 'B', 'C', 'D', 'E'].map((c, i) => entrada(c, amostra(c, i * 5)));
    expect(dadosDoGrafico(analisar(entradas, CONFIGURACAO_PADRAO), 'amostras').etiquetas).toEqual(
      []
    );
  });

  it('a 9ª cor não existe: vira o neutro', () => {
    expect(corDoTratamento(0)).toBe('var(--color-series-1)');
    expect(corDoTratamento(TETO_DE_CORES - 1)).toBe('var(--color-series-8)');
    expect(corDoTratamento(TETO_DE_CORES)).toBe('var(--color-ink-3)');
  });
});

describe('saida', () => {
  const analise = analisar(
    [
      entrada('A', amostra('A', 0)),
      entrada('A', amostra('A', 4)),
      entrada('B', amostra('B', 30)),
      entrada('B', amostra('B', 33)),
      entrada('P', poucas),
    ],
    CONFIGURACAO_PADRAO
  );

  it('celulaNumerica: vírgula decimal, vazio para null', () => {
    expect(celulaNumerica(1.5)).toBe('1,5');
    expect(celulaNumerica(1.23456, 2)).toBe('1,23');
    expect(celulaNumerica(null)).toBe('');
    expect(celulaNumerica(undefined)).toBe('');
    expect(celulaNumerica(NaN)).toBe('');
  });

  it('o CSV tem BOM, ponto e vírgula, uma linha por amostra (inclusive a recusada) e a seção de médias com letras', () => {
    const csv = escreverCsv(analise, CONFIGURACAO_PADRAO);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const linhas = csv.slice(1).split('\r\n');
    expect(linhas[0]).toMatch(/^# uniformidade=U7525;x_para_tx=20;tmax_auc_h=168/);
    expect(linhas[1].split(';')[0]).toBe('codigo');
    expect(linhas[1].split(';')).toContain('motivo');
    const recusada = linhas.find((l) => l.startsWith('P;'));
    expect(recusada).toMatch(/germinaram 2 sementes/);
    const cabecalhoDasMedias = linhas.find((l) => l.startsWith('tratamento;n;n_ajustadas'));
    expect(cabecalhoDasMedias).toMatch(/tukey_t50MaxG;tukey_gMax;tukey_auc$/);
    const linhaA = linhas.find((l) => l.startsWith('A;2;2;'));
    expect(linhaA).toBeDefined();
    expect(
      linhaA
        ?.split(';')
        .slice(-3)
        .every((letra) => /^[a-z]+$/.test(letra))
    ).toBe(true);
    // O tratamento fora da ANOVA fica sem letra, não com letra inventada.
    const linhaP = linhas.find((l) => l.startsWith('P;1;0;'));
    expect(linhaP?.split(';').slice(-3)).toEqual(['', '', '']);
    expect(linhas.some((l) => l.startsWith('# ANOVA t50MaxG: F(1; 2)'))).toBe(true);
  });

  it('o TSV no formato da planilha tem as colunas da aba output, na ordem e com os nomes dela', () => {
    const tsv = escreverTabelaOUTPUT(analise, CONFIGURACAO_PADRAO);
    const linhas = tsv.split('\r\n');
    expect(linhas[0].split('\t')).toEqual([
      'code',
      'max hrs',
      'gMAX (%)',
      'yo',
      'a',
      'b',
      't50 maxG (Cs, hr)',
      'u7525 (hr)',
      'r2',
      '20(%seeds)',
      't20 maxG (hr)',
      'tMAX for AUC (hr)',
      'AUC',
      't50 totS   (hr)',
      't20  totS   (hr)',
      'MGT',
      't50 maxG / MGT',
    ]);
    const primeira = linhas[1].split('\t');
    expect(primeira[0]).toBe('A');
    expect(primeira[1]).toBe('168');
    expect(primeira[2]).toBe('0,8');
    expect(primeira[3]).toBe('0');
    expect(primeira).toHaveLength(17);
    const recusada = linhas.find((l) => l.startsWith('P\t'));
    expect(recusada).toMatch(/germinaram 2 sementes/);
  });

  it('a uniformidade e o x escolhidos mudam os nomes das colunas', () => {
    const tsv = escreverTabelaOUTPUT(analise, {
      ...CONFIGURACAO_PADRAO,
      uniformidade: 'u8416',
      percentualParaTx: 10,
    });
    const cabecalho = tsv.split('\r\n')[0].split('\t');
    expect(cabecalho).toContain('u8416 (hr)');
    expect(cabecalho).toContain('10(%seeds)');
    expect(cabecalho).toContain('t10 maxG (hr)');
    expect(cabecalho).toContain('t10  totS   (hr)');
  });

  it('o TSV da grade escrito a partir da análise é lido de volta (a Ceci exporta e o coautor cola)', () => {
    const amostras = analise.linhas
      .map((l) => l.amostra)
      .filter((a): a is AmostraDeGerminacao => a !== null);
    expect(lerTabelaColada(escreverTabelaINPUT(amostras)).amostras).toEqual(amostras);
  });
});
