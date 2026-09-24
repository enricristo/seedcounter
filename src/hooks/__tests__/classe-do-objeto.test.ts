// =============================================================================
// A classe de um objeto mora num lugar só.
//
// O DEFEITO (relatado em 24/09/2026: "toda vez que troco a classe na galeria
// dá bug"). A classe de uma semente contornada estava gravada em dois lugares
// que ninguém sincronizava:
//
//   marca.type          → o que a CONTAGEM usa quando marca e contorno estão
//                         pareados (`enumerarObjetos`);
//   segmentacao.category → o que a COR usa, no canvas e na galeria.
//
// Clicar na célula de um item contornado invertia só o contorno: a cor virava
// e o número NÃO mudava. E o seletor de classe fina gravava `subclasse` sem
// tocar em `type` — uma semente marcada "morta" seguia contada como viável e
// desenhada em ciano.
//
// As funções testadas aqui são as puras que `useMarks` usa; o hook só as liga
// ao histórico (o ambiente de teste é node, sem React DOM).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { contarObjetos } from '../../lib/contagem';
import { categoriaDaClasse } from '../../features/classes/ferramentas-de-classe';
import type { Mark, YoloSegmentation } from '../../types';

/**
 * O que `aplicarClasse` faz, na forma pura — marca e contorno pareado juntos.
 * Espelha `useMarks.aplicarClasse`; se um dos dois mudar sem o outro, este
 * teste deixa de descrever o produto e é para ele quebrar mesmo.
 */
function definirClasse(
  marks: Mark[],
  segs: YoloSegmentation[],
  marcaId: number,
  categoria: 'viable' | 'inviable',
  subclasse?: Mark['subclasse']
) {
  return {
    marks: marks.map((m) => (m.id === marcaId ? { ...m, type: categoria, subclasse } : m)),
    segs: segs.map((s) =>
      s.marcaId === marcaId
        ? {
            ...s,
            category: categoria,
            class_name: categoria === 'viable' ? 'viavel' : 'inviavel',
          }
        : s
    ),
  };
}

const marca = (id: number, type: Mark['type'], subclasse?: Mark['subclasse']): Mark => ({
  id,
  x: 10,
  y: 10,
  type,
  ...(subclasse ? { subclasse } : {}),
});

const contorno = (
  id: number,
  marcaId: number,
  category: 'viable' | 'inviable'
): YoloSegmentation => ({
  id,
  marcaId,
  category,
  class_name: category === 'viable' ? 'viavel' : 'inviavel',
  confidence: 1,
  origem: 'clique',
  polygon_points: [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ],
});

describe('a classe de um objeto pareado', () => {
  it('a contagem lê a MARCA — por isso mexer só no contorno não mudava número', () => {
    const marks = [marca(1, 'viable')];
    const segs = [contorno(10, 1, 'viable')];
    expect(contarObjetos(marks, segs)).toMatchObject({ viaveis: 1, inviaveis: 0, total: 1 });

    // O jeito ERRADO, que era o do produto: inverter só o contorno.
    const soContorno = segs.map((s) => ({ ...s, category: 'inviable' as const }));
    expect(contarObjetos(marks, soContorno)).toMatchObject({ viaveis: 1, inviaveis: 0 });

    // O jeito certo: os dois juntos.
    const certo = definirClasse(marks, segs, 1, 'inviable');
    expect(contarObjetos(certo.marks, certo.segs)).toMatchObject({ viaveis: 0, inviaveis: 1 });
  });

  it('a cor lê o CONTORNO — por isso mexer só na marca deixava a célula mentindo', () => {
    const marks = [marca(1, 'viable')];
    const segs = [contorno(10, 1, 'viable')];
    const soMarca = marks.map((m) => ({ ...m, type: 'inviable' as const }));
    expect(segs[0].category).toBe('viable'); // a célula continuaria ciano
    expect(soMarca[0].type).toBe('inviable');

    const certo = definirClasse(marks, segs, 1, 'inviable');
    expect(certo.segs[0].category).toBe('inviable');
    expect(certo.segs[0].class_name).toBe('inviavel');
  });

  it('classe fina traz o tipo junto: "morta" não pode ficar contada como viável', () => {
    const marks = [marca(1, 'viable')];
    const segs = [contorno(10, 1, 'viable')];
    const categoria = categoriaDaClasse('morta');
    expect(categoria).toBe('inviable');

    const depois = definirClasse(marks, segs, 1, categoria, 'morta');
    expect(depois.marks[0].type).toBe('inviable');
    expect(depois.marks[0].subclasse).toBe('morta');
    expect(depois.segs[0].category).toBe('inviable');
    expect(contarObjetos(depois.marks, depois.segs)).toMatchObject({ viaveis: 0, inviaveis: 1 });
  });

  it('classe fina "normal" devolve o objeto a viável', () => {
    const marks = [marca(1, 'inviable', 'morta')];
    const segs = [contorno(10, 1, 'inviable')];
    const depois = definirClasse(marks, segs, 1, categoriaDaClasse('normal'), 'normal');
    expect(depois.marks[0].type).toBe('viable');
    expect(contarObjetos(depois.marks, depois.segs)).toMatchObject({ viaveis: 1, inviaveis: 0 });
  });

  it('"vazia" sai do denominador pelos dois lados — tipo e classe concordam', () => {
    const marks = [marca(1, 'viable')];
    const segs = [contorno(10, 1, 'viable')];
    const depois = definirClasse(marks, segs, 1, categoriaDaClasse('vazia'), 'vazia');
    const c = contarObjetos(depois.marks, depois.segs);
    expect(c).toMatchObject({ viaveis: 0, inviaveis: 0, inertes: 1, sementes: 0, total: 1 });
  });

  it('inverter apaga a classe fina que passaria a contradizer o tipo', () => {
    // A pessoa classificou "dormente" (inviável) e depois disse "é viável".
    // Guardar as duas afirmações seria guardar uma que ela não fez.
    const m = marca(1, 'inviable', 'dormente');
    const nova: 'viable' = 'viable';
    const contradiz = categoriaDaClasse(m.subclasse!) !== nova;
    expect(contradiz).toBe(true);
    const depois = definirClasse([m], [contorno(10, 1, 'inviable')], 1, nova, undefined);
    expect(depois.marks[0].subclasse).toBeUndefined();
    expect(depois.marks[0].type).toBe('viable');
  });

  it('contorno órfão (de modelo, sem marca) continua invertendo sozinho', () => {
    const orfao = { ...contorno(10, 0, 'viable'), marcaId: undefined, origem: 'modelo' as const };
    expect(contarObjetos([], [orfao])).toMatchObject({ viaveis: 1, total: 1 });
    const invertido = { ...orfao, category: 'inviable' as const };
    expect(contarObjetos([], [invertido])).toMatchObject({ inviaveis: 1, total: 1 });
  });
});
