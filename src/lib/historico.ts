// =============================================================================
// SeedCounter — histórico de anotações (desfazer / refazer)
//
// O QUE ELE GUARDA. Instantâneos do estado inteiro, não a lista de ações.
// Guardar ações ("marca adicionada", "contorno removido") obriga cada ação a
// saber se desfazer — e a primeira que esquecer (o corte, que cria uma marca
// E dois contornos) volta pela metade. Um instantâneo volta inteiro sempre,
// e sai de graça: as listas já são imutáveis, então guardar o estado anterior
// é guardar uma referência.
//
// O GESTO. Arrastar um vértice produz dezenas de estados por segundo, e
// nenhum deles é uma "ação" para quem arrasta — a ação é o arraste inteiro.
// Quem abre um gesto declara isso: enquanto ele estiver aberto, a primeira
// mudança contínua registra e as seguintes só substituem o presente. Ctrl+Z
// depois do arraste volta para ANTES do arraste, não para o penúltimo pixel.
//
// Genérico em T de propósito: o módulo não sabe o que é marca nem contorno, e
// por isso pode ser testado sem nenhum dos dois.
// =============================================================================

export type EstadoDoGesto = 'fechado' | 'aberto' | 'registrado';

export interface Historico<T> {
  /** Do mais antigo ao mais recente. */
  passado: readonly T[];
  presente: T;
  /** Do mais próximo ao mais distante: `futuro[0]` é o que "refazer" traz. */
  futuro: readonly T[];
  gesto: EstadoDoGesto;
}

export interface OpcoesDeRegistro {
  /**
   * Mudança que faz parte de um gesto em curso (um arraste, uma pincelada
   * contínua). Com o gesto aberto, só a primeira registra.
   */
  continuo?: boolean;
  /**
   * Junta esta mudança à entrada anterior, sem criar outra. É o que uma ação
   * composta usa quando precisa de duas chamadas para um gesto só — a onda
   * cria a marca e depois o contorno, e Ctrl+Z tem que remover os dois.
   */
  fundir?: boolean;
}

/**
 * Quantos estados ficam para trás. Cem gestos é mais do que uma sessão de
 * curadoria desfaz de fato; o limite existe para uma sessão longa em uma
 * imagem grande não guardar milhares de listas de contornos.
 */
export const LIMITE_DO_PASSADO = 100;

export function iniciar<T>(presente: T): Historico<T> {
  return { passado: [], presente, futuro: [], gesto: 'fechado' };
}

/** Registra um estado novo. Um estado idêntico (mesma referência) é ignorado. */
export function registrar<T>(h: Historico<T>, proximo: T, op: OpcoesDeRegistro = {}): Historico<T> {
  if (proximo === h.presente) return h;

  // Substituir sem empilhar: continuação de um gesto já registrado, ou uma
  // fusão pedida explicitamente. A fusão só faz sentido se há entrada anterior
  // para fundir — sem passado, é um registro comum.
  const substitui = (op.continuo && h.gesto === 'registrado') || (op.fundir && h.passado.length > 0);
  if (substitui) {
    return { ...h, presente: proximo, futuro: [] };
  }

  const passado = h.passado.length >= LIMITE_DO_PASSADO ? h.passado.slice(1) : h.passado;
  return {
    passado: [...passado, h.presente],
    presente: proximo,
    futuro: [],
    gesto: op.continuo && h.gesto === 'aberto' ? 'registrado' : h.gesto,
  };
}

export function podeDesfazer<T>(h: Historico<T>): boolean {
  return h.passado.length > 0;
}

export function podeRefazer<T>(h: Historico<T>): boolean {
  return h.futuro.length > 0;
}

/** Volta um passo. Fecha qualquer gesto: desfazer no meio de um arraste o encerra. */
export function desfazer<T>(h: Historico<T>): Historico<T> {
  if (!podeDesfazer(h)) return h;
  return {
    passado: h.passado.slice(0, -1),
    presente: h.passado[h.passado.length - 1],
    futuro: [h.presente, ...h.futuro],
    gesto: 'fechado',
  };
}

export function refazer<T>(h: Historico<T>): Historico<T> {
  if (!podeRefazer(h)) return h;
  return {
    passado: [...h.passado, h.presente],
    presente: h.futuro[0],
    futuro: h.futuro.slice(1),
    gesto: 'fechado',
  };
}

export function abrirGesto<T>(h: Historico<T>): Historico<T> {
  return h.gesto === 'aberto' ? h : { ...h, gesto: 'aberto' };
}

export function fecharGesto<T>(h: Historico<T>): Historico<T> {
  return h.gesto === 'fechado' ? h : { ...h, gesto: 'fechado' };
}

/**
 * Troca o presente e esquece tudo. É o que carregar uma sessão faz: o que se
 * fez na imagem anterior não é "passado" desta.
 */
export function recomecar<T>(presente: T): Historico<T> {
  return iniciar(presente);
}
