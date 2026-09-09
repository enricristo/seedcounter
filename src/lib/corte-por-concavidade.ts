// =============================================================================
// SeedCounter — corte por concavidade
//
// SEPARAR DUAS SEMENTES QUE O CONTORNO ENGOLIU NUMA SÓ.
//
// Quando duas sementes se encostam, o contorno que as envolve tem uma
// assinatura geométrica inconfundível: **duas reentrâncias opostas**, uma de
// cada lado do ponto onde elas se tocam. É a cintura.
//
// Ligar essas duas reentrâncias é o corte. Não é heurística de última hora — é
// a técnica que a literatura de análise de sementes usa, e ela ganha do
// watershed em objeto alongado por um motivo estrutural: watershed parte de um
// mapa de distância cujo máximo, num objeto comprido, é uma CRISTA e não um
// ponto, então ele fatia a semente sozinha ao meio.
//
// POR QUE O PAR DE REENTRÂNCIAS, E NÃO A MAIS FUNDA SOZINHA.
//
// Uma reentrância isolada é feitio da semente: hilo, bico, testa amassada. Um
// PAR de reentrâncias aproximadamente frente a frente, cuja linha entre elas
// atravessa o contorno pelo lugar mais estreito, é o que duas sementes
// encostadas produzem e o que uma semente sozinha quase nunca produz.
//
// O QUE ESTE MÓDULO NÃO FAZ.
//
// Não decide SE deve cortar — `aglomerado.ts` faz a triagem. Aqui a pergunta é
// "dado que este contorno parece um par, por onde passa a linha de corte?".
// Separar as duas perguntas é o que permite medir cada uma.
//
// E não valida o corte por elipse. A memória do projeto registra: elipse
// valida, nunca mede. Aqui nem valida — o resultado é uma proposta que a pessoa
// aceita ou desfaz, e a borracha existe para o caso de ela recusar.
// =============================================================================

import { indicesDoFechoConvexo } from './aglomerado';

export type Ponto = [number, number];

export interface Reentrancia {
  /** Índice do vértice mais fundo dentro do contorno. */
  indice: number;
  ponto: Ponto;
  /** Distância do vértice até a corda do fecho, em pixels. */
  profundidade: number;
}

export interface CorteProposto {
  /** Os dois contornos resultantes. */
  partes: [Ponto[], Ponto[]];
  /** Os dois pontos ligados pelo corte. */
  linha: [Ponto, Ponto];
  /** Comprimento do corte, em pixels. */
  comprimento: number;
  /** As reentrâncias que originaram o corte. */
  reentrancias: [Reentrancia, Reentrancia];
}

export interface OpcoesDeCorte {
  /**
   * Profundidade mínima de uma reentrância para ela contar, como fração do raio
   * do círculo de mesma área.
   *
   * ESTE NÚMERO DEPENDE DA FORMA DA SEMENTE, e é a TERCEIRA vez que a mesma
   * lição aparece neste projeto — depois da razão comprimento/largura e dos
   * limiares do detector de aglomerado.
   *
   * A geometria explica: dois DISCOS que mal se tocam produzem uma cintura de
   * apenas 0,248 do raio equivalente, porque o fecho convexo de duas rodelas já
   * é quase a própria forma. Duas sementes ALONGADAS lado a lado produzem
   * 0,852, medido em 240 pares reais de orquídea — a reentrância é funda porque
   * o objeto é fino.
   *
   * O padrão 0,15 serve ao caso difícil (semente redonda, sinal fraco). Para
   * semente alongada use `CORTE_PARA_SEMENTE_ALONGADA`, senão o feitio normal
   * da testa vira corte: em orquídea isolada a profundidade mediana já é 0,199.
   */
  profundidadeMinima?: number;
  /**
   * Quão opostas as duas reentrâncias precisam estar, em fração do perímetro.
   *
   * Duas reentrâncias vizinhas no contorno são a mesma dobra vista duas vezes,
   * não uma cintura. Exigir separação ao longo do contorno é o que distingue as
   * duas situações.
   */
  separacaoMinima?: number;
}

const PADROES = {
  profundidadeMinima: 0.15,
  separacaoMinima: 0.2,
};

/**
 * Corte para semente alongada — orquídea, forrageira, arroz.
 *
 * Medido: orquídea isolada tem profundidade relativa mediana 0,199 e o par real
 * tem 0,852. O padrão de 0,15 cortaria a semente sadia ao meio.
 */
export const CORTE_PARA_SEMENTE_ALONGADA: OpcoesDeCorte = {
  profundidadeMinima: 0.4,
};

/** Abaixo disto não há contorno o bastante para procurar cintura. */
const VERTICES_MINIMOS = 8;

// ---------------------------------------------------------------------------

/**
 * Acha as reentrâncias do contorno, da mais funda para a mais rasa.
 *
 * A profundidade é medida contra a corda do fecho convexo, e **restrita ao arco
 * do contorno entre os dois vértices do fecho** — que é a correção que este
 * projeto já precisou fazer uma vez. Medir contra a corda inteira devolve o
 * diâmetro do objeto, não a reentrância, e o número sai maior que 1.
 */
export function acharReentrancias(contorno: Ponto[]): Reentrancia[] {
  const n = contorno.length;
  if (n < VERTICES_MINIMOS) return [];

  const fecho = indicesDoFechoConvexo(contorno);
  if (fecho.length < 3) return [];

  const achadas: Reentrancia[] = [];

  for (let k = 0; k < fecho.length; k++) {
    const i = fecho[k];
    const j = fecho[(k + 1) % fecho.length];

    const a = contorno[i];
    const b = contorno[j];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const comprimento = Math.hypot(dx, dy);
    if (comprimento < 1e-6) continue;

    let melhorIndice = -1;
    let melhorProfundidade = 0;

    // Só o arco entre i e j, andando para frente no contorno.
    for (let passo = 1; ; passo++) {
      const idx = (i + passo) % n;
      if (idx === j) break;
      if (passo > n) break;

      const p = contorno[idx];
      // Distância perpendicular à reta que passa por a e b.
      const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / comprimento;
      if (d > melhorProfundidade) {
        melhorProfundidade = d;
        melhorIndice = idx;
      }
    }

    if (melhorIndice >= 0 && melhorProfundidade > 0) {
      achadas.push({
        indice: melhorIndice,
        ponto: contorno[melhorIndice],
        profundidade: melhorProfundidade,
      });
    }
  }

  return achadas.sort((x, y) => y.profundidade - x.profundidade);
}

/**
 * Propõe o corte que separa o par, ou `null` quando não há cintura.
 *
 * Devolver `null` é a resposta certa na maioria dos contornos: quase todo objeto
 * é uma semente só, e cortar por engano é pior que não cortar — vira duas
 * sementes onde havia uma, e o número do laudo sobe.
 */
export function proporCorte(
  contorno: Ponto[],
  opcoes: OpcoesDeCorte = {}
): CorteProposto | null {
  const { profundidadeMinima, separacaoMinima } = { ...PADROES, ...opcoes };
  const n = contorno.length;
  if (n < VERTICES_MINIMOS) return null;

  const area = areaDoPoligono(contorno);
  if (!(area > 0)) return null;
  const raioEquivalente = Math.sqrt(area / Math.PI);
  const limite = profundidadeMinima * raioEquivalente;

  const reentrancias = acharReentrancias(contorno).filter((r) => r.profundidade >= limite);
  if (reentrancias.length < 2) return null;

  // `ceil`, e nao `floor`: a separacao maxima possivel entre dois vertices num
  // contorno fechado e exatamente n/2, e com `floor` um pedido de 0,51 virava
  // n/2 arredondado para baixo — ou seja, ainda aceitava. O parametro nao
  // cumpria o que promete.
  const separacao = Math.max(2, Math.ceil(n * separacaoMinima));

  // Entre os pares que passam, vence o de MENOR corte. É a definição de
  // cintura: o lugar mais estreito. Um par fundo mas largo é o contorno de um
  // objeto em forma de C, não de duas sementes encostadas.
  let melhor: { a: Reentrancia; b: Reentrancia; comprimento: number } | null = null;

  for (let i = 0; i < reentrancias.length; i++) {
    for (let j = i + 1; j < reentrancias.length; j++) {
      const a = reentrancias[i];
      const b = reentrancias[j];

      const distanciaNoContorno = Math.min(
        Math.abs(a.indice - b.indice),
        n - Math.abs(a.indice - b.indice)
      );
      if (distanciaNoContorno < separacao) continue;

      const comprimento = Math.hypot(a.ponto[0] - b.ponto[0], a.ponto[1] - b.ponto[1]);
      if (!melhor || comprimento < melhor.comprimento) {
        melhor = { a, b, comprimento };
      }
    }
  }

  if (!melhor) return null;

  const partes = fatiar(contorno, melhor.a.indice, melhor.b.indice);
  if (!partes) return null;

  return {
    partes,
    linha: [melhor.a.ponto, melhor.b.ponto],
    comprimento: melhor.comprimento,
    reentrancias: [melhor.a, melhor.b],
  };
}

/**
 * Corta o contorno em dois nos índices dados.
 *
 * Cada parte fica com os DOIS pontos do corte, e é isso que faz as duas metades
 * serem polígonos fechados em vez de arcos abertos.
 */
export function fatiar(
  contorno: Ponto[],
  i: number,
  j: number
): [Ponto[], Ponto[]] | null {
  const n = contorno.length;
  const de = Math.min(i, j);
  const ate = Math.max(i, j);

  const primeira = contorno.slice(de, ate + 1);
  const segunda = [...contorno.slice(ate), ...contorno.slice(0, de + 1)];

  if (primeira.length < 3 || segunda.length < 3) return null;
  if (primeira.length + segunda.length < n) return null;

  return [primeira, segunda];
}

export function areaDoPoligono(p: Ponto[]): number {
  let soma = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    soma += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  }
  return Math.abs(soma) / 2;
}
