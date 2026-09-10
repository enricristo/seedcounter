// =============================================================================
// Corte por concavidade.
//
// A afirmacao a sustentar: um contorno em forma de AMENDOIM — duas sementes
// encostadas — e cortado no lugar mais estreito, e uma semente sozinha NAO e
// cortada. O segundo importa mais que o primeiro: cortar por engano vira duas
// sementes onde havia uma, e o numero do laudo sobe.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  CORTE_PARA_SEMENTE_ALONGADA,
  acharReentrancias,
  areaDoPoligono,
  fatiar,
  proporCorte,
  type Ponto,
} from '../corte-por-concavidade';

/** Elipse: uma semente sozinha. */
function elipse(cx: number, cy: number, a: number, b: number, n = 48): Ponto[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + a * Math.cos(t), cy + b * Math.sin(t)] as Ponto;
  });
}

/**
 * Duas sementes encostadas: o contorno da UNIAO de dois discos que se sobrepoem.
 *
 * A primeira versao deste ajudante modulava o raio de uma elipse e produzia uma
 * forma CONVEXA — o fecho convexo devolvia todos os vertices, e nao havia
 * cintura nenhuma para achar. O teste falhava por culpa do teste.
 *
 * Uniao de discos e o caso fisico de verdade, e tem cintura por construcao:
 * `separacao` e a distancia entre os centros em fracao do raio. Perto de 0 os
 * discos coincidem (sem cintura); perto de 2 eles mal se tocam (cintura funda).
 */
function duasEncostadas(
  cx: number,
  cy: number,
  raio: number,
  separacao = 1.2,
  n = 72
): Ponto[] {
  const d = (raio * separacao) / 2;
  const centros: Ponto[] = [
    [cx - d, cy],
    [cx + d, cy],
  ];

  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const ux = Math.cos(t);
    const uy = Math.sin(t);

    // Distancia ate a saida do raio em cada disco; a uniao fica com a MAIOR.
    let melhor = 0;
    for (const [ccx, ccy] of centros) {
      const vx = ccx - cx;
      const vy = ccy - cy;
      const proj = ux * vx + uy * vy;
      const disc = raio * raio - (vx * vx + vy * vy) + proj * proj;
      if (disc <= 0) continue;
      const s = proj + Math.sqrt(disc);
      if (s > melhor) melhor = s;
    }
    return [cx + ux * melhor, cy + uy * melhor] as Ponto;
  });
}

describe('acharReentrancias', () => {
  it('a elipse nao tem reentrancia funda', () => {
    const r = acharReentrancias(elipse(100, 100, 60, 30));
    const raio = Math.sqrt(areaDoPoligono(elipse(100, 100, 60, 30)) / Math.PI);
    for (const re of r) expect(re.profundidade / raio).toBeLessThan(0.15);
  });

  it('o amendoim tem DUAS reentrancias fundas', () => {
    const c = duasEncostadas(100, 100, 40, 1.35);
    const raio = Math.sqrt(areaDoPoligono(c) / Math.PI);
    // Dois DISCOS produzem cintura rasa por geometria — 0,153 do raio
    // equivalente — porque o fecho de duas rodelas ja e quase a propria forma.
    // Semente alongada produz muito mais fundo (0,852 medido em orquideia).
    const fundas = acharReentrancias(c).filter((re) => re.profundidade / raio > 0.1);
    expect(fundas.length).toBeGreaterThanOrEqual(2);
  });

  it('a profundidade NUNCA passa do raio equivalente vezes dois', () => {
    // O bug ja cometido neste projeto: medir contra a corda inteira devolve o
    // DIAMETRO do objeto, nao a reentrancia, e o numero sai absurdo.
    for (const c of [elipse(100, 100, 60, 30), duasEncostadas(100, 100, 40, 1.35)]) {
      const raio = Math.sqrt(areaDoPoligono(c) / Math.PI);
      for (const re of acharReentrancias(c)) {
        expect(re.profundidade / raio).toBeLessThan(2);
      }
    }
  });

  it('contorno curto demais nao produz reentrancia', () => {
    expect(acharReentrancias([[0, 0], [10, 0], [5, 10]])).toEqual([]);
  });
});

describe('proporCorte', () => {
  it('NAO corta uma semente sozinha', () => {
    // E o teste que mais importa: cortar por engano sobe o numero do laudo.
    expect(proporCorte(elipse(100, 100, 60, 30))).toBeNull();
    expect(proporCorte(elipse(100, 100, 40, 40))).toBeNull();
    expect(proporCorte(elipse(100, 100, 80, 20))).toBeNull();
  });

  it('CORTA o amendoim', () => {
    const r = proporCorte(duasEncostadas(100, 100, 40, 1.35));
    expect(r).not.toBeNull();
    expect(r!.partes[0].length).toBeGreaterThanOrEqual(3);
    expect(r!.partes[1].length).toBeGreaterThanOrEqual(3);
  });

  it('corta no lugar MAIS ESTREITO', () => {
    // A cintura do amendoim esta em x = cx. O corte tem de passar por la.
    const r = proporCorte(duasEncostadas(100, 100, 40, 1.35))!;
    const [a, b] = r.linha;
    expect(Math.abs(a[0] - 100)).toBeLessThan(14);
    expect(Math.abs(b[0] - 100)).toBeLessThan(14);
    // E os dois lados do corte ficam em metades opostas.
    expect(Math.sign(a[1] - 100)).not.toBe(Math.sign(b[1] - 100));
  });

  it('as duas metades somam aproximadamente a area do todo', () => {
    const c = duasEncostadas(100, 100, 40, 1.35);
    const r = proporCorte(c)!;
    const soma = areaDoPoligono(r.partes[0]) + areaDoPoligono(r.partes[1]);
    expect(soma).toBeGreaterThan(areaDoPoligono(c) * 0.9);
    expect(soma).toBeLessThan(areaDoPoligono(c) * 1.1);
  });

  it('cintura rasa NAO e cortada', () => {
    // Feitio da semente — hilo, bico — nao pode virar corte.
    expect(proporCorte(duasEncostadas(100, 100, 40, 0.35))).toBeNull();
    expect(proporCorte(duasEncostadas(100, 100, 40, 0.75))).toBeNull();
  });

  it('o preset de semente ALONGADA e mais exigente que o padrao', () => {
    // Orquideia isolada ja tem profundidade relativa mediana 0,199: com o
    // padrao de 0,15 a semente sadia seria cortada ao meio.
    const par = duasEncostadas(100, 100, 40, 1.35);
    expect(proporCorte(par)).not.toBeNull();
    expect(proporCorte(par, CORTE_PARA_SEMENTE_ALONGADA)).toBeNull();
  });

  it('cintura profunda e cortada', () => {
    expect(proporCorte(duasEncostadas(100, 100, 40, 1.5))).not.toBeNull();
  });

  it('o limiar e ajustavel, e afrouxa-lo corta mais', () => {
    const rasa = duasEncostadas(100, 100, 40, 0.75);
    expect(proporCorte(rasa)).toBeNull();
    expect(proporCorte(rasa, { profundidadeMinima: 0.05 })).not.toBeNull();
  });

  it('exige que as reentrancias estejam SEPARADAS no contorno', () => {
    // Duas reentrancias vizinhas sao a mesma dobra vista duas vezes, nao uma
    // cintura. A separacao maxima possivel e METADE do perimetro — que e
    // exatamente onde as duas cinturas de um par ficam. Pedir mais que isso
    // nunca aceita nada, e o teste fixa esse teto.
    const c = duasEncostadas(100, 100, 40, 1.35);
    expect(proporCorte(c, { separacaoMinima: 0.2 })).not.toBeNull();
    expect(proporCorte(c, { separacaoMinima: 0.51 })).toBeNull();
  });

  it('nao quebra com entrada degenerada', () => {
    expect(proporCorte([])).toBeNull();
    expect(proporCorte([[0, 0], [1, 1], [2, 2]])).toBeNull();
  });
});

describe('fatiar', () => {
  it('cada metade fica com os DOIS pontos do corte', () => {
    // Sem isso as metades seriam arcos abertos, nao poligonos.
    const c = elipse(100, 100, 60, 30, 20);
    const [p, q] = fatiar(c, 3, 13)!;
    expect(p[0]).toEqual(c[3]);
    expect(p[p.length - 1]).toEqual(c[13]);
    expect(q[0]).toEqual(c[13]);
    expect(q[q.length - 1]).toEqual(c[3]);
  });

  it('recusa corte que deixaria metade degenerada', () => {
    const c = elipse(100, 100, 60, 30, 20);
    expect(fatiar(c, 3, 4)).toBeNull();
  });
});
