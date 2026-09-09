// =============================================================================
// SeedCounter — a versão da norma aplicada
//
// POR QUE A NORMA É DADO, E NÃO CONSTANTE NO CÓDIGO.
//
// A RAS 2009 está revogada. A edição de 2025 mudou de NATUREZA: publicação
// exclusivamente digital, na plataforma Wikisda do MAPA, em **15 capítulos
// independentes, cada um com número de revisão próprio e histórico datado**.
// Não existe mais "o livro da RAS".
//
// E ela se move. O Cap. 5 (Tetrazólio) foi revisado duas vezes só em 2025; o
// Quadro 1.5 está na revisão 1.6, de abril de 2026.
//
// A consequência é direta: dois laudos emitidos sob revisões diferentes do
// mesmo capítulo **podem não ser comparáveis**, e quem lê precisa saber sob
// qual regra cada número foi produzido. Guardar "RAS 2025" no laudo não
// responde isso; guardar capítulo, revisão e data responde.
//
// O mesmo vale para a ISTA, cujas Rules mudam todo 1º de janeiro — as de 2026
// alteraram o número mínimo de sementes do teste de viabilidade e criaram uma
// seção de arredondamento que não existia.
//
// Fundamentação: docs/superpowers/specs/2026-09-08-norma-e-pratica-de-laboratorio.md
// =============================================================================

export type Norma = 'RAS' | 'ISTA';

export interface VersaoDaNorma {
  norma: Norma;
  /** Ano da edição: '2025' para a RAS vigente, '2026' para as ISTA Rules. */
  edicao: string;
  /** Número do capítulo, como a norma o nomeia. */
  capitulo: string;
  /** Título do capítulo, para o laudo não exigir que o leitor decore números. */
  titulo: string;
  /** Revisão do capítulo. A RAS numera cada um separadamente. */
  revisao: string;
  /** Data da revisão, em ISO. Ausente quando não foi confirmada. */
  data?: string;
}

/**
 * Os capítulos da RAS 2025, com as revisões observadas no Wikisda.
 *
 * ATENÇÃO: esta tabela é uma FOTOGRAFIA, tirada em 2026-09-08. Ela envelhece
 * sozinha, porque a norma é viva. Serve para preencher o padrão e para o
 * aplicativo saber dizer "a revisão que conheço é a 1.2" — nunca para afirmar
 * que é a vigente. Quem emite laudo tem de conferir no Wikisda.
 */
export const CAPITULOS_RAS_2025: Record<string, VersaoDaNorma> = {
  '1': v('1', 'Amostragem', '1.4'),
  '2': v('2', 'Análise de Pureza', '1.3'),
  '3': v('3', 'Determinação de Outras Sementes por Número', '1.3'),
  '4': v('4', 'Teste de Germinação', '1.5'),
  '5': v('5', 'Teste de Tetrazólio', '1.2', '2025-12-01'),
  '6': v('6', 'Exame de Sementes Infestadas', '1'),
  '7': v('7', 'Verificação de Outras Cultivares', '1'),
  '8': v('8', 'Análise de Sementes Revestidas', '1.3'),
  '9': v('9', 'Peso de Mil Sementes', '1.4'),
  '10': v('10', 'Análise de Mistura de Sementes', '1.4'),
  '11': v('11', 'Teste de Raios X', '1', '2025-03-28'),
  '12': v('12', 'Teste de Sementes por Repetições Pesadas', '1.3'),
  '13': v('13', 'Determinação do Grau de Umidade', '1'),
  '14': v('14', 'Análise de Sementes de Espécies Florestais', '1.1'),
  '15': v('15', 'Tabelas de Tolerância para Uso da Fiscalização', '1.1'),
};

function v(capitulo: string, titulo: string, revisao: string, data?: string): VersaoDaNorma {
  return { norma: 'RAS', edicao: '2025', capitulo, titulo, revisao, data };
}

/** Data em que a RAS 2025 entrou em vigor. */
export const RAS_2025_EM_VIGOR_DESDE = '2025-06-26';

/**
 * O endereço da norma, para o laudo poder apontar a fonte.
 *
 * O Wikisda organiza por capítulo, então quem conferir chega no texto exato —
 * e não numa página inicial que exige procurar.
 */
export const RAS_2025_BASE =
  'https://wikisda.agricultura.gov.br/pt-br/Laboratórios/Metodologia/Sementes/RAS_2025/';

/**
 * O número da portaria que instituiu a RAS 2025 NÃO FOI LOCALIZADO no
 * levantamento. Fica registrado como pendência explícita para que ninguém o
 * invente ao redigir um laudo — o caminho é confirmar com a CGAL.
 */
export const PORTARIA_DA_RAS_2025_NAO_CONFIRMADA = true;

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/**
 * Como a versão aparece no laudo.
 *
 * Ex.: "RAS 2025, Cap. 5 — Teste de Tetrazólio, rev. 1.2 (01/12/2025)"
 */
export function descrever(versao: VersaoDaNorma): string {
  const base = `${versao.norma} ${versao.edicao}, Cap. ${versao.capitulo} — ${versao.titulo}, rev. ${versao.revisao}`;
  if (!versao.data) return base;
  const [ano, mes, dia] = versao.data.split('-');
  return `${base} (${dia}/${mes}/${ano})`;
}

/** Forma curta, para tabela e rodapé. Ex.: "RAS 2025 5 rev. 1.2". */
export function descreverCurto(versao: VersaoDaNorma): string {
  return `${versao.norma} ${versao.edicao} ${versao.capitulo} rev. ${versao.revisao}`;
}

/** A versão que o aplicativo conhece para aquele capítulo da RAS. */
export function capituloDaRas(numero: string): VersaoDaNorma | undefined {
  return CAPITULOS_RAS_2025[numero];
}

/**
 * Duas medidas são comparáveis sob o mesmo método?
 *
 * Só quando norma, edição, capítulo E revisão coincidem. Comparar germinações
 * sob revisões diferentes do Cap. 4 é o tipo de erro que não aparece no número
 * e aparece na conclusão.
 */
export function mesmaVersao(a: VersaoDaNorma, b: VersaoDaNorma): boolean {
  return (
    a.norma === b.norma &&
    a.edicao === b.edicao &&
    a.capitulo === b.capitulo &&
    a.revisao === b.revisao
  );
}
