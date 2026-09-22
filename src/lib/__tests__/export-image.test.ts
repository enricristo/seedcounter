// =============================================================================
// A foto anotada.
//
// O que é puro (filtro da cena, resumo, dimensões da caixa, cabeçalho) é
// testado direto. O desenho é testado com um contexto 2D falso que registra
// as chamadas — o suficiente para provar que a legenda escreve o número da
// enumeração canônica e que omitir uma classe não renumera a outra.
//
// FORA DO TESTE, E POR QUÊ. `drawAnnotatedImageToCanvas` faz uma coisa a
// mais que `desenharCenaAnotada`: `canvas.getContext('2d')`. O ambiente é
// node, sem canvas; instalar um seria uma dependência nova por uma linha.
// O que se testa dela é o único ramo próprio: sem contexto devolve `null`.
// A rasterização em si (o PNG ficar igual ao canvas ao vivo) só se prova
// no navegador.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  desenharCenaAnotada,
  dimensoesDaCaixa,
  drawAnnotatedImageToCanvas,
  filtrarCena,
  linhasDeCabecalho,
  resumoDaCena,
  type ImageExportOptions,
} from '../export-image';
import { enumerarObjetos } from '../objetos';
import type { Mark, Metadata, YoloSegmentation } from '../../types';

type Chamada = { nome: string; args: unknown[] };

function contextoFalso() {
  const chamadas: Chamada[] = [];
  const textos: string[] = [];
  const registrar =
    (nome: string) =>
    (...args: unknown[]) => {
      chamadas.push({ nome, args });
    };
  const ctx = {
    drawImage: registrar('drawImage'),
    beginPath: registrar('beginPath'),
    closePath: registrar('closePath'),
    arc: registrar('arc'),
    fill: registrar('fill'),
    stroke: registrar('stroke'),
    setLineDash: registrar('setLineDash'),
    moveTo: registrar('moveTo'),
    lineTo: registrar('lineTo'),
    roundRect: registrar('roundRect'),
    save: registrar('save'),
    restore: registrar('restore'),
    fillText: (texto: string, x: number, y: number) => {
      chamadas.push({ nome: 'fillText', args: [texto, x, y] });
      textos.push(texto);
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas, textos };
}

const imagem = (width = 900, height = 600) =>
  ({ width, height }) as unknown as HTMLImageElement;

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

const tudo: ImageExportOptions = { includeViable: true, includeInviable: true, overlayType: 'none' };
const metadados: Metadata = {
  researcher: 'Ana',
  project: '',
  treatment: '',
  plate: 'P3',
  quadrant: 'Q2',
  notes: '',
};

describe('filtrarCena', () => {
  it('omite uma classe sem renumerar a outra', () => {
    const objetos = enumerarObjetos(
      [marca(1, 10, 10, 'viable'), marca(2, 20, 20, 'inviable'), marca(3, 30, 30, 'viable')],
      []
    );
    const soInviaveis = filtrarCena(objetos, { includeViable: false, includeInviable: true });
    expect(soInviaveis.map((o) => o.indice)).toEqual([2]);
    const soViaveis = filtrarCena(objetos, { includeViable: true, includeInviable: false });
    expect(soViaveis.map((o) => o.indice)).toEqual([1, 3]);
  });

  it('nenhuma classe → lista vazia; lista vazia → lista vazia', () => {
    const objetos = enumerarObjetos([marca(1, 10, 10)], []);
    expect(filtrarCena(objetos, { includeViable: false, includeInviable: false })).toEqual([]);
    expect(filtrarCena([], tudo)).toEqual([]);
  });
});

describe('resumoDaCena', () => {
  it('cena vazia é zero em tudo, sem NaN', () => {
    expect(resumoDaCena([])).toEqual({ viaveis: 0, inviaveis: 0, total: 0, pctViaveis: 0, pctInviaveis: 0 });
  });

  it('os percentuais são complementares e somam 100', () => {
    const objetos = enumerarObjetos(
      [marca(1, 1, 1), marca(2, 2, 2), marca(3, 3, 3, 'inviable')],
      []
    );
    const r = resumoDaCena(objetos);
    expect(r).toMatchObject({ viaveis: 2, inviaveis: 1, total: 3 });
    expect(r.pctViaveis + r.pctInviaveis).toBe(100);
  });

  it('semente clicada (marcação + contorno) conta UMA vez — o defeito original contava duas', () => {
    const marks = [marca(1, 100, 100)];
    const segs = [contorno(10, 100, 100, { origem: 'clique', marcaId: 1 })];
    expect(resumoDaCena(enumerarObjetos(marks, segs)).total).toBe(1);
  });
});

describe('dimensoesDaCaixa', () => {
  it('"none" não tem caixa', () => {
    expect(dimensoesDaCaixa('none', 3)).toEqual({ largura: 0, altura: 0 });
  });

  it('cresce uma linha de texto por linha de identificação além da primeira', () => {
    const base = dimensoesDaCaixa('table', 1).altura;
    expect(dimensoesDaCaixa('table', 0).altura).toBe(base);
    expect(dimensoesDaCaixa('table', 2).altura).toBe(base + 24);
    expect(dimensoesDaCaixa('table', 3).altura).toBe(base + 48);
  });

  it('"both" é mais alta que cada parte sozinha', () => {
    expect(dimensoesDaCaixa('both', 1).altura).toBeGreaterThan(dimensoesDaCaixa('table', 1).altura);
    expect(dimensoesDaCaixa('both', 1).altura).toBeGreaterThan(dimensoesDaCaixa('chart', 1).altura);
  });

  it('contagem de linhas inválida não produz altura inválida', () => {
    expect(Number.isFinite(dimensoesDaCaixa('chart', Number.NaN).altura)).toBe(true);
    expect(dimensoesDaCaixa('chart', -5).altura).toBe(dimensoesDaCaixa('chart', 0).altura);
  });
});

describe('linhasDeCabecalho', () => {
  it('pesquisador e detalhes viram duas linhas', () => {
    expect(linhasDeCabecalho(metadados)).toEqual(['Pesquisador: Ana', 'Placa: P3 | Quad: Q2']);
  });

  it('campo em branco ou ausente não vira rótulo vazio', () => {
    expect(linhasDeCabecalho({ researcher: '   ', plate: '', quadrant: 'Q1' })).toEqual(['Quad: Q1']);
    expect(linhasDeCabecalho({})).toEqual([]);
    expect(linhasDeCabecalho(undefined)).toEqual([]);
    expect(linhasDeCabecalho(null)).toEqual([]);
  });
});

describe('desenharCenaAnotada', () => {
  const so = (chamadas: Chamada[], nome: string) => chamadas.filter((c) => c.nome === nome);

  it('desenha a imagem, os contornos e as marcas; sem sobreposição não escreve texto', () => {
    const f = contextoFalso();
    const marks = [marca(1, 100, 100)];
    const segs = [contorno(11, 400, 400, { origem: 'modelo' })];
    const resumo = desenharCenaAnotada(f.ctx, imagem(), metadados, marks, segs, tudo, 'dots', 1);

    expect(so(f.chamadas, 'drawImage')).toHaveLength(1);
    expect(so(f.chamadas, 'lineTo').length).toBeGreaterThanOrEqual(3);
    expect(f.textos).toEqual([]);
    expect(resumo.total).toBe(2);
  });

  it('a legenda escreve o total da enumeração canônica, não marcas + contornos', () => {
    const f = contextoFalso();
    const marks = [marca(1, 100, 100)];
    const segs = [contorno(10, 100, 100, { origem: 'clique', marcaId: 1 })];
    desenharCenaAnotada(f.ctx, imagem(), metadados, marks, segs, { ...tudo, overlayType: 'table' }, 'dots', 1);

    expect(f.textos).toContain('Relatório de Viabilidade');
    expect(f.textos).toContain('Pesquisador: Ana');
    expect(f.textos).toContain('1 (100%)');
    expect(f.textos).toContain('0 (0%)');
    expect(f.textos.at(-1)).toBe('1');
  });

  it('só inviáveis: o índice escrito é o do CSV, e a legenda conta só o que aparece', () => {
    const f = contextoFalso();
    const marks = [marca(1, 10, 10, 'viable'), marca(2, 20, 20, 'inviable'), marca(3, 30, 30, 'viable')];
    const resumo = desenharCenaAnotada(
      f.ctx,
      imagem(),
      metadados,
      marks,
      [],
      { includeViable: false, includeInviable: true, overlayType: 'chart' },
      'numbers',
      1
    );
    expect(f.textos[0]).toBe('2');
    expect(resumo).toMatchObject({ viaveis: 0, inviaveis: 1, total: 1 });
    expect(f.textos).toContain('Viáveis (0)  |  Inviáveis (1)');
  });

  it('contorno da classe omitida não é desenhado', () => {
    const f = contextoFalso();
    const segs = [contorno(11, 400, 400, { origem: 'modelo', category: 'inviable' })];
    desenharCenaAnotada(
      f.ctx,
      imagem(),
      metadados,
      [],
      segs,
      { includeViable: true, includeInviable: false, overlayType: 'none' },
      'dots',
      1
    );
    expect(so(f.chamadas, 'lineTo')).toHaveLength(0);
  });

  it('contorno sem pontos, oculto ou degenerado não quebra nem desenha', () => {
    const f = contextoFalso();
    const segs = [
      contorno(11, 0, 0, { origem: 'modelo', polygon_points: [] }),
      contorno(12, 0, 0, { origem: 'modelo', polygon_points: [[1, 1], [2, 2]] }),
      contorno(13, 50, 50, { origem: 'modelo', visible: false }),
    ];
    expect(() => desenharCenaAnotada(f.ctx, imagem(), metadados, [], segs, tudo, 'dots', 1)).not.toThrow();
    expect(so(f.chamadas, 'lineTo')).toHaveLength(0);
  });

  it('cena vazia com gráfico desenha o disco neutro e a legenda zerada', () => {
    const f = contextoFalso();
    const resumo = desenharCenaAnotada(f.ctx, imagem(), {}, [], [], { ...tudo, overlayType: 'both' }, 'dots', 1);
    expect(resumo.total).toBe(0);
    expect(f.textos).toContain('0 (0%)');
    expect(f.textos).toContain('Viáveis (0)  |  Inviáveis (0)');
    expect(so(f.chamadas, 'fillText').every((c) => typeof c.args[0] === 'string' && !c.args[0].includes('NaN'))).toBe(true);
  });

  it('estilo e opacidade da marca chegam à exportação — o PNG sai como o canvas ao vivo', () => {
    const f = contextoFalso();
    desenharCenaAnotada(f.ctx, imagem(), metadados, [marca(1, 50, 50, 'inviable')], [], tudo, 'dots', 1, {
      estiloDaMarca: 'anel',
      opacidadeDaMarca: 0.5,
    });
    const tracejados = so(f.chamadas, 'setLineDash').map((c) => c.args[0] as number[]);
    expect(tracejados.some((d) => d.length === 2)).toBe(true);
  });

  it('a legenda não herda a opacidade da marca', () => {
    // A legenda entra em save/restore com alfa 1: a transparência escolhida
    // para a marca não pode apagar o texto do relatório.
    const f = contextoFalso();
    desenharCenaAnotada(f.ctx, imagem(), metadados, [marca(1, 50, 50)], [], { ...tudo, overlayType: 'table' }, 'dots', 1, {
      opacidadeDaMarca: 0.3,
    });
    expect(so(f.chamadas, 'save')).toHaveLength(1);
    expect(so(f.chamadas, 'restore')).toHaveLength(1);
    expect(f.ctx.globalAlpha).toBe(1);
  });
});

describe('drawAnnotatedImageToCanvas', () => {
  it('sem contexto 2D devolve null em vez de fingir que exportou', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(drawAnnotatedImageToCanvas(canvas, imagem(), metadados, [], [], tudo, 'dots', 1)).toBeNull();
  });

  it('com contexto, delega e devolve o resumo', () => {
    const f = contextoFalso();
    const canvas = { getContext: () => f.ctx } as unknown as HTMLCanvasElement;
    const r = drawAnnotatedImageToCanvas(canvas, imagem(), metadados, [marca(1, 1, 1)], [], tudo, 'dots', 1);
    expect(r?.total).toBe(1);
  });
});
