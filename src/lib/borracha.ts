// =============================================================================
// SeedCounter — borracha de contorno
//
// O PROBLEMA.
//
// A onda erra de dois jeitos, e a medição do baseline diz quanto: em forrageira,
// 9 de 30 segmentações engoliram a vizinha. Hoje o único remédio é apagar tudo
// e clicar de novo — o que joga fora também a parte que estava certa.
//
// A IDEIA, E POR QUE ELA NÃO É UMA FERRAMENTA DE PINTURA.
//
// Raspar a borda com uma borracha comum deixaria o contorno esfarrapado: a nova
// fronteira seria o arco do próprio cursor, um semicírculo artificial que não
// corresponde a nada na imagem. O que o traço deve fazer é IMPOR UMA RESTRIÇÃO,
// não desenhar uma linha.
//
//   O traço declara: "a fronteira não passa por aqui."
//
// Com isso, achar o novo contorno vira um problema de otimização, e um problema
// com solução clássica: o CAMINHO DE MENOR CUSTO entre os dois pontos onde o
// traço encontrou o contorno, num campo em que andar sobre gradiente forte é
// barato e andar sobre região lisa é caro. É o livewire (Mortensen & Barrett,
// 1995), também chamado de tesoura inteligente.
//
// O efeito é o que se pede quando se diz "a segmentação vai fechando e se
// ajustando": a borda não vai para onde o cursor passou — vai para a borda de
// verdade mais próxima que respeita a raspada.
//
// A SIMETRIA QUE DÁ A BORRACHA INVERSA DE GRAÇA.
//
// Remover e acrescentar são o MESMO problema, mudando só onde o caminho pode
// andar:
//
//   remover     — o caminho anda DENTRO do contorno velho, contornando o traço
//   acrescentar — o caminho anda FORA do contorno velho, contornando o traço
//
// Nos dois casos o traço é proibido e o caminho passa do lado certo dele. Não
// há um segundo algoritmo: há um segundo conjunto de pixels permitidos.
// =============================================================================

import { rgbParaLab, type DadosImagem } from './color-features';
import { simplifyContour } from './contour';

export type Ponto = [number, number];

/** Uma pincelada: um ponto do traço, com seu raio. */
export interface Pincelada {
  x: number;
  y: number;
  raio: number;
}

export type ModoDaBorracha = 'remover' | 'acrescentar';

export interface OpcoesDaBorracha {
  /** Folga em volta da área de trabalho, em pixels. */
  margem?: number;
  /**
   * Penalidade por passo, somada ao custo do gradiente.
   *
   * Sem ela o caminho serpenteia por qualquer pixel ruidoso que tenha gradiente
   * alto, alongando a borda sem melhorá-la. Com ela, o caminho só desvia quando
   * o desvio compensa.
   */
  pesoDoComprimento?: number;
  /** Máximo de vértices no contorno devolvido. */
  maximoDeVertices?: number;
}

const PADROES = {
  margem: 12,
  pesoDoComprimento: 0.35,
  maximoDeVertices: 64,
};

/** Teto de pixels da janela de trabalho, por segurança de desempenho. */
const MAXIMO_DE_PIXELS = 1_200_000;

export interface ResultadoDaBorracha {
  contorno: Ponto[];
  /** Quantos vértices do contorno velho o traço invalidou. */
  verticesRefeitos: number;
}

// ---------------------------------------------------------------------------

/**
 * Refaz o contorno respeitando o traço.
 *
 * Devolve `null` quando não há o que fazer — traço que não encostou no
 * contorno, contorno degenerado, janela vazia. Devolver o contorno original
 * nesses casos esconderia do chamador que nada aconteceu.
 */
export function ajustarContorno(
  imagem: DadosImagem,
  contorno: Ponto[],
  pinceladas: Pincelada[],
  modo: ModoDaBorracha,
  opcoes: OpcoesDaBorracha = {}
): ResultadoDaBorracha | null {
  const { margem, pesoDoComprimento, maximoDeVertices } = { ...PADROES, ...opcoes };

  if (contorno.length < 3 || pinceladas.length === 0) return null;

  const janela = montarJanela(contorno, pinceladas, margem, imagem);
  if (!janela) return null;

  const { x0, y0, largura, altura } = janela;
  const total = largura * altura;

  // --- 1. Quem é interior ao contorno velho -------------------------------
  const dentro = rasterizar(contorno, x0, y0, largura, altura);

  // --- 2. Quem o traço proíbe ---------------------------------------------
  const proibido = marcarPinceladas(pinceladas, x0, y0, largura, altura);

  // --- 3. Onde o novo caminho pode andar ----------------------------------
  //
  // Tres condicoes, e cada uma existe por um motivo que so apareceu testando.
  //
  // (a) O LADO. A simetria inteira do modulo mora aqui: remover anda por
  //     dentro do contorno velho, acrescentar anda por fora.
  const base = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const ehInterior = dentro[i] === 1;
    base[i] = (modo === 'remover' ? ehInterior : !ehInterior) ? 1 : 0;
  }

  // (b) A FRONTEIRA E TRANSITAVEL. Os extremos do caminho estao SOBRE a
  //     fronteira velha, e a rasterizacao nao inclui a coluna da borda no
  //     interior. Sem dilatar, A e B nasciam cercados: de um lado o traco
  //     proibido, do outro o exterior — e a busca devolvia "sem caminho" numa
  //     raspada perfeitamente comum.
  const lado = dilatar(base, largura, altura);

  // (c) PERTO DO TRACO. Sem este limite, o caminho e livre para dar a volta no
  //     objeto inteiro colado na borda real — o que e o trajeto MAIS BARATO e
  //     nao e o que a pessoa pediu. A faixa prende a correcao onde ela foi
  //     pedida: a borda longe do traco nao se mexe.
  const perto = faixaDoTraco(pinceladas, x0, y0, largura, altura);

  const permitido = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    permitido[i] = lado[i] && perto[i] && !proibido[i] ? 1 : 0;
  }

  // --- 4. Onde o traço cortou o contorno ----------------------------------
  const corte = acharCorte(contorno, proibido, x0, y0, largura, altura);
  if (!corte) return null;

  const { inicio, fim, quantidade } = corte;
  const a = paraJanela(contorno[inicio], x0, y0);
  const b = paraJanela(contorno[fim], x0, y0);

  // Os extremos precisam ser transitáveis: eles estão SOBRE a fronteira velha,
  // e a fronteira é justamente onde `dentro` muda de valor. Liberá-los
  // explicitamente evita que o caminho comece sem saída por um pixel que caiu
  // do lado errado do arredondamento.
  liberar(permitido, a, largura, altura);
  liberar(permitido, b, largura, altura);

  // --- 5. O caminho de menor esforço --------------------------------------
  const custo = campoDeCusto(imagem, x0, y0, largura, altura, pesoDoComprimento);
  const caminho = menorCaminho(a, b, permitido, custo, largura, altura);
  if (!caminho) return null;

  // --- 6. Costura ----------------------------------------------------------
  const sobrevivente: Ponto[] = [];
  for (let k = 0; k <= contorno.length - quantidade; k++) {
    const i = (fim + k) % contorno.length;
    sobrevivente.push(contorno[i]);
    if (i === inicio) break;
  }

  const emImagem = caminho.map(([x, y]) => [x + x0, y + y0] as Ponto);
  // O arco sobrevivente vai de B ate A; o caminho vai de A ate B. Emendados
  // NESTA ordem eles fecham o poligono percorrendo o perimetro uma vez so.
  //
  // Inverter o caminho aqui foi o primeiro erro deste modulo: produzia um
  // poligono que se cruzava, e o teste de "remover" ainda passava porque numa
  // raspada reta a caixa envolvente sai parecida nos dois casos. So a borracha
  // inversa denunciou.
  const bruto = [...sobrevivente, ...emImagem.slice(1, -1)];

  if (bruto.length < 3) return null;

  return {
    contorno: simplifyContour(bruto, maximoDeVertices),
    verticesRefeitos: quantidade,
  };
}

// ---------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------

interface Janela {
  x0: number;
  y0: number;
  largura: number;
  altura: number;
}

function montarJanela(
  contorno: Ponto[],
  pinceladas: Pincelada[],
  margem: number,
  imagem: DadosImagem
): Janela | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const abraçar = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const [x, y] of contorno) abraçar(x, y);
  for (const p of pinceladas) {
    abraçar(p.x - p.raio, p.y - p.raio);
    abraçar(p.x + p.raio, p.y + p.raio);
  }

  if (!Number.isFinite(minX)) return null;

  const x0 = Math.max(0, Math.floor(minX - margem));
  const y0 = Math.max(0, Math.floor(minY - margem));
  const x1 = Math.min(imagem.width, Math.ceil(maxX + margem) + 1);
  const y1 = Math.min(imagem.height, Math.ceil(maxY + margem) + 1);

  const largura = x1 - x0;
  const altura = y1 - y0;
  if (largura < 3 || altura < 3) return null;
  if (largura * altura > MAXIMO_DE_PIXELS) return null;

  return { x0, y0, largura, altura };
}

function paraJanela(p: Ponto, x0: number, y0: number): Ponto {
  return [Math.round(p[0]) - x0, Math.round(p[1]) - y0];
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------

/**
 * Pinta o interior do polígono por varredura de linhas.
 *
 * Regra par-ímpar com a convenção `yi > y !== yj > y`: ela conta cada aresta uma
 * vez só quando a linha de varredura passa exatamente por um vértice, que é o
 * caso em que uma implementação ingênua deixa buracos.
 */
export function rasterizar(
  poligono: Ponto[],
  x0: number,
  y0: number,
  largura: number,
  altura: number
): Uint8Array {
  const mascara = new Uint8Array(largura * altura);
  const n = poligono.length;

  for (let linha = 0; linha < altura; linha++) {
    const y = linha + y0 + 0.5;
    const cruzamentos: number[] = [];

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = poligono[i];
      const [xj, yj] = poligono[j];
      if (yi > y !== yj > y) {
        cruzamentos.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }

    cruzamentos.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cruzamentos.length; k += 2) {
      const de = Math.max(0, Math.ceil(cruzamentos[k] - x0 - 0.5));
      const ate = Math.min(largura - 1, Math.floor(cruzamentos[k + 1] - x0 - 0.5));
      for (let c = de; c <= ate; c++) mascara[linha * largura + c] = 1;
    }
  }

  return mascara;
}

function marcarPinceladas(
  pinceladas: Pincelada[],
  x0: number,
  y0: number,
  largura: number,
  altura: number
): Uint8Array {
  const mascara = new Uint8Array(largura * altura);

  for (const p of pinceladas) {
    const raio = Math.max(1, p.raio);
    const cx = p.x - x0;
    const cy = p.y - y0;
    const de = Math.max(0, Math.floor(cy - raio));
    const ate = Math.min(altura - 1, Math.ceil(cy + raio));

    for (let linha = de; linha <= ate; linha++) {
      const dy = linha - cy;
      const meia = Math.sqrt(Math.max(0, raio * raio - dy * dy));
      const c0 = Math.max(0, Math.floor(cx - meia));
      const c1 = Math.min(largura - 1, Math.ceil(cx + meia));
      for (let c = c0; c <= c1; c++) mascara[linha * largura + c] = 1;
    }
  }

  return mascara;
}

/**
 * Cresce a mascara em um pixel nas quatro direcoes.
 *
 * Serve para tornar a propria fronteira transitavel: ela e a linha onde
 * `dentro` muda de valor, e portanto nao pertence estritamente a nenhum dos
 * dois lados.
 */
function dilatar(mascara: Uint8Array, largura: number, altura: number): Uint8Array {
  const saida = new Uint8Array(mascara);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = y * largura + x;
      if (mascara[i]) continue;
      if (
        (x > 0 && mascara[i - 1]) ||
        (x < largura - 1 && mascara[i + 1]) ||
        (y > 0 && mascara[i - largura]) ||
        (y < altura - 1 && mascara[i + largura])
      ) {
        saida[i] = 1;
      }
    }
  }
  return saida;
}

/** Quao longe do traco o caminho pode se afastar, em multiplos do raio. */
const ALCANCE_DA_FAIXA = 2.6;

/**
 * A vizinhanca do traco.
 *
 * Fora dela o caminho nao anda. E o que garante que raspar um pedaco da borda
 * direita nao possa reescrever a borda esquerda: a correcao fica onde foi
 * pedida.
 */
function faixaDoTraco(
  pinceladas: Pincelada[],
  x0: number,
  y0: number,
  largura: number,
  altura: number
): Uint8Array {
  const faixa = new Uint8Array(largura * altura);

  for (const p of pinceladas) {
    const alcance = Math.max(3, p.raio * ALCANCE_DA_FAIXA);
    const cx = p.x - x0;
    const cy = p.y - y0;
    const de = Math.max(0, Math.floor(cy - alcance));
    const ate = Math.min(altura - 1, Math.ceil(cy + alcance));

    for (let linha = de; linha <= ate; linha++) {
      const dy = linha - cy;
      const meia = Math.sqrt(Math.max(0, alcance * alcance - dy * dy));
      const c0 = Math.max(0, Math.floor(cx - meia));
      const c1 = Math.min(largura - 1, Math.ceil(cx + meia));
      for (let c = c0; c <= c1; c++) faixa[linha * largura + c] = 1;
    }
  }

  return faixa;
}

function liberar(permitido: Uint8Array, p: Ponto, largura: number, altura: number) {
  const [x, y] = p;
  if (x < 0 || y < 0 || x >= largura || y >= altura) return;
  permitido[y * largura + x] = 1;
}

// ---------------------------------------------------------------------------
// Corte
// ---------------------------------------------------------------------------

interface Corte {
  /** Último vértice íntegro antes do trecho invalidado. */
  inicio: number;
  /** Primeiro vértice íntegro depois dele. */
  fim: number;
  /** Quantos vértices o traço invalidou. */
  quantidade: number;
}

/**
 * Acha o trecho do contorno que o traço invalidou.
 *
 * O contorno é cíclico, então o trecho pode atravessar o fim do array — por
 * isso a varredura é feita em índices módulo n, e não numa fatia.
 *
 * Quando o traço toca o contorno em mais de um lugar, vence o trecho MAIS
 * LONGO: é o que a pessoa quis raspar. Os toques menores são reencostões do
 * cursor, e refazer por eles produziria um contorno diferente do que se vê.
 */
export function acharCorte(
  contorno: Ponto[],
  proibido: Uint8Array,
  x0: number,
  y0: number,
  largura: number,
  altura: number
): Corte | null {
  const n = contorno.length;
  const atingido = new Uint8Array(n);
  let quantosAtingidos = 0;

  for (let i = 0; i < n; i++) {
    const [x, y] = paraJanela(contorno[i], x0, y0);
    if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
    if (proibido[y * largura + x]) {
      atingido[i] = 1;
      quantosAtingidos++;
    }
  }

  // Nada tocado: o traço não encostou no contorno. Nada tem de mudar.
  if (quantosAtingidos === 0) return null;
  // Tudo tocado: não sobrou fronteira para ancorar o caminho novo.
  if (quantosAtingidos >= n - 1) return null;

  let melhorInicio = -1;
  let melhorTamanho = 0;

  for (let i = 0; i < n; i++) {
    // Só começa a contar num vértice atingido cujo anterior esteja íntegro.
    if (!atingido[i] || atingido[(i - 1 + n) % n]) continue;

    let tamanho = 0;
    while (tamanho < n && atingido[(i + tamanho) % n]) tamanho++;

    if (tamanho > melhorTamanho) {
      melhorTamanho = tamanho;
      melhorInicio = i;
    }
  }

  if (melhorInicio < 0) return null;

  return {
    inicio: (melhorInicio - 1 + n) % n,
    fim: (melhorInicio + melhorTamanho) % n,
    quantidade: melhorTamanho,
  };
}

// ---------------------------------------------------------------------------
// Campo de custo
// ---------------------------------------------------------------------------

/**
 * Custo de pisar em cada pixel: barato sobre borda, caro sobre região lisa.
 *
 * O gradiente sai do L* — a mesma razão da onda: sob cada semente há sombra, e
 * em RGB ela mexe nos três canais de uma vez. Em Lab a sombra fica quase toda
 * no L*, e a borda de cor continua legível.
 *
 * A normalização é pelo MÁXIMO da janela, não por uma constante: uma
 * digitalização de scanner e uma foto de lupa têm faixas de gradiente
 * completamente diferentes, e um limiar fixo serviria a uma e não à outra.
 */
export function campoDeCusto(
  imagem: DadosImagem,
  x0: number,
  y0: number,
  largura: number,
  altura: number,
  pesoDoComprimento: number
): Float32Array {
  const luz = new Float32Array(largura * altura);

  for (let linha = 0; linha < altura; linha++) {
    for (let coluna = 0; coluna < largura; coluna++) {
      const px = ((linha + y0) * imagem.width + (coluna + x0)) * 4;
      const [L] = rgbParaLab(
        imagem.data[px],
        imagem.data[px + 1],
        imagem.data[px + 2]
      );
      luz[linha * largura + coluna] = L;
    }
  }

  const gradiente = new Float32Array(largura * altura);
  let maximo = 0;

  for (let linha = 1; linha < altura - 1; linha++) {
    for (let coluna = 1; coluna < largura - 1; coluna++) {
      const i = linha * largura + coluna;
      // Sobel.
      const gx =
        luz[i - largura + 1] +
        2 * luz[i + 1] +
        luz[i + largura + 1] -
        luz[i - largura - 1] -
        2 * luz[i - 1] -
        luz[i + largura - 1];
      const gy =
        luz[i + largura - 1] +
        2 * luz[i + largura] +
        luz[i + largura + 1] -
        luz[i - largura - 1] -
        2 * luz[i - largura] -
        luz[i - largura + 1];

      const g = Math.hypot(gx, gy);
      gradiente[i] = g;
      if (g > maximo) maximo = g;
    }
  }

  const custo = new Float32Array(largura * altura);
  const escala = maximo > 1e-6 ? 1 / maximo : 0;

  for (let i = 0; i < custo.length; i++) {
    // Gradiente forte → custo perto de zero. Região lisa → custo perto de 1.
    custo[i] = 1 - gradiente[i] * escala + pesoDoComprimento;
  }

  return custo;
}

// ---------------------------------------------------------------------------
// Dijkstra
// ---------------------------------------------------------------------------

const VIZINHOS: [number, number, number][] = [
  [-1, 0, 1],
  [1, 0, 1],
  [0, -1, 1],
  [0, 1, 1],
  // As diagonais custam √2 porque percorrem essa distância. Sem o fator, o
  // caminho prefere escadinhas diagonais e corta cantos que a borda não tem.
  [-1, -1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [1, 1, Math.SQRT2],
];

/**
 * O caminho de menor esforço entre dois pontos, pelos pixels permitidos.
 *
 * Devolve `null` quando não há caminho — o traço isolou os extremos, e nesse
 * caso o contorno original vale mais que um remendo inventado.
 */
export function menorCaminho(
  a: Ponto,
  b: Ponto,
  permitido: Uint8Array,
  custo: Float32Array,
  largura: number,
  altura: number
): Ponto[] | null {
  const total = largura * altura;
  const inicio = a[1] * largura + a[0];
  const destino = b[1] * largura + b[0];

  if (inicio < 0 || inicio >= total || destino < 0 || destino >= total) return null;
  if (inicio === destino) return [a, b];

  const distancia = new Float32Array(total).fill(Infinity);
  const anterior = new Int32Array(total).fill(-1);
  const fechado = new Uint8Array(total);
  const fila = new FilaDePrioridade(total * 2);

  distancia[inicio] = 0;
  fila.inserir(inicio, 0);

  while (!fila.vazia) {
    const atual = fila.remover();
    if (atual < 0) break;
    if (fechado[atual]) continue;
    fechado[atual] = 1;
    if (atual === destino) break;

    const cx = atual % largura;
    const cy = (atual - cx) / largura;

    for (const [dx, dy, passo] of VIZINHOS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue;

      const vizinho = ny * largura + nx;
      if (fechado[vizinho]) continue;
      // O destino é sempre alcançável, mesmo que a máscara o marque como
      // proibido: ele é o ponto de ancoragem, não uma escolha do caminho.
      if (!permitido[vizinho] && vizinho !== destino) continue;

      const candidato = distancia[atual] + custo[vizinho] * passo;
      if (candidato < distancia[vizinho]) {
        distancia[vizinho] = candidato;
        anterior[vizinho] = atual;
        fila.inserir(vizinho, candidato);
      }
    }
  }

  if (!Number.isFinite(distancia[destino])) return null;

  const caminho: Ponto[] = [];
  for (let i = destino; i !== -1; i = anterior[i]) {
    const x = i % largura;
    caminho.push([x, (i - x) / largura]);
    if (i === inicio) break;
  }

  return caminho.reverse();
}

/** Heap binário mínimo sobre índices de pixel. */
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
        this.trocar(menor, i);
        i = menor;
      }
    }
    return topo;
  }

  private trocar(a: number, b: number) {
    const i = this.indices[a];
    this.indices[a] = this.indices[b];
    this.indices[b] = i;
    const c = this.custos[a];
    this.custos[a] = this.custos[b];
    this.custos[b] = c;
  }
}
