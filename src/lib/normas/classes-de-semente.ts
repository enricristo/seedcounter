// =============================================================================
// SeedCounter — as classes que o teste de germinação produz
//
// POR QUE VIÁVEL/INVIÁVEL NÃO BASTA.
//
// O aplicativo nasceu com duas classes, e para orquídea elas servem. Para
// forrageira, não: uma semente que não germinou pode ser **dormente, dura,
// vazia ou morta**, e as quatro significam coisas diferentes para quem compra o
// lote. Dormente germina depois; morta não germina nunca; dura precisa de
// escarificação; vazia nem semente é.
//
// A REGRA QUE MUDA O NÚMERO, E NÃO SÓ O RÓTULO.
//
// A RAS é explícita: em pureza, "unidade de dispersão na qual for óbvio que não
// contenha a semente" é **material inerte**. Ou seja, a espigueta vazia de uma
// forrageira NÃO É SEMENTE — ela sai do denominador.
//
// Contar 400 espiguetas, das quais 80 são vazias, e declarar germinação sobre
// 400 dá um número menor que a verdade. O denominador é 320. Isto não é
// detalhe: numa forrageira com muita espigueta vazia, a diferença entre os dois
// denominadores é a diferença entre reprovar e aprovar o lote.
//
// DORMÊNCIA É RESULTADO, NÃO RUÍDO.
//
// A RAS obriga: **dormentes ≥ 5% pedem confirmação de viabilidade por
// tetrazólio**, com o método declarado em Observações. O aplicativo precisa
// saber disparar isso sozinho, porque é justamente o caso em que a germinação
// sozinha subestima o lote.
// =============================================================================

/** O que uma semente pode ser ao fim do teste de germinação. */
export type ClasseDeSemente =
  | 'normal'
  | 'anormal'
  | 'dura'
  | 'dormente'
  | 'morta'
  /** Unidade de dispersão sem semente dentro. NÃO é semente. */
  | 'vazia';

export interface DescricaoDaClasse {
  rotulo: string;
  /** O que ela significa, em uma frase. */
  explicacao: string;
  /** Entra no denominador da porcentagem de germinação? */
  ehSemente: boolean;
  /** Conta como germinada? */
  germinou: boolean;
}

export const CLASSES: Record<ClasseDeSemente, DescricaoDaClasse> = {
  normal: {
    rotulo: 'Plântula normal',
    explicacao: 'Germinou e formou plântula com todas as estruturas essenciais.',
    ehSemente: true,
    germinou: true,
  },
  anormal: {
    rotulo: 'Plântula anormal',
    explicacao: 'Germinou, mas a plântula não tem estruturas essenciais íntegras.',
    ehSemente: true,
    germinou: false,
  },
  dura: {
    rotulo: 'Dura',
    explicacao: 'Não absorveu água — tegumento impermeável. Pode germinar após escarificação.',
    ehSemente: true,
    germinou: false,
  },
  dormente: {
    rotulo: 'Dormente',
    explicacao: 'Absorveu água e continua firme, sem germinar. Viva, mas dormente.',
    ehSemente: true,
    germinou: false,
  },
  morta: {
    rotulo: 'Morta',
    explicacao: 'Amolecida ou deteriorada ao fim do teste.',
    ehSemente: true,
    germinou: false,
  },
  vazia: {
    rotulo: 'Vazia (inerte)',
    explicacao:
      'Unidade de dispersão sem semente dentro. A RAS a classifica como material inerte — ' +
      'ela sai do denominador da germinação.',
    ehSemente: false,
    germinou: false,
  },
};

/** As classes que o protocolo de uma espécie usa. */
export interface Protocolo {
  chave: string;
  nome: string;
  classes: ClasseDeSemente[];
  /**
   * Fração de dormentes acima da qual a RAS pede confirmação por tetrazólio.
   * `null` quando o protocolo não prevê dormência.
   */
  limiarDeTetrazolio: number | null;
  /** Escarificação faz parte do protocolo desta espécie? */
  admiteEscarificacao: boolean;
}

export const LIMIAR_DE_DORMENCIA = 5;

export const PROTOCOLOS: Record<string, Protocolo> = {
  /**
   * O protocolo simples — o que o aplicativo sempre fez.
   *
   * Continua existindo porque para orquídea ele é o certo: ali não há
   * espigueta, não há dormência tegumentar, e a leitura é viável/inviável.
   */
  simples: {
    chave: 'simples',
    nome: 'Viável / inviável',
    classes: ['normal', 'morta'],
    limiarDeTetrazolio: null,
    admiteEscarificacao: false,
  },

  germinacao: {
    chave: 'germinacao',
    nome: 'Germinação (Cap. 4)',
    classes: ['normal', 'anormal', 'dura', 'dormente', 'morta'],
    limiarDeTetrazolio: LIMIAR_DE_DORMENCIA,
    admiteEscarificacao: false,
  },

  /**
   * Forrageira: germinação mais a espigueta vazia.
   *
   * É a única em que uma classe SAI do denominador, e é por isso que ela existe
   * separada em vez de ser a de germinação com uma classe a mais.
   */
  forrageira: {
    chave: 'forrageira',
    nome: 'Forrageira (com espigueta vazia)',
    classes: ['normal', 'anormal', 'dura', 'dormente', 'morta', 'vazia'],
    limiarDeTetrazolio: LIMIAR_DE_DORMENCIA,
    admiteEscarificacao: true,
  },
};

export type Contagens = Partial<Record<ClasseDeSemente, number>>;

export interface Consolidacao {
  /** Quantas unidades foram examinadas, incluindo as vazias. */
  unidadesExaminadas: number;
  /**
   * O denominador da porcentagem: unidades que SÃO semente.
   *
   * É onde mora a diferença que a norma impõe. Contar sobre as unidades
   * examinadas subestimaria a germinação de uma forrageira com muita espigueta
   * vazia.
   */
  denominador: number;
  /** Porcentagens por classe, sobre o denominador. */
  porcentagens: Partial<Record<ClasseDeSemente, number>>;
  /** Germinação declarada: só plântulas normais. */
  germinacao: number;
  /** Avisos que a interface precisa mostrar. */
  avisos: AvisoDeProtocolo[];
}

export interface AvisoDeProtocolo {
  tipo: 'tetrazolio-obrigatorio' | 'inerte-fora-do-denominador' | 'sem-semente';
  texto: string;
  /** O que registrar em Observações do boletim. Vazio quando não é caso disso. */
  textoParaObservacoes: string;
}

// ---------------------------------------------------------------------------

/**
 * Consolida as contagens em porcentagens, aplicando as regras do protocolo.
 *
 * A porcentagem é sempre sobre o DENOMINADOR (unidades que são semente), nunca
 * sobre o total examinado.
 */
export function consolidar(contagens: Contagens, protocolo: Protocolo): Consolidacao {
  const avisos: AvisoDeProtocolo[] = [];

  let unidadesExaminadas = 0;
  let denominador = 0;

  for (const classe of protocolo.classes) {
    const n = contagens[classe] ?? 0;
    if (!Number.isFinite(n) || n < 0) continue;
    unidadesExaminadas += n;
    if (CLASSES[classe].ehSemente) denominador += n;
  }

  const vazias = contagens.vazia ?? 0;
  if (vazias > 0 && protocolo.classes.includes('vazia')) {
    const fracao = unidadesExaminadas > 0 ? (vazias / unidadesExaminadas) * 100 : 0;
    avisos.push({
      tipo: 'inerte-fora-do-denominador',
      texto:
        `${vazias} unidades vazias (${virgula(fracao)}% do examinado) saíram do denominador. ` +
        `A porcentagem é calculada sobre ${denominador} sementes, não sobre ${unidadesExaminadas} unidades.`,
      textoParaObservacoes:
        `${vazias} unidades de dispersão vazias classificadas como material inerte ` +
        '(RAS, Cap. 2), excluídas do cálculo da germinação.',
    });
  }

  if (denominador <= 0) {
    return {
      unidadesExaminadas,
      denominador: 0,
      porcentagens: {},
      germinacao: 0,
      avisos: [
        ...avisos,
        {
          tipo: 'sem-semente',
          texto: 'Nenhuma semente no material examinado — não há porcentagem a calcular.',
          textoParaObservacoes: '',
        },
      ],
    };
  }

  const porcentagens: Partial<Record<ClasseDeSemente, number>> = {};
  for (const classe of protocolo.classes) {
    if (!CLASSES[classe].ehSemente) continue;
    porcentagens[classe] = ((contagens[classe] ?? 0) / denominador) * 100;
  }

  const germinacao = porcentagens.normal ?? 0;
  const dormentes = porcentagens.dormente ?? 0;

  if (protocolo.limiarDeTetrazolio !== null && dormentes >= protocolo.limiarDeTetrazolio) {
    avisos.push({
      tipo: 'tetrazolio-obrigatorio',
      texto:
        `${virgula(dormentes)}% de sementes dormentes, no limiar de ${protocolo.limiarDeTetrazolio}% ou acima. ` +
        'A RAS pede confirmação da viabilidade por tetrazólio.',
      textoParaObservacoes:
        `Sementes dormentes: ${virgula(dormentes)}%. Viabilidade confirmada por teste de ` +
        'tetrazólio, conforme exigido para dormência igual ou superior a ' +
        `${protocolo.limiarDeTetrazolio}%.`,
    });
  }

  return { unidadesExaminadas, denominador, porcentagens, germinacao, avisos };
}

/** O tetrazólio é obrigatório para estas contagens? */
export function exigeTetrazolio(contagens: Contagens, protocolo: Protocolo): boolean {
  return consolidar(contagens, protocolo).avisos.some(
    (a) => a.tipo === 'tetrazolio-obrigatorio'
  );
}

function virgula(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

// ---------------------------------------------------------------------------
// Escarificação
// ---------------------------------------------------------------------------

export type MetodoDeEscarificacao = 'nenhuma' | 'acido-sulfurico' | 'mecanica' | 'agua-quente';

export const ESCARIFICACAO: Record<MetodoDeEscarificacao, string> = {
  nenhuma: 'Sem escarificação',
  'acido-sulfurico': 'Ácido sulfúrico',
  mecanica: 'Mecânica (lixa)',
  'agua-quente': 'Água quente',
};

export interface RegistroDeEscarificacao {
  metodo: MetodoDeEscarificacao;
  /** Duração da exposição, em minutos. */
  duracaoMin?: number;
  observacao?: string;
}

/**
 * O texto de Observações para a escarificação.
 *
 * Precisa constar do boletim porque **muda o que está sendo medido**: um lote
 * escarificado teve a dormência tegumentar superada artificialmente, e a
 * germinação declarada não é a mesma que o comprador obteria semeando o lote
 * como recebeu.
 */
export function descreverEscarificacao(r: RegistroDeEscarificacao | undefined): string {
  if (!r || r.metodo === 'nenhuma') return '';
  const duracao = r.duracaoMin ? `, ${virgula(r.duracaoMin)} min` : '';
  const extra = r.observacao?.trim() ? ` ${r.observacao.trim()}` : '';
  return `Superação de dormência por escarificação: ${ESCARIFICACAO[r.metodo]}${duracao}.${extra}`;
}
