// =============================================================================
// SeedCounter — segmentação por clique ("a onda")
//
// A IDEIA, NAS PALAVRAS DE QUEM PEDIU: "eu clico e ele joga uma onda na volta
// da região e segmenta numa região de pixel, algo bem click interativo, não
// necessariamente YOLO, algo mais matemático, semi-automático".
//
// POR QUE ISTO VEM ANTES DO CLASSIFICADOR.
//
// O modelo YOLO embarcado foi treinado só em semente de orquídea, com duas
// classes. Ele não serve para soja nem para forrageira, e o projeto tem dois
// alvos permanentes. Já a onda não depende de espécie nenhuma: é geometria e
// cor. Funciona em soja hoje e em orquídea sempre.
//
// E o clique É a curadoria. Não existe proposta a aceitar ou rejeitar, porque
// foi a pessoa que iniciou — o ponto clicado é a identidade e a localização da
// semente, não só o gatilho da segmentação.
//
// COMO FUNCIONA, EM UMA FRASE.
//
// A região é o componente conexo do ponto clicado dentro do conjunto de pixels
// cuja diferença de cor até a referência é menor que uma tolerância — e a
// tolerância não é escolhida à mão: é a que deixa a área mais ESTÁVEL.
//
// A frente cresce sempre pelo pixel mais parecido primeiro (fila de
// prioridade), e cada pixel guarda o ΔE em que entrou — o "tempo de chegada"
// da onda. Com esse mapa, a região para qualquer tolerância é um simples corte:
// os pixels que chegaram antes dela. Um vazamento (a onda escapou para o fundo)
// aparece como um SALTO BRUSCO de área; a tolerância boa é aquela onde a área
// quase não muda. É o critério do MSER (Maximally Stable Extremal Regions),
// aplicado ao eixo de tolerância em vez do de intensidade.
//
// POR QUE EM CIELAB, E NÃO EM RGB OU HSV.
//
// O L* isola a luminosidade do resto. Sob cada semente há uma sombra suave, e
// em RGB ela muda os três canais de uma vez — a onda ou vaza para a sombra ou
// para antes de chegar na borda. Em Lab a sombra mexe quase só no L*, e o
// contorno para onde a cor realmente muda. É também o espaço onde o a* do
// tetrazólio já vive: nenhuma conversão nova.
// =============================================================================

import { rgbParaLab, type DadosImagem } from './color-features';
import { simplifyContour, traceContour } from './contour';

export interface OpcoesDaOnda {
  /**
   * Lado da janela de trabalho, em pixels. A onda nunca sai dela.
   *
   * Existe por desempenho e por segurança: uma digitalização de scanner tem
   * dezenas de milhões de pixels, e sem teto um clique no fundo inundaria a
   * imagem inteira. 512 cobre semente de soja a ~950 dpi (261 px) e de
   * orquídea a 3600 dpi (~166 px).
   */
  janela?: number;
  /** Raio da amostra de cor ao redor do clique. Padrão 2 (janela de 5×5). */
  raioDaAmostra?: number;
  /** Tolerância fixa em ΔE. Ausente = escolhida pela estabilidade. */
  tolerancia?: number;
  /** Área mínima (px) para uma região contar como semente. Padrão 24. */
  areaMinima?: number;
  /**
   * Crescimento de área tolerado ao medir a largura do platô, como fração.
   * Padrão 0,02. Só afeta a medida de confiança, não a escolha da tolerância.
   */
  crescimentoTolerado?: number;
  /**
   * Quanto recuar do custo de escape, como fração. Padrão 0,10.
   *
   * O escape é o ΔE em que a onda sai da janela — na prática, o ΔE do fundo.
   * Parar exatamente nele engole a borda inteira e um pedaço do fundo; recuar
   * 10% cai no meio da rampa de transição, que é onde uma pessoa desenharia o
   * contorno. Medido contra as máscaras do dataset de soja: sem recuo o erro
   * mediano é +118%, com 10% é -4%.
   */
  recuoDoEscape?: number;
  /**
   * Devolve o perfil da onda: o ΔE de gargalo em que cada pixel entrou, na
   * ordem de entrada. É o que permite estudar a escolha de tolerância contra
   * dado real, e é o que uma interface usaria para desenhar a curva de área.
   */
  comPerfil?: boolean;
}

export interface ResultadoDaOnda {
  /** Janela de trabalho, em coordenadas absolutas da imagem. */
  janela: { x: number; y: number; w: number; h: number };
  /** Máscara da janela: 1 dentro da região. */
  mascara: Uint8Array;
  /** Contorno em coordenadas ABSOLUTAS da imagem. */
  contorno: [number, number][];
  /** Área da região, em pixels. */
  areaPx: number;
  /** ΔE escolhido (ou o informado, quando fixo). */
  tolerancia: number;
  /**
   * Quanto a região cresce ao atravessar a borda escolhida, em fração da
   * própria área. MENOR = borda mais nítida; 0 = degrau perfeito.
   *
   * É a medida de confiança do contorno: numa semente que se destaca do fundo,
   * mexer a tolerância em volta da borda quase não muda a área. Numa borda em
   * rampa — sombra forte, semente da cor da bandeja — a área muda muito, e o
   * contorno passa a ser palpite. Acima de
   * `CRESCIMENTO_MAXIMO_CONFIAVEL` o resultado vem marcado.
   */
  crescimentoNaBorda: number;
  /**
   * A região encostou na borda da janela — provavelmente foi cortada, ou o
   * clique caiu no fundo e a onda vazou. Quem chama deve tentar de novo com
   * uma janela maior antes de aceitar o resultado.
   */
  tocouBorda: boolean;
  /** Só quando `comPerfil`: ΔE de entrada de cada pixel, em ordem crescente. */
  perfil?: Float32Array;
  /** Só quando `comPerfil`: ΔE em que a onda alcançou a borda da janela. */
  custoDaBorda?: number;
}

const PADROES = {
  janela: 512,
  raioDaAmostra: 2,
  areaMinima: 24,
  crescimentoTolerado: 0.02,
  recuoDoEscape: 0.1,
};

/**
 * Acima deste crescimento relativo a borda não é uma borda — é uma rampa, e o
 * contorno vira palpite. Metade da área mudando ao atravessar a transição é o
 * limite do que ainda dá para chamar de contorno.
 */
export const CRESCIMENTO_MAXIMO_CONFIAVEL = 0.5;

/**
 * ΔE máximo que a onda percorre antes de desistir.
 *
 * Não é a tolerância: é o alcance da varredura, de onde os candidatos de
 * tolerância são tirados. Acima de 60 em Lab as cores não têm mais nada a ver
 * uma com a outra, e continuar só custa tempo.
 */
const ALCANCE_MAXIMO = 60;

/**
 * Quanto além do ΔE de fuga a onda ainda avança antes de parar.
 *
 * Precisa sobrar margem para medir `crescimentoNaBorda` do outro lado da
 * transição; 40% é folga confortável e corta a maior parte do trabalho.
 */
const FOLGA_APOS_ESCAPE = 1.4;

// ---------------------------------------------------------------------------
// Fila de prioridade (heap binário de mínimo)
// ---------------------------------------------------------------------------

/**
 * Heap sobre índices de pixel, ordenado pelo ΔE de cada um.
 *
 * Escrito à mão e sobre arrays tipados de propósito: são centenas de milhares
 * de operações por clique, e uma fila de objetos com `sort` a cada inserção
 * transformaria um clique instantâneo em meio segundo de espera.
 */
class FilaDePrioridade {
  private indices: Int32Array;
  private custos: Float32Array;
  private tamanho = 0;

  constructor(capacidade: number) {
    this.indices = new Int32Array(capacidade);
    this.custos = new Float32Array(capacidade);
  }

  get vazia(): boolean {
    return this.tamanho === 0;
  }

  inserir(indice: number, custo: number): void {
    // Capacidade estourada não pode derrubar a segmentação: o pior efeito de
    // ignorar é a onda parar um pouco antes, e isso o `tocouBorda` denuncia.
    if (this.tamanho >= this.indices.length) return;

    let i = this.tamanho++;
    this.indices[i] = indice;
    this.custos[i] = custo;

    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (this.custos[pai] <= this.custos[i]) break;
      this.trocar(pai, i);
      i = pai;
    }
  }

  /** Remove e devolve o índice de menor custo. Devolve -1 se vazia. */
  remover(): number {
    if (this.tamanho === 0) return -1;
    const topo = this.indices[0];
    this.tamanho--;
    if (this.tamanho > 0) {
      this.indices[0] = this.indices[this.tamanho];
      this.custos[0] = this.custos[this.tamanho];
      let i = 0;
      for (;;) {
        const e = 2 * i + 1;
        const d = e + 1;
        let menor = i;
        if (e < this.tamanho && this.custos[e] < this.custos[menor]) menor = e;
        if (d < this.tamanho && this.custos[d] < this.custos[menor]) menor = d;
        if (menor === i) break;
        this.trocar(i, menor);
        i = menor;
      }
    }
    return topo;
  }

  /** Custo do último item removido — o ΔE de chegada daquele pixel. */
  ultimoCusto = 0;

  private trocar(a: number, b: number): void {
    const ti = this.indices[a];
    this.indices[a] = this.indices[b];
    this.indices[b] = ti;
    const tc = this.custos[a];
    this.custos[a] = this.custos[b];
    this.custos[b] = tc;
  }

  custoDoTopo(): number {
    return this.tamanho > 0 ? this.custos[0] : Infinity;
  }
}

// ---------------------------------------------------------------------------
// A onda
// ---------------------------------------------------------------------------

/**
 * Segmenta uma semente a partir de um ponto clicado.
 *
 * Devolve `null` quando o clique cai fora da imagem. Um resultado com
 * `tocouBorda` verdadeiro NÃO é erro — é aviso de que a janela pode ter
 * cortado a semente, ou de que o clique caiu no fundo.
 */
export function segmentarPorClique(
  imagem: DadosImagem,
  clique: { x: number; y: number },
  opcoes: OpcoesDaOnda = {}
): ResultadoDaOnda | null {
  const cfg = { ...PADROES, ...opcoes };
  const cx = Math.round(clique.x);
  const cy = Math.round(clique.y);
  if (cx < 0 || cy < 0 || cx >= imagem.width || cy >= imagem.height) return null;

  // --- Janela de trabalho, centrada no clique e presa aos limites ---
  const meio = Math.floor(cfg.janela / 2);
  const jx = Math.max(0, cx - meio);
  const jy = Math.max(0, cy - meio);
  const jw = Math.min(imagem.width, cx + meio) - jx;
  const jh = Math.min(imagem.height, cy + meio) - jy;
  if (jw < 3 || jh < 3) return null;

  const n = jw * jh;

  // --- Lab sob demanda ---
  // Converter a janela inteira de antemão custava ~900 ms por clique numa
  // digitalização de scanner: 262 mil pixels x seis potências cada. A onda
  // costuma tocar uma fração disso, então converte-se só o que ela alcança.
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const convertido = new Uint8Array(n);

  const garantirLab = (i: number) => {
    if (convertido[i]) return;
    const x = i % jw;
    const y = (i / jw) | 0;
    const src = ((jy + y) * imagem.width + (jx + x)) * 4;
    const [l, a, b] = rgbParaLab(imagem.data[src], imagem.data[src + 1], imagem.data[src + 2]);
    L[i] = l;
    A[i] = a;
    B[i] = b;
    convertido[i] = 1;
  };

  // --- Cor de referência: média da vizinhança do clique ---
  // Um pixel só é ruído de sensor; a vizinhança pequena é estável sem invadir
  // a borda da semente.
  const lx = cx - jx;
  const ly = cy - jy;
  let refL = 0;
  let refA = 0;
  let refB = 0;
  let amostras = 0;
  for (let dy = -cfg.raioDaAmostra; dy <= cfg.raioDaAmostra; dy++) {
    for (let dx = -cfg.raioDaAmostra; dx <= cfg.raioDaAmostra; dx++) {
      const x = lx + dx;
      const y = ly + dy;
      if (x < 0 || y < 0 || x >= jw || y >= jh) continue;
      const i = y * jw + x;
      garantirLab(i);
      refL += L[i];
      refA += A[i];
      refB += B[i];
      amostras++;
    }
  }
  refL /= amostras;
  refA /= amostras;
  refB /= amostras;

  const deltaE = (i: number) => {
    garantirLab(i);
    const dl = L[i] - refL;
    const da = A[i] - refA;
    const db = B[i] - refB;
    return Math.sqrt(dl * dl + da * da + db * db);
  };

  // --- Crescimento: a onda ---
  // `chegada` guarda, por pixel, o ΔE em que ele entrou na região. Como a fila
  // entrega sempre o menor primeiro, a sequência de chegadas é crescente — e é
  // isso que permite recortar qualquer tolerância depois, com uma busca.
  const chegada = new Float32Array(n).fill(Infinity);
  const naFila = new Uint8Array(n);
  const ordem = new Int32Array(n);
  const custos = new Float32Array(n);
  let visitados = 0;
  /**
   * ΔE em que a onda alcançou a borda da janela pela primeira vez.
   *
   * É a âncora que impede a escolha automática de premiar o vazamento: quando
   * a onda inunda tudo, a área SATURA no tamanho da janela e o final da
   * varredura parece perfeitamente estável — a área não muda mais porque
   * acabaram os pixels, não porque existe uma borda ali. Sem este limite, a
   * estabilidade escolhia sempre a região que engolia a janela inteira.
   */
  let custoDaBorda = Infinity;

  const fila = new FilaDePrioridade(n);
  const inicio = ly * jw + lx;
  fila.inserir(inicio, deltaE(inicio));
  naFila[inicio] = 1;

  // Custo de GARGALO do caminho, não o ΔE do pixel sozinho.
  //
  // A primeira versão usava o ΔE do próprio pixel como prioridade, e os dados
  // reais mostraram o erro: um pixel muito parecido com a referência, mas só
  // alcançável atravessando pixels diferentes, era descoberto tarde e saía da
  // fila na hora — então a sequência de saída NÃO era crescente. Como o corte
  // por tolerância pressupõe ordem, a área calculada ficava errada, e uma
  // semente de 55 mil pixels virava uma região de 355.
  //
  // Com o gargalo (o maior ΔE que se precisou atravessar para chegar ali), a
  // saída é monótona por construção, e a região na tolerância t passa a ser
  // exatamente o que a definição diz: o componente conexo do clique dentro do
  // conjunto de pixels com ΔE ≤ t.
  let custoAnterior = 0;

  while (!fila.vazia) {
    const custo = Math.max(custoAnterior, fila.custoDoTopo());
    if (custo > ALCANCE_MAXIMO) break;
    // Depois que a onda escapa da janela, tudo o que ela ainda faz é inundar o
    // fundo — e o critério só precisa de um pedaço além da fuga para medir
    // quanto a região cresce ao atravessar a borda. Sem esta parada a onda
    // convertia a janela inteira para Lab a cada clique, e um clique custava
    // ~600 ms num scanner.
    if (custo > custoDaBorda * FOLGA_APOS_ESCAPE) break;
    const i = fila.remover();
    if (i < 0) break;
    custoAnterior = custo;

    chegada[i] = custo;
    ordem[visitados] = i;
    custos[visitados] = custo;
    visitados++;

    const x = i % jw;
    const y = (i / jw) | 0;
    if (custoDaBorda === Infinity && (x === 0 || y === 0 || x === jw - 1 || y === jh - 1)) {
      custoDaBorda = custo;
    }

    // Vizinhança 4: a 8 costura diagonais e junta sementes que só se tocam
    // numa quina — exatamente o caso que não queremos unir.
    if (x > 0) empurrar(i - 1);
    if (x < jw - 1) empurrar(i + 1);
    if (y > 0) empurrar(i - jw);
    if (y < jh - 1) empurrar(i + jw);
  }

  function empurrar(j: number) {
    if (naFila[j]) return;
    naFila[j] = 1;
    fila.inserir(j, deltaE(j));
  }

  // A prioridade na fila continua sendo o ΔE do pixel; o gargalo é aplicado na
  // saída, com o `Math.max` acima. É equivalente e evita reinserção.

  if (visitados === 0) return null;

  // --- Escolha da tolerância ---
  const escolha =
    opcoes.tolerancia !== undefined
      ? { tolerancia: opcoes.tolerancia, crescimentoNaBorda: NaN, confiavel: true }
      : escolherPelaFuga(custos, visitados, cfg, custoDaBorda);

  // --- Máscara: os pixels que chegaram até a tolerância ---
  const mascara = new Uint8Array(n);
  let areaPx = 0;
  let bordaNaRegiao = false;
  for (let k = 0; k < visitados; k++) {
    if (custos[k] > escolha.tolerancia) break;
    const i = ordem[k];
    mascara[i] = 1;
    areaPx++;
    const x = i % jw;
    const y = (i / jw) | 0;
    if (x === 0 || y === 0 || x === jw - 1 || y === jh - 1) bordaNaRegiao = true;
  }

  const contornoLocal = simplifyContour(traceContour(mascara, jw, jh));
  const contorno: [number, number][] = contornoLocal.map(([x, y]) => [x + jx, y + jy]);

  return {
    janela: { x: jx, y: jy, w: jw, h: jh },
    mascara,
    contorno,
    areaPx,
    tolerancia: escolha.tolerancia,
    crescimentoNaBorda: escolha.crescimentoNaBorda,
    // Três formas de a mesma coisa dar errado, e todas precisam avisar: a
    // região escolhida encosta na borda da janela; não havia platô nenhum antes
    // do vazamento; ou o platô encontrado é estreito demais para sustentar um
    // contorno — a semente não se destaca do que está em volta.
    tocouBorda:
      bordaNaRegiao ||
      !escolha.confiavel ||
      escolha.crescimentoNaBorda > CRESCIMENTO_MAXIMO_CONFIAVEL,
    ...(opcoes.comPerfil ? { perfil: custos.slice(0, visitados), custoDaBorda } : {}),
  };
}

/**
 * Escolhe a tolerância a partir do CUSTO DE FUGA da onda.
 *
 * DUAS VERSÕES ANTERIORES ESTAVAM ERRADAS, E OS DADOS REAIS MOSTRARAM.
 *
 * A primeira media a derivada da área num ponto. Numa região uniforme todos os
 * pixels chegam quase no mesmo ΔE, a área "salta" de nada para tudo, e a medida
 * dava o pior valor possível justamente no caso mais fácil — ela capturava a
 * uniformidade interna, não a nitidez da borda.
 *
 * A segunda procurava o platô mais largo (critério do MSER). Passou em toda
 * cena sintética e falhou na soja de verdade: erro mediano de -23%, com só
 * 4 de 21 sementes dentro de ±15% da máscara de referência. Numa elipse
 * desenhada a borda é um degrau e o platô existe; numa semente real o ΔE sobe
 * continuamente pela curvatura, pelo hilo e pela sombra, e não há platô nenhum
 * para achar.
 *
 * O que os dados mostraram é que o sinal está em outro lugar. A onda percorre a
 * semente com ΔE crescente e, quando alcança o fundo, atravessa a bandeja
 * inteira de uma vez: o ΔE em que ela SAI DA JANELA é, na prática, o ΔE do
 * fundo. Medido nas 21 sementes, o ΔE da área verdadeira ficou sempre logo
 * abaixo desse custo de fuga (25 contra 26).
 *
 * Então a regra é: cresça até escapar, e volte um pouco. Parar exatamente na
 * fuga engole a borda e um pedaço de bandeja (+118% de erro); recuar 10% cai no
 * meio da rampa de transição, que é onde uma pessoa desenharia o contorno
 * (-4%, com 18 de 21 dentro de ±15%).
 *
 * Junto vai uma medida de confiança: quanto a área cresce ao atravessar a borda
 * escolhida. Numa semente que se destaca do fundo, mexer a tolerância em volta
 * da borda quase não muda a área. Numa rampa, muda muito — e aí o contorno é
 * palpite, e a interface precisa dizer isso.
 */
function escolherPelaFuga(
  custos: Float32Array,
  quantidade: number,
  cfg: { areaMinima: number; crescimentoTolerado: number; recuoDoEscape: number },
  custoDeFuga: number
): { tolerancia: number; crescimentoNaBorda: number; confiavel: boolean } {
  // Sem fuga, a varredura parou no alcance máximo: o objeto é tão distinto do
  // entorno que a onda nunca chegou perto do fundo. O último custo explorado
  // faz o mesmo papel de âncora.
  const ancora = Number.isFinite(custoDeFuga) ? custoDeFuga : custos[quantidade - 1];
  const tolerancia = ancora * (1 - cfg.recuoDoEscape);

  // Área nessa tolerância, e largura do platô em volta dela.
  const areaEm = (t: number): number => {
    let lo = 0;
    let hi = quantidade;
    while (lo < hi) {
      const meio = (lo + hi) >> 1;
      if (custos[meio] <= t) lo = meio + 1;
      else hi = meio;
    }
    return lo;
  };

  const area = areaEm(tolerancia);
  if (area < cfg.areaMinima) {
    // Quase nada coube: o clique caiu no fundo, ou na borda de outra coisa.
    return { tolerancia, crescimentoNaBorda: Infinity, confiavel: false };
  }

  // Confiança: quanto a área muda ao varrer a tolerância em volta da borda.
  // A meia-janela é metade do recuo — o mesmo intervalo em que a decisão foi
  // tomada, e não um número solto.
  const meia = (ancora * cfg.recuoDoEscape) / 2;
  const crescimento = (areaEm(tolerancia + meia) - areaEm(tolerancia - meia)) / area;

  return { tolerancia, crescimentoNaBorda: crescimento, confiavel: true };
}
