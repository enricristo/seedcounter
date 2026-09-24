// =============================================================================
// SeedCounter — laço do lote (Task C1)
//
// Roda UMA receita (`features/ensaio/receitas.ts`) sobre N imagens, uma de
// cada vez. Mesmo espírito de `features/datasets/medir-pasta.ts` (Task B4):
// laço cancelável que cede a tela, com a parte que toca canvas/`File`
// injetada como `processar` — aqui isto é testável em node com um dublê.
//
// UMA IMAGEM COM ERRO NÃO DERRUBA O LOTE: arquivo corrompido, TIFF que o
// navegador não decodifica, memória insuficiente numa digitalização enorme —
// cada falha vira `erro` no resultado daquela imagem e o laço segue. É o
// mesmo espírito de `medirPasta`/`executarReceita`.
//
// Diferença do padrão de `medirPasta` (que cede a tela a cada `lote` fotos):
// aqui cede-se entre CADA imagem, sempre — decodificar uma digitalização de
// scanner inteira e rodar a onda sobre até 400 pontos já é caro por si só;
// não há por que acumular várias antes de devolver o controle à tela.
// =============================================================================

import type { Receita } from '../ensaio/receitas';

/** Uma imagem do lote — a origem (fila, regiões, pasta) não importa aqui. */
export interface ItemDoLote {
  id: string;
  rotulo: string;
  obterFile(): Promise<File>;
  /**
   * A página do TIFF que esta linha representa. Ausente = a primeira, que é
   * o caso de toda imagem de uma página só.
   *
   * Existe porque sete dos doze TIFF do laboratório guardam várias
   * varreduras: o de dez espécies virava UMA linha, e nove espécies sumiam
   * sem aviso (`paginas-do-lote.ts`).
   */
  pagina?: number;
}

export interface ResultadoDeUmaImagem {
  id: string;
  rotulo: string;
  contagem: number;
  viaveis: number;
  inviaveis: number;
  suspeitos: number;
  escapes: number;
  duracaoMs: number;
  /** Presente quando a imagem foi descartada — o lote segue, esta linha avisa. */
  erro?: string;
  /**
   * Prévia pequena (~72 px no maior lado) com os contornos propostos
   * desenhados por cima — data URL. Gerada no FIM do processamento desta
   * imagem, enquanto ela ainda está decodificada (`processar-imagem.ts`):
   * depois disso seria decodificar de novo. Ausente quando `erro`.
   */
  miniatura?: string;
  /**
   * Prévia maior (até ~960 px no maior lado), mesma ideia — o que o clique
   * na miniatura abre para conferir antes de aceitar. Ausente quando `erro`.
   */
  imagemGrande?: string;
}

export interface ResultadoDoLote {
  resultados: ResultadoDeUmaImagem[];
  /** Índice (0-based) em que `cancelado()` interrompeu o laço; `null` = terminou tudo. */
  canceladoEm: number | null;
  duracaoTotalMs: number;
}

export interface OpcoesDoLote {
  cancelado?: () => boolean;
  /** Chamado após cada imagem, para a barra de progresso do painel. */
  progresso?: (feito: number, total: number) => void;
}

function agora(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Cede a tela; mesmo padrão de `medirPasta`/`executarReceita`. */
function cederATela(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function resultadoDeErro(item: ItemDoLote, erro: unknown): ResultadoDeUmaImagem {
  return {
    id: item.id,
    rotulo: item.rotulo,
    contagem: 0,
    viaveis: 0,
    inviaveis: 0,
    suspeitos: 0,
    escapes: 0,
    duracaoMs: 0,
    erro: erro instanceof Error ? erro.message : 'erro desconhecido',
  };
}

/**
 * Roda `receita` sobre cada item de `itens`, sequencialmente. `processar` é
 * injetável de propósito — separa o laço (ordem, cancelamento, isolamento de
 * erro, progresso — testável em node) da parte real que toca `File`/canvas
 * (`processar-imagem.ts`, padrão real, testado só manualmente/via app).
 */
export async function executarLote(
  itens: ItemDoLote[],
  receita: Receita,
  processar: (item: ItemDoLote, receita: Receita) => Promise<ResultadoDeUmaImagem>,
  opcoes: OpcoesDoLote = {}
): Promise<ResultadoDoLote> {
  const { cancelado = () => false, progresso } = opcoes;
  const inicio = agora();
  const resultados: ResultadoDeUmaImagem[] = [];
  let canceladoEm: number | null = null;

  for (let i = 0; i < itens.length; i++) {
    if (cancelado()) {
      canceladoEm = i;
      break;
    }
    const item = itens[i];
    let resultado: ResultadoDeUmaImagem;
    try {
      resultado = await processar(item, receita);
    } catch (e) {
      resultado = resultadoDeErro(item, e);
    }
    resultados.push(resultado);
    progresso?.(i + 1, itens.length);
    await cederATela();
  }

  return { resultados, canceladoEm, duracaoTotalMs: agora() - inicio };
}
