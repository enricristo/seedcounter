// =============================================================================
// A parte pura dos exemplos (`metadados-do-exemplo.ts`): o que dá para provar
// em node, sem canvas nem `fetch`.
//
// O que se protege: a extração de `App.tsx` prometeu que o metadado proposto
// por um exemplo é o MESMO de antes. Os blocos `ANTIGO_*` abaixo são o
// literal que `handleCarregarExemplo`/`handleCarregarExemploReal` montavam
// dentro do `setMetadata(prev => ...)`, copiados do App antes da extração —
// não derivados do código novo — comparados por `toEqual`.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { metadadosDaCena, metadadosDoExemploReal } from '../metadados-do-exemplo';
import { AVISO_CENA } from '../../../lib/synthetic-scene';
import type { Metadata } from '../../../types';

const PREV: Metadata = {
  researcher: 'Ana',
  project: 'projeto antigo',
  treatment: 'T2',
  plate: '5',
  quadrant: 'Q1',
  notes: 'nota antiga',
  baselineCount: 0,
  useDifferential: false,
  umPerPixel: 99,
  dataset: { conjunto: 'Sementes de Soja', caminho: 'train/img01.png' },
  amostra: { especieNomeCientifico: 'Glycine max', procedencia: 'lote antigo' },
};

describe('metadadosDaCena — o que handleCarregarExemplo montava', () => {
  it('é, campo a campo, o objeto que o App montava', () => {
    // Formato antigo, copiado de `handleCarregarExemplo` (App.tsx, antes da
    // extração):
    //   setMetadata((prev) => ({
    //     ...prev, project: projeto, treatment: '', plate: '', quadrant: '',
    //     notes: AVISO_CENA, umPerPixel: cena.umPorPixel, dataset: undefined,
    //   }))
    const ANTIGO: Metadata = {
      ...PREV,
      project: '[DEMO] Soja · 40 sementes, 90% viáveis',
      treatment: '',
      plate: '',
      quadrant: '',
      notes: AVISO_CENA,
      umPerPixel: 26.7,
      dataset: undefined,
    };
    const novo = metadadosDaCena(PREV, { umPorPixel: 26.7 }, '[DEMO] Soja · 40 sementes, 90% viáveis');
    expect(novo).toEqual(ANTIGO);
  });

  it('apaga o vínculo de dataset da imagem anterior', () => {
    const novo = metadadosDaCena(PREV, { umPorPixel: 10 }, 'projeto');
    expect(novo.dataset).toBeUndefined();
  });

  it('a escala é a que a cena declara — nunca a que já estava', () => {
    const novo = metadadosDaCena(PREV, { umPorPixel: 7.06 }, 'projeto');
    expect(novo.umPerPixel).toBe(7.06);
  });

  it('não muda o que a cena não fala nada sobre (pesquisador, amostra)', () => {
    const novo = metadadosDaCena(PREV, { umPorPixel: 10 }, 'projeto');
    expect(novo.researcher).toBe('Ana');
    expect(novo.amostra).toEqual(PREV.amostra);
  });
});

describe('metadadosDoExemploReal — o que handleCarregarExemploReal montava', () => {
  it('é, campo a campo, o objeto que o App montava', () => {
    // Formato antigo, copiado de `handleCarregarExemploReal` (App.tsx, antes
    // da extração):
    //   setMetadata((prev) => ({
    //     ...prev, ...metadados, plate: '', quadrant: '', dataset: undefined,
    //     amostra: { ...prev.amostra, ...metadados.amostra },
    //   }))
    const metadados: Partial<Metadata> = {
      project: 'Dataset X',
      treatment: 'with mold',
      notes: 'Exemplo real: Amendoim com mofo. Origem: Dataset X.',
      umPerPixel: 42.3,
      imageSource: 'other',
      amostra: { especieNomeComum: 'Amendoim', procedencia: 'Dataset X' },
    };
    const ANTIGO: Metadata = {
      ...PREV,
      ...metadados,
      plate: '',
      quadrant: '',
      dataset: undefined,
      amostra: { ...PREV.amostra, ...metadados.amostra },
    };
    const novo = metadadosDoExemploReal(PREV, metadados);
    expect(novo).toEqual(ANTIGO);
  });

  it('amostra é mesclada campo a campo, não substituída', () => {
    // O exemplo real só fala de nome comum e procedência; o nome científico
    // que já estava (de outra imagem) tem de sobreviver.
    const novo = metadadosDoExemploReal(PREV, {
      amostra: { especieNomeComum: 'Amendoim' },
    });
    expect(novo.amostra).toEqual({
      especieNomeCientifico: 'Glycine max',
      procedencia: 'lote antigo',
      especieNomeComum: 'Amendoim',
    });
  });

  it('o que o exemplo não conhece fica vazio, não herdado — quando o exemplo não declara o campo', () => {
    // `umPerPixel` ausente em `metadados` não sobrescreve o que já estava,
    // porque o spread de `undefined` numa chave ausente não apaga a anterior.
    const novo = metadadosDoExemploReal(PREV, { project: 'Dataset Y' });
    expect(novo.umPerPixel).toBe(99);
  });

  it('sem escala conhecida, `umPerPixel` vira undefined (o exemplo declara o campo, vazio)', () => {
    const novo = metadadosDoExemploReal(PREV, { project: 'Dataset Y', umPerPixel: undefined });
    expect(novo.umPerPixel).toBeUndefined();
  });

  it('apaga o vínculo de dataset da imagem anterior', () => {
    const novo = metadadosDoExemploReal(PREV, { project: 'Dataset Y' });
    expect(novo.dataset).toBeUndefined();
  });
});
