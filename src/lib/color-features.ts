// =============================================================================
// SeedCounter — características de cor por objeto
//
// POR QUE ISTO EXISTE, e por que a cor importa mais aqui do que em outros
// analisadores de semente.
//
// O AIseed (Tu et al., Computers and Electronics in Agriculture 207, 2023)
// extrai 54 características por semente e treina modelos sobre elas. Os
// resultados publicados dizem algo que orienta este projeto inteiro:
//
//     pureza física (é semente ou impureza?)   98,9 %
//     vigor (está viva?)                       77,6 %
//
// As MESMAS 54 características, a mesma floresta aleatória. Os próprios
// autores explicam: "é mais fácil discriminar entre sementes puras e
// impurezas do que entre sementes de alto e baixo vigor porque seus valores
// característicos se sobrepõem menos".
//
// Forma e cor dizem bem o que é uma semente; dizem mal se ela está viva.
//
// É exatamente por isso que o teste de tetrazólio existe: o sal reage com as
// desidrogenases do tecido vivo e produz formazan VERMELHO. A coloração
// converte um problema difícil — inferir vigor da aparência — num problema
// fácil: medir quão vermelho está o núcleo.
//
// Daí a escolha do que medir. O eixo a* do CIELAB é o eixo verde–vermelho, e
// é a medida direta do que o critério de anotação descreve em palavras
// ("núcleo com qualquer grau de vermelho → viável"). Com ele, a regra deixa
// de ser subjetiva e vira número auditável.
//
// As 20 características abaixo são as mesmas do conjunto de cor do AIseed —
// média e desvio de R, G, B, H, S, V, L*, a*, b* e cinza — para que os dois
// sistemas sejam comparáveis.
// =============================================================================

export interface DadosImagem {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

export interface CaracteristicasDeCor {
  rMean: number;
  rStd: number;
  gMean: number;
  gStd: number;
  bMean: number;
  bStd: number;
  hMean: number;
  hStd: number;
  sMean: number;
  sStd: number;
  vMean: number;
  vStd: number;
  /** Luminosidade CIELAB, 0 a 100. */
  lMean: number;
  lStd: number;
  /** Eixo verde–vermelho do CIELAB. POSITIVO = vermelho. O sinal do tetrazólio. */
  aMean: number;
  aStd: number;
  /** Eixo azul–amarelo do CIELAB. */
  labBMean: number;
  labBStd: number;
  grayMean: number;
  grayStd: number;
  /** Quantos pixels entraram na conta. Zero significa polígono degenerado. */
  pixels: number;
}

// ---------------------------------------------------------------------------
// Conversões de espaço de cor
// ---------------------------------------------------------------------------

/** RGB (0–255) para HSV. H em graus (0–360), S e V em 0–100. */
export function rgbParaHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;

  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

/**
 * RGB (0–255) para CIELAB, iluminante D65, observador 2°.
 *
 * Vale o custo em relação a usar R direto: o CIELAB é perceptualmente
 * uniforme, então a mesma diferença numérica em a* corresponde à mesma
 * diferença visível — o que não vale para o canal R, onde a distância depende
 * do brilho. Para comparar coloração entre lâminas, iluminações e
 * equipamentos, é a diferença entre um número transferível e um número que só
 * vale naquela foto.
 */
export function rgbParaLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB -> linear
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  // linear -> XYZ (matriz sRGB D65)
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;

  // Branco de referência D65
  const xr = X / 0.95047;
  const yr = Y / 1.0;
  const zr = Z / 1.08883;

  const fx = t116(xr);
  const fy = t116(yr);
  const fz = t116(zr);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function t116(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

// ---------------------------------------------------------------------------
// Extração sobre o polígono
// ---------------------------------------------------------------------------

/** Lançamento de raio — mesma função de measurements.ts, replicada para manter este módulo independente. */
function dentroDoPoligono(px: number, py: number, poly: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cruza = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Média e desvio padrão populacional de um acumulador. */
function estatisticas(soma: number, somaQuadrados: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const media = soma / n;
  const variancia = Math.max(0, somaQuadrados / n - media * media);
  return [media, Math.sqrt(variancia)];
}

/**
 * Extrai as 20 características de cor dos pixels DENTRO do contorno.
 *
 * Percorre apenas a caixa envolvente do polígono, não a imagem inteira: numa
 * digitalização de 7992×3672 com dezenas de sementes, varrer tudo por objeto
 * seria proibitivo.
 *
 * `amostragem` maior que 1 salta pixels — útil para contornos grandes, onde a
 * média não muda mas o custo cai quadraticamente.
 */
export function extrairCaracteristicasDeCor(
  img: DadosImagem,
  poligono: [number, number][],
  amostragem = 1
): CaracteristicasDeCor {
  const zero: CaracteristicasDeCor = {
    rMean: 0, rStd: 0, gMean: 0, gStd: 0, bMean: 0, bStd: 0,
    hMean: 0, hStd: 0, sMean: 0, sStd: 0, vMean: 0, vStd: 0,
    lMean: 0, lStd: 0, aMean: 0, aStd: 0, labBMean: 0, labBStd: 0,
    grayMean: 0, grayStd: 0, pixels: 0,
  }; // prettier-ignore

  if (poligono.length < 3) return zero;

  // Caixa envolvente, recortada aos limites da imagem.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poligono) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(img.width - 1, Math.ceil(maxX));
  maxY = Math.min(img.height - 1, Math.ceil(maxY));
  if (maxX < minX || maxY < minY) return zero;

  const passo = Math.max(1, Math.floor(amostragem));
  const soma = new Float64Array(10);
  const somaQ = new Float64Array(10);
  let n = 0;

  for (let y = minY; y <= maxY; y += passo) {
    for (let x = minX; x <= maxX; x += passo) {
      if (!dentroDoPoligono(x + 0.5, y + 0.5, poligono)) continue;

      const i = (y * img.width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];

      const [h, s, v] = rgbParaHsv(r, g, b);
      const [L, A, Blab] = rgbParaLab(r, g, b);
      const cinza = 0.299 * r + 0.587 * g + 0.114 * b;

      const vals = [r, g, b, h, s, v, L, A, Blab, cinza];
      for (let k = 0; k < 10; k++) {
        soma[k] += vals[k];
        somaQ[k] += vals[k] * vals[k];
      }
      n++;
    }
  }

  if (n === 0) return zero;

  const [rMean, rStd] = estatisticas(soma[0], somaQ[0], n);
  const [gMean, gStd] = estatisticas(soma[1], somaQ[1], n);
  const [bMean, bStd] = estatisticas(soma[2], somaQ[2], n);
  const [hMean, hStd] = estatisticas(soma[3], somaQ[3], n);
  const [sMean, sStd] = estatisticas(soma[4], somaQ[4], n);
  const [vMean, vStd] = estatisticas(soma[5], somaQ[5], n);
  const [lMean, lStd] = estatisticas(soma[6], somaQ[6], n);
  const [aMean, aStd] = estatisticas(soma[7], somaQ[7], n);
  const [labBMean, labBStd] = estatisticas(soma[8], somaQ[8], n);
  const [grayMean, grayStd] = estatisticas(soma[9], somaQ[9], n);

  const r3 = (x: number) => Number(x.toFixed(3));

  return {
    rMean: r3(rMean), rStd: r3(rStd),
    gMean: r3(gMean), gStd: r3(gStd),
    bMean: r3(bMean), bStd: r3(bStd),
    hMean: r3(hMean), hStd: r3(hStd),
    sMean: r3(sMean), sStd: r3(sStd),
    vMean: r3(vMean), vStd: r3(vStd),
    lMean: r3(lMean), lStd: r3(lStd),
    aMean: r3(aMean), aStd: r3(aStd),
    labBMean: r3(labBMean), labBStd: r3(labBStd),
    grayMean: r3(grayMean), grayStd: r3(grayStd),
    pixels: n,
  }; // prettier-ignore
}

/**
 * Índice de coloração por tetrazólio, na escala do a* do CIELAB.
 *
 * Não é um classificador — é a medida bruta que uma regra pode usar. Positivo
 * indica vermelho; quanto maior, mais forte a coloração. Fica aqui, e não num
 * modelo, exatamente para poder ser defendido numa banca: "descartei abaixo de
 * a* = 5 porque é o limiar em que a coloração deixa de ser visível".
 */
export function indiceTetrazolio(cor: CaracteristicasDeCor): number {
  return cor.aMean;
}
