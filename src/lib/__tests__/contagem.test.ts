// =============================================================================
// A regra de contagem.
//
// O defeito que motivou estes testes: a segmentação por clique cria uma
// marcação E um contorno para a MESMA semente. Como a contagem somava as duas
// listas, doze cliques viravam vinte e quatro sementes — no número que o
// aplicativo existe para produzir.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { contarObjetos, contornoRepresentaSemente } from '../contagem';
import type { Mark, YoloSegmentation } from '../../types';

let proximoId = 1;

const marca = (type: Mark['type']): Mark => ({ x: 0, y: 0, type, id: proximoId++ });

const contorno = (
  category: YoloSegmentation['category'],
  extra: Partial<YoloSegmentation> = {}
): YoloSegmentation => ({
  id: proximoId++,
  category,
  class_name: category === 'viable' ? 'viavel' : 'inviavel',
  confidence: 0.9,
  polygon_points: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  ...extra,
});

describe('contarObjetos', () => {
  it('conta marcações manuais', () => {
    const c = contarObjetos([marca('viable'), marca('viable'), marca('inviable')], []);
    expect(c).toEqual({ viaveis: 2, inviaveis: 1, total: 3 });
  });

  it('conta contornos propostos por modelo', () => {
    // Ali não há marcação humana equivalente: foi a máquina que achou.
    const c = contarObjetos([], [contorno('viable'), contorno('inviable', { origem: 'modelo' })]);
    expect(c).toEqual({ viaveis: 1, inviaveis: 1, total: 2 });
  });

  it('NÃO conta o contorno que veio de clique', () => {
    // O mesmo clique já criou a marcação. Contar os dois é contar a semente
    // duas vezes — foi exatamente o defeito.
    const c = contarObjetos([marca('viable')], [contorno('viable', { origem: 'clique' })]);
    expect(c).toEqual({ viaveis: 1, inviaveis: 0, total: 1 });
  });

  it('doze cliques dão doze sementes, não vinte e quatro', () => {
    const marcas = Array.from({ length: 12 }, () => marca('viable'));
    const contornos = Array.from({ length: 12 }, () =>
      contorno('viable', { origem: 'clique' })
    );
    expect(contarObjetos(marcas, contornos).total).toBe(12);
  });

  it('contorno oculto não conta — esconder é como se rejeita uma proposta', () => {
    const c = contarObjetos([], [contorno('viable', { visible: false }), contorno('viable')]);
    expect(c.viaveis).toBe(1);
  });

  it('contorno sem origem declarada conta, para não quebrar sessão antiga', () => {
    // Toda segmentação salva antes deste campo existir veio de modelo.
    const c = contarObjetos([], [contorno('viable')]);
    expect(c.viaveis).toBe(1);
  });

  it('mistura as três fontes sem somar ninguém duas vezes', () => {
    const c = contarObjetos(
      [marca('viable'), marca('inviable')],
      [
        contorno('viable', { origem: 'clique' }), // acompanha a marcação
        contorno('inviable', { origem: 'clique' }), // idem
        contorno('viable', { origem: 'modelo' }), // semente só do modelo
        contorno('inviable', { visible: false }), // rejeitada
      ]
    );
    expect(c).toEqual({ viaveis: 2, inviaveis: 1, total: 3 });
  });
});

describe('contornoRepresentaSemente', () => {
  it('resume a regra em um lugar só', () => {
    expect(contornoRepresentaSemente(contorno('viable'))).toBe(true);
    expect(contornoRepresentaSemente(contorno('viable', { origem: 'modelo' }))).toBe(true);
    expect(contornoRepresentaSemente(contorno('viable', { origem: 'clique' }))).toBe(false);
    expect(contornoRepresentaSemente(contorno('viable', { visible: false }))).toBe(false);
  });
});
