// =============================================================================
// Identificação do laboratório e da amostra.
//
// O que estes testes protegem é a regra da IN 40/2010: nenhum campo do Boletim
// fica em branco. Um laudo incompleto não é um laudo com lacunas — é um
// documento que não pode ser emitido, e quem tem como pegar isso antes da
// impressão é o software.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  CATEGORIAS,
  conferirParaEmissao,
  escreverEspecie,
  numeroDoBoletim,
  podeEmitir,
  type IdentificacaoDaAmostra,
  type IdentificacaoDoLaboratorio,
} from '../identificacao';

const LABORATORIO: IdentificacaoDoLaboratorio = {
  nome: 'Laboratório de Sementes e Tecido Vegetal — Unoeste',
  renasem: 'SP-00000/0000',
  portariaDeCredenciamento: 'Portaria nº 000/0000',
  endereco: 'Rod. Raposo Tavares, km 572 — Presidente Prudente, SP',
  responsavelTecnico: 'Nelson Barbosa Machado Neto',
};

const AMOSTRA: IdentificacaoDaAmostra = {
  especieNomeComum: 'soja',
  especieNomeCientifico: 'Glycine max',
  lote: 'L-2026-014',
  categoria: 'C2',
  numeroDaAmostra: '0411',
  dataDeRecebimento: '2026-03-11',
};

describe('numeração do boletim', () => {
  it('é sequencial com quatro dígitos e o ano', () => {
    expect(numeroDoBoletim(411, 2026)).toBe('0411/2026');
    expect(numeroDoBoletim(1, 2026)).toBe('0001/2026');
  });

  it('o ano faz parte da identidade, porque a série reinicia', () => {
    // 0411/2025 e 0411/2026 são documentos diferentes. Sem o ano, o mesmo
    // número apontaria para dois laudos.
    expect(numeroDoBoletim(411, 2025)).not.toBe(numeroDoBoletim(411, 2026));
  });

  it('não trunca sequencial que passa de quatro dígitos', () => {
    expect(numeroDoBoletim(12345, 2026)).toBe('12345/2026');
  });
});

describe('conferência antes de emitir', () => {
  it('com laboratório e amostra completos, pode emitir', () => {
    expect(conferirParaEmissao(LABORATORIO, AMOSTRA)).toEqual([]);
    expect(podeEmitir(LABORATORIO, AMOSTRA)).toBe(true);
  });

  it('sem nada preenchido, aponta tudo o que falta', () => {
    const faltando = conferirParaEmissao(undefined, undefined);
    expect(faltando.length).toBeGreaterThan(0);
    expect(podeEmitir(undefined, undefined)).toBe(false);
  });

  it('devolve QUAIS campos faltam, não só que falta algo', () => {
    // Dizer "está incompleto" sem dizer o quê obriga a pessoa a caçar o campo.
    const faltando = conferirParaEmissao({ ...LABORATORIO, renasem: '' }, AMOSTRA);
    expect(faltando).toHaveLength(1);
    expect(faltando[0].campo).toBe('laboratorio.renasem');
    expect(faltando[0].descricao).toMatch(/RENASEM/);
  });

  it('campo só com espaços conta como em branco', () => {
    const faltando = conferirParaEmissao(LABORATORIO, { ...AMOSTRA, lote: '   ' });
    expect(faltando.map((p) => p.campo)).toContain('amostra.lote');
  });

  it('exige o Responsável Técnico — o laudo é assinado por uma pessoa', () => {
    // O software não assume responsabilidade técnica. Nunca.
    const faltando = conferirParaEmissao({ ...LABORATORIO, responsavelTecnico: '' }, AMOSTRA);
    expect(faltando.map((p) => p.campo)).toContain('laboratorio.responsavelTecnico');
  });

  it('exige a categoria, que não é texto livre', () => {
    const semCategoria = { ...AMOSTRA };
    delete semCategoria.categoria;
    const faltando = conferirParaEmissao(LABORATORIO, semCategoria);
    expect(faltando.map((p) => p.campo)).toContain('amostra.categoria');
  });

  it('exige nome científico, não só o nome comum', () => {
    // "soja" identifica no balcão; Glycine max identifica no boletim.
    const faltando = conferirParaEmissao(LABORATORIO, {
      ...AMOSTRA,
      especieNomeCientifico: undefined,
    });
    expect(faltando.map((p) => p.campo)).toContain('amostra.especieNomeCientifico');
  });

  it('não exige o que a norma deixa opcional', () => {
    // Cultivar, safra, peneira e procedência não bloqueiam a emissão.
    expect(conferirParaEmissao(LABORATORIO, AMOSTRA)).toEqual([]);
  });
});

describe('categorias', () => {
  it('são as cinco do sistema brasileiro', () => {
    expect(Object.keys(CATEGORIAS)).toEqual(['basica', 'C1', 'C2', 'S1', 'S2']);
  });

  it('cada uma tem rótulo legível', () => {
    expect(CATEGORIAS.basica).toBe('Básica');
    expect(CATEGORIAS.C2).toMatch(/segunda geração/);
  });
});

describe('escrita da espécie', () => {
  it('nome comum em caixa alta, científico entre parênteses', () => {
    expect(escreverEspecie(AMOSTRA)).toBe('SOJA (Glycine max)');
  });

  it('aguenta ter só um dos dois', () => {
    expect(escreverEspecie({ especieNomeComum: 'soja' })).toBe('SOJA');
    expect(escreverEspecie({ especieNomeCientifico: 'Glycine max' })).toBe('Glycine max');
    expect(escreverEspecie({})).toBe('');
  });

  it('não mexe na capitalização do nome científico', () => {
    // Gênero maiúsculo, epíteto minúsculo — é regra de nomenclatura, não estilo.
    expect(escreverEspecie({ especieNomeCientifico: 'Urochloa brizantha' })).toBe(
      'Urochloa brizantha'
    );
  });
});
