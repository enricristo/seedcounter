// =============================================================================
// SeedCounter — identificação do laboratório e da amostra
//
// POR QUE ISTO NÃO CABE NO `Metadata` QUE JÁ EXISTE.
//
// O `Metadata` do aplicativo tem `project`, `treatment`, `plate`, `quadrant` —
// campos de PESQUISA. Servem para agrupar repetições de um ensaio e são
// exatamente o que um pesquisador precisa.
//
// O Boletim de Análise de Sementes pede outra coisa. Ele identifica um LOTE
// COMERCIAL: espécie com nome científico, cultivar registrada no RNC, número do
// lote, safra, categoria, quem amostrou e sob qual registro no RENASEM. Nada
// disso é "tratamento" nem "placa".
//
// São dois vocabulários, e forçar um no outro estraga os dois. Por isso a
// identificação normativa entra como estrutura SEPARADA e OPCIONAL: quem usa o
// aplicativo para pesquisa continua sem preencher nada; quem vai emitir laudo
// preenche, e aí o aplicativo sabe conferir se está completo.
//
// A REGRA QUE MOTIVA A CONFERÊNCIA.
//
// A IN 40/2010 proíbe campo em branco e proíbe rasura. Um boletim incompleto
// não é um boletim com lacunas — é um documento que não pode ser emitido. Um
// aplicativo que deixa exportar um PDF pela metade transfere para o analista um
// erro que o software tinha como pegar.
//
// Fundamentação: docs/superpowers/specs/2026-09-08-norma-e-pratica-de-laboratorio.md
// =============================================================================

import type { VersaoDaNorma } from './versao';

/** Categorias de semente do sistema brasileiro de produção. */
export type CategoriaDeSemente = 'basica' | 'C1' | 'C2' | 'S1' | 'S2';

export const CATEGORIAS: Record<CategoriaDeSemente, string> = {
  basica: 'Básica',
  C1: 'C1 — Certificada de primeira geração',
  C2: 'C2 — Certificada de segunda geração',
  S1: 'S1 — Semente de primeira geração',
  S2: 'S2 — Semente de segunda geração',
};

/**
 * O cabeçalho obrigatório do laudo.
 *
 * O RENASEM e a Portaria de credenciamento não são enfeite institucional: são
 * o que torna o documento rastreável até um laboratório habilitado. Sem eles o
 * papel não é um Boletim, é um relatório.
 */
export interface IdentificacaoDoLaboratorio {
  nome: string;
  /** Registro Nacional de Sementes e Mudas. */
  renasem: string;
  /** Data de validade do RENASEM, em ISO. */
  validadeDoRenasem?: string;
  /** Número da Portaria de credenciamento. */
  portariaDeCredenciamento: string;
  endereco: string;
  /** Quem assina. A responsabilidade técnica é de uma pessoa, nunca do software. */
  responsavelTecnico: string;
  crea?: string;
  renasemDoResponsavel?: string;
}

/**
 * A amostra, como o Boletim a identifica.
 *
 * A divisão entre o que o REQUERENTE declara e o que o LABORATÓRIO atribui é a
 * da própria norma, e importa: o laboratório não inventa lote nem safra — ele
 * recebe essa informação e a reproduz. Se estiver errada, a responsabilidade é
 * de quem declarou.
 */
export interface IdentificacaoDaAmostra {
  // --- Declarado pelo requerente ---
  /** Nome comum, em caixa alta no boletim. Ex.: SOJA. */
  especieNomeComum?: string;
  /** Nome científico, em itálico no boletim. Ex.: Glycine max. */
  especieNomeCientifico?: string;
  /** Cultivar conforme o Registro Nacional de Cultivares. */
  cultivar?: string;
  lote?: string;
  /** Quanto o lote representa, em kg. */
  representatividadeKg?: number;
  safra?: string;
  categoria?: CategoriaDeSemente;
  procedencia?: string;
  amostrador?: string;
  renasemDoAmostrador?: string;
  /** Data da amostragem, em ISO. */
  dataDaAmostragem?: string;
  peneira?: string;
  requerente?: string;
  renasemDoRequerente?: string;

  // --- Atribuído pelo laboratório ---
  /** Número da amostra no laboratório. */
  numeroDaAmostra?: string;
  /** Data de recebimento, em ISO. */
  dataDeRecebimento?: string;
}

/**
 * A norma sob a qual cada determinação foi feita.
 *
 * Um boletim pode reunir determinações feitas sob capítulos diferentes — e,
 * como a RAS é viva, sob revisões diferentes do mesmo capítulo se o trabalho
 * atravessou uma atualização. Guardar por determinação, e não por boletim, é o
 * que preserva essa distinção.
 */
export interface MetodoAplicado {
  determinacao: string;
  versao: VersaoDaNorma;
  /**
   * Quando a determinação NÃO tem método na RAS — vigor, ou espécie fora do
   * Quadro 1.5, como orquídea. A IN 40/2010 manda declarar a metodologia no
   * campo "Observações", e este texto é o que vai para lá.
   */
  metodoForaDaNorma?: string;
}

// ---------------------------------------------------------------------------
// Numeração
// ---------------------------------------------------------------------------

/**
 * O número do boletim: sequencial, reiniciado a cada ano, com barra e ano.
 *
 * O reinício anual é da norma, e tem consequência: `0411/2025` e `0411/2026`
 * são documentos diferentes, e o ano não é decoração — é parte da identidade.
 */
export function numeroDoBoletim(sequencial: number, ano: number): string {
  return `${String(sequencial).padStart(4, '0')}/${ano}`;
}

// ---------------------------------------------------------------------------
// Conferência antes de emitir
// ---------------------------------------------------------------------------

export interface Pendencia {
  campo: string;
  /** O que falta, em linguagem de quem preenche. */
  descricao: string;
}

/**
 * O que ainda falta para o boletim poder ser emitido.
 *
 * Devolve a lista, não um booleano: dizer "está incompleto" sem dizer o quê
 * obriga a pessoa a caçar o campo. Lista vazia significa que pode emitir.
 */
export function conferirParaEmissao(
  laboratorio: Partial<IdentificacaoDoLaboratorio> | undefined,
  amostra: IdentificacaoDaAmostra | undefined
): Pendencia[] {
  const faltando: Pendencia[] = [];

  const exigir = (valor: unknown, campo: string, descricao: string) => {
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      faltando.push({ campo, descricao });
    }
  };

  exigir(laboratorio?.nome, 'laboratorio.nome', 'Nome do laboratório');
  exigir(laboratorio?.renasem, 'laboratorio.renasem', 'Número do RENASEM do laboratório');
  exigir(
    laboratorio?.portariaDeCredenciamento,
    'laboratorio.portariaDeCredenciamento',
    'Número da Portaria de credenciamento'
  );
  exigir(laboratorio?.endereco, 'laboratorio.endereco', 'Endereço do laboratório');
  exigir(
    laboratorio?.responsavelTecnico,
    'laboratorio.responsavelTecnico',
    'Responsável Técnico — o laudo é assinado por uma pessoa'
  );

  exigir(amostra?.especieNomeComum, 'amostra.especieNomeComum', 'Nome comum da espécie');
  exigir(
    amostra?.especieNomeCientifico,
    'amostra.especieNomeCientifico',
    'Nome científico da espécie'
  );
  exigir(amostra?.lote, 'amostra.lote', 'Número do lote');
  exigir(amostra?.numeroDaAmostra, 'amostra.numeroDaAmostra', 'Número da amostra no laboratório');
  exigir(amostra?.dataDeRecebimento, 'amostra.dataDeRecebimento', 'Data de recebimento da amostra');

  if (!amostra?.categoria) {
    faltando.push({
      campo: 'amostra.categoria',
      descricao: 'Categoria da semente (Básica, C1, C2, S1 ou S2)',
    });
  }

  return faltando;
}

/**
 * Pode emitir?
 *
 * Atalho sobre `conferirParaEmissao`, para quem só precisa do sim ou não —
 * mas a lista é que deve chegar à pessoa.
 */
export function podeEmitir(
  laboratorio: Partial<IdentificacaoDoLaboratorio> | undefined,
  amostra: IdentificacaoDaAmostra | undefined
): boolean {
  return conferirParaEmissao(laboratorio, amostra).length === 0;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/**
 * A espécie como o boletim a escreve: nome comum em caixa alta, seguido do
 * científico entre parênteses.
 *
 * O itálico do nome científico é do meio de saída — HTML e PDF sabem fazer;
 * texto puro, não. Aqui sai a estrutura, e quem renderiza aplica o estilo.
 */
export function escreverEspecie(a: IdentificacaoDaAmostra): string {
  const comum = a.especieNomeComum?.trim().toUpperCase() ?? '';
  const cientifico = a.especieNomeCientifico?.trim() ?? '';
  if (comum && cientifico) return `${comum} (${cientifico})`;
  return comum || cientifico;
}
