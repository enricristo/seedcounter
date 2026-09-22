// =============================================================================
// SeedCounter — carregar imagem quando já há uma cena aberta: a decisão
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Carregar uma imagem é o gesto mais repetido do aplicativo. Hoje ele faz
// sempre a mesma coisa: substitui a fila inteira e abre o primeiro arquivo.
// Isso é certo na primeira imagem do dia e errado no meio de uma contagem —
// a pessoa que arrasta a repetição 2 por cima da repetição 1 meio contada
// perde a placa que estava na tela sem nenhum aviso.
//
// A REGRA: PERGUNTAR SÓ QUANDO HÁ O QUE PERDER.
//
// Um diálogo na primeira imagem do dia é um obstáculo; um diálogo em cima de
// vinte marcações é uma proteção. A diferença é a cena estar OCUPADA: imagem
// aberta E alguma marcação ou contorno. Imagem sem marcação nenhuma é só uma
// imagem — substituir custa nada, e por isso abre direto.
//
// Este módulo é puro de propósito: a regra que decide se um diálogo aparece
// é a regra mais fácil de quebrar sem notar (um `&&` que vira `||` e o
// diálogo passa a aparecer sempre), e a única defesa barata é um teste.
// =============================================================================

export interface EstadoParaDecidir {
  /** Há uma imagem aberta na bancada ativa. */
  temImagem: boolean;
  /** Marcações manuais (com ou sem contorno) na cena atual. */
  totalDeMarcas: number;
  /** Contornos (do modelo, do ensaio, da onda) na cena atual. */
  totalDeContornos: number;
  /**
   * Carimbo da última gravação da cena atual, ou null se nunca foi gravada
   * desde que esta imagem abriu. É `cena.ultimaGravacao`, que o App zera a
   * cada troca de `filename`.
   */
  ultimaGravacao: number | null;
}

export type DecisaoAoCarregar = 'abrir' | 'perguntar';

/** O que a pessoa pode escolher no diálogo. */
export type EscolhaAoCarregar = 'substituir' | 'adicionar-a-fila' | 'adicionar-e-ir';

/** A cena tem alguma marcação ou contorno — há trabalho em cima da imagem. */
export function cenaOcupada(estado: EstadoParaDecidir): boolean {
  return estado.temImagem && estado.totalDeMarcas + estado.totalDeContornos > 0;
}

/**
 * Abrir direto ou perguntar.
 *
 * `perguntar` só com cena ocupada. Sem imagem, ou com imagem sem nenhuma
 * marcação, abre direto — o diálogo NÃO pode aparecer na primeira imagem do
 * dia, nem quando a pessoa está só folheando uma pasta sem contar nada.
 */
export function decidirAoCarregar(estado: EstadoParaDecidir): DecisaoAoCarregar {
  return cenaOcupada(estado) ? 'perguntar' : 'abrir';
}

/**
 * Substituir esta cena perde trabalho que ninguém gravou?
 *
 * "Não salvo" aqui é: há marcação ou contorno E a cena não foi gravada no
 * histórico desde que esta imagem abriu. Gravar uma vez e marcar mais dez
 * depois também é "não salvo" a rigor, e este critério NÃO pega esse caso —
 * o aplicativo não guarda a contagem no instante da gravação para comparar.
 * A alternativa seria avisar sempre que há marcação, e aviso que aparece
 * sempre deixa de ser lido. O aviso mira o caso que custa uma folha inteira:
 * quem nunca gravou nada desta imagem.
 */
export function haTrabalhoNaoSalvo(estado: EstadoParaDecidir): boolean {
  return cenaOcupada(estado) && estado.ultimaGravacao === null;
}
