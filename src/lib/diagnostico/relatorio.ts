// =============================================================================
// SeedCounter — o relatório de diagnóstico
//
// O QUE ELE É, E O QUE ELE DELIBERADAMENTE NÃO É.
//
// É um `.json` legível que a pessoa baixa e manda por mensagem. Tem a versão
// exata do código, o navegador, as condições de medição em curso e a trilha
// (`trilha.ts`) — o suficiente para reproduzir um defeito sem interrogatório.
//
// NÃO tem pixel, NÃO tem imagem, NÃO tem dataURL, NÃO tem endereço de e-mail
// nem nome de quem assina a contagem. A regra vem de `trilha.ts` e vale aqui
// inteira: o contexto passado pelo chamador atravessa o MESMO `sanitizar`
// antes de entrar, e não existe caminho que escape disso.
//
// POR QUE SÓ FUNÇÃO PURA AQUI.
//
// Montar e nomear são as duas coisas que precisam estar certas mesmo quando a
// interface já quebrou — o `ErrorBoundary` chama este módulo depois de a tela
// ter ido embora. Elas leem o ambiente por meio de guardas e devolvem objeto;
// baixar o arquivo é trabalho de quem chamou.
// =============================================================================

import { lerErros, lerTrilha, sanitizar, type ErroDaTrilha, type EventoDaTrilha } from './trilha';

/**
 * O contexto que só quem está na tela sabe: as condições da medição em curso.
 *
 * Todos os campos são opcionais porque o relatório também é montado do
 * `ErrorBoundary`, onde não sobrou estado nenhum para perguntar.
 */
export interface ContextoDoRelatorio {
  /** Escala da imagem aberta, em µm/px. */
  umPerPixel?: number;
  /** Nome científico declarado na amostra. */
  especie?: string;
  /** Dimensões da imagem aberta, em pixels. Nunca o conteúdo dela. */
  imagem?: { largura: number; altura: number };
  /** Extensão do arquivo aberto, sem o ponto. Nunca o nome completo. */
  extensaoDaImagem?: string;
  contagem?: { viaveis: number; inviaveis: number; total: number };
  /** Nome da receita em uso, quando há uma. */
  receita?: string;
  /** Quantas bancadas estão abertas, e qual está ativa. */
  bancadas?: { abertas: number; ativa: number };
  /** Espaço para o que a tela achar útil. Passa pelo mesmo filtro. */
  extra?: Record<string, unknown>;
}

export interface AmbienteDoRelatorio {
  userAgent: string;
  idioma: string;
  tela: { largura: number; altura: number; devicePixelRatio: number };
  /** `null` quando o navegador não informa. */
  online: boolean | null;
  /** Memória do aparelho em GB, quando o navegador informa. */
  memoriaGb: number | null;
}

export interface RelatorioDeDiagnostico {
  /** Fixo. Existe para quem receber o arquivo saber o que está lendo. */
  formato: 'seedcounter-diagnostico';
  /** Versão DESTE formato, não do aplicativo. */
  versaoDoFormato: 1;
  aplicativo: { versao: string; commit: string; compiladoEm: string };
  geradoEm: string;
  ambiente: AmbienteDoRelatorio;
  contexto: Record<string, unknown>;
  eventos: EventoDaTrilha[];
  erros: ErroDaTrilha[];
  /** A promessa, escrita dentro do próprio arquivo. */
  privacidade: string;
}

const PRIVACIDADE =
  'Este arquivo não contém imagem, pixel, dataURL, nome de arquivo do seu computador ' +
  'nem dado pessoal. Só versão do programa, navegador, condições de medição e a ' +
  'sequência de ações desta sessão.';

/**
 * Lê a identidade do build.
 *
 * As três constantes são injetadas pelo Vite (ver `define` em vite.config.ts) e
 * NÃO existem sob o vitest, que compila sem essa etapa. O `typeof` é o que
 * permite testar este módulo sem simular o empacotador.
 */
function identidadeDoBuild(): { versao: string; commit: string; compiladoEm: string } {
  const ler = (f: () => string): string => {
    try {
      return f();
    } catch {
      return 'desconhecido';
    }
  };
  return {
    versao: ler(() => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'desconhecida')),
    commit: ler(() => (typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'desconhecido')),
    compiladoEm: ler(() => (typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : 'desconhecido')),
  };
}

/**
 * O que o navegador conta sobre si.
 *
 * Cada leitura tem guarda própria: um navegador antigo pode não ter
 * `deviceMemory`, e o mesmo módulo roda em node durante os testes, onde
 * `screen` não existe. Um diagnóstico que quebra ao ser montado seria a pior
 * ironia possível.
 */
export function lerAmbiente(): AmbienteDoRelatorio {
  const nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined;

  // `deviceMemory` não está na tipagem padrão do DOM: é proposta só de alguns
  // navegadores. A leitura é indireta para não precisar de `any`.
  let memoriaGb: number | null = null;
  if (nav) {
    const bruto = (nav as unknown as Record<string, unknown>).deviceMemory;
    if (typeof bruto === 'number' && Number.isFinite(bruto)) memoriaGb = bruto;
  }

  let tela = { largura: 0, altura: 0, devicePixelRatio: 1 };
  try {
    if (typeof window !== 'undefined' && typeof screen !== 'undefined') {
      tela = {
        largura: screen.width,
        altura: screen.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      };
    }
  } catch {
    // Ambiente sem tela. Fica nos zeros.
  }

  return {
    userAgent: nav?.userAgent ?? 'desconhecido',
    idioma: nav?.language ?? 'desconhecido',
    tela,
    online: nav && typeof nav.onLine === 'boolean' ? nav.onLine : null,
    memoriaGb,
  };
}

/**
 * Monta o relatório.
 *
 * O contexto entra por `sanitizar`, e não por cópia direta, porque é dele que
 * viria um vazamento: basta alguém, um dia, resolver passar `imagem.src` no
 * `extra` para uma dataURL de 40 MB tentar entrar aqui.
 */
export function montarRelatorio(
  contexto: ContextoDoRelatorio = {},
  data: Date = new Date()
): RelatorioDeDiagnostico {
  return {
    formato: 'seedcounter-diagnostico',
    versaoDoFormato: 1,
    aplicativo: identidadeDoBuild(),
    geradoEm: data.toISOString(),
    ambiente: lerAmbiente(),
    contexto: sanitizar(contexto as unknown as Record<string, unknown>),
    eventos: lerTrilha(),
    erros: lerErros(),
    privacidade: PRIVACIDADE,
  };
}

/**
 * O nome do arquivo baixado.
 *
 * ISO com os dois-pontos trocados por hífen: Windows recusa `:` em nome de
 * arquivo, e a ordem cronológica como texto se mantém — que é o que serve a
 * quem vai receber vinte destes numa pasta.
 */
export function nomeDoArquivoDeRelatorio(data: Date = new Date()): string {
  const carimbo = data.toISOString().slice(0, 19).replace(/:/g, '-');
  return `seedcounter-diagnostico-${carimbo}.json`;
}

/**
 * O resumo de uma tela, para quem vai relatar por mensagem em vez de anexar
 * arquivo — que é a maioria.
 *
 * Três erros é o teto por um motivo prático: acima disso ninguém cola, e o
 * primeiro erro costuma ser a causa dos outros.
 */
export function resumoCurto(relatorio: RelatorioDeDiagnostico, quantosErros = 3): string {
  const linhas: string[] = [
    `SeedCounter v${relatorio.aplicativo.versao} (${relatorio.aplicativo.commit})`,
    `Quando: ${relatorio.geradoEm}`,
    `Navegador: ${relatorio.ambiente.userAgent}`,
    `Tela: ${relatorio.ambiente.tela.largura}x${relatorio.ambiente.tela.altura} @${relatorio.ambiente.tela.devicePixelRatio}x`,
  ];

  const ultimos = relatorio.erros.slice(-quantosErros);
  if (ultimos.length === 0) {
    linhas.push('Erros: nenhum registrado nesta sessão.');
  } else {
    linhas.push(`Últimos ${ultimos.length} erro(s):`);
    for (const e of ultimos) {
      linhas.push(`  [${e.origem} @${e.t}ms] ${e.mensagem}`);
    }
  }

  const ultimoEvento = relatorio.eventos[relatorio.eventos.length - 1];
  if (ultimoEvento) linhas.push(`Última ação registrada: ${ultimoEvento.tipo}`);

  return linhas.join('\n');
}

/** O conteúdo do arquivo. Indentado porque é para humano ler, não só máquina. */
export function relatorioComoTexto(relatorio: RelatorioDeDiagnostico): string {
  return JSON.stringify(relatorio, null, 2);
}
