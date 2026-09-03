// =============================================================================
// Testes da aritmética de recorte.
//
// Só as funções puras: as que dependem de canvas ficam de fora porque o vitest
// roda em ambiente node. A separação em image-crop.ts foi feita para isto.
//
// Os números aqui são das imagens reais do laboratório, não inventados:
//   6754×2339  digitalização de folha (Cortada_digitalizar0004)
//   7992×3672  digitalização do acervo do doutorado (DFhandPSOL1.tif)
//   5676×1892  região útil que o protótipo em Tkinter recortava
//   1880×4096  foto de celular pela ocular da lupa
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  calcularGrade,
  gradeParaTotal,
  gradePorLado,
  detectarCampoCircular,
  ehTiff,
  nomeDaPeca,
  type Retangulo,
} from '../image-crop';

const FOLHA: Retangulo = { x: 0, y: 0, w: 6754, h: 2339 };
const ACERVO: Retangulo = { x: 0, y: 0, w: 7992, h: 3672 };
const PROTOTIPO: Retangulo = { x: 0, y: 0, w: 5676, h: 1892 };

describe('calcularGrade', () => {
  it('produz colunas × linhas pedaços', () => {
    expect(calcularGrade(FOLHA, 6, 2)).toHaveLength(12);
    expect(calcularGrade(ACERVO, 8, 4)).toHaveLength(32);
  });

  it('numera coluna e linha a partir de 1', () => {
    const pecas = calcularGrade(FOLHA, 3, 2);
    expect(pecas[0]).toMatchObject({ coluna: 1, linha: 1 });
    expect(pecas[5]).toMatchObject({ coluna: 3, linha: 2 });
  });

  it('não perde pixel: a sobra vai para a última coluna e linha', () => {
    // 2339 / 2 = 1169,5 — sobra 1 px de altura.
    const pecas = calcularGrade(FOLHA, 6, 2);

    const direita = pecas.filter((p) => p.coluna === 6);
    const larguraTotal = pecas.filter((p) => p.linha === 1).reduce((s, p) => s + p.retangulo.w, 0);
    const alturaTotal = pecas.filter((p) => p.coluna === 1).reduce((s, p) => s + p.retangulo.h, 0);

    expect(larguraTotal).toBe(FOLHA.w);
    expect(alturaTotal).toBe(FOLHA.h);
    // A última linha absorve a sobra ímpar.
    expect(direita[1].retangulo.h).toBeGreaterThanOrEqual(direita[0].retangulo.h);
  });

  it('cobre a região sem buraco nem sobreposição', () => {
    const pecas = calcularGrade(FOLHA, 4, 3);
    const area = pecas.reduce((s, p) => s + p.retangulo.w * p.retangulo.h, 0);
    expect(area).toBe(FOLHA.w * FOLHA.h);
  });

  it('respeita a origem de uma região deslocada', () => {
    const regiao: Retangulo = { x: 100, y: 50, w: 400, h: 200 };
    const pecas = calcularGrade(regiao, 2, 2);
    expect(pecas[0].retangulo).toMatchObject({ x: 100, y: 50 });
    expect(pecas[3].retangulo).toMatchObject({ x: 300, y: 150 });
  });

  it('devolve vazio para grade inválida', () => {
    expect(calcularGrade(FOLHA, 0, 2)).toEqual([]);
    expect(calcularGrade({ x: 0, y: 0, w: 4, h: 4 }, 10, 10)).toEqual([]);
  });
});

describe('gradeParaTotal', () => {
  it('escolhe a grade que deixa o pedaço mais próximo do quadrado', () => {
    // 6754×2339 é quase 3:1, entao 12 pedacos cabem melhor em 6×2 (1125×1169)
    // do que em 12×1 (562×2339) ou 4×3 (1688×779).
    expect(gradeParaTotal(FOLHA, 12)).toEqual({ colunas: 6, linhas: 2 });
  });

  it('acompanha a proporção da região', () => {
    // Região retrato: a mesma quantidade deve virar mais linhas que colunas.
    const retrato: Retangulo = { x: 0, y: 0, w: 1000, h: 3000 };
    expect(gradeParaTotal(retrato, 12)).toEqual({ colunas: 2, linhas: 6 });
  });

  it('lida com total primo', () => {
    const g = gradeParaTotal(FOLHA, 7);
    expect(g.colunas * g.linhas).toBe(7);
  });

  it('total 1 devolve a região inteira', () => {
    expect(gradeParaTotal(FOLHA, 1)).toEqual({ colunas: 1, linhas: 1 });
  });
});

describe('gradePorLado', () => {
  it('reproduz a grade do protótipo em Tkinter', () => {
    // 5676/946 = 6 colunas, 1892/946 = 2 linhas, os 12 pedaços originais.
    expect(gradePorLado(PROTOTIPO, 946)).toEqual({ colunas: 6, linhas: 2 });
  });

  it('nunca devolve zero', () => {
    expect(gradePorLado({ x: 0, y: 0, w: 100, h: 100 }, 5000)).toEqual({ colunas: 1, linhas: 1 });
  });
});

describe('detectarCampoCircular', () => {
  /** Monta um disco claro sobre entorno escuro, como a foto pela ocular. */
  const comDisco = (w: number, h: number, cx: number, cy: number, r: number, fundo = 10) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dentro = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
        const v = dentro ? 230 : fundo;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    return { data, width: w, height: h };
  };

  it('encontra o campo numa foto em retrato, como as da lupa', () => {
    // Proporção das imagens reais (1880×4096), em escala reduzida.
    const c = detectarCampoCircular(comDisco(188, 410, 94, 205, 90), 1);
    expect(c).not.toBeNull();
    expect(c!.cx).toBeCloseTo(94, 0);
    expect(c!.cy).toBeCloseTo(205, 0);
    expect(c!.r).toBeCloseTo(90, 0);
  });

  it('funciona com entorno azul-acinzentado, não só preto', () => {
    // A segunda amostra real tem o fundo escuro, mas nao preto.
    const c = detectarCampoCircular(comDisco(188, 410, 94, 205, 90, 45), 1);
    expect(c).not.toBeNull();
    expect(c!.r).toBeCloseTo(90, 0);
  });

  it('devolve null para imagem de scanner, que não tem campo', () => {
    // Folha clara de ponta a ponta: nao ha o que recortar.
    const w = 200;
    const h = 80;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200;
      data[i + 1] = 205;
      data[i + 2] = 235;
      data[i + 3] = 255;
    }
    expect(detectarCampoCircular({ data, width: w, height: h }, 1)).toBeNull();
  });

  it('devolve null quando o claro ocupa quase tudo', () => {
    expect(detectarCampoCircular(comDisco(100, 100, 50, 50, 60), 1)).toBeNull();
  });

  it('devolve null para imagem minúscula', () => {
    expect(detectarCampoCircular(comDisco(4, 4, 2, 2, 1), 1)).toBeNull();
  });
});

describe('ehTiff', () => {
  it('reconhece pelo tipo MIME e pela extensão', () => {
    expect(ehTiff(new File([], 'a.tif', { type: 'image/tiff' }))).toBe(true);
    expect(ehTiff(new File([], 'DFhandPSOL1.tif'))).toBe(true);
    expect(ehTiff(new File([], 'b.TIFF'))).toBe(true);
  });

  it('não confunde com formatos que o navegador decodifica', () => {
    expect(ehTiff(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(false);
    expect(ehTiff(new File([], 'a.png', { type: 'image/png' }))).toBe(false);
    // Nao pode casar so por conter "tif" no meio do nome.
    expect(ehTiff(new File([], 'motif.png', { type: 'image/png' }))).toBe(false);
  });
});

describe('nomeDaPeca', () => {
  it('gera nome ordenável, com a coluna preenchida com zero', () => {
    const pecas = calcularGrade(FOLHA, 12, 1);
    expect(nomeDaPeca('scan.jpg', pecas[0])).toBe('scan_L1C01.png');
    expect(nomeDaPeca('scan.jpg', pecas[11])).toBe('scan_L1C12.png');
  });

  it('não duplica extensão', () => {
    const [peca] = calcularGrade(FOLHA, 1, 1);
    expect(nomeDaPeca('a.b.jpeg', peca)).toBe('a.b_L1C01.png');
  });
});
