// =============================================================================
// SeedCounter — a sessão do histórico, montada sem tocar o navegador
//
// POR QUE EXISTE. Gravar uma cena no histórico é decidir o que dela vira
// registro: nome, contagem, metadado, marcas, contornos e a foto. Essa
// decisão morava dentro de `saveCurrentSession`, no App, misturada com o
// canvas que gera o JPEG e com o `alert`. Aqui fica só a montagem — o que dá
// para provar em node contra o formato antigo, byte a byte — e as frases que
// a pessoa lê ao salvar e ao abrir. O canvas, o IndexedDB e a navegação estão
// em `useSessao.ts`.
//
// A CONTAGEM CHEGA PRONTA, NÃO É REFEITA AQUI. O App a calcula uma vez por
// render, a partir de `contarObjetos` (lib/contagem) e da regra diferencial
// (quem semeou N e marcou só as viáveis) — e é ESSE número que o histórico
// guarda, o mesmo que a tela mostra e que o CSV exporta. Recalcular aqui
// criaria uma segunda fonte, que é exatamente o que `fonte-unica.test.ts`
// existe para impedir.
//
// O QUE A SESSÃO NÃO GUARDA (e continua não guardando, por ser extração):
// procedência (é montada na hora de exportar, ver `features/exportar`) e as
// anotações visuais. Mudar isso é decisão de formato, não deste PR.
// =============================================================================

import type { Mark, Metadata, Session, YoloSegmentation } from '../../types';
import { contarObjetos } from '../../lib/contagem';

export interface CenaParaSessao {
  filename: string;
  metadata: Metadata;
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  /** Como o App já a calculou — com o diferencial, quando ele vale. */
  contagem: { viableCount: number; inviableCount: number };
  /** A foto em JPEG (qualidade 0,85, tamanho real) como dataURL; ausente sem imagem. */
  imagem: string | undefined;
}

/**
 * O registro que vai para o histórico. `id` e `date` saem do MESMO instante:
 * o id é a chave do IndexedDB e a data é o que a tabela mostra; dois
 * `Date.now()` separados podiam diferir de um milissegundo e ninguém notaria,
 * até alguém comparar os dois.
 */
export function montarSessao(cena: CenaParaSessao, agora: Date = new Date()): Session {
  return {
    id: agora.getTime().toString(),
    date: agora.toISOString(),
    filename: cena.filename,
    viableCount: cena.contagem.viableCount,
    inviableCount: cena.contagem.inviableCount,
    metadata: { ...cena.metadata },
    marks: cena.marks,
    yoloSegmentations: cena.segmentacoes,
    imageData: cena.imagem,
  };
}

/**
 * O nome pelo qual a pessoa reconhece a sessão: o do arquivo. É o que a
 * tabela do histórico mostra e o que as mensagens citam — existe para que
 * nenhuma delas invente outro (data, id) por conta própria.
 */
export function nomeDaSessao(sessao: Pick<Session, 'filename'>): string {
  return sessao.filename;
}

/**
 * Sessão sem nenhuma semente contada — pela mesma enumeração canônica da
 * tela, e não por `marks.length`, que ignoraria os contornos do modelo.
 */
export function sessaoEstaVazia(sessao: Pick<Session, 'marks' | 'yoloSegmentations'>): boolean {
  return contarObjetos(sessao.marks ?? [], sessao.yoloSegmentations ?? []).total === 0;
}

// ---------------------------------------------------------------------------
// As frases de sempre
// ---------------------------------------------------------------------------

export const MENSAGEM_SESSAO_SALVA = 'Sessão salva com sucesso no histórico local!';
export const MENSAGEM_IMAGEM_DA_SESSAO_FALHOU = 'Erro ao carregar a imagem salva da sessão.';

/** Sessão antiga, de antes de o histórico guardar a foto: pede o arquivo. */
export function mensagemDeSessaoSemImagem(sessao: Pick<Session, 'filename'>): string {
  return `Sessão carregada, mas esta sessão antiga não possui a imagem salva no banco.\nPor favor, carregue o arquivo de imagem "${nomeDaSessao(sessao)}" manualmente.`;
}
