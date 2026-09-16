// =============================================================================
// SeedCounter — a lista canônica de objetos da cena
//
// UM objeto = uma semente contada. Ele pode ser uma marcação (com ou sem
// contorno) ou um contorno que representa uma semente sozinho (proposto por
// modelo, ensaio ou detecção, e sem marcação correspondente).
//
// POR QUE EXISTE. A contagem (`contagem.ts`) incluía contornos do modelo, mas
// a tabela de medidas percorria só as marcações: uma semente detectada por
// IA sem marca era contada, aparecia no canvas, e NÃO tinha linha no CSV,
// índice ao apertar "2", nem medida na morfometria. Cada tela enumerava do
// seu jeito. Agora todas enumeram daqui, na mesma ordem, com o mesmo índice:
// canvas, lista do inspetor, tabela de medidas, CSV.
//
// ORDEM. Marcações primeiro, na ordem em que foram feitas; depois os contornos
// órfãos, na ordem em que entraram. É a ordem que a pessoa vê acontecer.
//
// PAREAMENTO marcação ↔ contorno, nesta ordem: (1) `marcaId` declarado no
// contorno — a onda grava de quem veio; (2) o contorno que CONTÉM a marcação;
// (3) o mais próximo cujo raio próprio alcança a marcação. Cada contorno
// pareia com no máximo uma marcação.
// =============================================================================

import type { Mark, YoloSegmentation } from '../types';

export type Ponto = [number, number];

export interface ObjetoDaCena {
  /** 1..N, global (não por classe): é o número que aparece no canvas e no CSV. */
  indice: number;
  categoria: 'viable' | 'inviable';
  marca?: Mark;
  contorno?: YoloSegmentation;
  /** Posição de referência: a marcação, ou o centroide do contorno. */
  x: number;
  y: number;
  /** 'marca' = só marcação; 'marca+contorno'; 'contorno' = proposto sem marca. */
  natureza: 'marca' | 'marca+contorno' | 'contorno';
}

/** Ponto dentro de polígono (par-ímpar). Independe de escala. */
export function pointInPolygon(px: number, py: number, poly: Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cruza = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Centroide (média dos vértices) de um polígono. */
export function centroideDoPoligono(points: Ponto[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/** Maior distância do centroide a um vértice — o "raio" próprio do contorno. */
export function raioDoContorno(poly: Ponto[], c: { x: number; y: number }): number {
  let maior = 0;
  for (const [x, y] of poly) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d > maior) maior = d;
  }
  return maior;
}

/**
 * Um contorno representa uma semente por si só?
 *
 * Contorno oculto não conta — esconder é a forma de rejeitar uma proposta.
 * Contorno vindo de clique é a FORMA de uma marcação, não uma segunda semente.
 * Sem origem declarada conta, para não quebrar sessão antiga.
 */
export function contornoRepresentaSemente(seg: YoloSegmentation): boolean {
  return seg.visible !== false && seg.origem !== 'clique';
}

export interface OpcoesDeEnumeracao {
  /** Piso do raio de pareamento por proximidade, em px. Padrão 25. */
  raioMinimo?: number;
}

/**
 * Enumera os objetos da cena — a lista que todo mundo usa.
 */
export function enumerarObjetos(
  marks: Mark[],
  segmentacoes: YoloSegmentation[],
  opcoes: OpcoesDeEnumeracao = {}
): ObjetoDaCena[] {
  const raioMinimo = opcoes.raioMinimo ?? 25;
  const contornos = segmentacoes
    .filter((s) => s.visible !== false && s.polygon_points?.length >= 3)
    .map((s) => ({ seg: s, c: centroideDoPoligono(s.polygon_points) }));
  const usados = new Set<number>();
  const objetos: ObjetoDaCena[] = [];

  for (const marca of marks) {
    let melhor: (typeof contornos)[number] | null = null;

    // (1) vínculo declarado
    for (const c of contornos) {
      if (!usados.has(c.seg.id) && c.seg.marcaId === marca.id) {
        melhor = c;
        break;
      }
    }
    // (2) contém a marcação
    if (!melhor) {
      for (const c of contornos) {
        if (usados.has(c.seg.id)) continue;
        if (pointInPolygon(marca.x, marca.y, c.seg.polygon_points)) {
          melhor = c;
          break;
        }
      }
    }
    // (3) mais próximo dentro do próprio raio (com folga de 20%)
    if (!melhor) {
      let melhorDist = Infinity;
      for (const c of contornos) {
        if (usados.has(c.seg.id)) continue;
        const d = Math.hypot(c.c.x - marca.x, c.c.y - marca.y);
        const limite = Math.max(raioMinimo, raioDoContorno(c.seg.polygon_points, c.c) * 1.2);
        if (d < limite && d < melhorDist) {
          melhorDist = d;
          melhor = c;
        }
      }
    }

    if (melhor) usados.add(melhor.seg.id);
    objetos.push({
      indice: objetos.length + 1,
      categoria: marca.type,
      marca,
      contorno: melhor?.seg,
      x: marca.x,
      y: marca.y,
      natureza: melhor ? 'marca+contorno' : 'marca',
    });
  }

  // Contornos órfãos que valem por uma semente.
  for (const c of contornos) {
    if (usados.has(c.seg.id)) continue;
    if (!contornoRepresentaSemente(c.seg)) continue;
    objetos.push({
      indice: objetos.length + 1,
      categoria: c.seg.category,
      contorno: c.seg,
      x: c.c.x,
      y: c.c.y,
      natureza: 'contorno',
    });
  }

  return objetos;
}
