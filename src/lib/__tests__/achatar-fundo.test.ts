// =============================================================================
// Achatar o fundo.
//
// A cena e um gradiente de iluminacao com objetos em cima — que e exatamente o
// que uma digitalizacao de scanner e. O teste que importa: depois de achatar, o
// FUNDO fica uniforme e o OBJETO continua distinguivel.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { achatarFundo, luzDeReferencia } from '../achatar-fundo';
import { estimarFundo } from '../background';
import type { DadosImagem } from '../color-features';

const W = 120;
const H = 90;

/**
 * Fundo cinza com gradiente forte da esquerda para a direita, dois objetos.
 *
 * Os objetos tem CROMA (tom terroso), e nao so luminosidade menor. Isso nao e
 * enfeite: `classificarPixel` decide por croma primeiro, e um objeto cinza
 * sobre fundo cinza e — corretamente — indistinguivel de uma sombra. Semente
 * real tem cor; uma cena acromatica testaria uma situacao que nao existe.
 */
function cena(): DadosImagem {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Gradiente de 30% da esquerda para a direita: o que a onda sofre.
      const fundo = 170 + (x / W) * 70;
      const dentro =
        (x > 30 && x < 50 && y > 30 && y < 50) || (x > 80 && x < 100 && y > 30 && y < 50);
      const i = (y * W + x) * 4;
      if (dentro) {
        data[i] = fundo * 0.55;
        data[i + 1] = fundo * 0.36;
        data[i + 2] = fundo * 0.2;
      } else {
        data[i] = data[i + 1] = data[i + 2] = fundo;
      }
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const luzEm = (img: DadosImagem, x: number, y: number) => img.data[(y * img.width + x) * 4];

describe('corrigir', () => {
  it('NIVELA o fundo: o gradiente some', () => {
    const original = cena();
    const esquerdaAntes = luzEm(original, 5, 10);
    const direitaAntes = luzEm(original, W - 6, 10);
    expect(Math.abs(direitaAntes - esquerdaAntes)).toBeGreaterThan(50);

    const r = achatarFundo(original, { modo: 'corrigir' })!;
    expect(r).not.toBeNull();
    const esquerdaDepois = luzEm(r.imagem, 5, 10);
    const direitaDepois = luzEm(r.imagem, W - 6, 10);
    expect(Math.abs(direitaDepois - esquerdaDepois)).toBeLessThan(12);
  });

  it('o OBJETO continua distinguivel do fundo', () => {
    // Nivelar nao pode apagar a semente: e o contorno dela que se quer medir.
    const r = achatarFundo(cena(), { modo: 'corrigir' })!;
    const noObjeto = luzEm(r.imagem, 40, 40);
    const noFundo = luzEm(r.imagem, 10, 10);
    expect(noFundo - noObjeto).toBeGreaterThan(60);
  });

  it('a correcao e MULTIPLICATIVA, nao subtrativa', () => {
    // Subtrair o gradiente escureceria as sementes das bordas junto com o fundo
    // delas. Multiplicando, os dois objetos ficam com luz parecida.
    const r = achatarFundo(cena(), { modo: 'corrigir' })!;
    const objEsquerda = luzEm(r.imagem, 40, 40);
    const objDireita = luzEm(r.imagem, 90, 40);
    expect(Math.abs(objDireita - objEsquerda)).toBeLessThan(20);
  });

  it('nao estoura os limites do canal', () => {
    const r = achatarFundo(cena(), { modo: 'realcar' })!;
    for (let i = 0; i < r.imagem.data.length; i += 4) {
      expect(r.imagem.data[i]).toBeGreaterThanOrEqual(0);
      expect(r.imagem.data[i]).toBeLessThanOrEqual(255);
    }
  });
});

describe('isolar', () => {
  it('pinta o fundo e preserva o objeto', () => {
    const r = achatarFundo(cena(), { modo: 'isolar' })!;
    expect(luzEm(r.imagem, 10, 10)).toBe(255);
    expect(luzEm(r.imagem, 40, 40)).toBeLessThan(150);
  });

  it('NAO separa objeto acromatico de sombra — e isso e correto', () => {
    // Limite conhecido e desejado do classificador: ele decide por croma
    // primeiro. Um objeto cinza sobre fundo cinza nao tem como ser distinguido
    // de uma sombra, e fingir que tem produziria recorte errado em silencio.
    const cinza = cena();
    for (let y = 30; y < 50; y++) {
      for (let x = 31; x < 50; x++) {
        const i = (y * W + x) * 4;
        const v = cinza.data[i + 1];
        cinza.data[i] = cinza.data[i + 1] = cinza.data[i + 2] = v;
      }
    }
    const r = achatarFundo(cinza, { modo: 'isolar' })!;
    expect(luzEm(r.imagem, 40, 40)).toBe(255);
    // O objeto COM croma, na mesma imagem, continua preservado.
    expect(luzEm(r.imagem, 90, 40)).toBeLessThan(200);
  });

  it('aceita outra cor de fundo', () => {
    const r = achatarFundo(cena(), { modo: 'isolar', corDoFundo: [0, 0, 0] })!;
    expect(luzEm(r.imagem, 10, 10)).toBe(0);
  });
});

describe('quando nao da para confiar', () => {
  it('devolve nulo quando a imagem e pequena demais para o modelo', () => {
    // Devolver um achatamento pela metade seria pior: o erro passaria a parecer
    // medida.
    const minuscula: DadosImagem = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    expect(achatarFundo(minuscula)).toBeNull();
  });

  it('propaga a incerteza do modelo em vez de escondê-la', () => {
    const r = achatarFundo(cena())!;
    expect(typeof r.incerto).toBe('boolean');
    expect(r.incerto).toBe(r.modelo.incerto);
  });

  it('reaproveita um modelo ja estimado', () => {
    const img = cena();
    const modelo = estimarFundo(img)!;
    const r = achatarFundo(img, { modelo })!;
    expect(r.modelo).toBe(modelo);
  });
});

describe('luz de referencia', () => {
  it('fica dentro da faixa do fundo, nao no branco', () => {
    // Dividir pelo branco levantaria a imagem inteira e estouraria o realce
    // numa digitalizacao de fundo cinza.
    const modelo = estimarFundo(cena())!;
    const alvo = luzDeReferencia(modelo, W, H);
    expect(alvo).toBeGreaterThan(50);
    expect(alvo).toBeLessThan(100);
  });
});
