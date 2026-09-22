// =============================================================================
// tabela.ts — a grade editável: ida e volta com amostras, célula inválida
// que derruba só a linha, edições puras e o que sobrevive ao F5.
// =============================================================================

import { describe, expect, it } from 'vitest';
import type { AmostraDeGerminacao } from '../../../lib/germinacao';
import { CONFIGURACAO_PADRAO } from '../analise';
import {
  acrescentarLinha,
  acrescentarTempo,
  editarCelula,
  editarTempo,
  entradasDaTabela,
  lerEstadoGravado,
  lerTempos,
  removerLinha,
  removerTempo,
  serializarEstado,
  tabelaDasAmostras,
  type TabelaDeEntrada,
} from '../tabela';

const amostras: AmostraDeGerminacao[] = [
  { codigo: 'T0', sementes: 50, leituras: [{ horas: 48, acumulado: 0 }, { horas: 96, acumulado: 21 }, { horas: 168, acumulado: 30 }] },
  { codigo: 'T8', sementes: 50, leituras: [{ horas: 96, acumulado: 9 }, { horas: 168, acumulado: 24 }] },
];

describe('tabelaDasAmostras e entradasDaTabela', () => {
  it('amostras → grade → entradas devolve as mesmas amostras', () => {
    const tabela = tabelaDasAmostras(amostras);
    expect(tabela.tempos).toEqual(['48', '96', '168']);
    expect(tabela.linhas[1]).toEqual({ codigo: 'T8', sementes: '50', contagens: ['', '9', '24'] });
    const { entradas, erroDosTempos } = entradasDaTabela(tabela);
    expect(erroDosTempos).toBeNull();
    expect(entradas.map((e) => e.amostra)).toEqual(amostras);
    expect(entradas.every((e) => e.erro === null)).toBe(true);
  });

  it('linhas totalmente vazias são ignoradas', () => {
    const tabela = acrescentarLinha(acrescentarLinha(tabelaDasAmostras(amostras)));
    expect(entradasDaTabela(tabela).entradas).toHaveLength(2);
  });

  it('célula de contagem inválida derruba a linha, com a mensagem, e não as outras', () => {
    const tabela = editarCelula(tabelaDasAmostras(amostras), 0, { campo: 'contagem', coluna: 1 }, 'vinte');
    const { entradas } = entradasDaTabela(tabela);
    expect(entradas[0].amostra).toBeNull();
    expect(entradas[0].erro).toMatch(/96 h/);
    expect(entradas[0].erro).toMatch(/"vinte"/);
    expect(entradas[1].amostra).not.toBeNull();
  });

  it('sementes inválido e código vazio têm mensagens próprias', () => {
    const t1 = editarCelula(tabelaDasAmostras(amostras), 0, { campo: 'sementes' }, '0');
    expect(entradasDaTabela(t1).entradas[0].erro).toMatch(/sementes inválido/);
    const t2 = editarCelula(tabelaDasAmostras(amostras), 0, { campo: 'codigo' }, '  ');
    expect(entradasDaTabela(t2).entradas[0].erro).toBe('sem código');
  });

  it('um tempo inválido invalida a grade inteira, com a coluna', () => {
    const tabela = editarTempo(tabelaDasAmostras(amostras), 1, '96h');
    const r = entradasDaTabela(tabela);
    expect(r.entradas).toEqual([]);
    expect(r.erroDosTempos).toMatch(/coluna 2/);
  });

  it('o ponto (0, 0) sai da amostra; um t = 0 com germinadas fica', () => {
    const tabela: TabelaDeEntrada = {
      tempos: ['0', '48'],
      linhas: [
        { codigo: 'A', sementes: '10', contagens: ['0', '5'] },
        { codigo: 'B', sementes: '10', contagens: ['2', '5'] },
      ],
    };
    const { entradas } = entradasDaTabela(tabela);
    expect(entradas[0].amostra?.leituras).toEqual([{ horas: 48, acumulado: 5 }]);
    expect(entradas[1].amostra?.leituras).toEqual([{ horas: 0, acumulado: 2 }, { horas: 48, acumulado: 5 }]);
  });
});

describe('lerTempos', () => {
  it('aceita crescentes, recusa fora de ordem, negativo e texto', () => {
    expect(lerTempos(['24', '48,5', '72'])).toEqual({ horas: [24, 48.5, 72], erro: null });
    expect(lerTempos(['48', '24']).erro).toMatch(/crescentes/);
    expect(lerTempos(['-1']).erro).toMatch(/negativo/);
    expect(lerTempos(['x']).erro).toMatch(/não é um número/);
    expect(lerTempos([])).toEqual({ horas: [], erro: null });
  });
});

describe('edições da grade', () => {
  const base = tabelaDasAmostras(amostras);

  it('acrescentar e remover linha', () => {
    const mais = acrescentarLinha(base);
    expect(mais.linhas).toHaveLength(3);
    expect(mais.linhas[2].contagens).toEqual(['', '', '']);
    expect(removerLinha(mais, 0).linhas.map((l) => l.codigo)).toEqual(['T8', '']);
  });

  it('acrescentar e remover tempo mantém as contagens alinhadas', () => {
    const mais = acrescentarTempo(base);
    expect(mais.tempos).toEqual(['48', '96', '168', '']);
    expect(mais.linhas.every((l) => l.contagens.length === 4)).toBe(true);
    const menos = removerTempo(mais, 0);
    expect(menos.tempos).toEqual(['96', '168', '']);
    expect(menos.linhas[0].contagens).toEqual(['21', '30', '']);
  });

  it('as edições não alteram a grade recebida', () => {
    const copia = JSON.parse(JSON.stringify(base)) as TabelaDeEntrada;
    editarCelula(base, 0, { campo: 'codigo' }, 'X');
    editarTempo(base, 0, '1');
    acrescentarTempo(base);
    removerLinha(base, 0);
    expect(base).toEqual(copia);
  });
});

describe('persistência', () => {
  it('serializar e ler são inversos', () => {
    const estado = { tabela: tabelaDasAmostras(amostras), configuracao: { ...CONFIGURACAO_PADRAO, uniformidade: 'u8416' as const, tMaxParaAuc: 504 } };
    expect(lerEstadoGravado(serializarEstado(estado))).toEqual(estado);
  });

  it('lixo devolve null, nunca lança', () => {
    expect(lerEstadoGravado(null)).toBeNull();
    expect(lerEstadoGravado('')).toBeNull();
    expect(lerEstadoGravado('não é json')).toBeNull();
    expect(lerEstadoGravado('[1]')).toBeNull();
    expect(lerEstadoGravado('{"tabela":{"tempos":["1"],"linhas":[{"codigo":"a","sementes":"1","contagens":["1","2"]}]}}')).toBeNull();
    expect(lerEstadoGravado('{"tabela":{"tempos":[1],"linhas":[]}}')).toBeNull();
  });

  it('configuração ausente ou inválida cai no padrão, campo a campo', () => {
    const lido = lerEstadoGravado('{"tabela":{"tempos":[],"linhas":[]},"configuracao":{"uniformidade":"u9999","percentualParaTx":10}}');
    expect(lido?.configuracao).toEqual({ ...CONFIGURACAO_PADRAO, percentualParaTx: 10 });
  });
});
