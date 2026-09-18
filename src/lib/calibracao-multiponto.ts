// =============================================================================
// SeedCounter — calibração por referência, medida em vários pontos
//
// POR QUE ESTE MÓDULO EXISTE.
//
// A calibração de um ponto só responde "quanto mede um pixel AQUI". Não
// responde as duas perguntas que decidem se uma medida pode ser publicada:
//
//   1. Quanto a medida VARIA quando eu repito? (repetibilidade)
//   2. A escala é a MESMA no canto e no meio da mesa? (uniformidade)
//
// É o procedimento de sensoriamento remoto aplicado a um scanner de mesa: um
// alvo de dimensão conhecida, lido em vários pontos do campo, e a dispersão
// vira parte do resultado em vez de virar surpresa. Sem isso, um erro de
// escala entra igual em TODO o lote — e um erro sistemático não aparece na
// repetição do ensaio, porque ele não é ruído, é viés. Foi assim que este
// projeto descobriu uma diferença de 32% entre o DPI declarado e o real
// (`docs/datasets/auditoria-de-medida.md`), e a diferença já tinha entrado em
// tudo que fora medido antes.
//
// O QUE É DECLARAÇÃO E O QUE É MEDIDA.
//
// O DPI que o driver grava no arquivo é o que o software ACHA que fez. Ele
// pode ser interpolado: um scanner de 1200 dpi ópticos configurado para 4800
// entrega quatro vezes mais pixels e NENHUM detalhe novo — a informação que
// não entrou pelo sensor não volta por reamostragem. Este módulo não sabe
// distinguir pixel óptico de pixel interpolado (nenhum software sabe, olhando
// só o arquivo), e por isso não finge: ele compara a escala MEDIDA com a
// DECLARADA e relata a diferença. Quem decide é a régua.
// =============================================================================

/** Uma leitura do alvo de referência, num ponto do campo. */
export interface LeituraDeReferencia {
  /** O tamanho real do alvo, em milímetros. Ex.: 10 mm entre dois traços da régua. */
  referenciaMm: number;
  /** Quantos pixels esse tamanho ocupou na imagem. */
  pixels: number;
  /** Onde a leitura foi feita, em pixels da imagem. Opcional — sem isso não há teste de uniformidade. */
  x?: number;
  y?: number;
  /** Anotação livre de quem mediu: "canto superior esquerdo", "sobre a lâmina". */
  ponto?: string;
}

export interface ResultadoDaCalibracao {
  /** Quantas leituras entraram. */
  n: number;
  /** A escala medida, em micrômetros por pixel — a média das leituras. */
  umPorPixel: number;
  /** O DPI que essa escala implica. */
  dpiMedido: number;
  /** Desvio-padrão amostral das leituras, em µm/px. `null` com uma leitura só. */
  desvioPadrao: number | null;
  /** Coeficiente de variação, em %. É o número que diz se dá para publicar. */
  cvPercent: number | null;
  /** Diferença percentual contra o DPI declarado, quando há um. Positivo = o declarado é MAIOR. */
  diferencaDoDeclaradoPercent: number | null;
  /**
   * A escala varia ao longo do campo? Correlação de Pearson entre a escala de
   * cada leitura e sua posição. `null` quando faltam posições ou leituras.
   * Valor alto em módulo é sinal de ótica ou tração não uniforme — o tipo de
   * erro que uma calibração de um ponto só nunca revela.
   */
  tendenciaEmX: number | null;
  tendenciaEmY: number | null;
  /** O que fazer com isto, em uma frase, na língua de quem está na bancada. */
  veredito: string;
  /** Presente quando o resultado NÃO deve virar medida publicada sem repetir. */
  alerta?: string;
}

/** Limiar de dispersão acima do qual a calibração não serve para publicar. */
const CV_ACEITAVEL = 1.0;
/** Diferença contra o declarado que já merece ser dita em voz alta. */
const DIVERGENCIA_NOTAVEL = 2.0;
/** Correlação com a posição a partir da qual se suspeita de não uniformidade. */
const TENDENCIA_NOTAVEL = 0.8;

function valido(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** µm/px de uma leitura: milímetros viram micrômetros, divididos pelos pixels. */
export function escalaDaLeitura(l: LeituraDeReferencia): number | null {
  if (!valido(l.referenciaMm) || !valido(l.pixels)) return null;
  return (l.referenciaMm * 1000) / l.pixels;
}

/** Pearson entre dois vetores. `null` quando não há variação em um deles. */
function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  // Sem variação numa das séries a correlação não existe — todas as leituras
  // no mesmo x, por exemplo. Devolver 0 seria afirmar "não há tendência", e
  // isso não foi medido.
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

/**
 * A calibração a partir de várias leituras do alvo.
 *
 * `dpiDeclarado` é opcional e serve só para a comparação: o resultado não
 * depende dele em nada.
 */
export function calibrarPorReferencia(
  leituras: LeituraDeReferencia[],
  dpiDeclarado?: number
): ResultadoDaCalibracao | null {
  const escalas: number[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const escalasComX: number[] = [];
  const escalasComY: number[] = [];

  for (const l of leituras) {
    const e = escalaDaLeitura(l);
    if (e === null) continue;
    escalas.push(e);
    if (typeof l.x === 'number' && Number.isFinite(l.x)) {
      xs.push(l.x);
      escalasComX.push(e);
    }
    if (typeof l.y === 'number' && Number.isFinite(l.y)) {
      ys.push(l.y);
      escalasComY.push(e);
    }
  }
  if (escalas.length === 0) return null;

  const n = escalas.length;
  const media = escalas.reduce((s, v) => s + v, 0) / n;
  const dpiMedido = 25400 / media;

  let desvioPadrao: number | null = null;
  let cvPercent: number | null = null;
  if (n >= 2) {
    // Amostral (n−1): estas leituras são uma amostra do que o aparelho faria,
    // não a população inteira das leituras possíveis.
    const variancia = escalas.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1);
    desvioPadrao = Math.sqrt(variancia);
    cvPercent = (desvioPadrao / media) * 100;
  }

  const diferencaDoDeclaradoPercent =
    valido(dpiDeclarado) ? ((dpiDeclarado - dpiMedido) / dpiMedido) * 100 : null;

  const tendenciaEmX = pearson(xs, escalasComX);
  const tendenciaEmY = pearson(ys, escalasComY);

  const r: ResultadoDaCalibracao = {
    n,
    umPorPixel: media,
    dpiMedido,
    desvioPadrao,
    cvPercent,
    diferencaDoDeclaradoPercent,
    tendenciaEmX,
    tendenciaEmY,
    // `veredito` e `alerta` vêm inteiros daqui — sem placeholder antes, que o
    // TypeScript corretamente acusou como escrita dupla.
    ...vereditoE(n, cvPercent, diferencaDoDeclaradoPercent, tendenciaEmX, tendenciaEmY, dpiMedido),
  };
  return r;
}

/**
 * A frase que a pessoa lê, e o alerta quando o resultado não deve ser usado.
 *
 * Fica separado porque é a parte que muda por conversa com quem usa, e não
 * quero que mexer no texto obrigue a mexer na aritmética.
 */
function vereditoE(
  n: number,
  cv: number | null,
  dif: number | null,
  tx: number | null,
  ty: number | null,
  dpiMedido: number
): { veredito: string; alerta?: string } {
  const dpi = Math.round(dpiMedido);

  if (n === 1) {
    return {
      veredito: `Escala medida: ${dpi} DPI efetivos, de uma leitura só.`,
      alerta:
        'Uma leitura não tem dispersão, e por isso não prova nada sobre repetibilidade. ' +
        'Meça o mesmo alvo em pelo menos três pontos diferentes do campo antes de publicar.',
    };
  }

  const partes: string[] = [`Escala medida: ${dpi} DPI efetivos em ${n} leituras`];
  if (cv !== null) partes.push(`CV ${cv.toFixed(2)}%`);
  const veredito = partes.join(', ') + '.';

  // A ordem importa, e custou um teste vermelho para ficar clara: uma escala
  // que varia com a POSIÇÃO também infla o CV. Se o CV falasse primeiro, o
  // diagnóstico seria "as leituras discordam" — verdadeiro, genérico e
  // inútil — quando a resposta certa é "a escala muda de um lado para o outro
  // do campo". Diagnóstico específico antes do genérico.
  const naoUniforme =
    (tx !== null && Math.abs(tx) > TENDENCIA_NOTAVEL) ||
    (ty !== null && Math.abs(ty) > TENDENCIA_NOTAVEL);
  if (naoUniforme) {
    const eixo = tx !== null && Math.abs(tx) > TENDENCIA_NOTAVEL ? 'horizontal' : 'vertical';
    return {
      veredito,
      alerta:
        `A escala muda ao longo do eixo ${eixo} do campo: as leituras crescem ou diminuem ` +
        'conforme a posição, em vez de variarem ao acaso. Uma escala única não descreve esta ' +
        'imagem — meça a amostra sempre na mesma região do campo, ou troque de equipamento ' +
        'para o que for publicar.',
    };
  }

  if (cv !== null && cv > CV_ACEITAVEL) {
    return {
      veredito,
      alerta:
        `As leituras discordam entre si (CV ${cv.toFixed(2)}%, acima de ${CV_ACEITAVEL}%). ` +
        'Antes de aceitar: confira se o alvo estava encostado no vidro, se a imagem não foi ' +
        'redimensionada depois de digitalizada, e se os traços medidos são os mesmos em todas ' +
        'as leituras.',
    };
  }

  if (dif !== null && Math.abs(dif) > DIVERGENCIA_NOTAVEL) {
    const sinal = dif > 0 ? 'MAIOR' : 'MENOR';
    return {
      veredito,
      alerta:
        `O DPI declarado pelo arquivo é ${Math.abs(dif).toFixed(1)}% ${sinal} que o medido. ` +
        'Medidas em milímetros feitas com o valor declarado carregam esse erro inteiro, e ele ' +
        'é sistemático: entra igual em todas as amostras e não aparece na repetição do ensaio. ' +
        'Use a escala medida.',
    };
  }

  return { veredito };
}
