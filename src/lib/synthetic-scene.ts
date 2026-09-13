// =============================================================================
// SeedCounter — cenas de exemplo geradas por código
//
// POR QUE GERAR EM VEZ DE EMPACOTAR IMAGEM.
//
// O app precisa abrir com alguma coisa dentro. Quem nunca usou não tem imagem
// de semente à mão, e uma tela vazia não demonstra nada — nem a contagem, nem
// a segmentação por clique, nem a morfometria.
//
// A saída óbvia seria embutir uma digitalização real. Três motivos para não:
// imagem de scanner a 3600 dpi pesa megabytes e entraria no bundle de todo
// mundo; publicar digitalização de pesquisa alheia num site é decisão de quem
// coletou, não do código; e imagem real não tem verdade conhecida.
//
// Esse último ponto vira vantagem. Aqui a cena é DESENHADA, então sabe-se
// exatamente onde cada semente está, qual a área dela e a que classe pertence.
// O preview pode então mostrar o ERRO — "a onda achou 47 das 50, e errou a
// área em 6%" — que é uma demonstração muito mais honesta do que um contorno
// bonito sobre uma foto.
//
// TUDO AQUI É SIMULADO, pelo mesmo motivo e com o mesmo cuidado dos dados de
// ensaio em `synthetic-data.ts`: número simulado confundido com medição é o
// único dano que este módulo poderia causar.
//
// AS TRÊS MODALIDADES.
//
// Não são variações decorativas — são os três problemas de imagem que o
// laboratório realmente tem, e eles pedem coisas diferentes do algoritmo:
//
//   soja        — semente grande, redonda, bem separada, sobre bandeja cinza.
//                 O caso fácil. Separação forte no b* (amarelo contra cinza).
//   orquídea-tz — semente fusiforme de 1 mm sobre fundo azul, embrião corado
//                 de vermelho quando viável. É o a* que decide, não a forma.
//                 Sementes se tocam.
//   forrageira  — cariopse alongada, e uma parte das espiguetas VAZIA. Aqui a
//                 pergunta não é viável/inviável, é cheia/vazia — o caso que a
//                 dicotomia atual do app não cobre.
// =============================================================================

import type { DadosImagem } from './color-features';
import { criarRng } from './rng';
import type { Ponto } from './aglomerado';

export type PresetDeCena = 'soja' | 'orquidea-tz' | 'forrageira';

/** Classe verdadeira de cada semente desenhada. */
export type ClasseSintetica = 'viable' | 'inviable';

export interface SementeSintetica {
  id: number;
  /** Centro, em pixels da cena. */
  x: number;
  y: number;
  /** Semi-eixos maior e menor, em pixels. */
  a: number;
  b: number;
  /** Rotação, em radianos. */
  angulo: number;
  classe: ClasseSintetica;
  /** Verdade: pixels efetivamente pintados desta semente. */
  areaPx: number;
  /**
   * Contorno da elipse (64 pontos, coordenadas absolutas da cena). Verdade
   * geométrica exata — existe para comparar contra o contorno que a onda
   * devolve, sem depender do rótulo por pixel.
   */
  contorno: Ponto[];
}

export interface CenaSintetica {
  imagem: DadosImagem;
  sementes: SementeSintetica[];
  preset: PresetDeCena;
  /** Frase curta para a interface anunciar o que está mostrando. */
  descricao: string;
  /** Escala declarada da cena, para a morfometria fazer sentido. */
  umPorPixel: number;
  /**
   * Verdade por pixel: 0 é fundo, senão o `id` da semente que pintou aquele
   * pixel por último. É o que permite perguntar "a onda recuperou ESTE
   * pixel?" em vez de só comparar área — máscara contra máscara, com IoU.
   */
  rotulos: Uint8Array;
}

export interface OpcoesDaCena {
  /** Semente do gerador. A mesma semente dá a mesma cena. */
  semente?: number;
  /** Quantas sementes desenhar. Padrão do preset. */
  quantidade?: number;
  /** Fração de viáveis (ou de cheias, na forrageira). Padrão do preset. */
  fracaoViavel?: number;
  /** Lado da cena em pixels. Padrão do preset. */
  lado?: number;
}

type Cor = [number, number, number];

interface Preset {
  lado: number;
  quantidade: number;
  fracaoViavel: number;
  fundo: Cor;
  /** Ruído do fundo, em níveis de 0–255. */
  ruidoDoFundo: number;
  /** Semi-eixos típicos, em pixels. */
  a: number;
  b: number;
  /** Variação relativa do tamanho entre sementes. */
  dispersaoDoTamanho: number;
  /** Sementes podem encostar? */
  permiteEncostar: boolean;
  /** Micrômetros por pixel declarados. */
  umPorPixel: number;
  descricao: string;
}

/**
 * Os números vêm das imagens reais: soja indonésia a ~950 dpi (semente de
 * ~260 px), orquídea em digitalização a 3600 dpi (semente de ~1,2 mm, ~166 px)
 * e forrageira a 1200 dpi (cariopse de ~4 mm, ~190 px).
 */
const PRESETS: Record<PresetDeCena, Preset> = {
  soja: {
    lado: 1100,
    quantidade: 24,
    fracaoViavel: 0.83,
    fundo: [178, 178, 176],
    ruidoDoFundo: 3,
    a: 108,
    b: 92,
    dispersaoDoTamanho: 0.11,
    permiteEncostar: false,
    umPorPixel: 26.7,
    descricao: 'Soja em bandeja de digitalização — semente grande e bem separada',
  },
  'orquidea-tz': {
    lado: 900,
    quantidade: 70,
    fracaoViavel: 0.62,
    fundo: [96, 156, 205],
    ruidoDoFundo: 7,
    a: 66,
    b: 17,
    dispersaoDoTamanho: 0.2,
    permiteEncostar: true,
    umPorPixel: 7.06,
    descricao: 'Orquídea corada com tetrazólio — embrião vermelho indica viável',
  },
  forrageira: {
    lado: 1000,
    quantidade: 34,
    fracaoViavel: 0.68,
    fundo: [232, 231, 226],
    ruidoDoFundo: 4,
    a: 96,
    b: 34,
    dispersaoDoTamanho: 0.16,
    permiteEncostar: true,
    umPorPixel: 21.2,
    descricao: 'Forrageira (Urochloa) — espigueta cheia contra espigueta vazia',
  },
};

/** Aviso que acompanha toda cena. */
export const AVISO_CENA = 'Cena SIMULADA, gerada pelo SeedCounter. Não é uma digitalização real.';

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function criarTela(lado: number, fundo: Cor, ruido: number, rng: () => number): DadosImagem {
  const data = new Uint8ClampedArray(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) {
    // Ruído correlacionado com o pixel, não por canal: fundo de scanner tem
    // granulado de luminância, não confete colorido.
    const n = Math.round((rng() - 0.5) * 2 * ruido);
    data[i * 4] = fundo[0] + n;
    data[i * 4 + 1] = fundo[1] + n;
    data[i * 4 + 2] = fundo[2] + n;
    data[i * 4 + 3] = 255;
  }
  return { data, width: lado, height: lado };
}

/**
 * Contorno paramétrico de uma elipse rotacionada, em coordenadas absolutas.
 *
 * 64 pontos é o mesmo grão que `traceContour`/`simplifyContour` costumam
 * devolver para um objeto deste tamanho — o suficiente para IoU e Feret sem
 * pesar a verdade da cena.
 */
function contornoDaElipse(cx: number, cy: number, a: number, b: number, angulo: number): Ponto[] {
  const cosT = Math.cos(angulo);
  const senT = Math.sin(angulo);
  const N = 64;
  const pontos: Ponto[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 2 * Math.PI;
    const cosArco = Math.cos(t);
    const senArco = Math.sin(t);
    pontos.push([
      cx + a * cosArco * cosT - b * senArco * senT,
      cy + a * cosArco * senT + b * senArco * cosT,
    ]);
  }
  return pontos;
}

/** Mistura `cor` sobre o pixel com peso `alfa`. */
function pintar(img: DadosImagem, x: number, y: number, cor: Cor, alfa: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  for (let c = 0; c < 3; c++) {
    img.data[i + c] = Math.round(img.data[i + c] * (1 - alfa) + cor[c] * alfa);
  }
}

/**
 * Percorre os pixels de uma elipse rotacionada, chamando `visitar` com a
 * distância normalizada ao centro (0 no meio, 1 na borda).
 */
function varrerElipse(
  img: DadosImagem,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angulo: number,
  folga: number,
  visitar: (x: number, y: number, d: number) => void
) {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  const alcance = Math.ceil(Math.max(a, b) * folga) + 2;
  for (let y = Math.round(cy - alcance); y <= Math.round(cy + alcance); y++) {
    for (let x = Math.round(cx - alcance); x <= Math.round(cx + alcance); x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const dx = x - cx;
      const dy = y - cy;
      // Rotaciona para o referencial da elipse.
      const u = (dx * cos + dy * sen) / a;
      const v = (-dx * sen + dy * cos) / b;
      const d = Math.sqrt(u * u + v * v);
      if (d <= folga) visitar(x, y, d);
    }
  }
}

/** Sombra sob a semente: escurece o entorno, sem mudar o matiz. */
function desenharSombra(
  img: DadosImagem,
  cx: number,
  cy: number,
  a: number,
  b: number,
  angulo: number,
  forca: number
) {
  varrerElipse(img, cx + 3, cy + 4, a, b, angulo, 1.28, (x, y, d) => {
    if (d < 1) return; // dentro da semente a sombra não aparece
    const peso = forca * (1 - (d - 1) / 0.28);
    if (peso <= 0) return;
    const i = (y * img.width + x) * 4;
    for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(img.data[i + c] * (1 - peso));
  });
}

// ---------------------------------------------------------------------------
// Corpo de cada modalidade
// ---------------------------------------------------------------------------

/**
 * Soja: corpo abaulado, com o miolo mais claro que a borda porque a superfície
 * é curva e o scanner ilumina de cima. O hilo é a marca escura de um lado.
 */
function desenharSoja(
  img: DadosImagem,
  s: SementeSintetica,
  rng: () => number,
  contar: (x: number, y: number) => void
) {
  const base: Cor = s.classe === 'viable' ? [222, 190, 148] : [186, 160, 132];
  const variacao = (rng() - 0.5) * 14;
  const cor: Cor = [base[0] + variacao, base[1] + variacao, base[2] + variacao];

  varrerElipse(img, s.x, s.y, s.a, s.b, s.angulo, 1, (x, y, d) => {
    // Curvatura: mais escuro perto da borda.
    const sombreado = 1 - 0.22 * d * d;
    const granulado = (rng() - 0.5) * 6;
    pintar(img, x, y, [cor[0] * sombreado + granulado, cor[1] * sombreado + granulado, cor[2] * sombreado + granulado], 1); // prettier-ignore
    contar(x, y);
  });

  // Hilo — a cicatriz do funículo, sempre presente e sempre mais escura.
  const hx = s.x + Math.cos(s.angulo) * s.a * 0.45;
  const hy = s.y + Math.sin(s.angulo) * s.a * 0.45;
  varrerElipse(img, hx, hy, s.a * 0.2, s.b * 0.09, s.angulo, 1, (x, y) => {
    pintar(img, x, y, [150, 120, 92], 0.75);
  });
}

/**
 * Orquídea: testa fusiforme translúcida, e dentro dela o embrião.
 *
 * A viabilidade não está na forma nem no tamanho — está na COR do embrião.
 * Corado de vermelho pelo formazan = tecido vivo; sem coloração = inviável.
 * É por isso que o eixo a* do CIELAB é a medida certa, e é isso que esta cena
 * existe para mostrar.
 */
function desenharOrquidea(
  img: DadosImagem,
  s: SementeSintetica,
  rng: () => number,
  contar: (x: number, y: number) => void
) {
  const testa: Cor = [206, 186, 150];

  varrerElipse(img, s.x, s.y, s.a, s.b, s.angulo, 1, (x, y, d) => {
    // A testa é translúcida: deixa o fundo passar um pouco, mais na borda.
    const opacidade = 0.62 + 0.3 * (1 - d);
    const granulado = (rng() - 0.5) * 10;
    pintar(img, x, y, [testa[0] + granulado, testa[1] + granulado, testa[2] + granulado], opacidade); // prettier-ignore
    contar(x, y);
  });

  // Embrião: elipse curta no meio da testa.
  const corDoEmbriao: Cor = s.classe === 'viable' ? [178, 44, 58] : [150, 134, 108];
  const intensidade = s.classe === 'viable' ? 0.85 + rng() * 0.15 : 0.5;
  varrerElipse(img, s.x, s.y, s.a * 0.42, s.b * 0.66, s.angulo, 1, (x, y, d) => {
    pintar(img, x, y, corDoEmbriao, intensidade * (1 - 0.35 * d));
  });
}

/**
 * Forrageira: espiguetas alongadas, umas com cariopse dentro e outras VAZIAS.
 *
 * Lote de forrageira tem proporção alta de espigueta sem cariopse, e contar
 * "sementes" sem separar cheia de vazia produz porcentagem errada. A vazia é
 * mais clara e mais translúcida — não tem o que preencher.
 */
function desenharForrageira(
  img: DadosImagem,
  s: SementeSintetica,
  rng: () => number,
  contar: (x: number, y: number) => void
) {
  const cheia = s.classe === 'viable';
  const palha: Cor = cheia ? [198, 172, 116] : [216, 204, 172];

  varrerElipse(img, s.x, s.y, s.a, s.b, s.angulo, 1, (x, y, d) => {
    const sombreado = 1 - 0.18 * d * d;
    const granulado = (rng() - 0.5) * 8;
    pintar(img, x, y, [palha[0] * sombreado + granulado, palha[1] * sombreado + granulado, palha[2] * sombreado + granulado], cheia ? 1 : 0.8); // prettier-ignore
    contar(x, y);
  });

  // Nervuras longitudinais da lema — textura que distingue palha de semente.
  const passos = 4;
  for (let k = 1; k < passos; k++) {
    const desloc = (k / passos - 0.5) * 2 * s.b * 0.7;
    const nx = s.x - Math.sin(s.angulo) * desloc;
    const ny = s.y + Math.cos(s.angulo) * desloc;
    varrerElipse(img, nx, ny, s.a * 0.9, Math.max(1, s.b * 0.05), s.angulo, 1, (x, y) => {
      pintar(img, x, y, [160, 140, 96], 0.25);
    });
  }

  // A cariopse só existe na cheia, e é o que dá o miolo mais escuro.
  if (cheia) {
    varrerElipse(img, s.x, s.y, s.a * 0.62, s.b * 0.55, s.angulo, 1, (x, y, d) => {
      pintar(img, x, y, [140, 106, 62], 0.55 * (1 - 0.4 * d));
    });
  }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/**
 * Gera uma cena de exemplo com verdade conhecida.
 *
 * A mesma semente devolve a mesma cena — o preview precisa ser estável entre
 * recarregamentos, senão "o resultado mudou" nunca se distingue de "a cena
 * mudou".
 */
export function gerarCenaSintetica(
  preset: PresetDeCena,
  opcoes: OpcoesDaCena = {}
): CenaSintetica {
  const p = PRESETS[preset];
  const rng = criarRng(opcoes.semente ?? 20260906);
  const lado = opcoes.lado ?? p.lado;
  const quantidade = opcoes.quantidade ?? p.quantidade;
  const fracaoViavel = opcoes.fracaoViavel ?? p.fracaoViavel;

  const img = criarTela(lado, p.fundo, p.ruidoDoFundo, rng);

  // --- Posições ---
  // Amostragem por rejeição: sorteia e descarta o que colide. Simples, e o
  // suficiente porque a densidade é baixa de propósito. Sem teto de tentativas
  // o laço poderia não terminar quando a cena está cheia demais.
  const margem = Math.ceil(p.a * 1.2);
  const sementes: SementeSintetica[] = [];
  const TENTATIVAS_MAXIMAS = quantidade * 200;
  let tentativas = 0;

  while (sementes.length < quantidade && tentativas < TENTATIVAS_MAXIMAS) {
    tentativas++;
    const escala = 1 + (rng() - 0.5) * 2 * p.dispersaoDoTamanho;
    const a = p.a * escala;
    const b = p.b * escala;
    const x = margem + rng() * (lado - 2 * margem);
    const y = margem + rng() * (lado - 2 * margem);

    // Distância mínima entre centros. Quando o preset permite encostar, o
    // limite cai para o raio menor — as sementes se tocam sem se empilhar,
    // que é o caso difícil de verdade em orquídea e forrageira.
    const folga = p.permiteEncostar ? 0.62 : 1.15;
    const colide = sementes.some((o) => {
      const dist = Math.hypot(o.x - x, o.y - y);
      return dist < (Math.max(a, b) + Math.max(o.a, o.b)) * folga;
    });
    if (colide) continue;

    const angulo = rng() * Math.PI;
    const cx = Math.round(x);
    const cy = Math.round(y);
    sementes.push({
      id: sementes.length + 1,
      x: cx,
      y: cy,
      a,
      b,
      angulo,
      classe: rng() < fracaoViavel ? 'viable' : 'inviable',
      areaPx: 0,
      contorno: contornoDaElipse(cx, cy, a, b, angulo),
    });
  }

  // --- Sombras primeiro, para nenhuma cair por cima de um corpo já pintado ---
  for (const s of sementes) {
    desenharSombra(img, s.x, s.y, s.a, s.b, s.angulo, preset === 'orquidea-tz' ? 0.1 : 0.16);
  }

  // --- Corpos, contando a área verdadeira de cada uma ---
  // O rótulo por pixel resolve a sobreposição: quando duas sementes dividem um
  // pixel, ele pertence à última desenhada, e a área de cada uma é o que de
  // fato ficou visível — não a área geométrica da elipse. Uint8Array porque o
  // `id` nunca passa de umas poucas centenas nestas cenas (o teto prático é a
  // `quantidade` pedida, sempre bem abaixo de 255).
  const rotulo = new Uint8Array(lado * lado);
  for (const s of sementes) {
    const contar = (x: number, y: number) => {
      rotulo[y * lado + x] = s.id;
    };
    if (preset === 'soja') desenharSoja(img, s, rng, contar);
    else if (preset === 'orquidea-tz') desenharOrquidea(img, s, rng, contar);
    else desenharForrageira(img, s, rng, contar);
  }

  const areas = new Int32Array(sementes.length + 1);
  for (let i = 0; i < rotulo.length; i++) areas[rotulo[i]]++;
  for (const s of sementes) s.areaPx = areas[s.id];

  return {
    imagem: img,
    sementes,
    preset,
    descricao: p.descricao,
    umPorPixel: p.umPorPixel,
    rotulos: rotulo,
  };
}

// ---------------------------------------------------------------------------
// Composição de recortes — a mesma verdade, sobre textura real
// ---------------------------------------------------------------------------

/** Um objeto pronto para colar: pixels, máscara e contorno em coordenadas locais. */
export interface Recorte {
  largura: number;
  altura: number;
  /** RGBA; só os canais RGB são usados — a máscara já diz onde colar. */
  rgba: Uint8ClampedArray;
  /** 1 dentro do objeto, coordenadas locais do recorte. */
  mascara: Uint8Array;
  /** Contorno fechado, coordenadas locais do recorte. */
  contorno: Ponto[];
  classe?: string;
}

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface ObjetoDaVerdade {
  id: number;
  caixa: Caixa;
  /** Centro de massa dos pixels efetivamente colados (não o centro geométrico). */
  centro: [number, number];
  /** Contorno do recorte, traduzido para coordenadas absolutas da cena. */
  contorno: Ponto[];
  areaPx: number;
  classe?: string;
}

export interface CenaComposta {
  imagem: DadosImagem;
  /** 0 fundo, senão o id do objeto — mesmo contrato de `CenaSintetica.rotulos`. */
  rotulos: Uint8Array;
  verdade: ObjetoDaVerdade[];
  /** Recortes que não couberam dentro do teto de tentativas. */
  naoColocados: number;
}

export interface OpcoesDeComposicao {
  /** Semente do gerador de posições. A mesma semente dá a mesma composição. */
  semente?: number;
  /** Folga mínima, em pixels, entre as caixas de dois objetos. Padrão 2. */
  margem?: number;
  /** Tentativas de posição por recorte antes de desistir dele. Padrão 200. */
  tentativas?: number;
}

/** Duas caixas colidem se não há folga de `margem` em nenhum dos dois eixos. */
function caixasColidem(
  x: number,
  y: number,
  largura: number,
  altura: number,
  b: Caixa,
  margem: number
): boolean {
  return !(
    x + largura + margem <= b.x ||
    b.x + b.largura + margem <= x ||
    y + altura + margem <= b.y ||
    b.y + b.altura + margem <= y
  );
}

/**
 * Cola recortes arbitrários — reais, vindos da galeria ou de um fixture, ou
 * sintéticos — sobre um fundo, com a mesma verdade por pixel que
 * `gerarCenaSintetica` produz. Reusa `criarRng` e a mesma amostragem por
 * rejeição do gerador principal (posição aleatória, rejeita por colisão de
 * caixa), em vez de duplicar essa lógica.
 *
 * É o meio-termo entre a cena 100% sintética (verdade perfeita, textura
 * falsa) e o fixture real (textura real, verdade marcada por humano): aqui a
 * textura é real e a posição é exata, porque foi o próprio código que
 * colocou. A esteira virtual do Degrau 3 é isto deslocado em x a cada quadro.
 */
export function comporCena(
  fundo: DadosImagem,
  recortes: Recorte[],
  opcoes: OpcoesDeComposicao = {}
): CenaComposta {
  const rng = criarRng(opcoes.semente ?? 20260906);
  const margem = opcoes.margem ?? 2;
  const tentativasPorRecorte = opcoes.tentativas ?? 200;

  const largura = fundo.width;
  const altura = fundo.height;
  // Cópia do fundo: `comporCena` não pode mutar a imagem de quem chamou.
  const data =
    fundo.data instanceof Uint8ClampedArray
      ? Uint8ClampedArray.from(fundo.data)
      : new Uint8ClampedArray(fundo.data);
  const imagem: DadosImagem = { data, width: largura, height: altura };
  const rotulos = new Uint8Array(largura * altura);

  const verdade: ObjetoDaVerdade[] = [];
  let naoColocados = 0;
  let proximoId = 1;

  for (const r of recortes) {
    const maxX = largura - r.largura;
    const maxY = altura - r.altura;
    if (maxX < 0 || maxY < 0) {
      // Recorte maior que a própria cena: não existe posição possível.
      naoColocados++;
      continue;
    }

    let colocado = false;
    for (let tentativa = 0; tentativa < tentativasPorRecorte && !colocado; tentativa++) {
      const x = Math.round(rng() * maxX);
      const y = Math.round(rng() * maxY);
      const colide = verdade.some((o) => caixasColidem(x, y, r.largura, r.altura, o.caixa, margem));
      if (colide) continue;

      const id = proximoId++;
      let areaPx = 0;
      let somaX = 0;
      let somaY = 0;
      for (let ly = 0; ly < r.altura; ly++) {
        for (let lx = 0; lx < r.largura; lx++) {
          const iLocal = ly * r.largura + lx;
          if (!r.mascara[iLocal]) continue;
          const gx = x + lx;
          const gy = y + ly;
          const iGlobal = gy * largura + gx;
          const srcIdx = iLocal * 4;
          const dstIdx = iGlobal * 4;
          for (let c = 0; c < 3; c++) imagem.data[dstIdx + c] = r.rgba[srcIdx + c];
          rotulos[iGlobal] = id;
          areaPx++;
          somaX += gx;
          somaY += gy;
        }
      }

      verdade.push({
        id,
        caixa: { x, y, largura: r.largura, altura: r.altura },
        centro:
          areaPx > 0 ? [somaX / areaPx, somaY / areaPx] : [x + r.largura / 2, y + r.altura / 2],
        contorno: r.contorno.map(([px, py]) => [px + x, py + y] as Ponto),
        areaPx,
        classe: r.classe,
      });
      colocado = true;
    }

    if (!colocado) naoColocados++;
  }

  return { imagem, rotulos, verdade, naoColocados };
}

/**
 * Interseção sobre união de duas máscaras binárias do mesmo tamanho.
 *
 * União vazia (as duas máscaras inteiramente zero) devolve 1: não há nada
 * para errar, e 0 daria a impressão de discordância total onde não há
 * discordância nenhuma.
 */
export function iouDeMascaras(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let uniao = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] !== 0;
    const bv = b[i] !== 0;
    if (av || bv) uniao++;
    if (av && bv) inter++;
  }
  return uniao === 0 ? 1 : inter / uniao;
}

/** Resumo curto da verdade da cena, para a interface anunciar. */
export function resumirCena(cena: CenaSintetica): {
  total: number;
  viaveis: number;
  inviaveis: number;
  percentualViavel: number;
} {
  const viaveis = cena.sementes.filter((s) => s.classe === 'viable').length;
  const total = cena.sementes.length;
  return {
    total,
    viaveis,
    inviaveis: total - viaveis,
    percentualViavel: total > 0 ? Math.round((viaveis / total) * 1000) / 10 : 0,
  };
}
