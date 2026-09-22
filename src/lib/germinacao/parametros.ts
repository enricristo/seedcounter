// =============================================================================
// SeedCounter — parâmetros de germinação extraídos da curva ajustada
//
// Cada definição abaixo foi conferida contra a saída da planilha original do
// Germinator (Joosen et al., 2010) em 24 amostras reais, usando os `a`, `b`,
// `c` DA PLANILHA como entrada — assim a definição é testada separada do
// otimizador. O que bateu, com que tolerância, e o que não bateu:
//
//   gMAX          contagem final / sementes. Exato.
//   t50 maxG      = c. Exato.
//   t-x maxG      tempo em que a curva atinge x % de `a`:
//                 t = c·(p/(1−p))^(1/b), p = x/100. Bate a 1e-10.
//   t50/t-x totS  tempo em que a curva atinge x % do TOTAL de sementes, isto é,
//                 a fração p = x/100 em valor absoluto: t = c·(q/(1−q))^(1/b)
//                 com q = p/a. Quando a ≤ p a curva nunca chega lá e a
//                 planilha deixa a célula vazia → null. Bate a 1e-10.
//   U(b−a)        u7525 = t75 − t25, ambos relativos a `a`. Bate a 1e-10.
//   r²            1 − SQres/SQtot sobre os pontos observados, SEM (0, 0).
//                 Bate a 1e-6 (a planilha guarda o r² em precisão simples).
//   AUC           soma de Riemann à direita da curva de 0 a tMAX com passo
//                 0,1 h: Σ y(0,1·k)·0,1, k = 1..tMAX/0,1, em fração×hora.
//                 Bate a 1e-7 relativo — o passo 0,1 é o da planilha; a
//                 integral exata difere na 4ª casa.
//   MGT           ∫₀^tMAX t·dy / a — o tempo médio de germinação da curva
//                 ajustada, até tMAX, normalizado pela assíntota `a` (não por
//                 y(tMAX): nas amostras de b baixo a diferença é de 3 h e a
//                 planilha fica com `a`). Calculado na mesma grade de 0,1 h,
//                 com o peso no meio do intervalo. Bate a 0,015 h no pior
//                 caso (1,7e-4 relativo). O resíduo é sistemático — a
//                 planilha fica 0,001–0,015 h ABAIXO, crescendo com b — e
//                 não é explicado por nenhuma das variantes testadas: passo
//                 (1 a 0,01 h), posição do peso, arredondamento de y em
//                 sementes ou em %, truncamento da cauda, Simpson/trapézio,
//                 média de percentis de t-x, acumulação em precisão simples.
//                 Fica registrado como o único parâmetro cuja fórmula exata da
//                 planilha não foi recuperada.
//   t50/MGT       razão dos dois acima. Segue a tolerância do MGT.
//
// ÍNDICES DE DORMÊNCIA E DE ESTRESSE.
//
// Joosen et al. (2010) definem ambos como diferença de AUC entre duas
// condições. Não há oráculo na planilha para eles; o teste é de coerência
// (sinal e simetria). A convenção de sinal aqui:
//
//   dormência = AUC(condição que quebra a dormência) − AUC(controle em água)
//   estresse  = AUC(controle) − AUC(sob estresse)
//
// Ambos positivos quando o efeito vai na direção esperada.
// =============================================================================

import {
  ajustarHill,
  hill,
  tempoNaFracaoDeA,
  type AjusteDeHill,
  type AmostraDeGerminacao,
  type OpcoesDoAjuste,
} from './hill';

export interface ConfiguracaoDosParametros extends OpcoesDoAjuste {
  /** Limite superior da AUC e do MGT, em horas. Planilha: 504. */
  tMaxParaAuc?: number;
  /** O x de t-x, em %. Planilha: 20. */
  percentualParaTx?: number;
  /** r² abaixo do qual o ajuste é marcado como pouco confiável. Planilha: 0,4. */
  r2Minimo?: number;
  /** Passo da grade de integração, em horas. Planilha: 0,1. */
  passoDaGrade?: number;
}

export interface ParametrosDeGerminacao {
  codigo: string;
  /** Fração germinada ao fim (contagem final / sementes). */
  gMax: number;
  /** = c: tempo em que a curva atinge metade de `a`, em horas. */
  t50MaxG: number;
  /** Tempo em que a curva atinge x % de `a`, em horas. */
  tXMaxG: number;
  /** Tempo em que a curva atinge 50 % do total de sementes. null se a ≤ 0,5. */
  t50TotS: number | null;
  /** Tempo em que a curva atinge x % do total de sementes. null se a ≤ x/100. */
  tXTotS: number | null;
  /** U(75−25): t75 − t25 relativos a `a`, em horas. */
  uniformidade: number;
  r2: number;
  /** true quando r² < r2Minimo: os números existem, mas a curva não descreve os dados. */
  r2AbaixoDoLimite: boolean;
  /** Área sob a curva de 0 a tMAX, em fração×hora. */
  auc: number;
  /** Tempo médio de germinação da curva, em horas. */
  mgt: number;
  /** t50MaxG / MGT. */
  assimetria: number;
  /** O x usado em tXMaxG e tXTotS, em %. */
  percentualX: number;
  /** O tMAX usado na AUC e no MGT, em horas. */
  tMax: number;
  ajuste: AjusteDeHill;
}

export type ResultadoDosParametros =
  | { parametros: ParametrosDeGerminacao; motivo: null }
  | { parametros: null; motivo: string };

const PASSO_PADRAO = 0.1;

/** Fração germinada ao fim: a última contagem sobre o total. */
export function gMaxObservado(amostra: AmostraDeGerminacao): number {
  return amostra.leituras[amostra.leituras.length - 1].acumulado / amostra.sementes;
}

/** Tempo em que a curva atinge x % de `a`. */
export function tXRelativoAoMaximo(ajuste: Pick<AjusteDeHill, 'b' | 'c'>, percentual: number): number {
  return tempoNaFracaoDeA(ajuste.b, ajuste.c, percentual / 100);
}

/**
 * Tempo em que a curva atinge x % do TOTAL de sementes. null quando a
 * assíntota `a` não chega a x %: a curva nunca cruza esse nível.
 */
export function tXRelativoAoTotal(ajuste: Pick<AjusteDeHill, 'a' | 'b' | 'c'>, percentual: number): number | null {
  const p = percentual / 100;
  if (!(ajuste.a > p)) return null;
  return tempoNaFracaoDeA(ajuste.b, ajuste.c, p / ajuste.a);
}

/** U(75−25): intervalo entre 25 % e 75 % de `a`, em horas. */
export function uniformidade7525(ajuste: Pick<AjusteDeHill, 'b' | 'c'>): number {
  return uniformidadeEntre(ajuste, 25, 75);
}

/**
 * U(superior−inferior): intervalo, em horas, entre o instante em que a curva
 * atinge `inferior` % de `a` e o instante em que atinge `superior` %.
 *
 * A planilha oferece u7525 como padrão e u8416 (±1 desvio de uma normal) como
 * alternativa; a fórmula é a mesma com percentis diferentes, então fica uma
 * função só. Percentis em %, 0 < inferior < superior < 100.
 */
export function uniformidadeEntre(
  ajuste: Pick<AjusteDeHill, 'b' | 'c'>,
  inferior: number,
  superior: number,
): number {
  return tempoNaFracaoDeA(ajuste.b, ajuste.c, superior / 100) - tempoNaFracaoDeA(ajuste.b, ajuste.c, inferior / 100);
}

/**
 * AUC de 0 a tMAX: soma de Riemann à direita com o passo da planilha.
 * Em fração×hora. O passo 0,1 é o que reproduz a planilha a 1e-7 —
 * não é uma escolha de precisão, é a definição.
 */
export function aucDaCurva(ajuste: Pick<AjusteDeHill, 'y0' | 'a' | 'b' | 'c'>, tMax: number, passo = PASSO_PADRAO): number {
  const n = Math.round(tMax / passo);
  let soma = 0;
  for (let k = 1; k <= n; k++) soma += hill(ajuste.y0, ajuste.a, ajuste.b, ajuste.c, k * passo);
  return soma * passo;
}

/**
 * MGT da curva ajustada: ∫₀^tMAX t·dy / a. Cada incremento da curva num
 * intervalo da grade é pesado pelo tempo do meio do intervalo. O denominador
 * é `a` — a fração que germinaria em tempo infinito — e não y(tMAX).
 */
export function mgtDaCurva(ajuste: Pick<AjusteDeHill, 'y0' | 'a' | 'b' | 'c'>, tMax: number, passo = PASSO_PADRAO): number {
  const n = Math.round(tMax / passo);
  let soma = 0;
  let anterior = ajuste.y0;
  for (let k = 1; k <= n; k++) {
    const t = k * passo;
    const y = hill(ajuste.y0, ajuste.a, ajuste.b, ajuste.c, t);
    soma += (y - anterior) * (t - passo / 2);
    anterior = y;
  }
  return soma / ajuste.a;
}

/**
 * Índice de dormência: quanto a condição que quebra a dormência (frio,
 * nitrato, giberelina, pós-maturação) adianta a germinação em relação ao
 * controle em água. Positivo quando havia dormência a quebrar.
 */
export function indiceDeDormencia(aucComQuebraDeDormencia: number, aucControle: number): number {
  return aucComQuebraDeDormencia - aucControle;
}

/**
 * Índice de estresse: quanto a condição de estresse (sal, calor, frio,
 * osmótico) atrasa ou reduz a germinação em relação ao controle. Positivo
 * quando o estresse prejudicou.
 */
export function indiceDeEstresse(aucControle: number, aucSobEstresse: number): number {
  return aucControle - aucSobEstresse;
}

/** Extrai todos os parâmetros a partir de um ajuste já feito. */
export function parametrosDoAjuste(
  amostra: AmostraDeGerminacao,
  ajuste: AjusteDeHill,
  config: ConfiguracaoDosParametros = {},
): ParametrosDeGerminacao {
  const tMax = config.tMaxParaAuc ?? 504;
  const percentualX = config.percentualParaTx ?? 20;
  const r2Minimo = config.r2Minimo ?? 0.4;
  const passo = config.passoDaGrade ?? PASSO_PADRAO;

  const mgt = mgtDaCurva(ajuste, tMax, passo);
  return {
    codigo: amostra.codigo,
    gMax: gMaxObservado(amostra),
    t50MaxG: ajuste.c,
    tXMaxG: tXRelativoAoMaximo(ajuste, percentualX),
    t50TotS: tXRelativoAoTotal(ajuste, 50),
    tXTotS: tXRelativoAoTotal(ajuste, percentualX),
    uniformidade: uniformidade7525(ajuste),
    r2: ajuste.r2,
    r2AbaixoDoLimite: ajuste.r2 < r2Minimo,
    auc: aucDaCurva(ajuste, tMax, passo),
    mgt,
    assimetria: ajuste.c / mgt,
    percentualX,
    tMax,
    ajuste,
  };
}

/** Ajusta a curva e extrai os parâmetros. Recusa com motivo quando o ajuste recusa. */
export function calcularParametros(
  amostra: AmostraDeGerminacao,
  config: ConfiguracaoDosParametros = {},
): ResultadoDosParametros {
  const resultado = ajustarHill(amostra, config);
  if (resultado.ajuste === null) return { parametros: null, motivo: resultado.motivo };
  return { parametros: parametrosDoAjuste(amostra, resultado.ajuste, config), motivo: null };
}
