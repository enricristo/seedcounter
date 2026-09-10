// =============================================================================
// SeedCounter — modelo do fundo
//
// POR QUE ISTO EXISTE.
//
// A onda cresce enquanto a cor se parece com o pixel clicado. Isso funciona
// quando a semente está sozinha e falha quando ela encosta noutra: a vizinha é
// igualmente parecida, e não há nada no critério que diga onde uma acaba.
//
// A saída é inverter a pergunta. Em vez de "até onde a cor continua parecida
// com o clique?", perguntar "até onde deixa de ser FUNDO?". Para isso é preciso
// saber o que é fundo — e saber ANTES do clique, para a imagem inteira.
//
// TRÊS DECISÕES, E O MOTIVO DE CADA UMA.
//
// 1. CIELAB, e a cromaticidade separada da luminosidade.
//
//    O argumento genérico "Lab é perceptualmente uniforme" é fraco. O forte é
//    específico: a sombra projetada sob a semente mexe quase só no L*. Então
//    uma distância calculada apenas em (a*, b*) é aproximadamente invariante à
//    sombra — o que não tem equivalente em RGB, onde a sombra move os três
//    canais juntos. HSV seria a pior escolha: o matiz é numericamente instável
//    em baixa saturação, e bandeja cinza é exatamente isso.
//
// 2. Superfície polinomial em vez de cor constante.
//
//    Digitalização de scanner tem vinheta e gradiente de lâmpada: a borda é
//    SISTEMATICAMENTE diferente do centro. Uma cor média global erra justamente
//    onde as sementes estão. Um polinômio de 2ª ordem em (x, y) — seis
//    coeficientes por canal — representa bem esses sinais de baixa frequência.
//    Grau 3 quase sempre é sobreajuste, e passa a seguir as próprias sementes.
//
// 3. Ajuste robusto por repesagem, semeado pela borda.
//
//    A borda da imagem é uma boa SEMENTE de fundo, mas um péssimo MODELO: além
//    da vinheta, um respingo ou uma marca de caneta na borda destrói uma média.
//    Então: começa pela borda com estatística robusta (mediana e desvio
//    absoluto mediano), ajusta, descarta os resíduos grandes — que são as
//    sementes — e reajusta. Duas ou três iterações bastam.
//
// A CLASSIFICAÇÃO É DE TRÊS VIAS, NÃO DUAS.
//
// Sombra não é fundo nem semente, e binarizar sempre erra numa das duas. Com o
// modelo em mãos a distinção fica direta:
//
//   fundo   cromaticidade próxima  E  luminosidade próxima
//   sombra  cromaticidade próxima  E  luminosidade MENOR   (mesma cor, escura)
//   objeto  cromaticidade distante
//
// O caso que este módulo NÃO resolve, e é honesto dizer: semente de orquídea
// translúcida é escura e pouco cromática — fotometricamente parecida com
// sombra. Ali não há truque de espaço de cor; ou entra prior geométrico (a
// sombra sai sempre do mesmo lado, porque a iluminação do scanner é fixa), ou
// entra forma, ou fica para o humano.
// =============================================================================

import { rgbParaLab, type DadosImagem } from './color-features';

export interface OpcoesDeFundo {
  /**
   * Passo da amostragem, em pixels. Padrão 8.
   *
   * O fundo é de baixa frequência por definição: amostrar um pixel a cada oito
   * preserva a superfície e corta o custo em 64×. Numa digitalização de 64
   * megapixels a diferença é entre segundos e milissegundos.
   */
  passo?: number;
  /** Espessura da faixa de borda usada como semente, em fração do lado. Padrão 0,04. */
  faixaDaBorda?: number;
  /** Quantas rodadas de repesagem. Padrão 3. */
  iteracoes?: number;
  /**
   * Múltiplo do desvio robusto acima do qual a amostra é descartada como
   * objeto durante o ajuste. Padrão 2,5.
   */
  corteDeResiduo?: number;
}

export interface ModeloDeFundo {
  /** Cor esperada do fundo naquele ponto, em Lab. */
  predizer(x: number, y: number): [number, number, number];
  /** Espalhamento típico do resíduo cromático entre os pixels de fundo. */
  sigmaCroma: number;
  /** Espalhamento típico do resíduo de luminosidade. */
  sigmaLuz: number;
  /** Quantas amostras sobreviveram como fundo no último ajuste. */
  amostras: number;
  /** Fração da imagem que sobrou como fundo. Numa digitalização normal, 0,8 a 0,95. */
  fracaoDeFundo: number;
  /**
   * A estimativa não merece confiança: sobraram poucas amostras, ou o resíduo
   * ficou grande demais para o fundo ser considerado uniforme.
   *
   * Quem chama precisa tratar isso — usar um modelo ruim em silêncio é pior que
   * não ter modelo, porque o erro passa a parecer medida.
   */
  incerto: boolean;
}

export type ClasseDePixel = 'fundo' | 'sombra' | 'objeto';

const PADROES = {
  passo: 8,
  faixaDaBorda: 0.04,
  iteracoes: 3,
  corteDeResiduo: 2.5,
};

/** Abaixo disto o ajuste não tem amostras suficientes para seis coeficientes. */
const AMOSTRAS_MINIMAS = 60;

/**
 * Acima deste resíduo cromático o "fundo" não é uniforme o bastante para o
 * modelo significar alguma coisa — imagem com duas bandejas, ou recorte que
 * pegou a borda do equipamento.
 */
const CROMA_MAXIMO_ACEITAVEL = 12;

/**
 * Fração mínima da imagem que precisa sobrar como fundo.
 *
 * Numa digitalização normal o fundo é 80 a 95 % dos pixels. Se depois da
 * repesagem sobrou menos de um terço, uma de duas coisas aconteceu: a imagem é
 * quase toda objeto (recorte apertado demais), ou o ajuste se agarrou a uma
 * região minoritária e chamou o resto de objeto. Nos dois casos o modelo pode
 * até estar internamente coerente, e ainda assim não descrever "o fundo desta
 * imagem" — que é o que quem chama vai supor.
 */
const FRACAO_MINIMA_DE_FUNDO = 0.33;

// ---------------------------------------------------------------------------
// Estatística robusta
// ---------------------------------------------------------------------------

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const meio = v.length >> 1;
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/**
 * Desvio absoluto mediano, reescalado para equivaler ao desvio padrão numa
 * distribuição normal. É o que substitui média e desvio quando um punhado de
 * amostras contaminadas pode existir — e aqui elas existem por construção.
 */
function desvioRobusto(valores: number[], centro: number): number {
  if (valores.length === 0) return 0;
  return 1.4826 * mediana(valores.map((v) => Math.abs(v - centro)));
}

// ---------------------------------------------------------------------------
// Ajuste da superfície
// ---------------------------------------------------------------------------

/** Base do polinômio de 2ª ordem, com (x, y) já normalizados para [-1, 1]. */
function base(x: number, y: number): number[] {
  return [1, x, y, x * x, x * y, y * y];
}

const N_COEF = 6;

/**
 * Resolve o sistema normal 6×6 por eliminação de Gauss com pivoteamento
 * parcial.
 *
 * Seis incógnitas não justificam decomposição QR, mas justificam o
 * pivoteamento: sem ele, uma imagem onde as amostras de fundo caem quase todas
 * numa linha produz pivô perto de zero e coeficientes absurdos.
 */
function resolver(A: number[][], b: number[]): number[] | null {
  const M = A.map((linha, i) => [...linha, b[i]]);

  for (let col = 0; col < N_COEF; col++) {
    let melhor = col;
    for (let linha = col + 1; linha < N_COEF; linha++) {
      if (Math.abs(M[linha][col]) > Math.abs(M[melhor][col])) melhor = linha;
    }
    if (Math.abs(M[melhor][col]) < 1e-10) return null; // singular
    [M[col], M[melhor]] = [M[melhor], M[col]];

    for (let linha = col + 1; linha < N_COEF; linha++) {
      const f = M[linha][col] / M[col][col];
      for (let k = col; k <= N_COEF; k++) M[linha][k] -= f * M[col][k];
    }
  }

  const c = new Array(N_COEF).fill(0);
  for (let i = N_COEF - 1; i >= 0; i--) {
    let soma = M[i][N_COEF];
    for (let j = i + 1; j < N_COEF; j++) soma -= M[i][j] * c[j];
    c[i] = soma / M[i][i];
  }
  return c;
}

/** Mínimos quadrados ponderados de um canal contra a base polinomial. */
function ajustarCanal(
  amostras: { bx: number[]; valor: number }[],
  pesos: number[]
): number[] | null {
  const A: number[][] = Array.from({ length: N_COEF }, () => new Array(N_COEF).fill(0));
  const b = new Array(N_COEF).fill(0);

  for (let n = 0; n < amostras.length; n++) {
    const p = pesos[n];
    if (p <= 0) continue;
    const { bx, valor } = amostras[n];
    for (let i = 0; i < N_COEF; i++) {
      b[i] += p * bx[i] * valor;
      for (let j = i; j < N_COEF; j++) A[i][j] += p * bx[i] * bx[j];
    }
  }
  // A é simétrica: preenche o triângulo inferior espelhando.
  for (let i = 0; i < N_COEF; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];

  return resolver(A, b);
}

// ---------------------------------------------------------------------------
// Estimativa
// ---------------------------------------------------------------------------

/**
 * Estima o fundo da imagem.
 *
 * Devolve `null` quando não há amostras suficientes — imagem minúscula, ou
 * recorte que é todo objeto.
 */
export function estimarFundo(
  imagem: DadosImagem,
  opcoes: OpcoesDeFundo = {}
): ModeloDeFundo | null {
  const cfg = { ...PADROES, ...opcoes };
  const { width: W, height: H } = imagem;
  if (W < 8 || H < 8) return null;

  // Coordenadas normalizadas: condiciona o sistema. Sem isto, x² num scanner de
  // 6800 px de largura gera números da ordem de 4×10⁷ e o ajuste perde precisão.
  const nx = (x: number) => (2 * x) / (W - 1) - 1;
  const ny = (y: number) => (2 * y) / (H - 1) - 1;

  // --- Amostragem ---
  interface Amostra {
    bx: number[];
    L: number;
    a: number;
    b: number;
    naBorda: boolean;
  }
  const amostras: Amostra[] = [];
  const margemX = Math.max(2, Math.round(W * cfg.faixaDaBorda));
  const margemY = Math.max(2, Math.round(H * cfg.faixaDaBorda));

  for (let y = 0; y < H; y += cfg.passo) {
    for (let x = 0; x < W; x += cfg.passo) {
      const i = (y * W + x) * 4;
      const [L, a, b] = rgbParaLab(imagem.data[i], imagem.data[i + 1], imagem.data[i + 2]);
      amostras.push({
        bx: base(nx(x), ny(y)),
        L,
        a,
        b,
        naBorda: x < margemX || y < margemY || x >= W - margemX || y >= H - margemY,
      });
    }
  }
  if (amostras.length < AMOSTRAS_MINIMAS) return null;

  // --- Semente: só a borda entra na primeira rodada ---
  // A borda é onde o objeto raramente está. Começar por ela evita que o
  // primeiro ajuste seja puxado pelas sementes do centro.
  const naBorda = amostras.filter((s) => s.naBorda);
  const pesos = amostras.map((s) => (s.naBorda ? 1 : 0));
  if (naBorda.length < AMOSTRAS_MINIMAS / 2) {
    // Recorte pequeno demais para ter borda útil: começa com tudo e deixa a
    // repesagem separar.
    pesos.fill(1);
  }

  let coefL: number[] | null = null;
  let coefA: number[] | null = null;
  let coefB: number[] | null = null;
  let sigmaCroma = 0;
  let sigmaLuz = 0;
  let sobreviventes = 0;

  for (let iter = 0; iter < cfg.iteracoes; iter++) {
    const paraL = amostras.map((s) => ({ bx: s.bx, valor: s.L }));
    const paraA = amostras.map((s) => ({ bx: s.bx, valor: s.a }));
    const paraB = amostras.map((s) => ({ bx: s.bx, valor: s.b }));

    coefL = ajustarCanal(paraL, pesos);
    coefA = ajustarCanal(paraA, pesos);
    coefB = ajustarCanal(paraB, pesos);
    if (!coefL || !coefA || !coefB) return null;

    const avaliar = (c: number[], bx: number[]) => {
      let v = 0;
      for (let i = 0; i < N_COEF; i++) v += c[i] * bx[i];
      return v;
    };

    // Resíduo CROMÁTICO: é ele que separa objeto de fundo sem confundir com
    // sombra. O resíduo de luminosidade é medido em separado, para a
    // classificação de três vias.
    const residuoCroma = amostras.map((s) => {
      const da = s.a - avaliar(coefA!, s.bx);
      const db = s.b - avaliar(coefB!, s.bx);
      return Math.sqrt(da * da + db * db);
    });
    const residuoLuz = amostras.map((s) => s.L - avaliar(coefL!, s.bx));

    // Estatística sobre o que hoje é considerado fundo.
    const doFundo = residuoCroma.filter((_, n) => pesos[n] > 0);
    const centro = mediana(doFundo);
    sigmaCroma = Math.max(0.5, desvioRobusto(doFundo, centro));

    const luzDoFundo = residuoLuz.filter((_, n) => pesos[n] > 0);
    sigmaLuz = Math.max(0.5, desvioRobusto(luzDoFundo, mediana(luzDoFundo)));

    // Repesagem: o que está longe demais é objeto e sai do ajuste. Na última
    // iteração não vale repesar — o resultado já não seria usado.
    if (iter < cfg.iteracoes - 1) {
      const limite = centro + cfg.corteDeResiduo * sigmaCroma;
      sobreviventes = 0;
      for (let n = 0; n < amostras.length; n++) {
        pesos[n] = residuoCroma[n] <= limite ? 1 : 0;
        if (pesos[n] > 0) sobreviventes++;
      }
      // Perder quase tudo significa que a imagem é majoritariamente objeto, ou
      // que o corte ficou apertado. Melhor manter a rodada anterior.
      if (sobreviventes < AMOSTRAS_MINIMAS) {
        pesos.fill(1);
        sobreviventes = amostras.length;
        break;
      }
    } else {
      sobreviventes = pesos.filter((p) => p > 0).length;
    }
  }

  const cL = coefL!;
  const cA = coefA!;
  const cB = coefB!;

  return {
    predizer(x: number, y: number) {
      const bx = base(nx(x), ny(y));
      let L = 0;
      let a = 0;
      let b = 0;
      for (let i = 0; i < N_COEF; i++) {
        L += cL[i] * bx[i];
        a += cA[i] * bx[i];
        b += cB[i] * bx[i];
      }
      return [L, a, b];
    },
    sigmaCroma,
    sigmaLuz,
    amostras: sobreviventes,
    fracaoDeFundo: sobreviventes / amostras.length,
    incerto:
      sobreviventes < AMOSTRAS_MINIMAS ||
      sigmaCroma > CROMA_MAXIMO_ACEITAVEL ||
      sobreviventes / amostras.length < FRACAO_MINIMA_DE_FUNDO,
  };
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export interface LimiaresDeClasse {
  /** Múltiplo de sigmaCroma acima do qual o pixel é objeto. Padrão 3. */
  croma?: number;
  /** Múltiplo de sigmaLuz abaixo do qual o pixel escuro é sombra. Padrão 2,5. */
  luz?: number;
}

/**
 * Classifica um pixel contra o modelo, em três vias.
 *
 * A ordem das perguntas importa: cromaticidade primeiro. Um pixel com cor
 * diferente é objeto, esteja claro ou escuro. Só depois, entre os que têm a
 * cor do fundo, o sinal da luminosidade separa fundo de sombra.
 */
export function classificarPixel(
  modelo: ModeloDeFundo,
  L: number,
  a: number,
  b: number,
  x: number,
  y: number,
  limiares: LimiaresDeClasse = {}
): ClasseDePixel {
  const corteCroma = (limiares.croma ?? 3) * modelo.sigmaCroma;
  const corteLuz = (limiares.luz ?? 2.5) * modelo.sigmaLuz;

  const [eL, ea, eb] = modelo.predizer(x, y);
  const dCroma = Math.hypot(a - ea, b - eb);
  if (dCroma > corteCroma) return 'objeto';

  const dLuz = L - eL;
  // Só escurecer conta como sombra. Mais claro que o fundo com a mesma cor é
  // reflexo especular, e reflexo está sobre o objeto.
  if (dLuz < -corteLuz) return 'sombra';
  if (dLuz > corteLuz) return 'objeto';
  return 'fundo';
}

/**
 * Máscara de primeiro plano da imagem inteira.
 *
 * Sombra NÃO entra: ela pertence ao fundo para efeito de contorno. Uma
 * morfometria que inclui a sombra mede a semente mais a sua projeção, e
 * superestima sistematicamente — do mesmo lado, sempre, porque a iluminação do
 * scanner é fixa.
 */
export function mascaraDeObjeto(
  imagem: DadosImagem,
  modelo: ModeloDeFundo,
  limiares: LimiaresDeClasse = {}
): Uint8Array {
  const { width: W, height: H } = imagem;
  const mascara = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [L, a, b] = rgbParaLab(imagem.data[i], imagem.data[i + 1], imagem.data[i + 2]);
      if (classificarPixel(modelo, L, a, b, x, y, limiares) === 'objeto') {
        mascara[y * W + x] = 1;
      }
    }
  }
  return mascara;
}
