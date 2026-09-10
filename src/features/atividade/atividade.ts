// =============================================================================
// SeedCounter — atividade em curso
//
// UM LUGAR SÓ PARA DIZER "ESTOU FAZENDO ALGO".
//
// O aplicativo tem meia dúzia de operações que demoram — carregar imagem, rodar
// o YOLO, achatar o fundo, contornar em lote, gerar o PDF — e cada uma nasceu
// com o seu próprio jeito de avisar, ou sem jeito nenhum. Numa digitalização de
// scanner isso vira segundos de tela parada, e tela parada sem sinal é
// indistinguível de tela travada.
//
// Este módulo é um REGISTRO: quem começa algo demorado se inscreve com um nome,
// e se desinscreve ao terminar. O rodapé mostra o que está em curso. Nada aqui
// sabe o que cada operação faz — só que ela está acontecendo.
//
// POR QUE UM REGISTRO DE MÓDULO, E NÃO ESTADO DE COMPONENTE.
//
// Quem inicia a operação está espalhado pelo App, pelos hooks e por callbacks
// assíncronos. Fazer cada um receber um `setState` por prop seria enfiar um
// canal de aviso em vinte assinaturas. Um registro global com assinantes é a
// forma que deixa a operação se anunciar de onde ela estiver.
// =============================================================================

export interface Atividade {
  /** Chave estável, para a mesma operação não aparecer duas vezes. */
  chave: string;
  /** O que dizer no rodapé. Curto: "Achatando o fundo…" */
  rotulo: string;
  /** Progresso de 0 a 1, quando há como saber. */
  progresso?: number;
}

type Ouvinte = (atividades: Atividade[]) => void;

const atividades = new Map<string, Atividade>();
const ouvintes = new Set<Ouvinte>();

function avisar() {
  const lista = [...atividades.values()];
  for (const o of ouvintes) o(lista);
}

/**
 * Anuncia uma atividade. Devolve a função que a encerra.
 *
 * O padrão "devolve o encerramento" é o que evita o pior defeito desta classe
 * de módulo: uma operação que começa e nunca termina de avisar. Com
 * `try/finally` em volta, o encerramento é garantido mesmo quando a operação
 * lança.
 */
export function iniciarAtividade(chave: string, rotulo: string): () => void {
  atividades.set(chave, { chave, rotulo });
  avisar();
  return () => {
    atividades.delete(chave);
    avisar();
  };
}

/** Atualiza o progresso de uma atividade em curso. */
export function atualizarProgresso(chave: string, progresso: number, rotulo?: string) {
  const atual = atividades.get(chave);
  if (!atual) return;
  atividades.set(chave, {
    ...atual,
    progresso: Math.max(0, Math.min(1, progresso)),
    rotulo: rotulo ?? atual.rotulo,
  });
  avisar();
}

/**
 * Executa uma operação anunciando-a do começo ao fim.
 *
 * É a forma preferida: quem chama não tem como esquecer de encerrar.
 */
export async function comAtividade<T>(
  chave: string,
  rotulo: string,
  operacao: () => Promise<T>
): Promise<T> {
  const encerrar = iniciarAtividade(chave, rotulo);
  try {
    return await operacao();
  } finally {
    encerrar();
  }
}

/** Inscreve um ouvinte. Devolve a função que o remove. */
export function ouvirAtividades(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  ouvinte([...atividades.values()]);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Existe para o teste começar limpo. */
export function limparAtividades() {
  atividades.clear();
  avisar();
}
