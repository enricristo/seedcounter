// =============================================================================
// As marcas no canvas.
//
// O contexto 2D é falso: um objeto que registra cada chamada e cada troca de
// propriedade. Não se testa o pixel; testa-se O QUE foi pedido ao canvas —
// quantas marcas, com que índice, com que alfa, e se o contexto volta como
// veio. É o suficiente para pegar os defeitos que importam aqui: contador
// próprio em vez do índice canônico, opacidade ignorada num dos modos, alfa
// vazando para o que vem depois.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { desenharObjetos, opacidadeEfetiva, renderMarksToContext } from '../render-marks';
import { enumerarObjetos } from '../objetos';
import { OPACIDADE_MINIMA } from '../../theme/specimen';
import type { Mark, YoloSegmentation } from '../../types';

type Chamada = { nome: string; args: unknown[] };

interface ContextoFalso {
  ctx: CanvasRenderingContext2D;
  chamadas: Chamada[];
  /** Cada valor atribuído a `globalAlpha`, na ordem. */
  alfas: number[];
  textos: { texto: string; x: number; y: number }[];
}

/**
 * Só o que `desenharMarca` e o modo de índices usam. Se um dia o desenho
 * passar a chamar algo além disto, o teste quebra com "não é função" — que
 * é exatamente o aviso que se quer.
 */
function contextoFalso(alfaInicial = 1): ContextoFalso {
  const chamadas: Chamada[] = [];
  const alfas: number[] = [];
  const textos: { texto: string; x: number; y: number }[] = [];
  let alfa = alfaInicial;

  const registrar =
    (nome: string) =>
    (...args: unknown[]) => {
      chamadas.push({ nome, args });
    };

  const base = {
    beginPath: registrar('beginPath'),
    arc: registrar('arc'),
    fill: registrar('fill'),
    stroke: registrar('stroke'),
    setLineDash: registrar('setLineDash'),
    moveTo: registrar('moveTo'),
    lineTo: registrar('lineTo'),
    fillText: (texto: string, x: number, y: number) => {
      chamadas.push({ nome: 'fillText', args: [texto, x, y] });
      textos.push({ texto, x, y });
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    get globalAlpha() {
      return alfa;
    },
    set globalAlpha(v: number) {
      alfa = v;
      alfas.push(v);
    },
  };

  return { ctx: base as unknown as CanvasRenderingContext2D, chamadas, alfas, textos };
}

const quadrado = (cx: number, cy: number, r = 10): [number, number][] => [
  [cx - r, cy - r],
  [cx + r, cy - r],
  [cx + r, cy + r],
  [cx - r, cy + r],
];
const marca = (id: number, x: number, y: number, type: Mark['type'] = 'viable'): Mark => ({ id, x, y, type });
const contorno = (
  id: number,
  cx: number,
  cy: number,
  extra: Partial<YoloSegmentation> = {}
): YoloSegmentation => ({
  id,
  category: 'viable',
  class_name: 'viavel',
  confidence: 1,
  polygon_points: quadrado(cx, cy),
  visible: true,
  ...extra,
});

const so = (chamadas: Chamada[], nome: string) => chamadas.filter((c) => c.nome === nome);

describe('opacidadeEfetiva', () => {
  it('prende na faixa [mínimo útil, 1]', () => {
    expect(opacidadeEfetiva(0)).toBe(OPACIDADE_MINIMA);
    expect(opacidadeEfetiva(-3)).toBe(OPACIDADE_MINIMA);
    expect(opacidadeEfetiva(0.6)).toBe(0.6);
    expect(opacidadeEfetiva(7)).toBe(1);
  });

  it('ausente ou não numérica vale 1 — nunca NaN no canvas', () => {
    expect(opacidadeEfetiva(undefined)).toBe(1);
    expect(opacidadeEfetiva(Number.NaN)).toBe(1);
    expect(opacidadeEfetiva(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('modo de pontos', () => {
  it('cada objeto com marcação recebe uma marca; contorno órfão NÃO recebe ponto', () => {
    const marks = [marca(1, 100, 100), marca(2, 200, 200, 'inviable')];
    const segs = [
      contorno(10, 100, 100, { origem: 'clique', marcaId: 1 }),
      contorno(11, 400, 400, { origem: 'modelo' }),
    ];
    const objetos = enumerarObjetos(marks, segs);
    expect(objetos).toHaveLength(3);
    expect(objetos[2].natureza).toBe('contorno');

    const f = contextoFalso();
    renderMarksToContext(f.ctx, marks, 'dots', 900, 1, segs);

    // Estilo disco: viável = halo + disco cheio (1 fill), inviável = halo +
    // anel (0 fill). Dois objetos com marcação → 2 halos + 2 formas = 4 arcs.
    // O contorno órfão não acrescenta nada.
    expect(so(f.chamadas, 'arc')).toHaveLength(4);
    expect(so(f.chamadas, 'fill')).toHaveLength(1);
    const centros = so(f.chamadas, 'arc').map((c) => [c.args[0], c.args[1]]);
    expect(centros).not.toContainEqual([400, 400]);
  });

  it('cena vazia não toca o canvas', () => {
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [], 'dots', 900);
    expect(f.chamadas).toHaveLength(0);
    expect(f.alfas).toHaveLength(0);
  });

  it('estilo e opacidade chegam em desenharMarca', () => {
    // Anel + inviável é o único caso que pede um tracejado não vazio:
    // se o estilo não chegasse, `setLineDash` só receberia [].
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [marca(1, 50, 50, 'inviable')], 'dots', 900, 1, [], 'anel', 0.5);

    const tracejados = so(f.chamadas, 'setLineDash').map((c) => c.args[0] as number[]);
    expect(tracejados.some((d) => d.length === 2)).toBe(true);
    expect(f.alfas).toContain(0.5);
  });

  it('opacidade fora da faixa é presa, não passada crua', () => {
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [marca(1, 50, 50)], 'dots', 900, 1, [], 'disco', 0);
    expect(f.alfas[0]).toBe(OPACIDADE_MINIMA);

    const g = contextoFalso();
    renderMarksToContext(g.ctx, [marca(1, 50, 50)], 'dots', 900, 1, [], 'disco', 4);
    expect(g.alfas[0]).toBe(1);
  });

  it('a forma diferencia viável de inviável no estilo cruz (+ contra ×)', () => {
    const v = contextoFalso();
    renderMarksToContext(v.ctx, [marca(1, 50, 50, 'viable')], 'dots', 900, 1, [], 'cruz');
    const i = contextoFalso();
    renderMarksToContext(i.ctx, [marca(1, 50, 50, 'inviable')], 'dots', 900, 1, [], 'cruz');

    // Depois do halo (que é sempre "+"), a cruz viável tem segmentos
    // horizontais/verticais; a inviável, diagonais. Basta olhar o último moveTo.
    const ultimoMove = (c: Chamada[]) => so(c, 'moveTo').at(-1)?.args as [number, number];
    const [vx, vy] = ultimoMove(v.chamadas);
    const [ix, iy] = ultimoMove(i.chamadas);
    expect(vx === 50 || vy === 50).toBe(true);
    expect(ix !== 50 && iy !== 50).toBe(true);
  });
});

describe('modo de índices', () => {
  it('escreve o índice canônico de enumerarObjetos, não um contador por classe', () => {
    const marks = [
      marca(1, 10, 10, 'inviable'),
      marca(2, 20, 20, 'viable'),
      marca(3, 30, 30, 'inviable'),
    ];
    const segs = [contorno(11, 400, 400, { origem: 'modelo', category: 'inviable' })];
    const esperado = enumerarObjetos(marks, segs).map((o) => String(o.indice));
    expect(esperado).toEqual(['1', '2', '3', '4']);

    const f = contextoFalso();
    renderMarksToContext(f.ctx, marks, 'numbers', 900, 1, segs);
    expect(f.textos.map((t) => t.texto)).toEqual(esperado);
    // O contorno órfão ganha número no seu centroide.
    expect(f.textos[3].x).toBeCloseTo(400);
  });

  it('desenharObjetos com lista filtrada mantém os índices originais', () => {
    const marks = [marca(1, 10, 10, 'viable'), marca(2, 20, 20, 'inviable'), marca(3, 30, 30, 'viable')];
    const soInviaveis = enumerarObjetos(marks, []).filter((o) => o.categoria === 'inviable');

    const f = contextoFalso();
    desenharObjetos(f.ctx, soInviaveis, { modo: 'numbers', larguraDaImagem: 900 });
    expect(f.textos.map((t) => t.texto)).toEqual(['2']);
  });

  it('inviável ganha o anel externo (forma redundante), viável não', () => {
    const v = contextoFalso();
    renderMarksToContext(v.ctx, [marca(1, 50, 50, 'viable')], 'numbers', 900);
    const i = contextoFalso();
    renderMarksToContext(i.ctx, [marca(1, 50, 50, 'inviable')], 'numbers', 900);
    expect(so(v.chamadas, 'arc')).toHaveLength(1);
    expect(so(i.chamadas, 'arc')).toHaveLength(2);
  });

  it('respeita a opacidade — antes só o modo de pontos respeitava', () => {
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [marca(1, 50, 50)], 'numbers', 900, 1, [], 'disco', 0.4);
    expect(f.alfas[0]).toBe(0.4);
  });
});

describe('o contexto volta como veio', () => {
  it.each(['dots', 'numbers'] as const)('globalAlpha restaurado no modo %s', (modo) => {
    const f = contextoFalso(0.83);
    renderMarksToContext(f.ctx, [marca(1, 50, 50), marca(2, 60, 60, 'inviable')], modo, 900, 1, [], 'anel', 0.3);
    expect(f.alfas.length).toBeGreaterThan(0);
    expect(f.ctx.globalAlpha).toBe(0.83);
  });
});

describe('entradas hostis', () => {
  it('coordenada não finita é pulada em vez de corromper o caminho', () => {
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [marca(1, Number.NaN, 10), marca(2, 20, 20)], 'numbers', 900);
    expect(f.textos.map((t) => t.texto)).toEqual(['2']);
  });

  it('contorno sem pontos suficientes não vira objeto nem quebra', () => {
    const f = contextoFalso();
    const segs = [
      contorno(11, 0, 0, { origem: 'modelo', polygon_points: [] }),
      contorno(12, 0, 0, { origem: 'modelo', polygon_points: [[1, 1], [2, 2]] }),
    ];
    expect(() => renderMarksToContext(f.ctx, [], 'numbers', 900, 1, segs)).not.toThrow();
    expect(f.textos).toHaveLength(0);
  });

  it('largura de imagem inválida ainda desenha, com o raio mínimo', () => {
    const f = contextoFalso();
    renderMarksToContext(f.ctx, [marca(1, 5, 5)], 'dots', 0);
    const raios = so(f.chamadas, 'arc').map((c) => c.args[2] as number);
    expect(raios.every((r) => Number.isFinite(r) && r > 0)).toBe(true);
  });
});
