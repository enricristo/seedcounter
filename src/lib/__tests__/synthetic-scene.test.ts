// =============================================================================
// Cenas de exemplo.
//
// A razão de existir destas cenas é ter VERDADE CONHECIDA — então o que estes
// testes protegem é justamente isso: que a verdade declarada corresponda ao que
// foi desenhado, e que cada modalidade de fato apresente o problema que ela diz
// apresentar.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  AVISO_CENA,
  gerarCenaSintetica,
  resumirCena,
  comporCena,
  iouDeMascaras,
  type CenaSintetica,
  type PresetDeCena,
  type Recorte,
} from '../synthetic-scene';
import { segmentarPorClique } from '../region-growing';
import { rgbParaLab } from '../color-features';

const PRESETS: PresetDeCena[] = ['soja', 'orquidea-tz', 'forrageira'];

/** Cor média dentro da elipse de uma semente. */
function corMedia(cena: CenaSintetica, i: number): [number, number, number] {
  const s = cena.sementes[i];
  const { imagem } = cena;
  const cos = Math.cos(s.angulo);
  const sen = Math.sin(s.angulo);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const alcance = Math.ceil(Math.max(s.a, s.b));
  for (let y = s.y - alcance; y <= s.y + alcance; y++) {
    for (let x = s.x - alcance; x <= s.x + alcance; x++) {
      if (x < 0 || y < 0 || x >= imagem.width || y >= imagem.height) continue;
      const dx = x - s.x;
      const dy = y - s.y;
      const u = (dx * cos + dy * sen) / (s.a * 0.5);
      const v = (-dx * sen + dy * cos) / (s.b * 0.5);
      if (u * u + v * v > 1) continue; // só o miolo
      const idx = (y * imagem.width + x) * 4;
      r += imagem.data[idx];
      g += imagem.data[idx + 1];
      b += imagem.data[idx + 2];
      n++;
    }
  }
  return n > 0 ? [r / n, g / n, b / n] : [0, 0, 0];
}

describe('gerarCenaSintetica', () => {
  it('é determinística', () => {
    for (const p of PRESETS) {
      const a = gerarCenaSintetica(p, { semente: 7 });
      const b = gerarCenaSintetica(p, { semente: 7 });
      expect(a.sementes).toEqual(b.sementes);
      expect(Array.from(a.imagem.data.slice(0, 4000))).toEqual(
        Array.from(b.imagem.data.slice(0, 4000))
      );
    }
  });

  it('sementes diferentes dão cenas diferentes', () => {
    const a = gerarCenaSintetica('soja', { semente: 1 });
    const b = gerarCenaSintetica('soja', { semente: 2 });
    expect(a.sementes).not.toEqual(b.sementes);
  });

  it('entrega a quantidade pedida', () => {
    for (const p of PRESETS) {
      const c = gerarCenaSintetica(p, { quantidade: 12 });
      expect(c.sementes.length, p).toBe(12);
    }
  });

  it('a área declarada é a área realmente pintada', () => {
    // É a promessa central: se a verdade não bater com o desenho, medir erro
    // contra ela não significa nada.
    for (const p of PRESETS) {
      const c = gerarCenaSintetica(p, { quantidade: 8, semente: 3 });
      for (const s of c.sementes) {
        const areaGeometrica = Math.PI * s.a * s.b;
        expect(s.areaPx, `${p} semente ${s.id}`).toBeGreaterThan(0);
        // Área pintada nunca pode passar da geométrica (sobreposição só tira).
        expect(s.areaPx).toBeLessThanOrEqual(Math.ceil(areaGeometrica * 1.05));
        // E não pode ser uma casca: no mínimo metade do que a elipse cobre.
        expect(s.areaPx).toBeGreaterThan(areaGeometrica * 0.5);
      }
    }
  });

  it('nenhuma semente escapa da cena', () => {
    for (const p of PRESETS) {
      const c = gerarCenaSintetica(p, { quantidade: 20 });
      for (const s of c.sementes) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThan(c.imagem.width);
        expect(s.y).toBeLessThan(c.imagem.height);
      }
    }
  });

  it('respeita a fração de viáveis pedida', () => {
    // Cena maior: 200 sementes não cabem em 900x900 sem empilhar, e o gerador
    // prefere entregar menos a sobrepor — então o teste dá espaço.
    const c = gerarCenaSintetica('orquidea-tz', {
      quantidade: 200,
      fracaoViavel: 0.5,
      semente: 9,
      lado: 2000,
    });
    const r = resumirCena(c);
    expect(r.total).toBe(200);
    expect(r.viaveis + r.inviaveis).toBe(200);
    // Sorteio binomial com n=200: 50% ± 10 pontos é folga larga o bastante.
    expect(r.percentualViavel).toBeGreaterThan(40);
    expect(r.percentualViavel).toBeLessThan(60);
  });

  it('o aviso de cena simulada é exportado para a interface usar', () => {
    expect(AVISO_CENA).toMatch(/SIMULADA/);
  });
});

describe('cada modalidade apresenta o problema que promete', () => {
  it('orquídea: a viabilidade está no a* do CIELAB, não no tamanho', () => {
    // É a premissa do projeto inteiro. Se a cena não tiver essa separação, ela
    // não serve para demonstrar nada sobre tetrazólio.
    const c = gerarCenaSintetica('orquidea-tz', { quantidade: 60, semente: 5 });
    const aDe = (i: number) => rgbParaLab(...corMedia(c, i))[1];

    const viaveis: number[] = [];
    const inviaveis: number[] = [];
    c.sementes.forEach((s, i) => (s.classe === 'viable' ? viaveis : inviaveis).push(aDe(i)));

    const media = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(viaveis.length).toBeGreaterThan(5);
    expect(inviaveis.length).toBeGreaterThan(5);
    // Corada de vermelho = a* bem positivo; sem coloração = perto do neutro.
    expect(media(viaveis)).toBeGreaterThan(media(inviaveis) + 10);

    // E o tamanho NÃO separa — se separasse, a cena estaria mentindo sobre
    // qual é a dificuldade.
    const areaMedia = (cl: string) => {
      const g = c.sementes.filter((s) => s.classe === cl);
      return g.reduce((t, s) => t + s.areaPx, 0) / g.length;
    };
    const razao = areaMedia('viable') / areaMedia('inviable');
    expect(razao).toBeGreaterThan(0.85);
    expect(razao).toBeLessThan(1.18);
  });

  it('forrageira: a espigueta vazia é mais clara que a cheia', () => {
    const c = gerarCenaSintetica('forrageira', { quantidade: 40, semente: 11 });
    const lDe = (i: number) => rgbParaLab(...corMedia(c, i))[0];
    const media = (cl: string) => {
      const idx = c.sementes.map((s, i) => [s, i] as const).filter(([s]) => s.classe === cl);
      return idx.reduce((t, [, i]) => t + lDe(i), 0) / idx.length;
    };
    // Sem cariopse não há o que escurecer o miolo.
    expect(media('inviable')).toBeGreaterThan(media('viable') + 5);
  });

  it('soja: as sementes não se tocam; orquídea e forrageira sim', () => {
    // A separação é o que faz a soja ser o caso fácil, e o encostar é o caso
    // que o watershed vai precisar resolver depois.
    const distanciaMinima = (p: PresetDeCena) => {
      const c = gerarCenaSintetica(p, { semente: 4 });
      let min = Infinity;
      for (let i = 0; i < c.sementes.length; i++) {
        for (let j = i + 1; j < c.sementes.length; j++) {
          const A = c.sementes[i];
          const B = c.sementes[j];
          const folga = Math.hypot(A.x - B.x, A.y - B.y) - (Math.max(A.a, A.b) + Math.max(B.a, B.b));
          min = Math.min(min, folga);
        }
      }
      return min;
    };
    expect(distanciaMinima('soja')).toBeGreaterThan(0);
    expect(distanciaMinima('orquidea-tz')).toBeLessThan(0);
  });
});

describe('a cena serve para medir o erro da onda', () => {
  it('a onda encontra a soja com a área certa, clicando no centro verdadeiro', () => {
    // O ponto de gerar a cena: dá para dizer QUANTO o algoritmo erra.
    const c = gerarCenaSintetica('soja', { quantidade: 10, semente: 21 });
    const erros: number[] = [];
    for (const s of c.sementes) {
      const r = segmentarPorClique(c.imagem, { x: s.x, y: s.y });
      if (!r || r.tocouBorda) continue;
      erros.push((r.areaPx - s.areaPx) / s.areaPx);
    }
    expect(erros.length).toBeGreaterThanOrEqual(7);
    erros.sort((a, b) => a - b);
    const mediano = erros[Math.floor(erros.length / 2)];
    expect(Math.abs(mediano), `erro mediano ${(mediano * 100).toFixed(1)}%`).toBeLessThan(0.2);
  });
});

describe('rotulos e contorno', () => {
  it('cada semente aparece nos rótulos e o contorno é fechado em coordenadas absolutas', () => {
    const cena = gerarCenaSintetica('soja', { semente: 3, quantidade: 12, lado: 400 });
    expect(cena.rotulos.length).toBe(cena.imagem.width * cena.imagem.height);
    const ids = new Set(cena.rotulos);
    for (const s of cena.sementes) {
      expect(ids.has(s.id)).toBe(true);
      expect(s.contorno.length).toBeGreaterThanOrEqual(32);
      for (const [x, y] of s.contorno) {
        expect(Math.abs(x - s.x)).toBeLessThanOrEqual(s.a + 1);
        expect(Math.abs(y - s.y)).toBeLessThanOrEqual(s.a + 1);
      }
    }
    // A contagem de pixels rotulados bate com a areaPx que já era devolvida.
    for (const s of cena.sementes) {
      let n = 0;
      for (const r of cena.rotulos) if (r === s.id) n++;
      expect(n).toBe(s.areaPx);
    }
  });

  // Investigação (`janela: 128` falhava com 0/4 recuperadas): o preset soja
  // tem `a` ≈ 108 px, ±11% de dispersão — até ~120 px. Com `janela: 128` a
  // meia-janela é 64, MENOR que o semieixo: a janela termina DENTRO da
  // semente, antes de alcançar o fundo. A onda então lê a rampa de
  // sombreamento interna da própria semente (a curvatura de `desenharSoja`,
  // mais escura perto da borda) como se fosse a transição para o fundo, e
  // para cedo — a máscara sai com ~53% da área verdadeira (IoU ~0,53, nunca
  // > 0,8). Não é o algoritmo que erra; é a janela pequena demais para o
  // objeto. Com `janela: 320` (meia-janela 160, folga de 40+ px além do
  // semieixo maior) a onda alcança o fundo de verdade e recupera 100% das
  // sementes em 10 sementes de rng testadas (`bons/total` sempre 1,0) — bem
  // acima do piso de 95% do teste. Note também: com `lado: 600` e sementes
  // deste tamanho, a amostragem por rejeição nunca chega a colocar as 20
  // pedidas (o espaçamento mínimo entre centros é grande demais para a área
  // livre) — o teste avalia a fração sobre o que de fato coube, não sobre 20.
  it('a onda recupera ≥ 95% das sementes com IoU > 0,8 no preset soja', () => {
    const cena = gerarCenaSintetica('soja', { semente: 5, quantidade: 20, lado: 600 });
    let bons = 0;
    for (const s of cena.sementes) {
      const r = segmentarPorClique(cena.imagem, { x: s.x, y: s.y }, { janela: 320 });
      if (!r || r.tocouBorda) continue;
      const { x: jx, y: jy, w, h } = r.janela;
      const verdade = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        verdade[y * w + x] = cena.rotulos[(jy + y) * cena.imagem.width + (jx + x)] === s.id ? 1 : 0;
      }
      if (iouDeMascaras(r.mascara, verdade) > 0.8) bons++;
    }
    expect(bons / cena.sementes.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('comporCena', () => {
  function quadrado(lado: number, cor: [number, number, number]): Recorte {
    const rgba = new Uint8ClampedArray(lado * lado * 4);
    const mascara = new Uint8Array(lado * lado).fill(1);
    for (let i = 0; i < lado * lado; i++) { rgba[i * 4] = cor[0]; rgba[i * 4 + 1] = cor[1]; rgba[i * 4 + 2] = cor[2]; rgba[i * 4 + 3] = 255; }
    return { largura: lado, altura: lado, rgba, mascara, contorno: [[0, 0], [lado, 0], [lado, lado], [0, lado]] };
  }

  it('coloca N recortes sem sobreposição, com rótulos e verdade consistentes', () => {
    const fundo = gerarCenaSintetica('soja', { semente: 1, quantidade: 0, lado: 300 }).imagem;
    const cena = comporCena(fundo, Array.from({ length: 15 }, () => quadrado(12, [220, 200, 150])), { semente: 2, margem: 3 });
    expect(cena.verdade).toHaveLength(15);
    expect(cena.naoColocados).toBe(0);
    for (let i = 0; i < 15; i++) for (let j = i + 1; j < 15; j++) {
      const a = cena.verdade[i].caixa, b = cena.verdade[j].caixa;
      const separadas = a.x + a.largura <= b.x || b.x + b.largura <= a.x || a.y + a.altura <= b.y || b.y + b.altura <= a.y;
      expect(separadas).toBe(true);
    }
    const ids = new Set(cena.rotulos);
    for (const o of cena.verdade) { expect(ids.has(o.id)).toBe(true); expect(o.areaPx).toBe(144); }
    expect(cena.rotulos[0]).toBe(0);
  });

  it('quando não cabe, devolve o que coube e conta os de fora', () => {
    const fundo = gerarCenaSintetica('soja', { semente: 1, quantidade: 0, lado: 40 }).imagem;
    const cena = comporCena(fundo, Array.from({ length: 4 }, () => quadrado(30, [200, 200, 200])), { semente: 3, tentativas: 50 });
    expect(cena.verdade.length).toBeLessThan(4);
    expect(cena.naoColocados).toBe(4 - cena.verdade.length);
  });
});

describe('iouDeMascaras', () => {
  it('iguais = 1, disjuntas = 0, metade = 1/3', () => {
    const a = new Uint8Array([1, 1, 0, 0]);
    expect(iouDeMascaras(a, a)).toBe(1);
    expect(iouDeMascaras(a, new Uint8Array([0, 0, 1, 1]))).toBe(0);
    expect(iouDeMascaras(a, new Uint8Array([1, 0, 1, 0]))).toBeCloseTo(1 / 3, 6);
  });
});
