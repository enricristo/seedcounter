// =============================================================================
// Borracha de contorno.
//
// A afirmação que estes testes têm de sustentar é a que distingue esta
// ferramenta de uma borracha de pintura: depois de raspar, a fronteira NÃO fica
// onde o cursor passou — ela vai para a borda de verdade mais próxima que
// respeita a raspada.
//
// Por isso a cena é sintética com borda conhecida: dá para perguntar "o contorno
// caiu sobre o degrau de cor?" e ter uma resposta numérica, em vez de olhar um
// desenho e achar que ficou bom.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  acharCorte,
  ajustarContorno,
  campoDeCusto,
  menorCaminho,
  rasterizar,
  type Ponto,
} from '../borracha';
import type { DadosImagem } from '../color-features';

// ---------------------------------------------------------------------------
// Cena: um retângulo escuro sobre fundo claro, com borda nítida.
// ---------------------------------------------------------------------------

const LARGURA = 160;
const ALTURA = 120;
const OBJETO = { x0: 40, y0: 30, x1: 110, y1: 90 };

function cena(): DadosImagem {
  const data = new Uint8ClampedArray(LARGURA * ALTURA * 4);
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const dentro = x >= OBJETO.x0 && x < OBJETO.x1 && y >= OBJETO.y0 && y < OBJETO.y1;
      const v = dentro ? 55 : 225;
      const i = (y * LARGURA + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: LARGURA, height: ALTURA };
}

/** O contorno correto do objeto, como a onda o teria devolvido. */
function contornoCerto(): Ponto[] {
  return [
    [OBJETO.x0, OBJETO.y0],
    [OBJETO.x1 - 1, OBJETO.y0],
    [OBJETO.x1 - 1, OBJETO.y1 - 1],
    [OBJETO.x0, OBJETO.y1 - 1],
  ];
}

/**
 * Um contorno que VAZOU: engoliu uma faixa de fundo à direita, como acontece
 * quando a onda escapa para a vizinha encostada.
 */
function contornoVazado(): Ponto[] {
  return [
    [OBJETO.x0, OBJETO.y0],
    [OBJETO.x1 + 28, OBJETO.y0],
    [OBJETO.x1 + 28, OBJETO.y1 - 1],
    [OBJETO.x0, OBJETO.y1 - 1],
  ];
}

/** Densifica um polígono, porque o corte trabalha por vértice. */
function densificar(poligono: Ponto[], passo = 3): Ponto[] {
  const saida: Ponto[] = [];
  for (let i = 0; i < poligono.length; i++) {
    const [ax, ay] = poligono[i];
    const [bx, by] = poligono[(i + 1) % poligono.length];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / passo));
    for (let k = 0; k < n; k++) {
      saida.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
  }
  return saida;
}

/** Maior x atingido pelo contorno — mede o quanto ele avança para a direita. */
const maiorX = (c: Ponto[]) => Math.max(...c.map((p) => p[0]));

describe('rasterizar', () => {
  it('pinta o interior do polígono', () => {
    const m = rasterizar(
      [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
      ],
      0,
      0,
      12,
      12
    );
    expect(m[5 * 12 + 5]).toBe(1);
    expect(m[0]).toBe(0);
    expect(m[11 * 12 + 11]).toBe(0);
  });

  it('não deixa buraco quando a varredura passa por um vértice', () => {
    // É o caso em que a regra par-ímpar ingênua falha.
    const m = rasterizar(
      [
        [2, 2],
        [10, 6],
        [2, 10],
      ],
      0,
      0,
      14,
      14
    );
    expect(m[6 * 14 + 4]).toBe(1);
  });
});

describe('acharCorte', () => {
  const contorno = densificar(contornoCerto());

  it('devolve nulo quando o traço não encosta no contorno', () => {
    // Nada tocado, nada a refazer — e dizer isso é melhor que devolver o
    // contorno igual, que esconderia do chamador que nada aconteceu.
    const proibido = new Uint8Array(LARGURA * ALTURA);
    expect(acharCorte(contorno, proibido, 0, 0, LARGURA, ALTURA)).toBeNull();
  });

  it('devolve nulo quando o traço cobre o contorno inteiro', () => {
    // Sem fronteira íntegra não há onde ancorar o caminho novo.
    const proibido = new Uint8Array(LARGURA * ALTURA).fill(1);
    expect(acharCorte(contorno, proibido, 0, 0, LARGURA, ALTURA)).toBeNull();
  });

  it('escolhe o trecho MAIS LONGO quando o traço toca em vários lugares', () => {
    // Toques curtos são reencostões do cursor; refazer por eles produziria um
    // contorno diferente do que a pessoa está vendo.
    const proibido = new Uint8Array(LARGURA * ALTURA);
    const marcar = (x: number, y: number) => {
      proibido[y * LARGURA + x] = 1;
    };
    // Um toque de 1 vértice no topo e um trecho longo na direita.
    marcar(Math.round(contorno[1][0]), Math.round(contorno[1][1]));
    for (let y = 40; y < 80; y++) marcar(OBJETO.x1 - 1, y);

    const corte = acharCorte(contorno, proibido, 0, 0, LARGURA, ALTURA)!;
    expect(corte).not.toBeNull();
    expect(corte.quantidade).toBeGreaterThan(3);
  });
});

describe('menorCaminho', () => {
  it('prefere o corredor barato ao atalho caro', () => {
    // Campo 9x9: uma faixa de custo quase zero em y=6. O caminho reto de (0,0)
    // a (8,0) seria mais curto, mas o destino está em y=6.
    const L = 9;
    const A = 9;
    const permitido = new Uint8Array(L * A).fill(1);
    const custo = new Float32Array(L * A).fill(1);
    for (let x = 0; x < L; x++) custo[6 * L + x] = 0.01;

    const caminho = menorCaminho([0, 6], [8, 6], permitido, custo, L, A)!;
    expect(caminho).not.toBeNull();
    // Deve andar pela faixa barata, não subir e descer.
    expect(caminho.every(([, y]) => y === 6)).toBe(true);
  });

  it('devolve nulo quando os extremos ficam isolados', () => {
    const L = 9;
    const A = 9;
    const permitido = new Uint8Array(L * A);
    permitido[0] = 1;
    const custo = new Float32Array(L * A).fill(1);
    expect(menorCaminho([0, 0], [8, 8], permitido, custo, L, A)).toBeNull();
  });
});

describe('campoDeCusto', () => {
  it('a borda é barata e a região lisa é cara', () => {
    const custo = campoDeCusto(cena(), 0, 0, LARGURA, ALTURA, 0);
    const naBorda = custo[50 * LARGURA + OBJETO.x0];
    const noLiso = custo[50 * LARGURA + 20];
    expect(naBorda).toBeLessThan(noLiso);
  });

  it('a normalização é pela janela, não por constante', () => {
    // Scanner e lupa têm faixas de gradiente completamente diferentes; um
    // limiar fixo serviria a uma e não à outra. O custo máximo tem de ficar
    // na mesma escala nas duas.
    const forte = campoDeCusto(cena(), 0, 0, LARGURA, ALTURA, 0);
    const fraca = (() => {
      const c = cena();
      // Metade do contraste.
      for (let i = 0; i < c.data.length; i += 4) {
        const v = 140 + (c.data[i] - 140) * 0.5;
        c.data[i] = c.data[i + 1] = c.data[i + 2] = v;
      }
      return campoDeCusto(c, 0, 0, LARGURA, ALTURA, 0);
    })();

    const min = (a: Float32Array) => Math.min(...Array.from(a));
    expect(min(forte)).toBeCloseTo(min(fraca), 3);
  });
});

describe('ajustarContorno — remover', () => {
  it('PUXA a fronteira para a borda de verdade, não para onde o cursor passou', () => {
    // Este é o teste que define a ferramenta. O contorno vazou 28 px para a
    // direita; a raspada cobre essa faixa. Se a borracha fosse de pintura, a
    // nova fronteira seria o arco do cursor. Aqui ela tem de cair sobre o
    // degrau de cor.
    const contorno = densificar(contornoVazado());
    const pinceladas = [];
    for (let y = OBJETO.y0 + 4; y < OBJETO.y1 - 4; y += 4) {
      pinceladas.push({ x: OBJETO.x1 + 14, y, raio: 16 });
    }

    const r = ajustarContorno(cena(), contorno, pinceladas, 'remover')!;
    expect(r).not.toBeNull();

    const antes = maiorX(contorno);
    const depois = maiorX(r.contorno);
    expect(antes).toBeCloseTo(OBJETO.x1 + 28, 0);
    // A fronteira recuou até a borda real, com folga de poucos pixels.
    expect(depois).toBeLessThan(antes - 20);
    expect(Math.abs(depois - (OBJETO.x1 - 1))).toBeLessThanOrEqual(4);
  });

  it('não mexe no que o traço não tocou', () => {
    const contorno = densificar(contornoVazado());
    const pinceladas = [{ x: OBJETO.x1 + 14, y: 60, raio: 14 }];
    const r = ajustarContorno(cena(), contorno, pinceladas, 'remover')!;

    // A borda esquerda continua onde estava.
    const menorX = (c: Ponto[]) => Math.min(...c.map((p) => p[0]));
    expect(menorX(r.contorno)).toBeCloseTo(OBJETO.x0, 0);
  });

  it('a correcao fica ONDE FOI PEDIDA — a borda longe do traço não se mexe', () => {
    // Sem a faixa de vizinhança, o caminho de menor custo dava a volta no objeto
    // inteiro colado na borda real: matematicamente o mais barato, e não o que a
    // pessoa pediu. Raspar a direita não pode reescrever a esquerda.
    const contorno = densificar(contornoVazado());
    const pinceladas = [];
    for (let y = OBJETO.y0 + 4; y < OBJETO.y1 - 4; y += 4) {
      pinceladas.push({ x: OBJETO.x1 + 14, y, raio: 16 });
    }
    const r = ajustarContorno(cena(), contorno, pinceladas, 'remover')!;

    const menorX = (c: Ponto[]) => Math.min(...c.map((p) => p[0]));
    const menorY = (c: Ponto[]) => Math.min(...c.map((p) => p[1]));
    const maiorY = (c: Ponto[]) => Math.max(...c.map((p) => p[1]));
    expect(menorX(r.contorno)).toBeCloseTo(menorX(contorno), 0);
    expect(menorY(r.contorno)).toBeCloseTo(menorY(contorno), 0);
    expect(maiorY(r.contorno)).toBeCloseTo(maiorY(contorno), 0);
  });

  it('devolve nulo quando o traço passa longe', () => {
    const contorno = densificar(contornoCerto());
    const r = ajustarContorno(cena(), contorno, [{ x: 5, y: 5, raio: 3 }], 'remover');
    expect(r).toBeNull();
  });

  it('devolve nulo em contorno degenerado, em vez de inventar', () => {
    expect(
      ajustarContorno(cena(), [[10, 10]] as Ponto[], [{ x: 10, y: 10, raio: 5 }], 'remover')
    ).toBeNull();
    expect(ajustarContorno(cena(), densificar(contornoCerto()), [], 'remover')).toBeNull();
  });
});

describe('ajustarContorno — acrescentar', () => {
  it('EMPURRA a fronteira para fora, incluindo a região pintada', () => {
    // A borracha inversa é o mesmo algoritmo com o outro conjunto de pixels
    // permitidos: o caminho anda FORA do contorno velho.
    const contorno = densificar([
      [OBJETO.x0, OBJETO.y0],
      [OBJETO.x1 - 22, OBJETO.y0],
      [OBJETO.x1 - 22, OBJETO.y1 - 1],
      [OBJETO.x0, OBJETO.y1 - 1],
    ]);

    const pinceladas = [];
    for (let y = OBJETO.y0 + 6; y < OBJETO.y1 - 6; y += 4) {
      pinceladas.push({ x: OBJETO.x1 - 14, y, raio: 12 });
    }

    const r = ajustarContorno(cena(), contorno, pinceladas, 'acrescentar')!;
    expect(r).not.toBeNull();
    expect(maiorX(r.contorno)).toBeGreaterThan(maiorX(contorno));
  });

  it('os dois modos são simétricos: nenhum cresce quando devia encolher', () => {
    const contorno = densificar(contornoVazado());
    const pinceladas = [{ x: OBJETO.x1 + 14, y: 60, raio: 15 }];

    const removido = ajustarContorno(cena(), contorno, pinceladas, 'remover');
    expect(removido).not.toBeNull();
    expect(maiorX(removido!.contorno)).toBeLessThanOrEqual(maiorX(contorno));
  });
});

describe('o contorno devolvido continua utilizável', () => {
  it('é um polígono fechado com vértices suficientes', () => {
    const contorno = densificar(contornoVazado());
    const pinceladas = [];
    for (let y = OBJETO.y0 + 4; y < OBJETO.y1 - 4; y += 4) {
      pinceladas.push({ x: OBJETO.x1 + 14, y, raio: 16 });
    }
    const r = ajustarContorno(cena(), contorno, pinceladas, 'remover')!;

    expect(r.contorno.length).toBeGreaterThanOrEqual(3);
    expect(r.contorno.length).toBeLessThanOrEqual(64);
    expect(r.verticesRefeitos).toBeGreaterThan(0);
    for (const [x, y] of r.contorno) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });
});
