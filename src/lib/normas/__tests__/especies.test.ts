// =============================================================================
// Espécie conhecida como contexto de bancada (C7).
//
// O que este teste protege: a união de `PERFIS_BIOMETRICOS` e `TAMANHOS` não
// duplica espécie nenhuma, a orquídea carrega o "jeito de digitalizar" e o
// protocolo de germinação, as forrageiras carregam o protocolo de forrageira,
// e a busca — que alimenta o popover do chip — acha por qualquer um dos
// nomes, sem acento e sem caixa, e inclui as extras ad hoc sem duplicar o que
// já é conhecido.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { ESPECIES_CONHECIDAS, buscarEspecies, especieAtual } from '../especies';
import { DEFAULT_LAB_DPI } from '../../calibration';

describe('ESPECIES_CONHECIDAS', () => {
  it('não repete espécie por nome comum normalizado', () => {
    const chaves = ESPECIES_CONHECIDAS.map((e) => e.nomeComum.trim().toLowerCase());
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('inclui soja, orquídea e as forrageiras', () => {
    const ids = ESPECIES_CONHECIDAS.map((e) => e.id);
    expect(ids).toContain('soja');
    expect(ids).toContain('orquidea');
    expect(ids).toContain('urochloa');
  });

  it('inclui abóbora, que só está em PERFIS_BIOMETRICOS', () => {
    expect(ESPECIES_CONHECIDAS.some((e) => e.id === 'abobora')).toBe(true);
  });

  it('a orquídea tem aquisição típica no scanner do laboratório, no DPI padrão', () => {
    const orquidea = ESPECIES_CONHECIDAS.find((e) => e.id === 'orquidea');
    expect(orquidea?.aquisicaoTipica).toEqual({ equipamentoId: 'scanjet-g2710', dpi: DEFAULT_LAB_DPI });
    expect(orquidea?.protocoloSugerido).toBe('germinacao');
  });

  it('as forrageiras sugerem protocolo de forrageira', () => {
    for (const chave of ['urochloa', 'panicum', 'stylosanthes']) {
      const especie = ESPECIES_CONHECIDAS.find((e) => e.id === chave);
      expect(especie?.protocoloSugerido, chave).toBe('forrageira');
    }
  });

  it('soja não tem protocolo nem aquisição sugeridos — não há o que sugerir', () => {
    const soja = ESPECIES_CONHECIDAS.find((e) => e.id === 'soja');
    expect(soja?.protocoloSugerido).toBeUndefined();
    expect(soja?.aquisicaoTipica).toBeUndefined();
  });
});

describe('buscarEspecies', () => {
  it('texto vazio devolve todas as conhecidas', () => {
    const resultado = buscarEspecies('');
    expect(resultado.length).toBeGreaterThanOrEqual(ESPECIES_CONHECIDAS.length);
  });

  it('acha sem acento e sem caixa', () => {
    const porComum = buscarEspecies('ORQUIDEA');
    expect(porComum.some((e) => 'id' in e && e.id === 'orquidea')).toBe(true);

    const porCientifico = buscarEspecies('glycine');
    expect(porCientifico.some((e) => 'id' in e && e.id === 'soja')).toBe(true);
  });

  it('inclui as extras que não batem com nenhuma conhecida', () => {
    const resultado = buscarEspecies('cattleya', ['Cattleya walkeriana']);
    expect(resultado).toEqual([{ nomeComum: 'Cattleya walkeriana' }]);
  });

  it('não duplica uma extra que já é uma espécie conhecida', () => {
    const resultado = buscarEspecies('soja', ['Soja', 'soja']);
    const ocorrencias = resultado.filter((e) => 'nomeComum' in e && /soja/i.test(e.nomeComum));
    expect(ocorrencias).toHaveLength(1);
    expect('id' in ocorrencias[0]).toBe(true);
  });

  it('ignora extras vazias ou só de espaço', () => {
    const resultado = buscarEspecies('', ['', '   ']);
    expect(resultado.length).toBe(ESPECIES_CONHECIDAS.length);
  });
});

describe('especieAtual', () => {
  it('sem amostra declarada, devolve null', () => {
    expect(especieAtual({})).toBeNull();
    expect(especieAtual({ amostra: {} })).toBeNull();
  });

  it('resolve para a espécie conhecida quando o nome comum bate', () => {
    const atual = especieAtual({ amostra: { especieNomeComum: 'Soja' } });
    expect(atual && 'id' in atual && atual.id).toBe('soja');
  });

  it('resolve para a espécie conhecida quando só o nome científico bate', () => {
    const atual = especieAtual({ amostra: { especieNomeCientifico: 'Glycine max' } });
    expect(atual && 'id' in atual && atual.id).toBe('soja');
  });

  it('nome declarado fora da tabela devolve só o nome, sem inventar espécie', () => {
    const atual = especieAtual({ amostra: { especieNomeComum: 'Cattleya walkeriana' } });
    expect(atual).toEqual({ nomeComum: 'Cattleya walkeriana' });
  });
});
