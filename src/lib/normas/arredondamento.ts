// =============================================================================
// SeedCounter — arredondamento que fecha a soma
//
// POR QUE ISTO É UM MÓDULO, E NÃO UMA CHAMADA A `Math.round`.
//
// Um boletim de germinação declara cinco frações — normais, anormais, duras,
// dormentes e mortas — e a norma exige que elas somem **exatamente 100%**.
// Arredondar cada uma por conta própria quase nunca fecha:
//
//   33,3 + 33,3 + 33,4  →  33 + 33 + 33  =  99
//
// Falta um ponto, e ele não pode ser jogado em qualquer campo. A RAS diz onde:
// mantém-se o inteiro das normais, e o ajuste vai para a **maior parte
// fracionária**. Quando duas empatam, a ordem de desempate é fixa —
// **anormais → duras → dormentes → mortas**.
//
// Isso é o método do maior resto (Hamilton), com uma regra de desempate
// determinística por cima. O determinismo é o ponto: dois analistas com os
// mesmos números têm de imprimir o mesmo boletim, e um desempate "pelo que vier
// primeiro no array" faria o resultado depender da ordem de digitação.
//
// AS NORMAIS NÃO RECEBEM O AJUSTE.
//
// É a fração que o comprador lê primeiro e a que define o valor do lote.
// Deixá-la absorver o resto faria a germinação declarada subir ou descer por
// um artefato de arredondamento — e é justamente ela que a fiscalização
// confere. O ajuste mora nas frações complementares.
// =============================================================================

import { arredondar } from './valor-de-boletim';

/**
 * As frações do teste de germinação, na ordem de desempate da norma.
 *
 * A ordem do tipo NÃO é decorativa: `ORDEM_DE_DESEMPATE` a lê para decidir quem
 * recebe o ajuste quando duas partes fracionárias empatam.
 */
export interface FracoesDeGerminacao {
  normais: number;
  anormais: number;
  duras: number;
  dormentes: number;
  mortas: number;
}

/** Quem pode receber o ajuste, na ordem em que a norma desempata. */
export const ORDEM_DE_DESEMPATE = ['anormais', 'duras', 'dormentes', 'mortas'] as const;

export type CampoAjustavel = (typeof ORDEM_DE_DESEMPATE)[number];

export interface ResultadoDoArredondamento<T> {
  valores: T;
  /** Quais campos receberam ajuste, e de quanto. Vazio quando fechou sozinho. */
  ajustes: { campo: string; delta: number }[];
}

// ---------------------------------------------------------------------------
// Germinação — inteiros que somam 100
// ---------------------------------------------------------------------------

/**
 * Arredonda as cinco frações para inteiros que somam exatamente 100.
 *
 * Recebe porcentagens (0 a 100), não contagens. Se a entrada já não somar ~100,
 * devolve o arredondamento simples e registra que não fechou — inventar um
 * total que a medição não produziu seria pior que mostrar a inconsistência.
 */
export function arredondarGerminacao(
  fracoes: FracoesDeGerminacao
): ResultadoDoArredondamento<FracoesDeGerminacao> {
  const total = somar(fracoes);

  // Tolera o erro de ponto flutuante da própria divisão, e só isso.
  if (!Number.isFinite(total) || Math.abs(total - 100) > 0.5) {
    return {
      valores: mapear(fracoes, (v) => Math.round(v)),
      ajustes: [],
    };
  }

  // Piso de todo mundo; o que sobrar é distribuído pelas maiores partes
  // fracionárias.
  const pisos = mapear(fracoes, (v) => Math.floor(v));
  const restos: Record<keyof FracoesDeGerminacao, number> = {
    normais: fracoes.normais - pisos.normais,
    anormais: fracoes.anormais - pisos.anormais,
    duras: fracoes.duras - pisos.duras,
    dormentes: fracoes.dormentes - pisos.dormentes,
    mortas: fracoes.mortas - pisos.mortas,
  };

  let faltando = 100 - somar(pisos);
  const valores = { ...pisos };
  const ajustes: { campo: string; delta: number }[] = [];

  // As NORMAIS ficam fora da distribuição: elas mantêm o próprio inteiro.
  const candidatos = [...ORDEM_DE_DESEMPATE];

  while (faltando > 0 && candidatos.length > 0) {
    const escolhido = maiorResto(candidatos, restos);
    valores[escolhido] += 1;
    ajustes.push({ campo: escolhido, delta: 1 });
    // Zera o resto para o campo não ser escolhido duas vezes na mesma rodada.
    restos[escolhido] = -1;
    faltando -= 1;
    if (candidatos.every((c) => restos[c] < 0)) break;
  }

  // Sobrou ponto e todo mundo já recebeu: devolve para as normais, que é o
  // único lugar que ainda pode absorver sem ficar negativo.
  if (faltando !== 0) {
    valores.normais += faltando;
    ajustes.push({ campo: 'normais', delta: faltando });
  }

  return { valores, ajustes };
}

/**
 * O campo de maior parte fracionária, com desempate pela ordem da norma.
 *
 * O `>` estrito é o que faz a ordem valer: num empate exato o primeiro da lista
 * já está escolhido e nenhum posterior o desloca.
 */
function maiorResto(
  candidatos: readonly CampoAjustavel[],
  restos: Record<keyof FracoesDeGerminacao, number>
): CampoAjustavel {
  let melhor = candidatos[0];
  for (const c of candidatos) {
    if (restos[c] > restos[melhor]) melhor = c;
  }
  return melhor;
}

// ---------------------------------------------------------------------------
// Pureza — uma decimal, somando 100,0
// ---------------------------------------------------------------------------

export interface FracoesDePureza {
  /** Semente pura. */
  puras: number;
  /** Outras sementes. */
  outrasSementes: number;
  /** Material inerte. */
  inerte: number;
}

/**
 * Arredonda as frações de pureza para uma decimal, somando 100,0.
 *
 * A norma manda ajustar **o maior valor** — que na prática é sempre a semente
 * pura. É o oposto da germinação, e por um motivo simétrico: na pureza o
 * ajuste de 0,1% sobre 98% é irrelevante, enquanto sobre 0,3% de inerte seria
 * um terço do valor.
 */
export function arredondarPureza(
  fracoes: FracoesDePureza
): ResultadoDoArredondamento<FracoesDePureza> {
  const bruto = {
    puras: arredondar(fracoes.puras, 1),
    outrasSementes: arredondar(fracoes.outrasSementes, 1),
    inerte: arredondar(fracoes.inerte, 1),
  };

  const total = arredondar(bruto.puras + bruto.outrasSementes + bruto.inerte, 1);
  const delta = arredondar(100 - total, 1);

  if (delta === 0) return { valores: bruto, ajustes: [] };

  // Um décimo é o MAIOR resíduo que o arredondamento correto de três valores
  // na grade de 0,1 consegue produzir: cada um erra no máximo 0,05, e a soma
  // dos três cai sempre num múltiplo de 0,1 dentro de ±0,15 — ou seja, 0,1.
  //
  // Diferença maior que isso não é arredondamento: é conta errada. Empurrá-la
  // para o maior valor produziria um boletim que fecha 100% sem que a medição
  // feche, que é exatamente o que ninguém quer descobrir na fiscalização.
  if (Math.abs(delta) > 0.1) {
    return { valores: bruto, ajustes: [] };
  }

  const campo = maiorCampoDePureza(bruto);
  const valores = { ...bruto, [campo]: arredondar(bruto[campo] + delta, 1) };
  return { valores, ajustes: [{ campo, delta }] };
}

function maiorCampoDePureza(f: FracoesDePureza): keyof FracoesDePureza {
  let campo: keyof FracoesDePureza = 'puras';
  for (const c of ['puras', 'outrasSementes', 'inerte'] as const) {
    if (f[c] > f[campo]) campo = c;
  }
  return campo;
}

// ---------------------------------------------------------------------------

function somar(f: FracoesDeGerminacao): number {
  return f.normais + f.anormais + f.duras + f.dormentes + f.mortas;
}

function mapear(
  f: FracoesDeGerminacao,
  fn: (v: number) => number
): FracoesDeGerminacao {
  return {
    normais: fn(f.normais),
    anormais: fn(f.anormais),
    duras: fn(f.duras),
    dormentes: fn(f.dormentes),
    mortas: fn(f.mortas),
  };
}

/** A soma fecha exatamente? Existe para o teste e para a interface conferirem. */
export function fecha100(f: FracoesDeGerminacao): boolean {
  return somar(f) === 100;
}

// ---------------------------------------------------------------------------
// Duas fracoes complementares
// ---------------------------------------------------------------------------

/**
 * Duas porcentagens complementares que somam EXATAMENTE 100.
 *
 * E o caso do laudo de contagem: viaveis e inviaveis. Arredondar cada uma por
 * conta propria produz 33,4 + 66,7 = 100,1 — e um boletim que nao fecha 100
 * perde a confianca do analista em trinta segundos.
 *
 * A regra segue o mesmo principio da germinacao: a fracao PRINCIPAL mantem o
 * proprio arredondamento, e o complemento absorve. A principal e a que o
 * comprador le primeiro; e ela que nao pode se mover por artefato.
 */
export function fecharDuas(
  principal: number,
  total: number,
  casas = 1
): { principal: number; complemento: number } | null {
  if (!Number.isFinite(principal) || !Number.isFinite(total) || total <= 0) return null;
  const p = arredondar((principal / total) * 100, casas);
  const c = arredondar(100 - p, casas);
  return { principal: p, complemento: c };
}
