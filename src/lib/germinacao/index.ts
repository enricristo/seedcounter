// =============================================================================
// SeedCounter — germinação: ajuste de curva e parâmetros (Germinator)
//
// Biblioteca pura: sem React, sem interface, sem dependência. Entra uma
// amostra (contagens acumuladas por tempo), sai a curva de Hill ajustada e
// os parâmetros que a planilha do Germinator (Joosen et al., 2010) devolve.
// Ver hill.ts para o modelo e parametros.ts para cada definição conferida.
// =============================================================================

export { nelderMead } from './otimizador';
export type { FuncaoObjetivo, OpcoesDoOtimizador, ResultadoDoOtimizador } from './otimizador';

export {
  ajustarHill,
  hill,
  derivadaDeHill,
  tempoNaFracaoDeA,
  fracoesObservadas,
  somaDeQuadrados,
  r2DoAjuste,
  cInicial,
} from './hill';
export type {
  LeituraDeGerminacao,
  AmostraDeGerminacao,
  AjusteDeHill,
  OpcoesDoAjuste,
  ResultadoDoAjuste,
} from './hill';

export {
  calcularParametros,
  parametrosDoAjuste,
  gMaxObservado,
  tXRelativoAoMaximo,
  tXRelativoAoTotal,
  uniformidade7525,
  aucDaCurva,
  mgtDaCurva,
  indiceDeDormencia,
  indiceDeEstresse,
} from './parametros';
export type { ConfiguracaoDosParametros, ParametrosDeGerminacao, ResultadoDosParametros } from './parametros';
