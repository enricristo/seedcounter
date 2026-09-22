// Importar JSON: o hook que o App chama e a parte pura que o teste exercita.
// Ver o cabeçalho de cada arquivo.
export { useImportacao } from './useImportacao';
export type { EntradaDaImportacao } from './useImportacao';
export {
  classificarJSON,
  interpretarJSON,
  segmentacoesDeJSON,
  backupDeJSON,
  sessaoDeJSON,
  mensagemDeImportacao,
  ehErro,
} from './importar';
export type {
  TipoDeJSON,
  ErroDeImportacao,
  SessaoImportada,
  ResultadoDaImportacao,
} from './importar';
