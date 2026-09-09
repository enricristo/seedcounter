// =============================================================================
// Modelo do fundo.
//
// As cenas geradas servem bem aqui porque a cor do fundo, a posição de cada
// semente e a sombra que desenhei são todas conhecidas — então dá para checar
// se o modelo recupera o que foi posto, e não só se ele "parece razoável".
//
// O teste que mais importa é o do GRADIENTE: uma cor constante passaria em
// quase tudo aqui, e é justamente numa digitalização com vinheta que ela
// falharia. Se o polinômio não estivesse fazendo trabalho nenhum, esse teste
// reprovaria.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  classificarPixel,
  estimarFundo,
  mascaraDeObjeto,
  type ModeloDeFundo,
} from '../background';
import { rgbParaLab, type DadosImagem } from '../color-features';
import { gerarCenaSintetica } from '../synthetic-scene';

// ---------------------------------------------------------------------------

function telaLisa(
  W: number,
  H: number,
  cor: [number, number, number],
  ruido = 0
): DadosImagem {
  const data = new Uint8ClampedArray(W * H * 4);
  let semente = 12345;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5);
  for (let i = 0; i < W * H; i++) {
    const n = ruido ? Math.round(rnd() * 2 * ruido) : 0;
    data[i * 4] = cor[0] + n;
    data[i * 4 + 1] = cor[1] + n;
    data[i * 4 + 2] = cor[2] + n;
    data[i * 4 + 3] = 255;
  }
  return { data, width: W, height: H };
}

/** Escurece progressivamente para as bordas — a vinheta do scanner. */
function aplicarVinheta(img: DadosImagem, forca: number) {
  const { width: W, height: H } = img;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (2 * x) / (W - 1) - 1;
      const v = (2 * y) / (H - 1) - 1;
      const k = 1 - forca * (u * u + v * v) * 0.5;
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(img.data[i + c] * k);
    }
  }
}

function retangulo(
  img: DadosImagem,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cor: [number, number, number]
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      img.data[i] = cor[0];
      img.data[i + 1] = cor[1];
      img.data[i + 2] = cor[2];
    }
  }
}

/** Classe do pixel da imagem naquela posição, pelo modelo. */
function classeEm(img: DadosImagem, m: ModeloDeFundo, x: number, y: number) {
  const i = (y * img.width + x) * 4;
  const [L, a, b] = rgbParaLab(img.data[i], img.data[i + 1], img.data[i + 2]);
  return classificarPixel(m, L, a, b, x, y);
}

const CINZA: [number, number, number] = [178, 178, 176];
const CREME: [number, number, number] = [222, 190, 148];

// ---------------------------------------------------------------------------

describe('estimarFundo', () => {
  it('recupera a cor de um fundo liso', () => {
    const img = telaLisa(400, 400, CINZA, 2);
    const m = estimarFundo(img)!;
    expect(m).not.toBeNull();
    expect(m.incerto).toBe(false);

    const esperado = rgbParaLab(...CINZA);
    const obtido = m.predizer(200, 200);
    for (let c = 0; c < 3; c++) expect(obtido[c]).toBeCloseTo(esperado[c], 0);
  });

  it('acompanha a vinheta — é para isso que o polinômio existe', () => {
    // Uma cor constante erraria no centro ou na borda; não nos dois.
    const img = telaLisa(400, 400, CINZA, 1);
    aplicarVinheta(img, 0.35);
    const m = estimarFundo(img)!;

    for (const [x, y] of [
      [200, 200],
      [20, 20],
      [380, 200],
      [200, 380],
    ]) {
      const i = (y * img.width + x) * 4;
      const real = rgbParaLab(img.data[i], img.data[i + 1], img.data[i + 2]);
      const previsto = m.predizer(x, y);
      // O L* varia dezenas de níveis entre centro e canto; acertar dentro de 2
      // só é possível seguindo a superfície.
      expect(Math.abs(previsto[0] - real[0]), `L* em (${x},${y})`).toBeLessThan(2);
    }
  });

  it('não é enganado pelos objetos no meio da imagem', () => {
    // A repesagem tem que descartar as sementes. Sem ela, o ajuste seria
    // puxado na direção do creme.
    const img = telaLisa(400, 400, CINZA, 2);
    for (let k = 0; k < 6; k++) retangulo(img, 60 + k * 50, 180, 40, 40, CREME);

    const m = estimarFundo(img)!;
    const esperado = rgbParaLab(...CINZA);
    const noMeio = m.predizer(200, 200);
    expect(Math.abs(noMeio[1] - esperado[1]), 'a*').toBeLessThan(1.5);
    expect(Math.abs(noMeio[2] - esperado[2]), 'b*').toBeLessThan(1.5);
  });

  it('devolve null para imagem pequena demais', () => {
    expect(estimarFundo(telaLisa(4, 4, CINZA))).toBeNull();
  });

  it('duas cores grandes não é incerteza — a repesagem escolhe uma e acerta', () => {
    // Metade cinza, metade azul. A repesagem elege o cinza como fundo e chama
    // o azul de objeto, o que é leitura defensável e não erro. O sinal de
    // incerteza NÃO é "há duas cores"; é "sobrou fundo de menos".
    const img = telaLisa(400, 400, CINZA, 1);
    retangulo(img, 0, 0, 400, 200, [40, 90, 190]);
    const m = estimarFundo(img)!;

    const cinzaLab = rgbParaLab(...CINZA);
    const previsto = m.predizer(200, 320); // dentro da metade cinza
    expect(Math.abs(previsto[1] - cinzaLab[1])).toBeLessThan(2);
    expect(m.fracaoDeFundo).toBeLessThan(0.7);
  });

  it('avisa quando sobra fundo de menos', () => {
    // Imagem quase toda objeto: o modelo pode estar coerente consigo mesmo e
    // ainda assim não descrever "o fundo desta imagem". Devolver isso em
    // silêncio faria o erro parecer medida.
    const img = telaLisa(400, 400, CINZA, 1);
    retangulo(img, 20, 20, 360, 360, CREME);
    const m = estimarFundo(img)!;
    expect(m.fracaoDeFundo).toBeLessThan(0.33);
    expect(m.incerto).toBe(true);
  });
});

describe('classificarPixel', () => {
  it('separa fundo de objeto', () => {
    const img = telaLisa(400, 400, CINZA, 2);
    retangulo(img, 150, 150, 80, 80, CREME);
    const m = estimarFundo(img)!;

    expect(classeEm(img, m, 190, 190)).toBe('objeto');
    expect(classeEm(img, m, 40, 40)).toBe('fundo');
    expect(classeEm(img, m, 350, 350)).toBe('fundo');
  });

  it('chama sombra de sombra, e não de objeto', () => {
    // É a razão de a classificação ser de três vias: mais escuro com a MESMA
    // cor é sombra. Tratar como objeto engordaria o contorno para o lado da
    // luz, sempre o mesmo lado.
    const img = telaLisa(400, 400, CINZA, 1);
    const escurecido: [number, number, number] = [
      Math.round(CINZA[0] * 0.82),
      Math.round(CINZA[1] * 0.82),
      Math.round(CINZA[2] * 0.82),
    ];
    retangulo(img, 150, 150, 60, 60, escurecido);
    const m = estimarFundo(img)!;

    expect(classeEm(img, m, 180, 180)).toBe('sombra');
  });

  it('mais claro com a mesma cor é objeto, não sombra', () => {
    // Reflexo especular está SOBRE o objeto, nunca sobre o fundo.
    const img = telaLisa(400, 400, CINZA, 1);
    retangulo(img, 150, 150, 60, 60, [250, 250, 248]);
    const m = estimarFundo(img)!;
    expect(classeEm(img, m, 180, 180)).toBe('objeto');
  });
});

describe('nas cenas geradas', () => {
  it('encontra as sementes de soja sem incluir a sombra', () => {
    const c = gerarCenaSintetica('soja', { quantidade: 8, semente: 5 });
    const m = estimarFundo(c.imagem)!;
    expect(m.incerto).toBe(false);

    const mascara = mascaraDeObjeto(c.imagem, m);
    const W = c.imagem.width;

    // O centro de cada semente é objeto.
    for (const s of c.sementes) {
      expect(mascara[s.y * W + s.x], `semente ${s.id}`).toBe(1);
    }

    // A área marcada é compatível com a soma das sementes. A sombra fica de
    // fora: incluí-la inflaria bem além disto.
    const areaMarcada = mascara.reduce((t, v) => t + v, 0);
    const areaVerdadeira = c.sementes.reduce((t, s) => t + s.areaPx, 0);
    expect(areaMarcada).toBeGreaterThan(areaVerdadeira * 0.85);
    expect(areaMarcada).toBeLessThan(areaVerdadeira * 1.35);
  });

  it('funciona no fundo azul da orquídea', () => {
    // Fundo cromático em vez de neutro: o modelo não pode depender de cinza.
    const c = gerarCenaSintetica('orquidea-tz', { quantidade: 20, semente: 6 });
    const m = estimarFundo(c.imagem)!;
    expect(m.incerto).toBe(false);

    const mascara = mascaraDeObjeto(c.imagem, m);
    const W = c.imagem.width;
    const achadas = c.sementes.filter((s) => mascara[s.y * W + s.x] === 1).length;
    expect(achadas).toBeGreaterThan(c.sementes.length * 0.8);
  });

  it('funciona no fundo claro da forrageira', () => {
    const c = gerarCenaSintetica('forrageira', { quantidade: 20, semente: 8 });
    const m = estimarFundo(c.imagem)!;
    const mascara = mascaraDeObjeto(c.imagem, m);
    const W = c.imagem.width;
    const achadas = c.sementes.filter((s) => mascara[s.y * W + s.x] === 1).length;
    expect(achadas).toBeGreaterThan(c.sementes.length * 0.8);
  });

  it('é rápido o bastante para rodar uma vez por imagem', () => {
    const c = gerarCenaSintetica('soja', { quantidade: 24 });
    const t0 = performance.now();
    estimarFundo(c.imagem);
    const ms = performance.now() - t0;
    // Amostragem de 8 em 8: 1100² viram ~19 mil amostras. Deve ser instantâneo.
    expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(500);
  });
});
