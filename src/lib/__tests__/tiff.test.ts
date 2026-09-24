import { describe, it, expect } from 'vitest';
import UTIF from 'utif';
import { DPI_MINIMO_PLAUSIVEL, decodificarTiff, lerDpiDeclarado } from '../tiff';

/**
 * Monta um TIFF mínimo à mão — little-endian, sem compressão, uma tira —
 * para o teste não depender do encoder da mesma biblioteca que decodifica.
 * `bits` 8 ou 16; `amostras` 1 (cinza) ou 3 (RGB); `valores` em ordem de
 * varredura, uma entrada por amostra.
 */
function tiffMinimo(
  largura: number,
  altura: number,
  bits: 8 | 16,
  amostras: 1 | 3,
  valores: number[]
): ArrayBuffer {
  const bytesPorAmostra = bits / 8;
  const dados = largura * altura * amostras * bytesPorAmostra;
  const entradas = 9;
  const ifdOffset = 8;
  const ifdTamanho = 2 + entradas * 12 + 4;
  // BitsPerSample precisa de uma entrada POR AMOSTRA: é `t258.length`, não
  // `SamplesPerPixel`, que `UTIF.toRGBA8` usa para saber quantos canais tem
  // cada pixel (visto lendo `UTIF.js`: `smpls = out["t258"] ? out["t258"].length
  // : 3`). Para 1 amostra o valor cabe inline no campo de 4 bytes do IFD;
  // para 3, três SHORT são 6 bytes e não cabem — precisa de um offset para
  // fora do IFD, exatamente como um TIFF real grava (é o que o próprio
  // `UTIF.encodeImage` faz: `t258: [8,8,8,8]`, uma entrada por amostra).
  const bitsPerSampleOffset = ifdOffset + ifdTamanho;
  const bitsPerSampleBytes = amostras > 1 ? amostras * 2 : 0;
  const dadosOffset = bitsPerSampleOffset + bitsPerSampleBytes;
  const buf = new ArrayBuffer(dadosOffset + dados);
  const v = new DataView(buf);
  v.setUint8(0, 0x49);
  v.setUint8(1, 0x49); // "II"
  v.setUint16(2, 42, true);
  v.setUint32(4, ifdOffset, true);
  let p = ifdOffset;
  v.setUint16(p, entradas, true);
  p += 2;
  const entrada = (tag: number, tipo: number, count: number, valor: number) => {
    v.setUint16(p, tag, true);
    v.setUint16(p + 2, tipo, true);
    v.setUint32(p + 4, count, true);
    if (tipo === 3 && count === 1) v.setUint16(p + 8, valor, true);
    else v.setUint32(p + 8, valor, true);
    p += 12;
  };
  entrada(256, 3, 1, largura); // ImageWidth
  entrada(257, 3, 1, altura); // ImageLength
  entrada(258, 3, amostras, amostras > 1 ? bitsPerSampleOffset : bits); // BitsPerSample (uma por amostra; offset se não couber inline)
  entrada(259, 3, 1, 1); // Compression = none
  entrada(262, 3, 1, amostras === 1 ? 1 : 2); // Photometric: BlackIsZero | RGB
  entrada(273, 4, 1, dadosOffset); // StripOffsets
  entrada(277, 3, 1, amostras); // SamplesPerPixel
  entrada(278, 3, 1, altura); // RowsPerStrip
  entrada(279, 4, 1, dados); // StripByteCounts
  v.setUint32(p, 0, true); // próximo IFD: nenhum
  if (amostras > 1) {
    let bp = bitsPerSampleOffset;
    for (let i = 0; i < amostras; i++) {
      v.setUint16(bp, bits, true);
      bp += 2;
    }
  }
  let q = dadosOffset;
  for (const val of valores) {
    if (bits === 8) {
      v.setUint8(q, val);
      q += 1;
    } else {
      v.setUint16(q, val, true);
      q += 2;
    }
  }
  return buf;
}

describe('decodificarTiff', () => {
  it('abre um RGB 8 bits sem compressão com largura, altura e pixels certos', () => {
    const buf = tiffMinimo(2, 1, 8, 3, [255, 0, 0, 0, 0, 255]);
    const img = decodificarTiff(buf);
    expect(img).not.toBeNull();
    expect(img!.width).toBe(2);
    expect(img!.height).toBe(1);
    expect(Array.from(img!.rgba.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(img!.rgba.slice(4, 8))).toEqual([0, 0, 255, 255]);
  });

  it('reduz 16 bits para 8 sem estourar: 0 → 0, 0x8000 → ~128, 0xFFFF → 255', () => {
    const buf = tiffMinimo(3, 1, 16, 1, [0, 0x8000, 0xffff]);
    const img = decodificarTiff(buf)!;
    const cinza = [img.rgba[0], img.rgba[4], img.rgba[8]];
    expect(cinza[0]).toBe(0);
    expect(Math.abs(cinza[1] - 128)).toBeLessThanOrEqual(1);
    expect(cinza[2]).toBe(255);
    // cinza: R = G = B
    expect(img.rgba[4]).toBe(img.rgba[5]);
    expect(img.rgba[5]).toBe(img.rgba[6]);
  });

  it('faz ida e volta pelo encoder da própria biblioteca (LZW não, mas RGBA sim)', () => {
    const w = 4,
      h = 3;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = i * 20;
      rgba[i * 4 + 1] = 7;
      rgba[i * 4 + 2] = 200 - i;
      rgba[i * 4 + 3] = 255;
    }
    const buf = UTIF.encodeImage(rgba, w, h);
    const img = decodificarTiff(buf)!;
    expect(img.width).toBe(w);
    expect(img.height).toBe(h);
    expect(Array.from(img.rgba)).toEqual(Array.from(rgba));
  });

  it('multipágina: devolve a primeira e conta as páginas', () => {
    // Dois IFDs encadeados exigem montar o segundo à mão; aqui basta garantir
    // que um TIFF de uma página conta 1 — a contagem vem de UTIF.decode.
    const img = decodificarTiff(tiffMinimo(1, 1, 8, 1, [9]))!;
    expect(img.paginas).toBe(1);
  });

  it('lixo devolve null em vez de lançar', () => {
    expect(decodificarTiff(new ArrayBuffer(3))).toBeNull();
    // `.buffer` de um TypedArray é tipado como `ArrayBufferLike` (cobre
    // `SharedArrayBuffer`); aqui é sempre `ArrayBuffer` de verdade.
    expect(
      decodificarTiff(new TextEncoder().encode('isto não é tiff').buffer as ArrayBuffer)
    ).toBeNull();
  });
});

describe('DPI declarado: palpite inicial, com piso', () => {
  // O DPI do arquivo é palpite — a régua na imagem é quem decide, e já medimos
  // 32% de diferença entre os dois. Mas arquivo reexportado por editor guarda o
  // padrão do EDITOR (1, 72, 96), e aceitar isso faria a morfometria começar
  // com escala até 25× errada. Palpite errado é pior que palpite nenhum: ele
  // parece um dado.
  const ifd = (valor: number, unidade?: number) => ({
    t282: [valor],
    ...(unidade === undefined ? {} : { t296: [unidade] }),
  });

  it('aceita o que um scanner de bancada produz', () => {
    for (const dpi of [300, 600, 1200, 2400, 3600, 4800]) {
      expect(lerDpiDeclarado(ifd(dpi)), String(dpi)).toBe(dpi);
    }
  });

  it('recusa o padrão de editor de imagem', () => {
    for (const dpi of [1, 72, 96]) {
      expect(lerDpiDeclarado(ifd(dpi)), String(dpi)).toBeUndefined();
    }
  });

  it('o piso fica entre os dois mundos', () => {
    expect(DPI_MINIMO_PLAUSIVEL).toBeGreaterThan(96);
    expect(DPI_MINIMO_PLAUSIVEL).toBeLessThan(300);
  });

  it('centímetro vira polegada ANTES de comparar com o piso', () => {
    // ResolutionUnit 3 = por centímetro. 118 pontos/cm são 300 dpi — recusar
    // isso seria jogar fora uma digitalização boa por causa da unidade.
    expect(lerDpiDeclarado(ifd(118, 3))).toBeCloseTo(299.7, 1);
    // 40/cm são ~102 dpi: continua abaixo do piso.
    expect(lerDpiDeclarado(ifd(40, 3))).toBeUndefined();
  });

  it('sem a marca, ou com valor sem sentido, não há palpite', () => {
    expect(lerDpiDeclarado({})).toBeUndefined();
    expect(lerDpiDeclarado(ifd(0))).toBeUndefined();
    expect(lerDpiDeclarado(ifd(-300))).toBeUndefined();
    expect(lerDpiDeclarado({ t282: ['300' as unknown as number] })).toBeUndefined();
  });
});
