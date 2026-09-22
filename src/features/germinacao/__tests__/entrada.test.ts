// =============================================================================
// entrada.ts — colar a aba INPUT, escrever de volta, e a ponte do longitudinal.
//
// O teste de aceitação é a fixture real: as 24 amostras do Llanero
// reconstruídas como o Excel colaria (tabulação, vírgula decimal onde o Excel
// em português a poria) têm que virar exatamente as amostras que o oráculo
// do núcleo usa.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { doLongitudinal, escreverTabelaINPUT, lerNumero, lerTabelaColada, motivoParaNaoImportar } from '../entrada';
import type { AmostraDeGerminacao } from '../../../lib/germinacao';
import type { Experiment } from '../../../types';

interface Fixture {
  tempos_h: number[];
  amostras: { codigo: string; sementes: number; contagens: number[] }[];
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'lib', 'germinacao', '__tests__', 'fixtures', 'germinator-llanero.json'), 'utf8'),
) as Fixture;

/** A aba INPUT como o Excel a cola: `t`, célula vazia, tempos; depois código, sementes, contagens. */
function fixtureComoTsv(decimal: '.' | ',' = '.'): string {
  const n = (v: number) => String(v).replace('.', decimal);
  const cabecalho = ['t', '', ...fixture.tempos_h.map(n)].join('\t');
  const linhas = fixture.amostras.map((a) => [a.codigo, n(a.sementes), ...a.contagens.map(n)].join('\t'));
  return [cabecalho, ...linhas].join('\r\n') + '\r\n';
}

const amostrasEsperadas: AmostraDeGerminacao[] = fixture.amostras.map((a) => ({
  codigo: a.codigo,
  sementes: a.sementes,
  leituras: fixture.tempos_h.map((horas, k) => ({ horas, acumulado: a.contagens[k] })),
}));

describe('lerNumero', () => {
  it('lê inteiro, decimal com ponto e decimal com vírgula', () => {
    expect(lerNumero('21')).toBe(21);
    expect(lerNumero(' 21.5 ')).toBe(21.5);
    expect(lerNumero('21,5')).toBe(21.5);
    expect(lerNumero('1e3')).toBe(1000);
    expect(lerNumero('-2')).toBe(-2);
  });

  it('devolve null para vazio, texto e formato ambíguo', () => {
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('   ')).toBeNull();
    expect(lerNumero('abc')).toBeNull();
    expect(lerNumero('1.234,5')).toBeNull();
    expect(lerNumero('21 sementes')).toBeNull();
  });
});

describe('lerTabelaColada — a fixture como TSV', () => {
  it('lê as 24 amostras do Llanero exatamente como o oráculo as usa', () => {
    const r = lerTabelaColada(fixtureComoTsv());
    expect(r.erro).toBeNull();
    expect(r.amostras).toEqual(amostrasEsperadas);
  });

  it('aceita vírgula decimal, que é o que o Excel em português cola', () => {
    const r = lerTabelaColada(fixtureComoTsv(','));
    expect(r.erro).toBeNull();
    expect(r.amostras).toEqual(amostrasEsperadas);
  });

  it('aceita o cabeçalho com "code" e "# seeds" antes dos tempos', () => {
    const texto = ['code\t# seeds\t48\t96\t168', 'T0\t50\t0\t21\t30'].join('\n');
    const r = lerTabelaColada(texto);
    expect(r.amostras).toEqual([
      { codigo: 'T0', sementes: 50, leituras: [{ horas: 48, acumulado: 0 }, { horas: 96, acumulado: 21 }, { horas: 168, acumulado: 30 }] },
    ]);
  });

  it('aceita ponto e vírgula como separador quando não há tabulação', () => {
    const texto = 't;;48;96;168\nT0;50;0;21;30\n';
    const r = lerTabelaColada(texto);
    expect(r.erro).toBeNull();
    expect(r.amostras?.[0].leituras.map((l) => l.acumulado)).toEqual([0, 21, 30]);
  });

  it('ignora linhas em branco no meio e no fim, e colunas vazias além da última', () => {
    const texto = ['', 't\t\t48\t96\t168\t\t', 'T0\t50\t0\t21\t30\t\t', '', 'T8\t50\t0\t9\t24', '\t\t', ''].join('\r\n');
    const r = lerTabelaColada(texto);
    expect(r.erro).toBeNull();
    expect(r.amostras?.map((a) => a.codigo)).toEqual(['T0', 'T8']);
  });

  it('célula de contagem vazia é "sem leitura nesse tempo", não zero', () => {
    const texto = 't\t\t48\t96\t168\nT0\t50\t0\t\t30\n';
    const r = lerTabelaColada(texto);
    expect(r.amostras?.[0].leituras).toEqual([
      { horas: 48, acumulado: 0 },
      { horas: 168, acumulado: 30 },
    ]);
  });
});

describe('lerTabelaColada — erros que dizem a linha e o que esperavam', () => {
  it('texto vazio', () => {
    expect(lerTabelaColada('').erro).toMatch(/vazio/);
    expect(lerTabelaColada('\n\n  \n').erro).toMatch(/vazio/);
  });

  it('cabeçalho sem número nenhum', () => {
    const r = lerTabelaColada('code\tseeds\thoras\nT0\t50\t1\n');
    expect(r.amostras).toBeNull();
    expect(r.erro).toMatch(/^Linha 1:/);
    expect(r.erro).toMatch(/tempos em horas/);
  });

  it('tempos fora de ordem', () => {
    const r = lerTabelaColada('t\t\t96\t48\nT0\t50\t1\t2\n');
    expect(r.erro).toMatch(/^Linha 1:/);
    expect(r.erro).toMatch(/crescentes/);
    expect(r.erro).toMatch(/96 vem antes de 48/);
  });

  it('linha sem código diz a linha', () => {
    const r = lerTabelaColada('t\t\t48\t96\nT0\t50\t1\t2\n\t50\t1\t2\n');
    expect(r.erro).toMatch(/^Linha 3:/);
    expect(r.erro).toMatch(/código/);
  });

  it('sementes que não é número diz a linha, o código e o que encontrou', () => {
    const r = lerTabelaColada('t\t\t48\t96\nT0\tcinquenta\t1\t2\n');
    expect(r.erro).toMatch(/^Linha 2 \(T0\):/);
    expect(r.erro).toMatch(/número de sementes/);
    expect(r.erro).toMatch(/"cinquenta"/);
  });

  it('sementes zero ou negativo é inválido', () => {
    expect(lerTabelaColada('t\t\t48\t96\nT0\t0\t1\t2\n').erro).toMatch(/número de sementes/);
    expect(lerTabelaColada('t\t\t48\t96\nT0\t-5\t1\t2\n').erro).toMatch(/número de sementes/);
  });

  it('contagem que não é número diz a linha, o tempo e o que encontrou', () => {
    const r = lerTabelaColada('t\t\t48\t96\nT0\t50\t1\tdois\n');
    expect(r.erro).toMatch(/^Linha 2 \(T0\), tempo 96 h:/);
    expect(r.erro).toMatch(/"dois"/);
  });

  it('mais contagens do que tempos', () => {
    const r = lerTabelaColada('t\t\t48\t96\nT0\t50\t1\t2\t3\n');
    expect(r.erro).toMatch(/^Linha 2 \(T0\):/);
    expect(r.erro).toMatch(/3 contagens/);
    expect(r.erro).toMatch(/2 tempos/);
  });

  it('linha só com código e sementes, sem contagem nenhuma', () => {
    const r = lerTabelaColada('t\t\t48\t96\nT0\t50\n');
    expect(r.erro).toMatch(/^Linha 2 \(T0\):/);
    expect(r.erro).toMatch(/nenhuma contagem/);
  });

  it('só o cabeçalho', () => {
    expect(lerTabelaColada('t\t\t48\t96\n').erro).toMatch(/nenhuma linha de amostra/);
  });

  it('a numeração conta as linhas em branco iniciais, para bater com o Excel', () => {
    const r = lerTabelaColada('\n\nt\t\t48\t96\nT0\t50\t1\tx\n');
    expect(r.erro).toMatch(/^Linha 4/);
  });
});

describe('escreverTabelaINPUT', () => {
  it('escreve a grade que lerTabelaColada lê de volta (ida e volta)', () => {
    const texto = escreverTabelaINPUT(amostrasEsperadas);
    expect(texto.split('\r\n')[0]).toBe('t\t\t48\t96\t168\t240\t336\t408\t504');
    expect(lerTabelaColada(texto).amostras).toEqual(amostrasEsperadas);
  });

  it('usa a união dos tempos e deixa vazio onde a amostra não leu', () => {
    const amostras: AmostraDeGerminacao[] = [
      { codigo: 'A', sementes: 10, leituras: [{ horas: 24, acumulado: 1 }, { horas: 72, acumulado: 5 }] },
      { codigo: 'B', sementes: 20, leituras: [{ horas: 48, acumulado: 2 }, { horas: 72, acumulado: 9 }] },
    ];
    const texto = escreverTabelaINPUT(amostras);
    expect(texto).toBe('t\t\t24\t48\t72\r\nA\t10\t1\t\t5\r\nB\t20\t\t2\t9\r\n');
    expect(lerTabelaColada(texto).amostras).toEqual(amostras);
  });

  it('escreve decimais com vírgula', () => {
    const texto = escreverTabelaINPUT([{ codigo: 'A', sementes: 10, leituras: [{ horas: 1.5, acumulado: 1 }] }]);
    expect(texto).toBe('t\t\t1,5\r\nA\t10\t1\r\n');
  });
});

function experimento(parcial: Partial<Experiment>): Experiment {
  return {
    id: 'e1',
    name: 'Ensaio',
    species: 'Cattleya',
    seedLot: 'L1',
    responsible: '',
    institution: '',
    cultureMedia: 'KC',
    seedsPerPlate: 100,
    replicates: 3,
    sowingDate: '2026-01-01',
    evaluationDays: [0, 14, 30],
    createdAt: '2026-01-01',
    treatments: [],
    ...parcial,
  };
}

const placa = (dayIndex: number, germinatedSeeds: number, totalSeeds: number) => ({
  dayIndex,
  evaluationDate: '2026-01-15',
  totalSeeds,
  germinatedSeeds,
  stageDistribution: {},
  contamination: 'none' as const,
  status: 'active' as const,
});

describe('doLongitudinal', () => {
  it('uma amostra por tratamento, dias × 24, acumulado do dia', () => {
    const exp = experimento({
      treatments: [
        { id: 't1', experimentId: 'e1', name: 'Controle', code: 'C', plates: [placa(14, 10, 100), placa(30, 40, 100), placa(45, 55, 100)] },
        { id: 't2', experimentId: 'e1', name: 'Sacarose', code: 'S', plates: [placa(30, 60, 100), placa(14, 20, 100)] },
      ],
    });
    expect(doLongitudinal(exp)).toEqual([
      { codigo: 'C', sementes: 100, leituras: [{ horas: 336, acumulado: 10 }, { horas: 720, acumulado: 40 }, { horas: 1080, acumulado: 55 }] },
      { codigo: 'S', sementes: 100, leituras: [{ horas: 336, acumulado: 20 }, { horas: 720, acumulado: 60 }] },
    ]);
  });

  it('soma as avaliações do mesmo dia (várias placas) e usa o maior total como sementes', () => {
    const exp = experimento({
      treatments: [
        { id: 't1', experimentId: 'e1', name: 'C', code: 'C', plates: [placa(14, 10, 100), placa(14, 12, 100), placa(30, 50, 100)] },
      ],
    });
    expect(doLongitudinal(exp)).toEqual([
      { codigo: 'C', sementes: 200, leituras: [{ horas: 336, acumulado: 22 }, { horas: 720, acumulado: 50 }] },
    ]);
  });

  it('remove o dia zero sem germinadas — é a origem que a curva já assume', () => {
    const exp = experimento({
      treatments: [{ id: 't1', experimentId: 'e1', name: 'C', code: 'C', plates: [placa(0, 0, 100), placa(14, 10, 100)] }],
    });
    expect(doLongitudinal(exp)[0].leituras).toEqual([{ horas: 336, acumulado: 10 }]);
  });

  it('tratamento sem avaliação fica de fora; sem código usa o nome', () => {
    const exp = experimento({
      treatments: [
        { id: 't1', experimentId: 'e1', name: 'Vazio', code: 'V', plates: [] },
        { id: 't2', experimentId: 'e1', name: 'Sem código', code: '', plates: [placa(14, 10, 100)] },
      ],
    });
    expect(doLongitudinal(exp).map((a) => a.codigo)).toEqual(['Sem código']);
  });

  it('experimento de armazenamento não é importável, e diz por quê', () => {
    const exp = experimento({
      timeAxis: 'armazenamento',
      treatments: [{ id: 't1', experimentId: 'e1', name: 'C', code: 'C', plates: [placa(14, 10, 100)] }],
    });
    expect(motivoParaNaoImportar(exp)).toMatch(/armazenamento/);
    expect(doLongitudinal(exp)).toEqual([]);
  });

  it('experimento sem avaliação nenhuma não é importável', () => {
    const exp = experimento({ treatments: [{ id: 't1', experimentId: 'e1', name: 'C', code: 'C', plates: [] }] });
    expect(motivoParaNaoImportar(exp)).toMatch(/nenhuma avaliação/);
    expect(motivoParaNaoImportar(experimento({ treatments: [{ id: 't1', experimentId: 'e1', name: 'C', code: 'C', plates: [placa(14, 1, 10)] }] }))).toBeNull();
  });
});
