// =============================================================================
// SeedCounter — as duas ações de relatar
//
// Baixar o arquivo e copiar o resumo. Moram aqui, e não no componente, porque
// o `ErrorBoundary` precisa das mesmas duas ações DEPOIS de a árvore de
// componentes ter ido embora — e porque o painel de configurações e a tela de
// erro têm de produzir exatamente o mesmo arquivo, não dois parecidos.
// =============================================================================

import { baixarArquivo } from '../download';
import {
  montarRelatorio,
  nomeDoArquivoDeRelatorio,
  relatorioComoTexto,
  resumoCurto,
  type ContextoDoRelatorio,
} from './relatorio';
import { registrarEvento } from './trilha';

/**
 * Monta e baixa o `.json`.
 *
 * Devolve o nome do arquivo para a interface poder dizer o que saiu — "baixou"
 * sem nome deixa a pessoa procurando na pasta de downloads.
 */
export function baixarRelatorioDeDiagnostico(contexto: ContextoDoRelatorio = {}): string {
  const data = new Date();
  // O evento entra ANTES de montar, de propósito: assim o próprio relatório
  // registra que foi pedido, e dois relatórios da mesma sessão se distinguem.
  registrarEvento('diagnostico:baixar');
  const relatorio = montarRelatorio(contexto, data);
  const nome = nomeDoArquivoDeRelatorio(data);
  baixarArquivo(relatorioComoTexto(relatorio), nome, 'application/json;charset=utf-8;');
  return nome;
}

/**
 * Copia o resumo curto para a área de transferência.
 *
 * `navigator.clipboard` exige contexto seguro e pode ser negado; quando falha,
 * devolve `null` para a interface mostrar o texto e deixar copiar à mão, em vez
 * de fingir que copiou.
 */
export async function copiarResumoDeDiagnostico(
  contexto: ContextoDoRelatorio = {}
): Promise<string | null> {
  const texto = resumoCurto(montarRelatorio(contexto));
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return null;
    await navigator.clipboard.writeText(texto);
    registrarEvento('diagnostico:copiar-resumo');
    return texto;
  } catch {
    return null;
  }
}
