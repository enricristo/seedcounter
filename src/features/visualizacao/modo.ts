// =============================================================================
// SeedCounter — modos de visualização (o módulo puro)
//
// POR QUE ISTO EXISTE.
//
// Até 20/09 a "interface limpa" de apresentação era um `?mode=enterprise` lido
// por `Header.tsx` e por `Sidebar.tsx`, cada um por conta própria, com
// `window.location.search.includes(...)`. Funcionava para gravar vídeo, mas
// não era estado: não mudava sem recarregar, não persistia, e não tinha como
// virar a barra de menu (Arquivo, Editar, Exibir...) que vem na sequência.
//
// Este módulo é a TABELA por trás dessa barra: quais partes da interface cada
// modo mostra. Ele não sabe de React, de URL viva nem de localStorage — só
// decide. Quem lê o ambiente é `useModoDeVisualizacao.ts`; quem desenha é
// `MenuExibir.tsx`.
//
// O QUE É "PARTE".
//
// Só o que a interface de fato tem hoje e um modo de fato esconde. Não há
// booleano especulativo: cada chave abaixo é lida por um componente real
// (`Header`, `Sidebar`, `RightSidebar`, ou `App` para o rodapé). Quando a
// barra de menu crescer, a tabela cresce junto — mas sempre com uma chave por
// coisa visível, nunca por "feature".
//
// O QUE O MODO ESCONDE TAMBÉM NÃO CUSTA.
//
// `ensaioAoCarregar` é o primeiro caso de uma parte que não é um painel, e
// sim um TRABALHO: as três receitas que rodam sobre cada imagem que chega
// (`App.tsx`, `onImageLoaded`). Numa digitalização grande são segundos de
// processamento na thread principal — e o modo "contagem" não mostra os
// cartões do ensaio a ninguém, então não há motivo para computá-los.
// Esconder uma parte tem que valer para o custo dela, não só para o pixel;
// senão o modo "leve" só parece leve. A regra fica escrita aqui porque é
// aqui que a próxima pessoa vai procurar quando outra parte cara aparecer.
//
// 'apresentacao' É O ANTIGO `?mode=enterprise`, E NÃO PODE MUDAR DE CARA.
//
// É o modo usado para gravar vídeo agora. O teste em `__tests__/modo.test.ts`
// fixa exatamente o que ele esconde; quem quiser um modo de apresentação
// diferente cria outro, não altera este.
// =============================================================================

export type ModoDeVisualizacao = 'completo' | 'contagem' | 'laudo' | 'apresentacao';

/** Os quatro modos, na ordem em que aparecem no menu. */
export const MODOS: readonly ModoDeVisualizacao[] = ['completo', 'contagem', 'laudo', 'apresentacao'];

/**
 * O que cada parte da interface responde a um modo. `true` = visível.
 *
 * Os nomes são os da tela, não os dos componentes: "abas de navegação", não
 * `<nav>`; "identificar amostra", não `MetadataForm`. É o vocabulário que o
 * menu "Exibir" mostra para a pessoa, e o mesmo que o código lê.
 */
export interface Visibilidade {
  // --- Cabeçalho, linha 1 ---
  /** Contagem · Longitudinal · Estatísticas. */
  abasDeNavegacao: boolean;
  /**
   * A aba Germinação (curva de Hill, parâmetros do Germinator, Tukey). É
   * ciência de laboratório: o analista comercial que só conta não a vê, e a
   * apresentação também não — o modo de gravar vídeo não pode ganhar uma aba
   * que não existia quando o roteiro foi escrito.
   */
  germinacao: boolean;
  /** O selo ao lado da marca (hoje diz "Analytics"; só a apresentação o mostra). */
  seloDoModo: boolean;
  /** O chip "Espécie: ..." (C7). */
  chipDeEspecie: boolean;
  /** O seletor de bancadas (C2). */
  seletorDeBancadas: boolean;
  /** O frasco: painel de funcionalidades e recursos experimentais. */
  botaoDeRecursos: boolean;

  // --- Cabeçalho, linha 2 ---
  /** A linha inteira de ações da vista (histórico, desfazer, fila, salvar, exportar). */
  barraDeAcoes: boolean;
  /** Importar · Salvar local · Exportar, dentro da barra de ações. */
  botoesDeExportacao: boolean;

  // --- Lateral esquerda: entrada e preparo ---
  lateralEsquerda: boolean;
  /** A caixa "Exemplos" (simulados e reais). */
  exemplos: boolean;
  /** Etapa "Calibrar escala". */
  calibrarEscala: boolean;
  /** Etapa "Encontrar objetos" (IA e assistida). */
  encontrarObjetos: boolean;
  /** Etapa "Preparar imagem" (ajustes). */
  prepararImagem: boolean;
  /** Etapa "Identificar amostra" (metadados e modo diferencial). */
  identificarAmostra: boolean;

  // --- Lateral direita: resultados ---
  lateralDireita: boolean;
  /** Biometria populacional, distribuição e regras semi-automáticas, na aba Resultados. */
  morfometria: boolean;
  /**
   * As receitas que rodam ao abrir uma imagem, com os cartões na aba
   * Inspetor. É trabalho, não painel — ver o cabeçalho do arquivo. Continua
   * atrás da flag `ensaioAoCarregar`: o modo só pode DESLIGAR o que a flag
   * ligou, nunca ligar o que ela mantém desligado.
   */
  ensaioAoCarregar: boolean;

  // --- Rodapé ---
  rodape: boolean;
}

export type ParteDaInterface = keyof Visibilidade;

/** Todas as partes, na ordem do menu (cabeçalho → esquerda → direita → rodapé). */
export const PARTES: readonly ParteDaInterface[] = [
  'abasDeNavegacao',
  'germinacao',
  'seloDoModo',
  'chipDeEspecie',
  'seletorDeBancadas',
  'botaoDeRecursos',
  'barraDeAcoes',
  'botoesDeExportacao',
  'lateralEsquerda',
  'exemplos',
  'calibrarEscala',
  'encontrarObjetos',
  'prepararImagem',
  'identificarAmostra',
  'lateralDireita',
  'morfometria',
  'ensaioAoCarregar',
  'rodape',
];

/** Rótulo de cada parte, para o menu. Em minúsculas: é item de lista, não título. */
export const ROTULO_DA_PARTE: Record<ParteDaInterface, string> = {
  abasDeNavegacao: 'Abas de navegação',
  germinacao: 'Aba Germinação',
  seloDoModo: 'Selo do modo',
  chipDeEspecie: 'Chip de espécie',
  seletorDeBancadas: 'Seletor de bancadas',
  botaoDeRecursos: 'Botão de recursos',
  barraDeAcoes: 'Barra de ações',
  botoesDeExportacao: 'Importar, salvar e exportar',
  lateralEsquerda: 'Painel esquerdo',
  exemplos: 'Exemplos',
  calibrarEscala: 'Calibrar escala',
  encontrarObjetos: 'Encontrar objetos',
  prepararImagem: 'Preparar imagem',
  identificarAmostra: 'Identificar amostra',
  lateralDireita: 'Painel direito',
  morfometria: 'Morfometria',
  ensaioAoCarregar: 'Ensaio ao carregar a imagem',
  rodape: 'Rodapé',
};

/** Tudo visível — o ponto de partida de todos os modos. */
const TUDO: Visibilidade = {
  abasDeNavegacao: true,
  germinacao: true,
  seloDoModo: false, // o selo é a exceção: só existe para dizer "isto é apresentação"
  chipDeEspecie: true,
  seletorDeBancadas: true,
  botaoDeRecursos: true,
  barraDeAcoes: true,
  botoesDeExportacao: true,
  lateralEsquerda: true,
  exemplos: true,
  calibrarEscala: true,
  encontrarObjetos: true,
  prepararImagem: true,
  identificarAmostra: true,
  lateralDireita: true,
  morfometria: true,
  ensaioAoCarregar: true,
  rodape: true,
};

/**
 * A tabela modo → visibilidade.
 *
 * Cada modo é descrito como um DESVIO do completo, para que o diff entre dois
 * modos seja legível aqui, sem precisar comparar dezessete booleanos.
 */
export function visibilidadePadrao(modo: ModoDeVisualizacao): Visibilidade {
  switch (modo) {
    case 'completo':
      return { ...TUDO };

    case 'contagem':
      // Só o que serve para contar: a imagem, o que encontra objetos, e os
      // totais. Calibração, morfometria e metadados são etapas de laudo, não
      // de contagem — ficam a um clique no menu, não na frente. O ensaio sai
      // pelo custo: contar não precisa de três receitas por imagem.
      return {
        ...TUDO,
        germinacao: false,
        botaoDeRecursos: false,
        exemplos: false,
        calibrarEscala: false,
        prepararImagem: false,
        identificarAmostra: false,
        morfometria: false,
        ensaioAoCarregar: false,
      };

    case 'laudo':
      // O oposto: metadados, morfometria e exportação em evidência. O que sai
      // é o que distrai de um laudo — exemplos de demonstração e o painel de
      // recursos experimentais.
      return {
        ...TUDO,
        botaoDeRecursos: false,
        exemplos: false,
      };

    case 'apresentacao':
      // EXATAMENTE o que `?mode=enterprise` escondia em 20/09/2026:
      //   Header  — abas de navegação e o botão de recursos; mostra o selo.
      //   Sidebar — "Preparar imagem" e "Identificar amostra" (seções e trilho).
      // Nada mais. Ver o cabeçalho deste arquivo sobre por que não muda.
      // A aba Germinação (21/09) nasceu depois e fica fora por construção:
      // as abas de navegação já estão escondidas, e ela mora entre elas.
      return {
        ...TUDO,
        abasDeNavegacao: false,
        germinacao: false,
        seloDoModo: true,
        botaoDeRecursos: false,
        prepararImagem: false,
        identificarAmostra: false,
      };
  }
}

export function ehModoDeVisualizacao(valor: unknown): valor is ModoDeVisualizacao {
  return typeof valor === 'string' && (MODOS as readonly string[]).includes(valor);
}

/**
 * Lê o modo pedido na URL.
 *
 * `?modo=apresentacao` é a forma nova. `?mode=enterprise` é a antiga, e
 * continua valendo porque há links gravados em roteiro de vídeo com ela —
 * quebrar um link que alguém colou num documento é o tipo de regressão que
 * só se descobre na hora errada. Qualquer outra coisa (ausência, valor
 * inválido) devolve null: "não pediu nada", que é diferente de "pediu
 * completo".
 */
export function lerModoDaUrl(search: string): ModoDeVisualizacao | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const novo = params.get('modo');
  if (ehModoDeVisualizacao(novo)) return novo;

  if (params.get('mode') === 'enterprise') return 'apresentacao';

  return null;
}

/**
 * Sobrescritas individuais, como ficam gravadas (JSON de `Partial<Visibilidade>`).
 *
 * Aceita só chaves conhecidas com valor booleano. Um JSON corrompido, de outra
 * versão, ou com lixo devolve `{}` — a pessoa perde as sobrescritas, não o
 * aplicativo. Nunca lança.
 */
export function lerSobrescritas(texto: string | null | undefined): Partial<Visibilidade> {
  if (!texto) return {};
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return {};
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return {};

  const resultado: Partial<Visibilidade> = {};
  for (const parte of PARTES) {
    const valor = (bruto as Record<string, unknown>)[parte];
    if (typeof valor === 'boolean') resultado[parte] = valor;
  }
  return resultado;
}

/** O inverso de `lerSobrescritas`, para gravar. */
export function serializarSobrescritas(sobrescritas: Partial<Visibilidade>): string {
  return JSON.stringify(sobrescritas);
}

/**
 * A visibilidade efetiva: o padrão do modo com as sobrescritas por cima.
 *
 * É assim que "ligar e desligar tal coisa" convive com os modos: a pessoa
 * escolhe um modo e, dentro dele, liga um painel que ele esconde (ou esconde
 * um que ele mostra). Trocar de modo zera as sobrescritas — elas são relativas
 * ao modo, e uma sobrescrita de "contagem" não faz sentido em "laudo".
 */
export function visibilidadeEfetiva(
  modo: ModoDeVisualizacao,
  sobrescritas: Partial<Visibilidade>
): Visibilidade {
  return { ...visibilidadePadrao(modo), ...sobrescritas };
}

/**
 * Devolve as sobrescritas depois de alternar uma parte. Se o resultado coincide
 * com o padrão do modo, a chave SAI do mapa em vez de ficar gravada como
 * "igual ao padrão" — assim "restaurar" e "não tem sobrescrita" são a mesma
 * condição, e o menu sabe quando mostrar o botão de redefinir.
 */
export function alternarParte(
  modo: ModoDeVisualizacao,
  sobrescritas: Partial<Visibilidade>,
  parte: ParteDaInterface
): Partial<Visibilidade> {
  const atual = visibilidadeEfetiva(modo, sobrescritas)[parte];
  const novo = !atual;
  const proximo = { ...sobrescritas };
  if (visibilidadePadrao(modo)[parte] === novo) delete proximo[parte];
  else proximo[parte] = novo;
  return proximo;
}

export interface DescricaoDoModo {
  rotulo: string;
  /** Uma frase, para o menu e para o título do botão. */
  frase: string;
}

export function descricaoDoModo(modo: ModoDeVisualizacao): DescricaoDoModo {
  switch (modo) {
    case 'completo':
      return { rotulo: 'Completo', frase: 'Tudo à vista: entrada, preparo, resultados e morfometria.' };
    case 'contagem':
      return { rotulo: 'Contagem', frase: 'Só a imagem, o que encontra objetos e os totais.' };
    case 'laudo':
      return { rotulo: 'Laudo', frase: 'Metadados, morfometria e exportação em evidência.' };
    case 'apresentacao':
      return { rotulo: 'Apresentação', frase: 'Interface limpa para projetar ou gravar.' };
  }
}
