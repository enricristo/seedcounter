import UTIF from 'utif';

/**
 * TIFF decodificado para o formato que o resto do app já entende: RGBA 8 bits.
 *
 * `paginas` existe porque scanner e microscópio às vezes gravam várias páginas
 * num arquivo; abrimos a primeira e dizemos quantas havia, para a interface
 * poder avisar em vez de fingir que só existe uma.
 */
export interface ImagemDecodificada {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  paginas: number;
}

/**
 * Decodifica a primeira página de um TIFF.
 *
 * Por que existe: nenhum navegador abre TIFF, e scanner de laboratório grava
 * TIFF — 8 ou 16 bits, LZW ou sem compressão. `utif` cobre isso e reduz 16
 * bits para 8 pegando o byte alto de cada amostra (valor >> 8), que é o que
 * um visualizador faria — 0 → 0, 0x8000 → 128, 0xFFFF → 255.
 *
 * Devolve `null` para qualquer coisa que não seja um TIFF legível. Quem chama
 * transforma isso em mensagem; aqui não se lança, porque um arquivo ruim é
 * caso esperado, não bug.
 */
export function decodificarTiff(buffer: ArrayBuffer): ImagemDecodificada | null {
  let ifds: ReturnType<typeof UTIF.decode>;
  try {
    ifds = UTIF.decode(buffer);
  } catch {
    return null;
  }
  if (!ifds || ifds.length === 0) return null;

  const ifd = ifds[0];
  try {
    UTIF.decodeImage(buffer, ifd, ifds);
  } catch {
    return null;
  }
  const width = ifd.width;
  const height = ifd.height;
  if (!width || !height) return null;

  let rgba: Uint8Array;
  try {
    rgba = UTIF.toRGBA8(ifd);
  } catch {
    return null;
  }
  if (rgba.length !== width * height * 4) return null;

  return {
    width,
    height,
    rgba: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length),
    paginas: ifds.length,
  };
}
