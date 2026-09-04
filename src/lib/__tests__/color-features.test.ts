// =============================================================================
// Características de cor.
//
// Os valores de referência do CIELAB são os canônicos do sRGB sob D65 — não
// foram gerados pela própria implementação, senão o teste só provaria que ela
// é consistente consigo mesma.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  rgbParaHsv,
  rgbParaLab,
  extrairCaracteristicasDeCor,
  indiceTetrazolio,
} from '../color-features';

/** Imagem de uma cor só. */
const chapada = (w: number, h: number, r: number, g: number, b: number) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
};

const quadrado = (x: number, y: number, lado: number): [number, number][] => [
  [x, y],
  [x + lado, y],
  [x + lado, y + lado],
  [x, y + lado],
];

describe('rgbParaHsv', () => {
  it('converte as cores canônicas', () => {
    expect(rgbParaHsv(255, 0, 0)[0]).toBeCloseTo(0, 1); // vermelho
    expect(rgbParaHsv(0, 255, 0)[0]).toBeCloseTo(120, 1); // verde
    expect(rgbParaHsv(0, 0, 255)[0]).toBeCloseTo(240, 1); // azul
  });

  it('cinza tem saturação zero', () => {
    const [, s] = rgbParaHsv(128, 128, 128);
    expect(s).toBeCloseTo(0, 5);
  });

  it('preto não divide por zero', () => {
    const [h, s, v] = rgbParaHsv(0, 0, 0);
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(v).toBe(0);
  });
});

describe('rgbParaLab', () => {
  it('branco é L=100, a=0, b=0', () => {
    const [L, a, b] = rgbParaLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });

  it('preto é L=0', () => {
    expect(rgbParaLab(0, 0, 0)[0]).toBeCloseTo(0, 3);
  });

  it('vermelho puro bate com o valor canônico do sRGB', () => {
    // Referência: sRGB #FF0000 sob D65 = L* 53,24 · a* 80,09 · b* 67,20
    const [L, a, b] = rgbParaLab(255, 0, 0);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('cinza médio tem a e b praticamente nulos', () => {
    const [, a, b] = rgbParaLab(128, 128, 128);
    expect(Math.abs(a)).toBeLessThan(0.01);
    expect(Math.abs(b)).toBeLessThan(0.01);
  });
});

describe('extrairCaracteristicasDeCor', () => {
  it('mede só os pixels de dentro do contorno', () => {
    // Fundo azul; um quadrado vermelho pintado no meio.
    const w = 40;
    const h = 40;
    const img = chapada(w, h, 0, 0, 255);
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 0;
        img.data[i + 2] = 0;
      }
    }

    const cor = extrairCaracteristicasDeCor(img, quadrado(10, 10, 10));

    // Se estivesse pegando o fundo, o vermelho médio despencaria.
    expect(cor.rMean).toBeCloseTo(255, 0);
    expect(cor.bMean).toBeCloseTo(0, 0);
    expect(cor.pixels).toBeGreaterThan(0);
  });

  it('desvio zero numa região de cor única', () => {
    const cor = extrairCaracteristicasDeCor(chapada(30, 30, 200, 120, 60), quadrado(5, 5, 10));
    expect(cor.rStd).toBeCloseTo(0, 3);
    expect(cor.gStd).toBeCloseTo(0, 3);
    expect(cor.aStd).toBeCloseTo(0, 3);
  });

  it('a* separa embrião corado de não corado — o sinal do tetrazólio', () => {
    // É a medida que substitui "núcleo com qualquer grau de vermelho" por um
    // número. Carmim de tetrazólio contra tecido branco opaco.
    const corado = extrairCaracteristicasDeCor(chapada(20, 20, 190, 60, 70), quadrado(2, 2, 10));
    const naoCorado = extrairCaracteristicasDeCor(chapada(20, 20, 225, 220, 210), quadrado(2, 2, 10)); // prettier-ignore

    expect(indiceTetrazolio(corado)).toBeGreaterThan(30);
    expect(indiceTetrazolio(naoCorado)).toBeLessThan(5);
    expect(indiceTetrazolio(corado)).toBeGreaterThan(indiceTetrazolio(naoCorado));
  });

  it('a* fica praticamente igual sob mudança de brilho', () => {
    // Duas capturas da mesma semente com iluminação diferente. É o motivo de
    // usar CIELAB em vez do canal R cru: R cairia junto com o brilho.
    const claro = extrairCaracteristicasDeCor(chapada(20, 20, 200, 90, 95), quadrado(2, 2, 10));
    const escuro = extrairCaracteristicasDeCor(chapada(20, 20, 150, 62, 66), quadrado(2, 2, 10));

    const variacaoR = Math.abs(claro.rMean - escuro.rMean);
    const variacaoA = Math.abs(claro.aMean - escuro.aMean);

    // O canal R cru acompanha o brilho e muda muito.
    expect(variacaoR).toBeGreaterThan(40);
    // a* também não é imune — mas varia várias vezes menos, e é essa razão
    // que importa: é o que torna o limiar transferível entre capturas.
    expect(variacaoA).toBeLessThan(variacaoR / 5);
  });

  it('devolve zeros para polígono degenerado', () => {
    const cor = extrairCaracteristicasDeCor(chapada(10, 10, 1, 2, 3), [
      [0, 0],
      [1, 1],
    ]);
    expect(cor.pixels).toBe(0);
    expect(cor.rMean).toBe(0);
  });

  it('não estoura quando o contorno passa da borda da imagem', () => {
    const cor = extrairCaracteristicasDeCor(chapada(20, 20, 10, 20, 30), quadrado(15, 15, 40));
    expect(cor.pixels).toBeGreaterThan(0);
    expect(Number.isFinite(cor.rMean)).toBe(true);
  });

  it('amostragem reduz o custo sem mudar a média em região uniforme', () => {
    const img = chapada(60, 60, 180, 100, 40);
    const cheio = extrairCaracteristicasDeCor(img, quadrado(5, 5, 40), 1);
    const amostrado = extrairCaracteristicasDeCor(img, quadrado(5, 5, 40), 4);

    expect(amostrado.pixels).toBeLessThan(cheio.pixels);
    expect(amostrado.rMean).toBeCloseTo(cheio.rMean, 3);
    expect(amostrado.aMean).toBeCloseTo(cheio.aMean, 3);
  });
});
