// =============================================================================
// A parte pura da onda (`contorno-do-clique.ts`): o que dá para provar em
// node, sem `Date.now()` do relógio real, sem canvas e sem estado do React.
//
// O que se protege: a extração de `App.tsx` prometeu que o clique avulso
// (`segmentarComOnda`), "contornar esta" (`handleSegmentarUma`) e o lote
// (`handleSegmentarPendentes`) continuam produzindo o MESMO objeto
// `YoloSegmentation` e os MESMOS recados de antes. Os fixtures "ANTIGO"
// abaixo são cópia literal do que cada handler montava dentro do App,
// comparados por `toEqual` e por `JSON.stringify` (chaves e ORDEM de chaves).
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  contornoDoClique,
  recadoDoContorno,
  recadoDeUma,
  recadoDoLote,
  areaFormatada,
  classeExternaDe,
} from '../contorno-do-clique';
import { calculateSeedDimensions } from '../../../lib/pca-utils';
import type { ResultadoDaOnda } from '../../../lib/region-growing';

const CONTORNO: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 4],
  [0, 4],
];
const { width, height } = calculateSeedDimensions(CONTORNO);

/** Um `ResultadoDaOnda` mínimo, válido, para os testes de recado. */
function umResultado(overrides: Partial<ResultadoDaOnda> = {}): ResultadoDaOnda {
  return {
    janela: { x: 0, y: 0, w: 512, h: 512 },
    mascara: new Uint8Array(0),
    contorno: CONTORNO,
    areaPx: 1234,
    tolerancia: 8,
    crescimentoNaBorda: 0.02,
    tocouBorda: false,
    ...overrides,
  };
}

describe('contornoDoClique — o YoloSegmentation que os três handlers montavam', () => {
  it('clique avulso (segmentarComOnda): formato ANTIGO, campo a campo e por JSON.stringify', () => {
    // ANTIGO (App.tsx, segmentarComOnda):
    //   appendYoloSegmentation({
    //     id: Date.now() + Math.floor(Math.random() * 1000),
    //     category: tipo,
    //     class_name: tipo === 'viable' ? 'viavel' : 'inviavel',
    //     classeExterna: classeExternaDaImagem,
    //     confidence: 1,
    //     polygon_points: r.contorno,
    //     visible: true,
    //     width, height,
    //     origem: 'clique',
    //     marcaId,
    //   }, { fundir: true });
    const ANTIGO = {
      id: 1_700_000_000_123,
      category: 'viable' as const,
      class_name: 'viavel',
      classeExterna: 'trigo duro',
      confidence: 1,
      polygon_points: CONTORNO,
      visible: true,
      width,
      height,
      origem: 'clique' as const,
      marcaId: 42,
    };

    const novo = contornoDoClique({
      id: 1_700_000_000_123,
      contorno: CONTORNO,
      tipo: 'viable',
      classeExterna: 'trigo duro',
      marcaId: 42,
    });

    expect(novo).toEqual(ANTIGO);
    expect(JSON.stringify(novo)).toBe(JSON.stringify(ANTIGO));
  });

  it('"contornar esta" (handleSegmentarUma): formato ANTIGO, sem classeExterna quando a marca não tem', () => {
    // ANTIGO (App.tsx, handleSegmentarUma):
    //   appendYoloSegmentation({
    //     id: Date.now(),
    //     category: marca.type,
    //     class_name: marca.type === 'viable' ? 'viavel' : 'inviavel',
    //     classeExterna: marca.classeExterna,
    //     confidence: 1,
    //     polygon_points: r.contorno,
    //     visible: true,
    //     width, height,
    //     origem: 'clique',
    //     marcaId: marca.id,
    //   });
    const ANTIGO = {
      id: 1_700_000_001_000,
      category: 'inviable' as const,
      class_name: 'inviavel',
      classeExterna: undefined,
      confidence: 1,
      polygon_points: CONTORNO,
      visible: true,
      width,
      height,
      origem: 'clique' as const,
      marcaId: 7,
    };

    const novo = contornoDoClique({
      id: 1_700_000_001_000,
      contorno: CONTORNO,
      tipo: 'inviable',
      classeExterna: undefined,
      marcaId: 7,
    });

    expect(novo).toEqual(ANTIGO);
    // `classeExterna: undefined` é chave presente, não ausente — o App
    // sempre escrevia a chave (`classeExterna: marca.classeExterna`), mesmo
    // quando o valor era undefined. JSON.stringify descarta chaves
    // `undefined` dos dois lados igualmente, então a comparação continua
    // provando o formato observável (o que sobra depois de serializado).
    expect(JSON.stringify(novo)).toBe(JSON.stringify(ANTIGO));
  });

  it('lote (handleSegmentarPendentes): formato ANTIGO, id = agora + i', () => {
    // ANTIGO (App.tsx, handleSegmentarPendentes, dentro do laço):
    //   appendYoloSegmentation({
    //     id: Date.now() + i,
    //     category: marca.type,
    //     class_name: marca.type === 'viable' ? 'viavel' : 'inviavel',
    //     classeExterna: marca.classeExterna,
    //     confidence: 1,
    //     polygon_points: r.contorno,
    //     visible: true,
    //     width, height,
    //     origem: 'clique',
    //     marcaId: marca.id,
    //   }, { fundir: medidas > 0 });
    const AGORA = 1_700_000_002_000;
    const I = 3;
    const ANTIGO = {
      id: AGORA + I,
      category: 'viable' as const,
      class_name: 'viavel',
      classeExterna: 'amendoim com mofo',
      confidence: 1,
      polygon_points: CONTORNO,
      visible: true,
      width,
      height,
      origem: 'clique' as const,
      marcaId: 99,
    };

    const novo = contornoDoClique({
      id: AGORA + I,
      contorno: CONTORNO,
      tipo: 'viable',
      classeExterna: 'amendoim com mofo',
      marcaId: 99,
    });

    expect(novo).toEqual(ANTIGO);
    expect(JSON.stringify(novo)).toBe(JSON.stringify(ANTIGO));
  });

  it('a ordem das chaves é a mesma do App (JSON.stringify é sensível a isso)', () => {
    const novo = contornoDoClique({
      id: 1,
      contorno: CONTORNO,
      tipo: 'viable',
      classeExterna: 'x',
      marcaId: 2,
    });
    expect(Object.keys(novo)).toEqual([
      'id',
      'category',
      'class_name',
      'classeExterna',
      'confidence',
      'polygon_points',
      'visible',
      'width',
      'height',
      'origem',
      'marcaId',
    ]);
  });
});

describe('areaFormatada — mm² calibrado (3 casas) ou px cru', () => {
  it('com umPerPixel, formata mm² com 3 casas decimais', () => {
    // ANTIGO: `${((r.areaPx * metadata.umPerPixel ** 2) / 1e6).toFixed(3)} mm²`
    expect(areaFormatada(1_000_000, 10)).toBe(`${((1_000_000 * 10 ** 2) / 1e6).toFixed(3)} mm²`);
    expect(areaFormatada(1_000_000, 10)).toBe('100.000 mm²');
  });

  it('sem umPerPixel, devolve px sem calibração', () => {
    // ANTIGO: `${r.areaPx} px`
    expect(areaFormatada(1234, undefined)).toBe('1234 px');
  });
});

describe('recadoDoContorno — os recados do clique avulso (segmentarComOnda)', () => {
  it('r nulo: "Não foi possível ler os pixels desta imagem."', () => {
    expect(recadoDoContorno(null, undefined, 5)).toEqual({
      tom: 'aviso',
      texto: 'Não foi possível ler os pixels desta imagem.',
    });
  });

  it('tocouBorda: "a onda escapou. Clique mais para dentro da semente."', () => {
    const r = umResultado({ tocouBorda: true });
    expect(recadoDoContorno(r, undefined, 5)).toEqual({
      tom: 'aviso',
      texto: 'Contagem registrada, sem contorno: a onda escapou. Clique mais para dentro da semente.',
    });
  });

  it('sucesso com calibração: "Contorno medido — X mm² · N ms"', () => {
    const r = umResultado({ areaPx: 1_000_000 });
    expect(recadoDoContorno(r, 10, 42)).toEqual({
      tom: 'ok',
      texto: 'Contorno medido — 100.000 mm² · 42 ms',
    });
  });

  it('sucesso sem calibração: área em px', () => {
    const r = umResultado({ areaPx: 777 });
    expect(recadoDoContorno(r, undefined, 3)).toEqual({
      tom: 'ok',
      texto: 'Contorno medido — 777 px · 3 ms',
    });
  });
});

describe('recadoDeUma — o recado de "contornar esta" (handleSegmentarUma)', () => {
  it('r nulo: mesma frase de tocouBorda (os dois casos viram um recado só)', () => {
    expect(recadoDeUma(null)).toEqual({
      tom: 'aviso',
      texto: 'A onda escapou nesta marcação — sem contorno. Tente ajustar o fundo ou o ponto.',
    });
  });

  it('tocouBorda: mesma frase', () => {
    const r = umResultado({ tocouBorda: true });
    expect(recadoDeUma(r)).toEqual({
      tom: 'aviso',
      texto: 'A onda escapou nesta marcação — sem contorno. Tente ajustar o fundo ou o ponto.',
    });
  });

  it('sucesso: "Contorno medido." — sem área nem tempo', () => {
    const r = umResultado();
    expect(recadoDeUma(r)).toEqual({ tom: 'ok', texto: 'Contorno medido.' });
  });
});

describe('recadoDoLote — o recado final do lote (handleSegmentarPendentes)', () => {
  it('todos medidos, ninguém escapou: tom ok, sem a frase de "ficou/ficaram"', () => {
    expect(recadoDoLote(5, 5, 0)).toEqual({
      tom: 'ok',
      texto: '5 de 5 contornos medidos. A contagem não mudou.',
    });
  });

  it('um escapou: singular "ficou"', () => {
    expect(recadoDoLote(4, 5, 1)).toEqual({
      tom: 'aviso',
      texto: '4 de 5 contornos medidos. 1 ficou sem contorno — a onda escapou. A contagem não mudou.',
    });
  });

  it('vários escaparam: plural "ficaram"', () => {
    expect(recadoDoLote(2, 5, 3)).toEqual({
      tom: 'aviso',
      texto: '2 de 5 contornos medidos. 3 ficaram sem contorno — a onda escapou. A contagem não mudou.',
    });
  });

  it('nenhum medido: continua "X de Y", tom aviso porque todos escaparam', () => {
    expect(recadoDoLote(0, 3, 3)).toEqual({
      tom: 'aviso',
      texto: '0 de 3 contornos medidos. 3 ficaram sem contorno — a onda escapou. A contagem não mudou.',
    });
  });
});

describe('classeExternaDe — mesma junção `\' + \'` de propostosParaSegmentacoes', () => {
  it('sem lista (undefined): undefined', () => {
    expect(classeExternaDe(undefined)).toBeUndefined();
  });

  it('lista vazia: undefined', () => {
    expect(classeExternaDe([])).toBeUndefined();
  });

  it('uma classe: o próprio nome', () => {
    expect(classeExternaDe(['trigo duro'])).toBe('trigo duro');
  });

  it('duas classes: junta com \' + \'', () => {
    expect(classeExternaDe(['a', 'b'])).toBe('a + b');
  });
});
