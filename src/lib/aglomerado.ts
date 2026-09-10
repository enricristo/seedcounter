// =============================================================================
// SeedCounter — detecção de aglomerado
//
// POR QUE ISTO VEM ANTES DE QUALQUER SEPARAÇÃO.
//
// Medimos: em 30 de 30 contornos de orquídea e 28 de 30 de forrageira, o
// sistema se declarou CONFIANTE — e 30% deles tinham engolido a semente
// vizinha. Ele está confiantemente errado.
//
// A causa é estrutural, não um limiar mal escolhido. A confiança atual
// (`crescimentoNaBorda`) mede quanto a região cresce ao atravessar a borda
// escolhida — ou seja, a nitidez da borda CONTRA O FUNDO. E a fronteira
// externa de um PAR de sementes é exatamente tão nítida quanto a de uma
// semente sozinha. A métrica é cega ao modo de falha dominante por construção:
// ela olha para fora, e o problema está dentro.
//
// Este módulo não separa nada. Ele responde outra pergunta — "isto é uma
// semente só?" — e é o conserto mais barato do defeito mais caro. Um contorno
// errado marcado como duvidoso convida à conferência; marcado como bom vira
// área e comprimento no CSV sem ninguém olhar.
//
// TRÊS SINAIS, E POR QUE ESTES.
//
// 1. ÁREA CONTRA A POPULAÇÃO DA PRÓPRIA CENA.
//
//    Uma bandeja tem dezenas ou centenas de sementes da mesma amostra. A
//    mediana robusta das áreas é um conhecimento de forma que não exige treino
//    nem saber a espécie: a própria cena é o conjunto de referência. Se um
//    contorno tem duas vezes a mediana, são provavelmente duas sementes.
//
//    É o sinal mais forte e o mais barato. A literatura de arroz híbrido
//    (Tan et al., 2019) treina uma rede neural para responder isso; uma
//    mediana responde quase tão bem.
//
// 2. SOLIDEZ — área dividida pela área do fecho convexo.
//
//    Semente é convexa. Duas encostadas formam duas cinturas, e o fecho
//    convexo passa por fora delas. Soja isolada fica em torno de 0,97-0,99; um
//    par cai para 0,85-0,90.
//
// 3. PROFUNDIDADE DO MAIOR DEFEITO DE CONVEXIDADE.
//
//    Mais específica que a solidez, e a diferença importa: distingue UMA
//    cintura funda num ponto (que é toque) de rugosidade espalhada pelo
//    contorno (que é tegumento). Forrageira com arista tem solidez
//    legitimamente baixa sem ser aglomerado.
//
// A REGRA DE SAÍDA É DE TRÊS ESTADOS, NÃO DOIS.
//
// Separado, suspeito de aglomerado, ou não avaliável. Com número científico
// publicável, a taxa de recusa é uma estatística reportável — e é muito mais
// defensável que um erro silencioso de 30%.
//
// Fundamentação: docs/superpowers/specs/2026-09-08-estado-atual-da-segmentacao.md
// =============================================================================

export type Ponto = [number, number];

export interface SinaisDeAglomerado {
  /** Área do contorno, em pixels. */
  areaPx: number;
  /** Área dividida pela área do fecho convexo. Semente isolada fica perto de 1. */
  solidez: number;
  /**
   * Profundidade do maior defeito de convexidade, dividida pelo raio de um
   * círculo de mesma área. Normalizar pelo raio torna o número comparável
   * entre sementes de tamanhos diferentes.
   */
  profundidadeRelativa: number;
  /**
   * Área dividida pela mediana da cena. `NaN` quando não há população de
   * referência ainda.
   */
  razaoDeArea: number;
  /**
   * Quantas sementes o contorno provavelmente contém, pela área. `NaN` sem
   * população de referência.
   */
  sementesEstimadas: number;
  /** O veredito. */
  veredito: 'semente' | 'aglomerado' | 'nao-avaliavel';
  /** Em linguagem de gente, para a interface mostrar. */
  motivo: string;
}

export interface LimiaresDeAglomerado {
  /** Abaixo desta solidez o contorno é suspeito. Padrão 0,92. */
  solidezMinima?: number;
  /** Acima desta profundidade relativa o contorno é suspeito. Padrão 0,15. */
  profundidadeMaxima?: number;
  /** Acima desta razão de área o contorno é suspeito. Padrão 1,5. */
  razaoDeAreaMaxima?: number;
}

/**
 * Limiares padrão — calibrados para contorno LISO, tipo soja.
 *
 * MEDIÇÃO QUE PRECISA ACOMPANHAR ESTES NÚMEROS.
 *
 * Aplicados a 3530 contornos de orquídea isolada anotados à mão (conjunto de
 * treino do YOLO em produção), eles reprovam a semente sadia em massa:
 *
 *   profundidadeMaxima 0,15 → 78,0% de falso alarme
 *   solidezMinima      0,92 → 40,1% de falso alarme
 *
 * Não é defeito da métrica: é que semente de orquídea tem testa papirácea e
 * irregular, e o contorno anotado dela NÃO é convexo. Uma constante que serve a
 * uma soja lisa não pode servir a isso.
 *
 * Contra 240 pares que realmente se encostam, os mesmos sinais separam bem —
 * desde que o limiar mude: a profundidade em 0,60 dá 5,8% de falso alarme com
 * 95,8% dos pares pegos, e a mediana das fundidas (0,852) fica muito acima da
 * mediana das isoladas (0,199).
 *
 * CONCLUSÃO DE PROJETO: constante absoluta é a forma errada para este problema.
 * O limiar certo é relativo à POPULAÇÃO DA PRÓPRIA IMAGEM — a mesma ideia que
 * `medianaDaCena` já usa para a área. Enquanto isso não existe, quem trabalha
 * com contorno irregular passa `LIMIARES_DE_CONTORNO_IRREGULAR`.
 */
const PADROES = {
  solidezMinima: 0.92,
  profundidadeMaxima: 0.15,
  razaoDeAreaMaxima: 1.5,
};

/**
 * Limiares medidos para contorno irregular (orquídea e afins).
 *
 * Vieram de 3530 contornos isolados contra 240 pares reais. O ponto de operação
 * escolhido privilegia NÃO importunar quem está certo: 5,8% de falso alarme por
 * 95,8% de detecção. Num painel de triagem, o custo de um falso alarme é a
 * pessoa olhar uma semente boa; o custo de um par não detectado é um número
 * errado no laudo — mas com 95,8% o segundo já é raro.
 */
export const LIMIARES_DE_CONTORNO_IRREGULAR = {
  solidezMinima: 0.75,
  profundidadeMaxima: 0.6,
  razaoDeAreaMaxima: 1.6,
} as const;

/** Abaixo disto o contorno não tem pontos suficientes para as medidas fazerem sentido. */
const PONTOS_MINIMOS = 8;

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/** Área do polígono pela fórmula do cadarço. Sempre positiva. */
export function areaDoPoligono(pontos: Ponto[]): number {
  if (pontos.length < 3) return 0;
  let soma = 0;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    soma += pontos[j][0] * pontos[i][1] - pontos[i][0] * pontos[j][1];
  }
  return Math.abs(soma) / 2;
}

/** Produto vetorial de OA × OB. Positivo se OAB gira à esquerda. */
function giro(O: Ponto, A: Ponto, B: Ponto): number {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

/**
 * Fecho convexo pela cadeia monótona de Andrew, devolvendo ÍNDICES no contorno
 * original. O(n log n).
 *
 * Devolver índices e não pontos é o que torna possível medir os defeitos: para
 * saber o quanto o contorno afunda sob uma aresta do fecho, é preciso saber
 * QUAIS pontos do contorno ficam sob ela — e isso é informação de ordem, que
 * se perde ao devolver só coordenadas.
 */
export function indicesDoFechoConvexo(pontos: Ponto[]): number[] {
  const n = pontos.length;
  if (n < 3) return pontos.map((_, i) => i);

  const ordem = pontos
    .map((_, i) => i)
    .sort((a, b) => pontos[a][0] - pontos[b][0] || pontos[a][1] - pontos[b][1]);

  const construir = (entrada: number[]): number[] => {
    const pilha: number[] = [];
    for (const i of entrada) {
      while (
        pilha.length >= 2 &&
        giro(pontos[pilha[pilha.length - 2]], pontos[pilha[pilha.length - 1]], pontos[i]) <= 0
      ) {
        pilha.pop();
      }
      pilha.push(i);
    }
    pilha.pop();
    return pilha;
  };

  return [...construir(ordem), ...construir([...ordem].reverse())];
}

/** O fecho convexo como pontos. */
export function fechoConvexo(pontos: Ponto[]): Ponto[] {
  return indicesDoFechoConvexo(pontos).map((i) => pontos[i]);
}

/** Distância do ponto P ao segmento AB. */
function distanciaAoSegmento(P: Ponto, A: Ponto, B: Ponto): number {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const comprimento2 = dx * dx + dy * dy;
  if (comprimento2 === 0) return Math.hypot(P[0] - A[0], P[1] - A[1]);

  // Projeção presa ao segmento: fora dele, a distância é até a ponta.
  let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / comprimento2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy));
}

/**
 * Profundidade do maior defeito de convexidade.
 *
 * Para cada corda do fecho, o quanto o contorno afunda SOB ELA — considerando
 * apenas os pontos do contorno que ficam entre as duas pontas da corda, na
 * ordem do contorno.
 *
 * A primeira versão comparava cada corda com o contorno INTEIRO, e por isso
 * devolvia números acima de 1: numa forma convexa o ponto mais distante de uma
 * aresta é o do lado oposto da figura. Ela media o diâmetro e chamava de
 * reentrância. A restrição ao arco correspondente é o que faz a medida
 * significar o que o nome diz.
 */
export function maiorDefeitoDeConvexidade(contorno: Ponto[]): number {
  const n = contorno.length;
  if (n < 4) return 0;

  const fecho = indicesDoFechoConvexo(contorno);
  if (fecho.length < 3) return 0;

  // Em ordem de contorno, para que cada par consecutivo delimite um arco.
  const ordenados = [...new Set(fecho)].sort((a, b) => a - b);
  if (ordenados.length < 3) return 0;

  let maior = 0;
  for (let k = 0; k < ordenados.length; k++) {
    const i = ordenados[k];
    const j = ordenados[(k + 1) % ordenados.length];

    // Percorre o arco de i até j na ordem do contorno, dando a volta no fim.
    const A = contorno[i];
    const B = contorno[j];
    let p = (i + 1) % n;
    while (p !== j) {
      const d = distanciaAoSegmento(contorno[p], A, B);
      if (d > maior) maior = d;
      p = (p + 1) % n;
    }
  }
  return maior;
}

// ---------------------------------------------------------------------------
// População da cena
// ---------------------------------------------------------------------------

/**
 * Mediana robusta das áreas já confirmadas nesta cena.
 *
 * A própria cena é a referência: as sementes de uma bandeja são da mesma
 * amostra, e a mediana resiste a alguns contornos errados no meio. Não exige
 * treino nem saber a espécie.
 *
 * Devolve `NaN` com menos de `minimo` amostras — declarar uma mediana com três
 * sementes seria dar autoridade a ruído.
 */
export function medianaDaCena(areas: number[], minimo = 5): number {
  const validas = areas.filter((a) => Number.isFinite(a) && a > 0);
  if (validas.length < minimo) return NaN;
  const v = [...validas].sort((a, b) => a - b);
  const meio = v.length >> 1;
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

// ---------------------------------------------------------------------------
// Análise
// ---------------------------------------------------------------------------

/**
 * Analisa um contorno e diz se ele parece conter mais de uma semente.
 *
 * `referenciaDeArea` é a mediana da cena, quando já houver uma. Sem ela, os
 * sinais de forma ainda funcionam — só o mais forte é que fica de fora.
 */
export function analisarContorno(
  contorno: Ponto[],
  referenciaDeArea = NaN,
  limiares: LimiaresDeAglomerado = {}
): SinaisDeAglomerado {
  const cfg = { ...PADROES, ...limiares };
  const areaPx = areaDoPoligono(contorno);

  if (contorno.length < PONTOS_MINIMOS || areaPx <= 0) {
    return {
      areaPx,
      solidez: NaN,
      profundidadeRelativa: NaN,
      razaoDeArea: NaN,
      sementesEstimadas: NaN,
      veredito: 'nao-avaliavel',
      motivo: 'Contorno curto demais para avaliar.',
    };
  }

  const areaDoFecho = areaDoPoligono(fechoConvexo(contorno));
  const solidez = areaDoFecho > 0 ? Math.min(1, areaPx / areaDoFecho) : NaN;

  // Raio do círculo de mesma área: normaliza a profundidade para que o número
  // signifique o mesmo numa soja de 260 px e numa orquídea de 34 px.
  const raioEquivalente = Math.sqrt(areaPx / Math.PI);
  const profundidade = maiorDefeitoDeConvexidade(contorno);
  const profundidadeRelativa = raioEquivalente > 0 ? profundidade / raioEquivalente : NaN;

  const temReferencia = Number.isFinite(referenciaDeArea) && referenciaDeArea > 0;
  const razaoDeArea = temReferencia ? areaPx / referenciaDeArea : NaN;
  const sementesEstimadas = temReferencia ? Math.max(1, Math.round(razaoDeArea)) : NaN;

  // A ordem das perguntas segue a força do sinal. Área contra a população é o
  // mais confiável quando existe; forma é o que resta quando não existe.
  const motivos: string[] = [];
  if (temReferencia && razaoDeArea > cfg.razaoDeAreaMaxima) {
    motivos.push(`área é ${razaoDeArea.toFixed(1)}× a mediana da amostra`);
  }
  if (Number.isFinite(solidez) && solidez < cfg.solidezMinima) {
    motivos.push(`contorno tem cintura (solidez ${solidez.toFixed(2)})`);
  }
  if (Number.isFinite(profundidadeRelativa) && profundidadeRelativa > cfg.profundidadeMaxima) {
    motivos.push(`reentrância funda (${(profundidadeRelativa * 100).toFixed(0)}% do raio)`);
  }

  if (motivos.length > 0) {
    const quantas = temReferencia && sementesEstimadas > 1 ? ` Parecem ${sementesEstimadas}.` : '';
    return {
      areaPx,
      solidez,
      profundidadeRelativa,
      razaoDeArea,
      sementesEstimadas,
      veredito: 'aglomerado',
      motivo: `Pode ser mais de uma semente: ${motivos.join('; ')}.${quantas}`,
    };
  }

  return {
    areaPx,
    solidez,
    profundidadeRelativa,
    razaoDeArea,
    sementesEstimadas,
    veredito: 'semente',
    motivo: temReferencia
      ? 'Compatível com uma semente da amostra.'
      : 'Forma compatível com uma semente (sem referência de tamanho ainda).',
  };
}
