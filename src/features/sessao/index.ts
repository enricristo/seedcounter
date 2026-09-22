// Sessão do histórico: o hook que o App chama e a parte pura que o teste
// exercita. Ver o cabeçalho de cada arquivo.
export { useSessao } from './useSessao';
export type { EntradaDaSessao } from './useSessao';
export {
  montarSessao,
  nomeDaSessao,
  sessaoEstaVazia,
  mensagemDeSessaoSemImagem,
  MENSAGEM_SESSAO_SALVA,
  MENSAGEM_IMAGEM_DA_SESSAO_FALHOU,
} from './sessao';
export type { CenaParaSessao } from './sessao';
