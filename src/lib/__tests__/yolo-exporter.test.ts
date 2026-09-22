// =============================================================================
// O dataset exportado usa a ordem de classes DO TREINO — e prova isso.
//
// Até 23/09 o exportador tinha `CLASS_VIABLE = 0`: coerente consigo mesmo e
// invertido em relação ao modelo (`names: [inviavel, viavel]`). Somar um
// dataset exportado ao conjunto de treino trocaria a classe de cada semente
// sem aviso. Este teste amarra o exportador à tabela de `classe-do-modelo.ts`.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildLabelLines, linhasDeClassesDoYaml, nomesDeClasses } from '../yolo-exporter';
import { YOLO_CLASSES, indiceDaCategoria, categoriaDoIndice } from '../classe-do-modelo';
import type { Session } from '../../types';

const OPTS = {
  trainValSplit: 0.8,
  estimatedSeedDiameterUm: 500,
  fallbackRadiusPx: 30,
  includeInviable: true,
  className: { viable: 'viavel', inviable: 'inviavel' },
};

/** Uma sessão mínima: o exportador só lê marcas, contornos e a calibração. */
function sessao(parcial: Partial<Session>): Session {
  return { metadata: {}, marks: [], yoloSegmentations: [], ...parcial } as unknown as Session;
}

const TRIANGULO = [
  [10, 10],
  [20, 10],
  [20, 20],
] as [number, number][];

describe('exportador YOLO — a ordem do treino', () => {
  it('indiceDaCategoria é o inverso de categoriaDoIndice', () => {
    for (let i = 0; i < YOLO_CLASSES.length; i++) {
      const cat = categoriaDoIndice(i);
      expect(cat).not.toBeNull();
      if (cat) expect(indiceDaCategoria(cat)).toBe(i);
    }
    expect(indiceDaCategoria('inviable')).toBe(0);
    expect(indiceDaCategoria('viable')).toBe(1);
  });

  it('contorno viável sai com classe 1 e inviável com 0 — como o modelo devolve', async () => {
    const s = sessao({
      yoloSegmentations: [
        { id: 'a', category: 'viable', polygon_points: TRIANGULO, visible: true },
        { id: 'b', category: 'inviable', polygon_points: TRIANGULO, visible: true },
      ] as unknown as Session['yoloSegmentations'],
    });
    const linhas = await buildLabelLines(s, 100, 100, OPTS);
    expect(linhas.map((l) => l.split(' ')[0])).toEqual(['1', '0']);
  });

  it('marca manual segue a mesma tabela', async () => {
    const s = sessao({
      marks: [
        { id: 1, x: 50, y: 50, type: 'inviable' },
        { id: 2, x: 60, y: 60, type: 'viable' },
      ] as unknown as Session['marks'],
    });
    const linhas = await buildLabelLines(s, 100, 100, OPTS);
    expect(linhas.map((l) => l.split(' ')[0])).toEqual(['0', '1']);
  });

  it('sem inviáveis, o índice de viável NÃO muda — e o yaml continua com nc: 2', async () => {
    const s = sessao({
      marks: [
        { id: 1, x: 50, y: 50, type: 'inviable' },
        { id: 2, x: 60, y: 60, type: 'viable' },
      ] as unknown as Session['marks'],
    });
    const linhas = await buildLabelLines(s, 100, 100, { ...OPTS, includeInviable: false });
    expect(linhas.map((l) => l.split(' ')[0])).toEqual(['1']);
    expect(linhasDeClassesDoYaml(OPTS.className)).toEqual([
      'nc: 2',
      'names:',
      '  0: inviavel',
      '  1: viavel',
    ]);
  });

  it('os nomes do yaml são os do treino, na ordem do treino', () => {
    expect(nomesDeClasses(OPTS.className)).toEqual([
      [0, 'inviavel', 'inviable'],
      [1, 'viavel', 'viable'],
    ]);
    // Um apelido troca o texto, nunca a posição.
    expect(nomesDeClasses({ viable: 'boa', inviable: 'ruim' }).map(([, n]) => n)).toEqual([
      'ruim',
      'boa',
    ]);
  });
});
