// =============================================================================
// SeedCounter — download de arquivo e nome de exportação
//
// POR QUE ESTE MÓDULO EXISTE.
//
// O app tinha seis lugares baixando arquivo, todos com o mesmo par de
// defeitos, e o sintoma era o mesmo em todos: o arquivo chegava com nome de
// UUID e SEM EXTENSÃO, parecendo que a exportação não tinha funcionado.
//
//   1. A âncora era criada e clicada sem nunca entrar no DOM. Âncora destacada
//      faz o navegador ignorar o atributo `download` e cair no nome derivado
//      da blob: URL, que é um UUID.
//
//   2. URL.revokeObjectURL era chamado no MESMO tick do clique. Para arquivo
//      grande — um PDF com imagem embutida, um zip de dataset — isso pode
//      abortar a transferência antes de ela terminar.
//
// Para um app cujo produto final É o arquivo exportado, isso não é detalhe.
// =============================================================================

/**
 * Baixa um conteúdo como arquivo, com o nome pedido.
 *
 * Aceita Blob (PDF, zip, imagem) ou string (CSV, JSON, SQL, TXT).
 */
export function baixarArquivo(conteudo: Blob | string, nome: string, tipoMime?: string): void {
  const blob =
    conteudo instanceof Blob
      ? conteudo
      : new Blob([conteudo], { type: tipoMime ?? 'application/octet-stream' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  a.style.display = 'none';

  // Sem esta linha o navegador ignora o `download` e o arquivo sai com nome
  // de UUID, sem extensão.
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revogar no mesmo tick pode abortar arquivo grande. O atraso é barato e a
  // memória volta logo em seguida.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------
// Nome de exportação
// ---------------------------------------------------------------------------

export interface ContextoDeNome {
  /** Nome do arquivo de imagem em análise. */
  arquivo?: string;
  projeto?: string;
  tratamento?: string;
  placa?: string;
  quadrante?: string;
  /** Sufixo do tipo de saída: 'medidas', 'relatorio', 'dataset'… */
  tipo?: string;
  /** Data ISO; padrão é agora. */
  data?: Date;
}

/**
 * Remove acento, troca separador por hífen e corta o que não é seguro em nome
 * de arquivo. Sem isto, "Cattleya × Laelia (T1)" vira um nome que quebra em
 * Windows e em shell.
 */
export function normalizarParaNome(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Compõe um nome de arquivo rastreável.
 *
 * A ordem é deliberada: projeto, tratamento, placa, quadrante, amostra, tipo,
 * data. Ordenar a pasta por nome agrupa por projeto e depois por tratamento,
 * que é como o pesquisador procura — e não por ordem de exportação, que não
 * significa nada.
 *
 * A data em ISO compacto (AAAAMMDD-HHMM) ordena cronologicamente como texto,
 * ao contrário de DD-MM-AAAA.
 */
export function nomeDeExportacao(ctx: ContextoDeNome, extensao: string): string {
  const d = ctx.data ?? new Date();
  const carimbo =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0');

  const base = (ctx.arquivo ?? '').replace(/\.[^.]+$/, '');

  const identificacao = [
    ctx.projeto,
    ctx.tratamento,
    ctx.placa && `placa-${ctx.placa}`,
    ctx.quadrante && `q-${ctx.quadrante}`,
    base,
    ctx.tipo,
  ]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map(normalizarParaNome)
    .filter((p) => p.length > 0);

  // Sem metadado nenhum, o carimbo sozinho faria o arquivo começar com
  // dígitos e sem dizer de onde veio. O nome do produto entra como piso.
  if (identificacao.length === 0) identificacao.push('seedcounter');

  const ext = extensao.replace(/^\./, '');
  return `${[...identificacao, carimbo].join('_')}.${ext}`;
}
