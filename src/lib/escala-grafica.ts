// =============================================================================
// SeedCounter — escala gráfica (a barra de mapa)
//
// Uma barra de comprimento "redondo" (1, 2, 5 × 10ⁿ) numa unidade legível,
// dimensionada para caber entre 60 e 180 px de tela em qualquer zoom. É o
// que um mapa faz e o que uma foto de microscopia publicada sempre traz: a
// escala fica NA imagem, não num campo de texto que ninguém confere.
//
// Sem calibração a barra existe do mesmo jeito, em pixels da imagem — para
// a pessoa ver que falta escala, em vez de não ver nada.
// =============================================================================

export interface EscalaGrafica {
  /** Comprimento da barra em px de TELA. */
  larguraPx: number;
  /** Rótulo: "1 mm", "500 µm", "200 px"… */
  rotulo: string;
  /** Verdadeiro quando não há calibração e a barra está em px da imagem. */
  semCalibracao: boolean;
  /** O mesmo comprimento em px da IMAGEM — a unidade em que o contorno é medido. */
  pxDaImagem: number;
}

/** Valor "redondo" (1, 2, 5 × 10ⁿ) ≤ x. */
export function valorRedondo(x: number): number {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const m = x / base;
  const mult = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return mult * base;
}

/** Formata um comprimento em µm com a unidade que dá menos dígitos. */
export function rotuloDeComprimento(um: number): string {
  if (um >= 10_000) return `${trocarPonto(um / 10_000)} cm`;
  if (um >= 1_000) return `${trocarPonto(um / 1_000)} mm`;
  return `${trocarPonto(um)} µm`;
}

function trocarPonto(v: number): string {
  // Sem toFixed cego: 1 → "1", 2.5 → "2,5", 0.25 → "0,25".
  const s = Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(3)));
  return s.replace('.', ',');
}

/**
 * Escolhe a barra para o zoom atual.
 *
 * @param umPerPixel  µm por pixel da imagem; ausente/0 = sem calibração.
 * @param zoom        px de tela por px de imagem.
 * @param alvoPx      largura de tela desejada (a barra sai entre ~metade e o alvo).
 */
export function escalaGrafica(umPerPixel: number | undefined, zoom: number, alvoPx = 140): EscalaGrafica {
  const z = zoom > 0 ? zoom : 1;
  if (umPerPixel && umPerPixel > 0) {
    // Quantos µm cabem no alvo, arredondado para baixo a um valor redondo.
    const umNoAlvo = (alvoPx / z) * umPerPixel;
    const um = valorRedondo(umNoAlvo);
    const pxDaImagem = um / umPerPixel;
    return { larguraPx: pxDaImagem * z, rotulo: rotuloDeComprimento(um), semCalibracao: false, pxDaImagem };
  }
  const pxNoAlvo = alvoPx / z;
  const px = valorRedondo(pxNoAlvo);
  return { larguraPx: px * z, rotulo: `${px} px`, semCalibracao: true, pxDaImagem: px };
}
