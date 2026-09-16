// =============================================================================
// SeedCounter — `processar` real do lote (Task C1)
//
// A implementação de verdade do que `lote.ts` chama de `processar`: abre o
// `File`, localiza (`detectObjects`, reduzido — mesmo teto de 400 pontos do
// ensaio ao carregar) e roda a onda de cada ponto (mesmo executor do ensaio,
// `features/ensaio/executar.ts`). Não toca no estado do app — devolve os
// contornos propostos para quem chama decidir se aceita.
//
// CUIDADO DE MEMÓRIA: uma digitalização de 6800×9359 decodificada é ~254 MB
// de RGBA (ver `onda-no-canvas.ts`). O `ImageBitmap` é fechado (`close()`) no
// `finally`, e o `<canvas>` sai de escopo com a função — nada disto sobrevive
// entre iterações do lote. Os `propostos` devolvidos são só arrays de pontos
// (polígonos), não pixels: leves o bastante para ficar em memória enquanto a
// pessoa confere a tabela antes de aceitar.
// =============================================================================

import { detectObjects } from '../../lib/detect';
import { segmentarNoCanvas } from '../segmentacao/onda-no-canvas';
import { executarReceita } from '../ensaio/executar';
import type { Receita, ContornoProposto } from '../ensaio/receitas';
import type { ItemDoLote, ResultadoDeUmaImagem } from './lote';

/**
 * Pontos localizados por receita, por imagem. Mesmo teto do ensaio ao
 * carregar (`App.tsx`) — acima disso a onda em lote deixaria de ser barata.
 */
const TETO_DE_PONTOS = 400;

export interface ProcessamentoDeUmaImagem {
  resultado: ResultadoDeUmaImagem;
  /** Ausente quando `resultado.erro` está definido — nada para aceitar. */
  propostos?: ContornoProposto[];
}

/**
 * Processa uma imagem do lote: decodifica, localiza, roda a onda, resume.
 *
 * NÃO engole exceção (arquivo corrompido, TIFF ilegível, canvas indisponível
 * propagam) — isolar erro por imagem é responsabilidade de `executarLote`,
 * que envolve cada chamada a `processar` num `try/catch`; aqui só o caso "a
 * onda foi cancelada no meio" vira `resultado.erro` diretamente, porque isso
 * não é uma exceção, é `executarReceita` devolvendo `null`.
 */
export async function processarImagemDoLote(
  item: ItemDoLote,
  receita: Receita,
  opcoes: { cancelado?: () => boolean } = {}
): Promise<ProcessamentoDeUmaImagem> {
  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let bitmap: ImageBitmap | null = null;
  try {
    const file = await item.obterFile();
    bitmap = await createImageBitmap(file);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');
    ctx.drawImage(bitmap, 0, 0);

    const deteccao = detectObjects(canvas, receita.localizacao);
    const objetos =
      deteccao.objects.length > TETO_DE_PONTOS ? deteccao.objects.slice(0, TETO_DE_PONTOS) : deteccao.objects;
    const pontos = objetos.map((o) => ({ x: o.x, y: o.y }));

    const resultadoDoEnsaio = await executarReceita(
      receita,
      pontos,
      (p, opcoesDaOnda) => {
        const r = segmentarNoCanvas(canvas, p, opcoesDaOnda);
        return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
      },
      { cancelado: opcoes.cancelado }
    );

    const duracaoMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - inicio;

    if (!resultadoDoEnsaio) {
      // `executarReceita` devolve `null` só quando `cancelado()` virou
      // verdadeiro no meio — não é uma falha desta imagem, é o "Parar" do
      // painel. `executarLote` já vai parar de chamar `processar` de qualquer
      // forma; este resultado é só o que sobra da imagem em andamento.
      return {
        resultado: {
          id: item.id,
          rotulo: item.rotulo,
          contagem: 0,
          viaveis: 0,
          inviaveis: 0,
          suspeitos: 0,
          escapes: 0,
          duracaoMs,
          erro: 'Interrompida.',
        },
      };
    }

    // Todo contorno proposto entra como 'viable'/'viavel' — mesma convenção
    // de `propostosParaSegmentacoes` (App.tsx): a onda não distingue viável de
    // inviável, isso é leitura de tetrazólio feita pela pessoa depois.
    return {
      resultado: {
        id: item.id,
        rotulo: item.rotulo,
        contagem: resultadoDoEnsaio.resumo.contagem,
        viaveis: resultadoDoEnsaio.resumo.contagem,
        inviaveis: 0,
        suspeitos: resultadoDoEnsaio.resumo.suspeitos,
        escapes: resultadoDoEnsaio.escapes,
        duracaoMs,
      },
      propostos: resultadoDoEnsaio.propostos,
    };
  } finally {
    bitmap?.close();
  }
}
