import UTIF from 'utif';

/**
 * TIFF decodificado para o formato que o resto do app já entende: RGBA 8 bits.
 *
 * `paginas` existe porque scanner e microscópio às vezes gravam várias páginas
 * num arquivo, e ISSO NÃO É CASO RARO NESTE LABORATÓRIO: uma digitalização de
 * tetrazólio com dez espécies chega como um TIFF de dez páginas, uma por
 * espécie, e uma repetição de uma espécie só chega com quatro. Abrir sempre a
 * primeira e avisar "havia dez" deixava nove espécies inalcançáveis sem
 * Photoshop — que é exatamente o passo manual que este aplicativo existe para
 * apagar. Por isso `decodificarTiff` recebe qual página abrir.
 */
export interface ImagemDecodificada {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  paginas: number;
  /** Qual página foi decodificada, base 0. */
  pagina: number;
  /** A resolução que o arquivo DECLARA, em DPI, quando declara. Ver nota abaixo. */
  dpiDeclarado?: number;
}

/**
 * O DPI que o TIFF declara — uma DECLARAÇÃO, não uma medida.
 *
 * O arquivo carrega XResolution (tag 282) e ResolutionUnit (296). Lemos e
 * mostramos, porque é o melhor palpite inicial de escala e evita que alguém
 * comece a medir sem escala nenhuma. Mas é palpite: o driver escreve o que
 * acha que fez, e já medimos neste projeto uma diferença de 32% entre o DPI
 * declarado e o que a régua da própria imagem mostra
 * (`docs/datasets/auditoria-de-medida.md`). Quem decide continua sendo a
 * régua na imagem.
 */
function lerDpiDeclarado(ifd: Record<string, unknown>): number | undefined {
  const x = ifd['t282'];
  const unidade = ifd['t296'];
  if (!Array.isArray(x) || x.length === 0) return undefined;
  const valor = typeof x[0] === 'number' ? x[0] : undefined;
  if (valor === undefined || !Number.isFinite(valor) || valor <= 0) return undefined;
  // ResolutionUnit: 2 = polegada, 3 = centímetro. Ausente, assume polegada,
  // que é o que o TIFF 6.0 manda.
  const u = Array.isArray(unidade) && typeof unidade[0] === 'number' ? unidade[0] : 2;
  return u === 3 ? valor * 2.54 : valor;
}

/**
 * Decodifica UMA página de um TIFF.
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
export function decodificarTiff(buffer: ArrayBuffer, pagina = 0): ImagemDecodificada | null {
  let ifds: ReturnType<typeof UTIF.decode>;
  try {
    ifds = UTIF.decode(buffer);
  } catch {
    return null;
  }
  if (!ifds || ifds.length === 0) return null;

  // Página fora da faixa não é erro de quem chama: é pedir a página 7 de um
  // arquivo que ficou com 3 depois de ser reexportado. Cai na primeira.
  const escolhida = Number.isInteger(pagina) && pagina >= 0 && pagina < ifds.length ? pagina : 0;
  const ifd = ifds[escolhida];
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
    pagina: escolhida,
    dpiDeclarado: lerDpiDeclarado(ifd as unknown as Record<string, unknown>),
  };
}
