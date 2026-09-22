// =============================================================================
// A parte pura do explorador de datasets (`referencia.ts`): o que dá para
// provar em node, sem `Date.now()` do relógio real nem estado do React.
//
// O que se protege: a extração de `App.tsx` prometeu que "Carregar
// referência" produz o MESMO contorno e a MESMA marca de antes. Os
// mapeamentos abaixo são cópia do que `handleCarregarReferencia` montava
// dentro do App, comparados por `toEqual`.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { normalizarClasseExterna, objetosDaReferencia, podeCarregarReferencia } from '../referencia';
import { calculateSeedDimensions } from '../../../lib/pca-utils';
import type { AnotacaoCarregada } from '../anotacao';

describe('normalizarClasseExterna', () => {
  it.each(['viável', 'viavel', 'viable', 'Viavel'])(
    'nome viável (%s) usa a taxonomia do app',
    (nome) => {
      expect(normalizarClasseExterna(nome)).toEqual({ category: 'viable', class_name: 'viavel' });
    }
  );

  it.each(['inviável', 'inviavel', 'inviable', 'Inviavel'])(
    'nome inviável (%s) usa a taxonomia do app',
    (nome) => {
      expect(normalizarClasseExterna(nome)).toEqual({ category: 'inviable', class_name: 'inviavel' });
    }
  );

  it('nome que não é nem viável nem inviável cai em classeExterna, cru', () => {
    expect(normalizarClasseExterna('amendoim com mofo')).toEqual({
      category: 'viable',
      class_name: 'viavel',
      classeExterna: 'amendoim com mofo',
    });
  });
});

describe('objetosDaReferencia — o que handleCarregarReferencia montava', () => {
  const POLIGONO: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 4],
    [0, 4],
  ];
  const { width, height } = calculateSeedDimensions(POLIGONO);

  const ANOTACAO: AnotacaoCarregada = {
    contornos: [
      { poligono: POLIGONO, classe: 'viavel' },
      { poligono: POLIGONO, classe: 'amendoim com mofo' },
    ],
    marcas: [{ x: 5, y: 5, classe: 'inviavel' }],
    classes: ['viavel', 'inviavel'],
  };

  it('é, campo a campo, o que o App montava (formato ANTIGO, copiado de `handleCarregarReferencia`)', () => {
    // ANTIGO:
    //   anotacaoAtual.contornos.map((c, i) => ({
    //     id: Date.now() + i, category, class_name, confidence: 1,
    //     polygon_points: c.poligono, visible: true, width, height,
    //     origem: 'referencia', ...(classeExterna ? { classeExterna } : {}),
    //   }))
    //   anotacaoAtual.marcas.map((m, i) => ({
    //     id: Date.now() + i + 1, x: m.x, y: m.y, type: category,
    //     origem: 'referencia' as const,
    //   }))
    const AGORA = 1_700_000_000_000;
    const { segmentacoes, marcas } = objetosDaReferencia(ANOTACAO, AGORA);

    expect(segmentacoes).toEqual([
      {
        id: AGORA + 0,
        category: 'viable',
        class_name: 'viavel',
        confidence: 1,
        polygon_points: POLIGONO,
        visible: true,
        width,
        height,
        origem: 'referencia',
      },
      {
        id: AGORA + 1,
        category: 'viable',
        class_name: 'viavel',
        confidence: 1,
        polygon_points: POLIGONO,
        visible: true,
        width,
        height,
        origem: 'referencia',
        classeExterna: 'amendoim com mofo',
      },
    ]);

    expect(marcas).toEqual([
      {
        id: AGORA + 0 + 1,
        x: 5,
        y: 5,
        type: 'inviable',
        origem: 'referencia',
      },
    ]);
  });

  it('ids de contorno e marca podem colidir — comportamento antigo, reproduzido de propósito', () => {
    // 2 contornos (ids agora+0, agora+1) e 1 marca (id agora+0+1 = agora+1):
    // contorno[1] e marca[0] nascem com o MESMO id. Não é conserto desta
    // extração — ver o cabeçalho de `referencia.ts`.
    const AGORA = 42;
    const { segmentacoes, marcas } = objetosDaReferencia(ANOTACAO, AGORA);
    expect(segmentacoes[1].id).toBe(marcas[0].id);
  });

  it('sem contornos, devolve lista de segmentações vazia (não undefined)', () => {
    const { segmentacoes } = objetosDaReferencia({ marcas: ANOTACAO.marcas, classes: [] }, 1);
    expect(segmentacoes).toEqual([]);
  });

  it('sem marcas, devolve lista de marcas vazia (não undefined)', () => {
    const { marcas } = objetosDaReferencia({ contornos: ANOTACAO.contornos, classes: [] }, 1);
    expect(marcas).toEqual([]);
  });
});

describe('podeCarregarReferencia', () => {
  const ANOTACAO_COM_CONTORNO: AnotacaoCarregada = {
    contornos: [{ poligono: [[0, 0], [1, 0], [1, 1]], classe: 'viavel' }],
    classes: ['viavel'],
  };

  it('falso sem imagem', () => {
    expect(podeCarregarReferencia(null, false, ANOTACAO_COM_CONTORNO)).toBe(false);
  });

  it('falso com a referência já carregada', () => {
    expect(podeCarregarReferencia({}, true, ANOTACAO_COM_CONTORNO)).toBe(false);
  });

  it('falso sem anotação', () => {
    expect(podeCarregarReferencia({}, false, null)).toBe(false);
  });

  it('falso com anotação sem contorno e sem marca', () => {
    expect(podeCarregarReferencia({}, false, { classes: [] })).toBe(false);
  });

  it('verdadeiro com imagem, sem referência carregada e anotação com contorno', () => {
    expect(podeCarregarReferencia({}, false, ANOTACAO_COM_CONTORNO)).toBe(true);
  });

  it('verdadeiro com anotação só de marca (sem contorno)', () => {
    expect(podeCarregarReferencia({}, false, { marcas: [{ x: 1, y: 1, classe: 'viavel' }], classes: [] })).toBe(
      true
    );
  });
});
