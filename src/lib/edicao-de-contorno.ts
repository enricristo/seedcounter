// =============================================================================
// SeedCounter — geometria da edição manual de contorno
//
// O que a ferramenta de contorno (C) precisa responder a cada clique, em
// pixels da imagem: "isto foi num vértice?", "foi numa aresta?", "foi dentro
// de qual contorno?". Mora aqui, e não no canvas, porque é geometria pura — e
// porque a tolerância dos alvos é a parte que mais dá bug em ferramenta de
// desenho, então tem que ser testável sem mouse.
//
// TOLERÂNCIA EM PIXELS DE TELA. Quem chama converte: `alcance = PX / zoom`.
// A primeira versão media em pixels da IMAGEM, e a alça de um vértice numa
// varredura de 2400 px tinha 11 px de imagem — 3 px de tela com zoom 0,3
// (impossível de pegar) e 33 com zoom 3 (tampava o vizinho).
// =============================================================================

export type Ponto = [number, number];

export interface VerticeProximo {
  indice: number;
  distancia: number;
}

export interface ArestaProxima {
  /** A aresta `i` liga o vértice `i` ao vértice `i + 1` (o último ao primeiro). */
  aresta: number;
  /** O pé da perpendicular — onde o vértice novo entra se a pessoa clicar aqui. */
  ponto: Ponto;
  distancia: number;
}

/** O vértice mais próximo de `p` dentro do alcance, ou null. */
export function verticeMaisProximo(
  poligono: readonly Ponto[],
  p: Ponto,
  alcance: number
): VerticeProximo | null {
  let melhor: VerticeProximo | null = null;
  for (let i = 0; i < poligono.length; i++) {
    const d = Math.hypot(poligono[i][0] - p[0], poligono[i][1] - p[1]);
    if (d <= alcance && (!melhor || d < melhor.distancia)) melhor = { indice: i, distancia: d };
  }
  return melhor;
}

/**
 * A aresta mais próxima de `p` dentro do alcance, com o pé da perpendicular.
 *
 * O pé é preso ao segmento: além dos extremos, a distância é até o vértice —
 * e aí quem responde é `verticeMaisProximo`, que tem prioridade em quem chama.
 */
export function arestaMaisProxima(
  poligono: readonly Ponto[],
  p: Ponto,
  alcance: number
): ArestaProxima | null {
  const n = poligono.length;
  if (n < 2) return null;
  let melhor: ArestaProxima | null = null;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = poligono[i];
    const [bx, by] = poligono[(i + 1) % n];
    const dx = bx - ax;
    const dy = by - ay;
    const comprimento2 = dx * dx + dy * dy;
    // Fração ao longo do segmento, presa em [0, 1].
    const t =
      comprimento2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / comprimento2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const d = Math.hypot(p[0] - px, p[1] - py);
    if (d <= alcance && (!melhor || d < melhor.distancia)) {
      melhor = { aresta: i, ponto: [px, py], distancia: d };
    }
  }
  return melhor;
}

/** Devolve um polígono novo com `ponto` inserido depois do vértice `aresta`. */
export function inserirVertice(poligono: readonly Ponto[], aresta: number, ponto: Ponto): Ponto[] {
  const n = poligono.length;
  const i = ((aresta % n) + n) % n;
  return [...poligono.slice(0, i + 1), ponto, ...poligono.slice(i + 1)];
}

/**
 * Ponto dentro do polígono, por cruzamento de raio.
 *
 * O `!==` entre as duas comparações de y é o que conta cada aresta uma vez só
 * quando o raio passa exatamente por um vértice.
 */
export function pontoNoPoligono(x: number, y: number, pontos: readonly Ponto[]): boolean {
  if (!pontos || pontos.length < 3) return false;

  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [xi, yi] = pontos[i];
    const [xj, yj] = pontos[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/**
 * Qual contorno está sob o ponto. Se há mais de um (contornos sobrepostos), o
 * de MENOR área: é o que a pessoa vê por cima e o que ela consegue apontar —
 * o grande ela alcança clicando fora do pequeno.
 */
export function contornoSobOPonto<T extends { polygon_points: Ponto[] }>(
  contornos: readonly T[],
  p: Ponto
): T | null {
  let melhor: T | null = null;
  let menorArea = Infinity;
  for (const c of contornos) {
    if (!pontoNoPoligono(p[0], p[1], c.polygon_points)) continue;
    const a = areaAbsoluta(c.polygon_points);
    if (a < menorArea) {
      menorArea = a;
      melhor = c;
    }
  }
  return melhor;
}

function areaAbsoluta(pontos: readonly Ponto[]): number {
  let soma = 0;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    soma += (pontos[j][0] + pontos[i][0]) * (pontos[j][1] - pontos[i][1]);
  }
  return Math.abs(soma) / 2;
}

// ---------------------------------------------------------------------------
// Arraste suave
//
// Um contorno da onda tem ~48 vértices. Mover UM deles faz um espinho: os dois
// vizinhos ficam parados e o polígono ganha um bico que não existe na semente.
// Corrigir uma barriga de 1/6 do contorno exigiria arrastar oito vértices, um
// a um, e acertar a curva de cabeça.
//
// A saída é a de qualquer editor de malha: o vértice puxado leva os vizinhos
// junto, com peso que cai a zero na distância `raio` medida AO LONGO DO
// CONTORNO. Cosseno levantado, porque é suave nas duas pontas — sem quina
// onde a influência acaba.
// ---------------------------------------------------------------------------

/** Comprimento do contorno fechado. */
export function perimetro(poligono: readonly Ponto[]): number {
  let soma = 0;
  for (let i = 0, n = poligono.length; i < n; i++) {
    const [ax, ay] = poligono[i];
    const [bx, by] = poligono[(i + 1) % n];
    soma += Math.hypot(bx - ax, by - ay);
  }
  return soma;
}

/**
 * Até onde o arraste de um vértice se propaga, por padrão: um oitavo do
 * perímetro para cada lado, ou seja, um quarto do contorno acompanha.
 *
 * Relativo ao contorno, não em pixels nem em milímetros: a mesma fração serve
 * para a soja de 8 mm e para a orquídea de 0,5 mm.
 */
export function raioDeInfluencia(poligono: readonly Ponto[]): number {
  return perimetro(poligono) / 8;
}

/**
 * Peso de cada vértice quando o vértice `indice` é puxado: 1 nele, caindo em
 * cosseno até 0 na distância `raio` pelo contorno (no sentido mais curto).
 */
export function pesosDeInfluencia(
  poligono: readonly Ponto[],
  indice: number,
  raio: number
): number[] {
  const n = poligono.length;
  const pesos = new Array<number>(n).fill(0);
  if (n === 0) return pesos;
  pesos[indice] = 1;
  if (raio <= 0) return pesos;

  // Anda pelos dois lados a partir do vértice puxado, acumulando o comprimento
  // das arestas, até passar do raio ou dar a volta.
  for (const sentido of [1, -1]) {
    let d = 0;
    let anterior = indice;
    for (let passo = 1; passo < n; passo++) {
      const j = (((indice + sentido * passo) % n) + n) % n;
      d += Math.hypot(poligono[j][0] - poligono[anterior][0], poligono[j][1] - poligono[anterior][1]);
      if (d >= raio) break;
      const w = 0.5 * (1 + Math.cos((Math.PI * d) / raio));
      // Nos dois sentidos o mesmo vértice pode ser alcançado; fica o maior.
      if (w > pesos[j]) pesos[j] = w;
      anterior = j;
    }
  }
  return pesos;
}

/**
 * Move o vértice `indice` para `destino`, levando os vizinhos com o peso de
 * `pesosDeInfluencia`. Com `raio` zero é o arraste rígido: só o vértice.
 */
export function moverVerticeSuave(
  poligono: readonly Ponto[],
  indice: number,
  destino: Ponto,
  raio: number
): Ponto[] {
  const dx = destino[0] - poligono[indice][0];
  const dy = destino[1] - poligono[indice][1];
  const pesos = pesosDeInfluencia(poligono, indice, raio);
  return poligono.map(([x, y], j) =>
    pesos[j] === 0 ? ([x, y] as Ponto) : ([x + dx * pesos[j], y + dy * pesos[j]] as Ponto)
  );
}
