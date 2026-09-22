// =============================================================================
// A parte pura da importação (`importar.ts`), que é o que dá para provar em
// node: o hook lê `File` e escreve no estado — nada disso existe aqui.
//
// O que se protege: a extração de `App.tsx` prometeu que um arquivo VÁLIDO
// produz exatamente o que o App produzia (os objetos abaixo são o formato
// antigo, copiado do `processJSONFile`, não derivado do código novo); que os
// três tipos continuam reconhecidos na mesma ordem; que a classe numérica é
// lida pela tabela do treino (0 é INVIÁVEL); e que um arquivo inválido é
// recusado com uma frase que diz o que faltou — antes era "Erro ao ler o
// arquivo JSON", para tudo.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  backupDeJSON,
  classificarJSON,
  ehErro,
  interpretarJSON,
  mensagemDeImportacao,
  MENSAGEM_FORMATO_DESCONHECIDO,
  MENSAGEM_HISTORICO_INVALIDO,
  MENSAGEM_JSON_ILEGIVEL,
  segmentacoesDeJSON,
  sessaoDeJSON,
} from '../importar';
import { calculateSeedDimensions } from '../../../lib/pca-utils';
import type { Metadata, Session, YoloSegmentation } from '../../../types';

const QUADRADO: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const TRIANGULO: [number, number][] = [
  [0, 0],
  [8, 0],
  [4, 6],
];

const METADATA: Metadata = {
  researcher: 'Ana',
  project: 'Orquídeas 2026',
  treatment: 'T1',
  plate: '3',
  quadrant: 'Q2',
  notes: '',
  baselineCount: 0,
  useDifferential: false,
  umPerPixel: 10,
};

/** Dois erros possíveis num teste: o resultado não é erro, ou o texto difere. */
function erroDe(r: unknown): string {
  if (!ehErro(r)) throw new Error(`esperava recusa, veio ${JSON.stringify(r)}`);
  return r.erro;
}

// ---------------------------------------------------------------------------

describe('classificarJSON — a ordem de reconhecimento de sempre', () => {
  it('objeto com "segmentations" é de segmentações, mesmo que também tenha "metadata"', () => {
    expect(classificarJSON('{"segmentations": [], "metadata": {}, "marks": []}')).toBe(
      'segmentacoes'
    );
  });

  it('lista é backup do histórico', () => {
    expect(classificarJSON('[]')).toBe('backup');
  });

  it('objeto com "metadata" e "marks" ou "yoloSegmentations" é sessão avulsa', () => {
    expect(classificarJSON('{"metadata": {}, "marks": []}')).toBe('sessao');
    expect(classificarJSON('{"metadata": {}, "yoloSegmentations": []}')).toBe('sessao');
  });

  it('"metadata" sem marcas nem contornos não é sessão — a frase de sempre', () => {
    expect(classificarJSON('{"metadata": {}}')).toEqual({ erro: MENSAGEM_FORMATO_DESCONHECIDO });
    expect(classificarJSON('{"marks": []}')).toEqual({ erro: MENSAGEM_FORMATO_DESCONHECIDO });
    expect(classificarJSON('42')).toEqual({ erro: MENSAGEM_FORMATO_DESCONHECIDO });
  });

  it('JSON ilegível é a frase de sempre, não uma pilha', () => {
    expect(classificarJSON('{isto não é json')).toEqual({ erro: MENSAGEM_JSON_ILEGIVEL });
    expect(classificarJSON('')).toEqual({ erro: MENSAGEM_JSON_ILEGIVEL });
  });
});

// ---------------------------------------------------------------------------

describe('segmentacoesDeJSON — o JSON de um modelo externo', () => {
  it('produz exatamente o objeto que o App montava', () => {
    const texto = JSON.stringify({
      image: 'placa.jpg',
      segmentations: [
        {
          id: 7,
          class: 1,
          class_name: 'viavel',
          confidence: 0.91,
          polygon_points: QUADRADO,
          bbox: [0, 0, 10, 10],
          area: 100,
        },
      ],
    });
    const { width, height } = calculateSeedDimensions(QUADRADO);
    // O formato antigo, copiado do `processJSONFile` do App — inclusive a
    // ordem dos campos e o que fica de fora (`bbox`, `area`).
    const antigo: YoloSegmentation = {
      id: 7,
      category: 'viable',
      class_name: 'viavel',
      confidence: 0.91,
      polygon_points: QUADRADO,
      visible: true,
      edited: false,
      width,
      height,
    };
    expect(segmentacoesDeJSON(texto)).toEqual([antigo]);
    expect(JSON.stringify(segmentacoesDeJSON(texto))).toBe(JSON.stringify([antigo]));
  });

  it('"class" numérico é lido pela tabela do treino: 0 é INVIÁVEL, 1 é viável', () => {
    const r = segmentacoesDeJSON(
      JSON.stringify({
        segmentations: [
          { class: 0, polygon_points: TRIANGULO },
          { class: 1, polygon_points: TRIANGULO },
          { class_id: 0, polygon_points: TRIANGULO },
        ],
      })
    );
    if (ehErro(r)) throw new Error(r.erro);
    expect(r.map((s) => s.category)).toEqual(['inviable', 'viable', 'inviable']);
    expect(r.map((s) => s.class_name)).toEqual(['inviavel', 'viavel', 'inviavel']);
  });

  it('"category" manda sobre "class_name", que manda sobre o índice; acento é tolerado', () => {
    const r = segmentacoesDeJSON(
      JSON.stringify({
        segmentations: [
          { category: 'inviable', class_name: 'viavel', class: 1, polygon_points: TRIANGULO },
          { class_name: 'Inviável', class: 1, polygon_points: TRIANGULO },
          { polygon_points: TRIANGULO },
        ],
      })
    );
    if (ehErro(r)) throw new Error(r.erro);
    expect(r.map((s) => s.category)).toEqual(['inviable', 'inviable', 'viable']);
  });

  it('os padrões de sempre: id pela posição, confiança 1, visível, não editado', () => {
    const r = segmentacoesDeJSON(
      JSON.stringify({
        segmentations: [{ points: TRIANGULO }, { points: TRIANGULO, visible: false, edited: true }],
      })
    );
    if (ehErro(r)) throw new Error(r.erro);
    expect(r[0]).toMatchObject({ id: 0, confidence: 1, visible: true, edited: false });
    expect(r[0].polygon_points).toEqual(TRIANGULO); // `points` é aceito como `polygon_points`
    expect(r[1]).toMatchObject({ id: 1, visible: false, edited: true });
  });

  it('contorno sem polígono entra vazio, como sempre — medida em branco, não inventada', () => {
    const r = segmentacoesDeJSON(JSON.stringify({ segmentations: [{ id: 1 }] }));
    if (ehErro(r)) throw new Error(r.erro);
    expect(r[0].polygon_points).toEqual([]);
    expect(r[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('lista vazia é válida e produz lista vazia', () => {
    expect(segmentacoesDeJSON('{"segmentations": []}')).toEqual([]);
  });

  it('recusa dizendo qual campo tem o tipo errado, e em qual segmentação', () => {
    expect(erroDe(segmentacoesDeJSON('{"segmentations": true}'))).toBe(
      'O campo "segmentations" deveria ser uma lista, e é booleano.'
    );
    expect(erroDe(segmentacoesDeJSON('{"segmentations": [1]}'))).toBe(
      'Segmentação 1: deveria ser um objeto, e é número.'
    );
    expect(
      erroDe(
        segmentacoesDeJSON(
          JSON.stringify({
            segmentations: [{ polygon_points: TRIANGULO }, { polygon_points: 'abc' }],
          })
        )
      )
    ).toBe('Segmentação 2: "polygon_points" deveria ser uma lista de pares [x, y].');
    expect(
      erroDe(segmentacoesDeJSON(JSON.stringify({ segmentations: [{ points: [[1, 2], [3]] }] })))
    ).toBe('Segmentação 1: "points" deveria ser uma lista de pares [x, y].');
    expect(
      erroDe(segmentacoesDeJSON(JSON.stringify({ segmentations: [{ id: '7', points: TRIANGULO }] })))
    ).toBe('Segmentação 1: "id" deveria ser número, e é texto.');
    expect(
      erroDe(
        segmentacoesDeJSON(JSON.stringify({ segmentations: [{ confidence: 'alta', points: TRIANGULO }] }))
      )
    ).toBe('Segmentação 1: "confidence" deveria ser número, e é texto.');
  });
});

// ---------------------------------------------------------------------------

describe('backupDeJSON — a lista que o histórico exporta', () => {
  const SESSAO: Session = {
    id: '1758470400000',
    date: '2026-09-21T17:00:00.000Z',
    filename: 'placa-03.tif',
    viableCount: 7,
    inviableCount: 3,
    metadata: METADATA,
    marks: [{ id: 1, x: 10, y: 20, type: 'viable' }],
    yoloSegmentations: [],
    imageData: 'data:image/jpeg;base64,/9j/4AAQ',
  };

  it('devolve as sessões como vieram — o banco recebe o mesmo objeto de antes', () => {
    const r = backupDeJSON(JSON.stringify([SESSAO, { ...SESSAO, id: '2', imageData: undefined }]));
    if (ehErro(r)) throw new Error(r.erro);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual(SESSAO);
    // Sem cópia: o que vai para o `bulkPut` é o objeto lido, com tudo o que
    // uma versão antiga do app possa ter escrito a mais.
    const comCampoAntigo = JSON.parse(JSON.stringify([{ ...SESSAO, campoDe2024: 'x' }]));
    const lido = backupDeJSON(JSON.stringify(comCampoAntigo));
    if (ehErro(lido)) throw new Error(lido.erro);
    expect(lido[0]).toEqual(comCampoAntigo[0]);
  });

  it('lista vazia é um backup válido de zero sessões', () => {
    expect(backupDeJSON('[]')).toEqual([]);
  });

  it('diz qual sessão e qual campo falta', () => {
    const semId = JSON.parse(JSON.stringify(SESSAO));
    delete semId.id;
    expect(erroDe(backupDeJSON(JSON.stringify([SESSAO, semId])))).toBe(
      'Sessão 2 do backup: falta o campo "id".'
    );
    const semContagem = JSON.parse(JSON.stringify(SESSAO));
    delete semContagem.viableCount;
    expect(erroDe(backupDeJSON(JSON.stringify([semContagem])))).toBe(
      'Sessão 1 do backup: falta o campo "viableCount".'
    );
  });

  it('diz qual campo tem o tipo errado', () => {
    expect(erroDe(backupDeJSON(JSON.stringify([{ ...SESSAO, viableCount: '7' }])))).toBe(
      'Sessão 1 do backup: "viableCount" deveria ser número, e é texto.'
    );
    expect(erroDe(backupDeJSON(JSON.stringify([{ ...SESSAO, metadata: [] }])))).toBe(
      'Sessão 1 do backup: "metadata" deveria ser objeto, e é lista.'
    );
    expect(erroDe(backupDeJSON(JSON.stringify([{ ...SESSAO, marks: {} }])))).toBe(
      'Sessão 1 do backup: "marks" deveria ser lista, e é objeto.'
    );
    expect(erroDe(backupDeJSON(JSON.stringify([{ ...SESSAO, imageData: 12 }])))).toBe(
      'Sessão 1 do backup: "imageData" deveria ser texto, e é número.'
    );
    expect(erroDe(backupDeJSON(JSON.stringify(['sessão'])))).toBe(
      'Sessão 1 do backup: deveria ser um objeto, e é texto.'
    );
  });
});

// ---------------------------------------------------------------------------

describe('sessaoDeJSON — a sessão avulsa que `sessaoEmJSON` exporta', () => {
  /** O que `sessaoEmJSON` escreve, com um contorno já medido e um sem medida. */
  const EXPORTADA = {
    filename: 'placa-03.tif',
    date: '2026-09-21T17:05:30.000Z',
    metadata: METADATA,
    results: { viableCount: 2, inviableCount: 1, totalCount: 3, viablePercent: 66.7, inviablePercent: 33.3 },
    marks: [
      { id: 1, x: 10, y: 20, type: 'viable' },
      { id: 2, x: 30, y: 40, type: 'inviable', subclasse: 'morta', origem: 'humano' },
    ],
    yoloSegmentations: [
      {
        id: 9,
        category: 'inviable',
        class_name: 'inviavel',
        confidence: 1,
        polygon_points: QUADRADO,
        visible: true,
        edited: false,
        width: 12.5,
        height: 11,
        origem: 'clique',
        marcaId: 2,
      },
      { id: 10, category: 'viable', class_name: 'viavel', confidence: 0.8, polygon_points: TRIANGULO },
    ],
  };

  it('produz exatamente o que o App montava: medida gravada vale, ausente é medida do contorno', () => {
    const r = sessaoDeJSON(JSON.stringify(EXPORTADA));
    if (ehErro(r)) throw new Error(r.erro);
    expect(r.filename).toBe('placa-03.tif');
    expect(r.metadata).toEqual(METADATA);
    expect(r.marks).toEqual(EXPORTADA.marks);

    const { width, height } = calculateSeedDimensions(TRIANGULO);
    // O formato antigo: `{ ...seg, width: seg.width ?? width, height: seg.height ?? height }`.
    expect(r.segmentacoes).toEqual([
      EXPORTADA.yoloSegmentations[0],
      { ...EXPORTADA.yoloSegmentations[1], width, height },
    ]);
  });

  it('marcas e contornos ausentes viram listas vazias; sem nome, não há nome', () => {
    const r = sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [] }));
    if (ehErro(r)) throw new Error(r.erro);
    expect(r).toEqual({ metadata: METADATA, marks: [], segmentacoes: [] });
    expect('filename' in r).toBe(false);

    const semNome = sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [], filename: '' }));
    if (ehErro(semNome)) throw new Error(semNome.erro);
    expect(semNome.filename).toBeUndefined();
  });

  it('metadado sem os campos de texto recebe "" — o formulário é controlado', () => {
    const r = sessaoDeJSON(JSON.stringify({ metadata: { umPerPixel: 5 }, marks: [] }));
    if (ehErro(r)) throw new Error(r.erro);
    expect(r.metadata).toEqual({
      umPerPixel: 5,
      researcher: '',
      project: '',
      treatment: '',
      plate: '',
      quadrant: '',
      notes: '',
    });
  });

  it('a classe do contorno passa por `categoriaImportada`: "Viável" à mão vira viable', () => {
    const r = sessaoDeJSON(
      JSON.stringify({
        metadata: METADATA,
        yoloSegmentations: [{ id: 1, category: 'Inviável', polygon_points: TRIANGULO }],
      })
    );
    if (ehErro(r)) throw new Error(r.erro);
    expect(r.segmentacoes[0]).toMatchObject({ category: 'inviable', class_name: 'inviavel', confidence: 1 });
  });

  it('recusa dizendo o que faltou, em qual marcação ou contorno', () => {
    expect(erroDe(sessaoDeJSON(JSON.stringify({ metadata: 'x', marks: [] })))).toBe(
      '"metadata" deveria ser um objeto, e é texto.'
    );
    expect(erroDe(sessaoDeJSON(JSON.stringify({ metadata: { plate: 3 }, marks: [] })))).toBe(
      'metadata: "plate" deveria ser texto, e é número.'
    );
    expect(erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: {} })))).toBe(
      '"marks" deveria ser lista, e é objeto.'
    );
    expect(
      erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [{ id: 1, x: 1, type: 'viable' }] })))
    ).toBe('Marcação 1: falta o campo "y".');
    expect(
      erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [{ id: 1, x: 1, y: '2', type: 'viable' }] })))
    ).toBe('Marcação 1: "y" deveria ser número, e é texto.');
    expect(
      erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [{ id: 1, x: 1, y: 2, type: 'morta' }] })))
    ).toBe('Marcação 1: "type" deveria ser "viable" ou "inviable".');
    expect(
      erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, yoloSegmentations: [{ polygon_points: TRIANGULO }] })))
    ).toBe('Contorno 1: falta o campo "id".');
    expect(
      erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, yoloSegmentations: [{ id: 1, polygon_points: [[1]] }] })))
    ).toBe('Contorno 1: "polygon_points" deveria ser uma lista de pares [x, y].');
    expect(erroDe(sessaoDeJSON(JSON.stringify({ metadata: METADATA, marks: [], filename: 3 })))).toBe(
      'Sessão: "filename" deveria ser texto, e é número.'
    );
  });
});

// ---------------------------------------------------------------------------

describe('interpretarJSON — reconhecer e conferir numa leitura só', () => {
  it('despacha cada tipo para a conferência certa', () => {
    expect(interpretarJSON('{"segmentations": []}')).toEqual({ tipo: 'segmentacoes', segmentacoes: [] });
    expect(interpretarJSON('[]')).toEqual({ tipo: 'backup', sessoes: [] });
    expect(interpretarJSON(JSON.stringify({ metadata: METADATA, marks: [] }))).toEqual({
      tipo: 'sessao',
      sessao: { metadata: METADATA, marks: [], segmentacoes: [] },
    });
  });

  it('a recusa da conferência sai com a frase da conferência', () => {
    expect(interpretarJSON('{"segmentations": 1}')).toEqual({
      erro: 'O campo "segmentations" deveria ser uma lista, e é número.',
    });
    expect(interpretarJSON('nada')).toEqual({ erro: MENSAGEM_JSON_ILEGIVEL });
    expect(interpretarJSON('{}')).toEqual({ erro: MENSAGEM_FORMATO_DESCONHECIDO });
  });
});

describe('as frases que a pessoa lê são as de sempre', () => {
  it('sucesso, por tipo', () => {
    const seg: YoloSegmentation = {
      id: 1,
      category: 'viable',
      class_name: 'viavel',
      confidence: 1,
      polygon_points: TRIANGULO,
    };
    expect(mensagemDeImportacao({ tipo: 'segmentacoes', segmentacoes: [seg, seg] })).toBe(
      'YOLO segmentações importadas! Encontradas 2 segmentações.'
    );
    expect(mensagemDeImportacao({ tipo: 'backup', sessoes: [] })).toBe(
      'Histórico importado com sucesso! 0 sessões adicionadas/mescladas.'
    );
    expect(
      mensagemDeImportacao({ tipo: 'sessao', sessao: { metadata: METADATA, marks: [], segmentacoes: [] } })
    ).toBe('Sessão importada com sucesso!');
  });

  it('as três recusas antigas', () => {
    expect(MENSAGEM_JSON_ILEGIVEL).toBe('Erro ao ler o arquivo JSON. Certifique-se de que é um formato válido.');
    expect(MENSAGEM_FORMATO_DESCONHECIDO).toBe(
      'Arquivo JSON com formato não reconhecido (não é YOLO, Backup ou Sessão).'
    );
    expect(MENSAGEM_HISTORICO_INVALIDO).toBe('Formato de histórico inválido.');
  });
});
