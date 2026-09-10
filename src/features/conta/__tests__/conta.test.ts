// =============================================================================
// A conta, e o que ela sincroniza.
//
// Duas regras protegidas aqui: o servidor guarda JSON livre e NAO pode
// contaminar a calibracao com lixo; e a preferencia da conta NUNCA sobrescreve
// o que a pessoa ja digitou — quem esta na frente da tela sabe mais que o
// servidor.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  aplicarPreferencia,
  extrairPreferencia,
  lerPreferencia,
  mesmaPreferencia,
} from '../conta';
import type { Metadata } from '../../../types';

const BASE: Metadata = {
  researcher: '',
  project: '',
  treatment: '',
  plate: '',
  quadrant: '',
  notes: '',
};

describe('lerPreferencia — o servidor guarda JSON livre', () => {
  it('le o que reconhece', () => {
    const p = lerPreferencia({
      especieNomeCientifico: 'Glycine max',
      umPerPixel: 21.2,
      pesquisador: 'Mayara',
    });
    expect(p).toEqual({
      especieNomeCientifico: 'Glycine max',
      umPerPixel: 21.2,
      pesquisador: 'Mayara',
    });
  });

  it('RECUSA escala invalida — nao pode chegar ate a calibracao', () => {
    expect(lerPreferencia({ umPerPixel: 'abc' }).umPerPixel).toBeUndefined();
    expect(lerPreferencia({ umPerPixel: -5 }).umPerPixel).toBeUndefined();
    expect(lerPreferencia({ umPerPixel: NaN }).umPerPixel).toBeUndefined();
    expect(lerPreferencia({ umPerPixel: 0 }).umPerPixel).toBeUndefined();
  });

  it('recusa protocolo que nao existe', () => {
    expect(lerPreferencia({ protocolo: 'invent' }).protocolo).toBeUndefined();
    expect(lerPreferencia({ protocolo: 'forrageira' }).protocolo).toBe('forrageira');
  });

  it('ignora chave desconhecida em vez de repassar', () => {
    const p = lerPreferencia({ default_species: 'x', qualquerCoisa: 1 });
    expect(p).toEqual({});
  });

  it('ignora texto vazio', () => {
    expect(lerPreferencia({ pesquisador: '   ' })).toEqual({});
  });

  it('aguenta nulo e lixo', () => {
    expect(lerPreferencia(null)).toEqual({});
    expect(lerPreferencia(undefined)).toEqual({});
  });
});

describe('extrairPreferencia — so o que esta preenchido', () => {
  it('nao manda campo vazio, para nao apagar o que estava salvo', () => {
    // Uma bancada com campo vazio nao deve apagar no servidor o que a pessoa
    // tinha salvo de outra maquina.
    expect(extrairPreferencia(BASE)).toEqual({});
  });

  it('extrai do mesmo lugar que o boletim le', () => {
    const p = extrairPreferencia({
      ...BASE,
      researcher: 'Mayara',
      umPerPixel: 7.06,
      amostra: { especieNomeCientifico: 'Cattleya labiata', especieNomeComum: 'Orquídea' },
    });
    expect(p.especieNomeCientifico).toBe('Cattleya labiata');
    expect(p.especieNomeComum).toBe('Orquídea');
    expect(p.umPerPixel).toBe(7.06);
    expect(p.pesquisador).toBe('Mayara');
  });
});

describe('aplicarPreferencia — preenche o vazio, nunca sobrescreve', () => {
  it('preenche o que esta vazio', () => {
    const m = aplicarPreferencia(BASE, {
      especieNomeCientifico: 'Glycine max',
      umPerPixel: 21.2,
      pesquisador: 'Mayara',
    });
    expect(m.amostra?.especieNomeCientifico).toBe('Glycine max');
    expect(m.umPerPixel).toBe(21.2);
    expect(m.researcher).toBe('Mayara');
  });

  it('NAO sobrescreve o que a pessoa ja digitou', () => {
    // Quem esta na frente da tela sabe mais que o servidor.
    const m = aplicarPreferencia(
      {
        ...BASE,
        researcher: 'Nelson',
        umPerPixel: 7.06,
        amostra: { especieNomeCientifico: 'Cattleya labiata' },
      },
      { especieNomeCientifico: 'Glycine max', umPerPixel: 21.2, pesquisador: 'Mayara' }
    );
    expect(m.amostra?.especieNomeCientifico).toBe('Cattleya labiata');
    expect(m.umPerPixel).toBe(7.06);
    expect(m.researcher).toBe('Nelson');
  });

  it('preferencia vazia nao muda nada', () => {
    const m = { ...BASE, researcher: 'Nelson' };
    expect(aplicarPreferencia(m, {})).toEqual(m);
  });

  it('nao cria `amostra` do nada quando nao ha o que por nela', () => {
    expect(aplicarPreferencia(BASE, { pesquisador: 'x' }).amostra).toBeUndefined();
  });
});

describe('ida e volta', () => {
  it('extrair depois de aplicar devolve a mesma preferencia', () => {
    const p = { especieNomeCientifico: 'Glycine max', umPerPixel: 21.2, pesquisador: 'Mayara' };
    expect(extrairPreferencia(aplicarPreferencia(BASE, p))).toEqual(p);
  });

  it('mesmaPreferencia evita gravar o que nao mudou', () => {
    const a = { especieNomeCientifico: 'x', umPerPixel: 1 };
    expect(mesmaPreferencia(a, { ...a })).toBe(true);
    expect(mesmaPreferencia(a, { ...a, umPerPixel: 2 })).toBe(false);
    expect(mesmaPreferencia({}, {})).toBe(true);
  });
});
