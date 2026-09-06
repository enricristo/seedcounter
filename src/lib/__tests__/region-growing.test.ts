// =============================================================================
// Segmentação por clique — a onda.
//
// O que estes testes protegem: que a onda pare na borda da semente e não no
// meio dela, que não vaze para o fundo, e que a tolerância escolhida sozinha
// pela estabilidade acerte sem ninguém mexer em controle deslizante.
//
// As imagens são sintéticas e desenhadas para reproduzir os casos reais que o
// dataset de soja mostra: semente clara sobre bandeja cinza, com SOMBRA suave
// em volta — que é o que quebra limiar em RGB.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { CRESCIMENTO_MAXIMO_CONFIAVEL, segmentarPorClique } from '../region-growing';
import type { DadosImagem } from '../color-features';

// ---------------------------------------------------------------------------
// Construção de cenas
// ---------------------------------------------------------------------------

function tela(largura: number, altura: number, fundo: [number, number, number]): DadosImagem {
  const data = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    data[i * 4] = fundo[0];
    data[i * 4 + 1] = fundo[1];
    data[i * 4 + 2] = fundo[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: largura, height: altura };
}

/** Desenha uma elipse cheia. */
function elipse(
  img: DadosImagem,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cor: [number, number, number]
) {
  for (let y = Math.max(0, cy - ry); y <= Math.min(img.height - 1, cy + ry); y++) {
    for (let x = Math.max(0, cx - rx); x <= Math.min(img.width - 1, cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const i = (y * img.width + x) * 4;
        img.data[i] = cor[0];
        img.data[i + 1] = cor[1];
        img.data[i + 2] = cor[2];
      }
    }
  }
}

/**
 * Sombra: escurece um anel ao redor da semente sem mudar o matiz.
 *
 * É o caso que separa Lab de RGB — em RGB a sombra move os três canais e o
 * limiar não distingue "mais escuro" de "outra cor".
 */
function sombra(img: DadosImagem, cx: number, cy: number, rx: number, ry: number, forca: number) {
  for (let y = Math.max(0, cy - ry); y <= Math.min(img.height - 1, cy + ry); y++) {
    for (let x = Math.max(0, cx - rx); x <= Math.min(img.width - 1, cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const k = 1 - forca * (1 - d);
      const i = (y * img.width + x) * 4;
      img.data[i] = Math.round(img.data[i] * k);
      img.data[i + 1] = Math.round(img.data[i + 1] * k);
      img.data[i + 2] = Math.round(img.data[i + 2] * k);
    }
  }
}

/**
 * Elipse com borda em rampa: a cor vai do miolo ao fundo ao longo de `rampa`
 * pixels, em vez de trocar de uma vez.
 *
 * É o que "borda difusa" realmente significa. Aproximar a COR do fundo mantendo
 * a borda dura não deixa a região menos estável — ela continua uniforme por
 * dentro, e a estabilidade continua no piso.
 */
function elipseComRampa(
  img: DadosImagem,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  miolo: [number, number, number],
  fundo: [number, number, number],
  rampa: number
) {
  const raio = Math.max(rx, ry);
  for (let y = Math.max(0, cy - ry - rampa); y <= Math.min(img.height - 1, cy + ry + rampa); y++) {
    for (let x = Math.max(0, cx - rx - rampa); x <= Math.min(img.width - 1, cx + rx + rampa); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.sqrt(dx * dx + dy * dy);
      // t = 0 no miolo, 1 já no fundo.
      const t = Math.min(1, Math.max(0, (d - 1) * (raio / rampa) + 0.5));
      if (d > 1 + rampa / raio) continue;
      const i = (y * img.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        img.data[i + c] = Math.round(miolo[c] * (1 - t) + fundo[c] * t);
      }
    }
  }
}

/** Soja creme sobre bandeja cinza — as cores medidas no dataset indonésio. */
const CINZA: [number, number, number] = [178, 178, 176];
const CREME: [number, number, number] = [222, 190, 148];

function cenaDeSoja(): DadosImagem {
  const img = tela(200, 200, CINZA);
  sombra(img, 100, 100, 46, 40, 0.12); // sombra ao redor, antes da semente
  elipse(img, 100, 100, 34, 28, CREME);
  return img;
}

/** Área esperada da elipse de rx=34, ry=28. */
const AREA_ESPERADA = Math.PI * 34 * 28;

// ---------------------------------------------------------------------------

describe('segmentarPorClique', () => {
  it('encontra a semente inteira a partir de um clique no centro', () => {
    const r = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;
    expect(r).not.toBeNull();
    // Tolerância de 12% cobre a antisserrilha da borda da elipse.
    expect(r.areaPx).toBeGreaterThan(AREA_ESPERADA * 0.88);
    expect(r.areaPx).toBeLessThan(AREA_ESPERADA * 1.12);
  });

  it('não vaza para o fundo, mesmo com sombra em volta', () => {
    // O caso que quebra limiar global: a sombra é um degrau intermediário
    // entre a semente e a bandeja. Vazar dobraria a área.
    const r = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;
    expect(r.areaPx).toBeLessThan(AREA_ESPERADA * 1.5);
    expect(r.tocouBorda).toBe(false);
  });

  it('acha a mesma semente clicando longe do centro', () => {
    // O pesquisador não mira o centroide. Clicar perto da borda tem que dar a
    // mesma semente.
    const centro = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;
    const canto = segmentarPorClique(cenaDeSoja(), { x: 122, y: 112 })!;
    const razao = canto.areaPx / centro.areaPx;
    expect(razao).toBeGreaterThan(0.8);
    expect(razao).toBeLessThan(1.25);
  });

  it('separa duas sementes vizinhas que não se tocam', () => {
    const img = tela(260, 160, CINZA);
    elipse(img, 70, 80, 30, 26, CREME);
    elipse(img, 190, 80, 30, 26, CREME);

    const esquerda = segmentarPorClique(img, { x: 70, y: 80 })!;
    const area = Math.PI * 30 * 26;
    // Pegar as duas daria o dobro. A vizinhança-4 e a tolerância impedem.
    expect(esquerda.areaPx).toBeLessThan(area * 1.3);
    // E a região não pode conter a segunda semente.
    const { x: jx, y: jy, w: jw } = esquerda.janela;
    const dentroDaSegunda = esquerda.mascara[(80 - jy) * jw + (190 - jx)];
    expect(dentroDaSegunda).toBeFalsy();
  });

  it('avisa quando o clique cai no fundo em vez de avisar nada', () => {
    // Clique na bandeja: a onda percorre o fundo até a borda da janela. O
    // resultado precisa DENUNCIAR isso — devolver uma região grande em
    // silêncio seria contar bandeja como semente.
    const img = tela(200, 200, CINZA);
    elipse(img, 100, 100, 30, 26, CREME);
    const r = segmentarPorClique(img, { x: 15, y: 15 })!;
    expect(r.tocouBorda).toBe(true);
  });

  it('devolve null para clique fora da imagem', () => {
    const img = cenaDeSoja();
    expect(segmentarPorClique(img, { x: -5, y: 10 })).toBeNull();
    expect(segmentarPorClique(img, { x: 10, y: 999 })).toBeNull();
  });

  it('o contorno sai em coordenadas absolutas da imagem', () => {
    // A janela é um detalhe interno; quem consome mede na imagem.
    const img = tela(600, 400, CINZA);
    elipse(img, 420, 300, 30, 26, CREME);
    const r = segmentarPorClique(img, { x: 420, y: 300 })!;

    expect(r.contorno.length).toBeGreaterThan(8);
    const xs = r.contorno.map((p) => p[0]);
    const ys = r.contorno.map((p) => p[1]);
    // O contorno tem que cercar o centro real, não a origem da janela.
    expect(Math.min(...xs)).toBeGreaterThan(420 - 40);
    expect(Math.max(...xs)).toBeLessThan(420 + 40);
    expect(Math.min(...ys)).toBeGreaterThan(300 - 36);
    expect(Math.max(...ys)).toBeLessThan(300 + 36);
  });

  it('a tolerância escolhida sozinha bate com a boa escolhida à mão', () => {
    // É o ponto da estabilidade: ninguém deveria precisar mexer no controle.
    const img = cenaDeSoja();
    const automatica = segmentarPorClique(img, { x: 100, y: 100 })!;
    const manual = segmentarPorClique(img, { x: 100, y: 100 }, { tolerancia: 12 })!;
    const razao = automatica.areaPx / manual.areaPx;
    expect(razao).toBeGreaterThan(0.85);
    expect(razao).toBeLessThan(1.15);
  });

  it('tolerância exagerada vaza — e é por isso que a automática existe', () => {
    // Guarda a premissa: se qualquer tolerância servisse, a estabilidade seria
    // enfeite. Com 60 a onda atravessa a bandeja inteira.
    const img = cenaDeSoja();
    const boa = segmentarPorClique(img, { x: 100, y: 100 })!;
    const exagerada = segmentarPorClique(img, { x: 100, y: 100 }, { tolerancia: 60 })!;
    expect(exagerada.areaPx).toBeGreaterThan(boa.areaPx * 3);
    expect(exagerada.tocouBorda).toBe(true);
  });

  it('a borda nítida cresce menos que a difusa ao ser atravessada', () => {
    // O número precisa significar alguma coisa: serve para a interface avisar
    // "este contorno é pouco confiável".
    const nitida = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;

    // Cena difusa: a MESMA cor e o mesmo tamanho, com a borda em rampa de 10 px.
    const difusa = tela(200, 200, CINZA);
    elipseComRampa(difusa, 100, 100, 34, 28, CREME, CINZA, 10);
    const r = segmentarPorClique(difusa, { x: 100, y: 100 })!;

    // Menos crescimento = borda mais nítida. É a medida de confiança que a
    // interface usa para avisar que um contorno é palpite.
    expect(nitida.crescimentoNaBorda).toBeLessThan(r.crescimentoNaBorda);
    expect(nitida.crescimentoNaBorda).toBeLessThan(CRESCIMENTO_MAXIMO_CONFIAVEL);
  });

  it('é determinística', () => {
    const a = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;
    const b = segmentarPorClique(cenaDeSoja(), { x: 100, y: 100 })!;
    expect(a.areaPx).toBe(b.areaPx);
    expect(a.tolerancia).toBe(b.tolerancia);
    expect(a.contorno).toEqual(b.contorno);
  });

  it('funciona em semente escura sobre fundo claro', () => {
    // Orquídea em lâmina, e não só soja em bandeja.
    const img = tela(200, 200, [235, 235, 232]);
    elipse(img, 100, 100, 26, 14, [92, 58, 44]);
    const r = segmentarPorClique(img, { x: 100, y: 100 })!;
    const area = Math.PI * 26 * 14;
    expect(r.areaPx).toBeGreaterThan(area * 0.85);
    expect(r.areaPx).toBeLessThan(area * 1.2);
  });

  it('a janela limita o custo, não o resultado', () => {
    // Janela pequena numa semente grande tem que AVISAR que cortou.
    const img = cenaDeSoja();
    const r = segmentarPorClique(img, { x: 100, y: 100 }, { janela: 40 })!;
    expect(r.tocouBorda).toBe(true);
    expect(r.janela.w).toBeLessThanOrEqual(40);
  });
});
