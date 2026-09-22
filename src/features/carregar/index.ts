// Carregar imagem com cena aberta: decisão (puro), continuidade (puro) e o
// diálogo que junta as duas. Ver o cabeçalho de cada arquivo.
export { decidirAoCarregar, haTrabalhoNaoSalvo, cenaOcupada } from './decisao';
export type { EstadoParaDecidir, DecisaoAoCarregar, EscolhaAoCarregar } from './decisao';
export {
  proporContinuidade,
  aplicarContinuidade,
  listarMudancas,
  acharTratamento,
  ROTULO_DO_CAMPO,
} from './continuidade';
export type {
  Continuidade,
  PropostaDeContinuidade,
  TipoDeContinuidade,
  CampoDeContinuidade,
  CenaAtual,
  MudancaProposta,
} from './continuidade';
export { DialogoDeCarregar } from './DialogoDeCarregar';
export type { ConfirmacaoDeCarregar } from './DialogoDeCarregar';
