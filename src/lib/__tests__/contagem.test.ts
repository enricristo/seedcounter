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
import type { ClasseDeSemente } from '../normas/classes-de-semente';

let proximoId = 1;

const marca = (type: Mark['type'], subclasse?: ClasseDeSemente): Mark => ({
  x: 0,
  y: 0,
  type,
  id: proximoId++,
  ...(subclasse ? { subclasse } : {}),
});

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
    expect(c).toEqual({ viaveis: 2, inviaveis: 1, total: 3, inertes: 0, sementes: 3 });
  });

  it('conta contornos propostos por modelo', () => {
    // Ali não há marcação humana equivalente: foi a máquina que achou.
    const c = contarObjetos([], [contorno('viable'), contorno('inviable', { origem: 'modelo' })]);
    expect(c).toEqual({ viaveis: 1, inviaveis: 1, total: 2, inertes: 0, sementes: 2 });
  });

  it('NÃO conta o contorno que veio de clique', () => {
    // O mesmo clique já criou a marcação. Contar os dois é contar a semente
    // duas vezes — foi exatamente o defeito.
    const c = contarObjetos([marca('viable')], [contorno('viable', { origem: 'clique' })]);
    expect(c).toEqual({ viaveis: 1, inviaveis: 0, total: 1, inertes: 0, sementes: 1 });
  });

  it('doze cliques dão doze sementes, não vinte e quatro', () => {
    const marcas = Array.from({ length: 12 }, () => marca('viable'));
    const contornos = Array.from({ length: 12 }, () => contorno('viable', { origem: 'clique' }));
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
    expect(c).toEqual({ viaveis: 2, inviaveis: 1, total: 3, inertes: 0, sementes: 3 });
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

describe('o denominador: o que é semente e o que é material inerte', () => {
  // A RAS: "unidade de dispersão na qual for óbvio que não contenha a semente"
  // é material inerte. Contar 400 espiguetas com 80 vazias e declarar
  // germinação sobre 400 dá número menor que a verdade — o denominador é 320.
  it('sem ninguém classificar, sementes === total e inertes é zero', () => {
    const c = contarObjetos([marca('viable'), marca('inviable')], []);
    expect(c.inertes).toBe(0);
    expect(c.sementes).toBe(c.total);
  });

  it('vazia (inerte) sai do denominador, mas continua no total', () => {
    const c = contarObjetos(
      [marca('viable'), marca('inviable', 'vazia'), marca('inviable', 'vazia')],
      []
    );
    expect(c.total).toBe(3);
    expect(c.inertes).toBe(2);
    expect(c.sementes).toBe(1);
    // E o principal: os dois detritos NÃO viram "sementes inviáveis".
    expect(c.viaveis).toBe(1);
    expect(c.inviaveis).toBe(0);
  });

  it('os três grupos sempre somam o total', () => {
    const c = contarObjetos(
      [marca('viable'), marca('inviable'), marca('inviable', 'vazia'), marca('viable', 'morta')],
      [contorno('viable', { origem: 'modelo' })]
    );
    expect(c.viaveis + c.inviaveis + c.inertes).toBe(c.total);
    expect(c.sementes).toBe(c.viaveis + c.inviaveis);
  });

  it('as outras cinco classes SÃO semente — dormente e morta contam', () => {
    for (const chave of ['normal', 'anormal', 'dura', 'dormente', 'morta'] as ClasseDeSemente[]) {
      const c = contarObjetos([marca('inviable', chave)], []);
      expect(c.inertes, `${chave} não deveria ser inerte`).toBe(0);
      expect(c.sementes).toBe(1);
    }
  });

  it('contorno de modelo sem marca conta como semente — não há onde declarar', () => {
    const c = contarObjetos([], [contorno('viable', { origem: 'modelo' })]);
    expect(c.inertes).toBe(0);
    expect(c.sementes).toBe(1);
  });
});
