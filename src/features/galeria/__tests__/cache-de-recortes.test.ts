// =============================================================================
// Trocar a classe de uma semente não pode custar 120 recortes.
//
// A galeria refazia TODOS os recortes sempre que `marks` ou
// `yoloSegmentations` mudava — e trocar a classe de uma semente muda as duas
// listas. Numa amostra densa eram 120 `toDataURL` por clique, com a interface
// parada no meio (relatado em 24/09/2026 como "a galeria trava quando troco de
// classe").
//
// O recorte lê a CAIXA, o POLÍGONO (só com máscara ligada) e a cor de fundo.
// Nunca a classe. `chaveDeRecorte` é essa identidade; o que este teste guarda é
// que ela não passa a depender da classe nem deixa de perceber a geometria.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { chaveDeRecorte } from '../recortar';
import type { ItemDaGaleria } from '../recortes';
import type { YoloSegmentation } from '../../../types';

const caixa = { x: 10.2, y: 20.4, largura: 30.1, altura: 30.9 };

const seg = (category: 'viable' | 'inviable', pontos: [number, number][]): YoloSegmentation => ({
  id: 7,
  category,
  class_name: category === 'viable' ? 'viavel' : 'inviavel',
  confidence: 1,
  polygon_points: pontos,
});

const TRIANGULO: [number, number][] = [
  [10, 20],
  [40, 20],
  [40, 50],
];

const item = (category: 'viable' | 'inviable', pontos = TRIANGULO, c = caixa): ItemDaGaleria => ({
  tipo: 'contorno',
  chave: 'c7',
  categoria: category,
  caixa: c,
  segmentacao: seg(category, pontos),
});

describe('chave do recorte', () => {
  it('NÃO muda quando só a classe muda — é o ponto todo', () => {
    expect(chaveDeRecorte(item('viable'), { semFundo: false })).toBe(
      chaveDeRecorte(item('inviable'), { semFundo: false })
    );
    // E também com a máscara ligada, onde o polígono entra na chave.
    expect(chaveDeRecorte(item('viable'), { semFundo: true })).toBe(
      chaveDeRecorte(item('inviable'), { semFundo: true })
    );
  });

  it('muda quando a caixa muda — mover uma marca refaz o recorte dela', () => {
    const movido = item('viable', TRIANGULO, { ...caixa, x: caixa.x + 5 });
    expect(chaveDeRecorte(movido, { semFundo: false })).not.toBe(
      chaveDeRecorte(item('viable'), { semFundo: false })
    );
  });

  it('com máscara, muda quando um vértice anda um pixel', () => {
    const editado: [number, number][] = [
      [10, 20],
      [41, 20],
      [40, 50],
    ];
    expect(chaveDeRecorte(item('viable', editado), { semFundo: true })).not.toBe(
      chaveDeRecorte(item('viable'), { semFundo: true })
    );
  });

  it('sem máscara o polígono não entra na chave: o recorte não o usa', () => {
    const outro: [number, number][] = [
      [0, 0],
      [99, 0],
      [99, 99],
      [0, 99],
    ];
    expect(chaveDeRecorte(item('viable', outro), { semFundo: false })).toBe(
      chaveDeRecorte(item('viable'), { semFundo: false })
    );
  });

  it('ligar a máscara muda a chave', () => {
    expect(chaveDeRecorte(item('viable'), { semFundo: true })).not.toBe(
      chaveDeRecorte(item('viable'), { semFundo: false })
    );
  });

  it('itens diferentes nunca compartilham chave', () => {
    const outro = { ...item('viable'), chave: 'c8' };
    expect(chaveDeRecorte(outro, { semFundo: false })).not.toBe(
      chaveDeRecorte(item('viable'), { semFundo: false })
    );
  });
});
