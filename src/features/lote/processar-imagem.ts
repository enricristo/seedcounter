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
import { areaDoPoligono } from '../../lib/aglomerado';
import { executarReceita } from '../ensaio/executar';
import type { Receita, ContornoProposto, ResumoDaReceita } from '../ensaio/receitas';
import type { ItemDoLote, ResultadoDeUmaImagem } from './lote';

/**
 * Pontos localizados por receita, por imagem. Mesmo teto do ensaio ao
 * carregar (`App.tsx`) - acima disso a onda em lote deixaria de ser barata.
 */
const TETO_DE_PONTOS = 400;

/** Maior lado da miniatura da linha da tabela (item 1, "lote redondo"). */
const LADO_MAIOR_DA_MINIATURA = 72;
/** Maior lado da prévia que o clique na miniatura abre. */
const LADO_MAIOR_DA_IMAGEM_GRANDE = 960;

/** Cor do contorno proposto - mesma técnica de `EnsaioPanel` (Miniatura): lê `--color-accent`, com fallback fixo fora do navegador/tema. */
function corDoContorno(): string {
  if (typeof document === 'undefined') return '#00e5ff';
  return getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#00e5ff';
}

/**
 * Reduz `origem` (o canvas já decodificado desta imagem) para uma prévia com
 * os contornos propostos desenhados por cima, como data URL.
 *
 * O contorno é desenhado DEPOIS de escalar a imagem para o tamanho final, não
 * antes, para a linha ter exatamente 1px e a cor certa - escalar a imagem com
 * as linhas já desenhadas as esfumaçaria (aliasing) e a compressão JPEG de
 * qualidade baixa do Canvas faria vazar artefatos coloridos.
 */
function desenharPreviaComContornos(origem: HTMLCanvasElement, propostos: ContornoProposto[], maxLado: number): string {
  const escala = Math.min(1, maxLado / Math.max(origem.width, origem.height));
  const w = Math.round(origem.width * escala);
  const h = Math.round(origem.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(origem, 0, 0, w, h);

  ctx.strokeStyle = corDoContorno();
  ctx.lineWidth = 1;
  for (const p of propostos) {
    if (p.contorno.length < 3) continue;
    ctx.setLineDash(p.suspeitoDeAglomerado ? [3, 2] : []);
    ctx.beginPath();
    ctx.moveTo(p.contorno[0][0] * escala, p.contorno[0][1] * escala);
    for (let i = 1; i < p.contorno.length; i++) {
      ctx.lineTo(p.contorno[i][0] * escala, p.contorno[i][1] * escala);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  return canvas.toDataURL('image/jpeg', 0.6); // qualidade baixa p/ o IndexedDB (Lote B)
}

export interface ProcessamentoDeUmaImagem {
  resultado: ResultadoDeUmaImagem;
  /** Ausente quando `resultado.erro` está definido — nada para aceitar. */
  propostos?: ContornoProposto[];
}

/**
 * Processa uma imagem do lote: decodifica, localiza, roda a onda, resume.
 *
 * NÃO engole exceção (arquivo corrompido, TIFF ilegível, canvas indisponível
 * propagam) - isolar erro por imagem é responsabilidade de `executarLote`,
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

    let resultadoDoEnsaio: { propostos: ContornoProposto[]; escapes: number; resumo: ResumoDaReceita } | null = null;

    if (receita.localizacao.usaModeloDeIA) {
      const { detectarNoWorker } = await import('../../lib/yolo-worker-client');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detections = await detectarNoWorker(imageData, {
        confThreshold: (receita.localizacao.sensitivity ?? 50) / 100,
      });
      if (opcoes.cancelado?.()) {
        resultadoDoEnsaio = null;
      } else {
        const propostos = detections.map(det => {
          const area = det.polygon ? areaDoPoligono(det.polygon) : 0;
          return {
            contorno: det.polygon ?? [],
            areaPx: area,
            suspeitoDeAglomerado: false,
            categoria: (det.className === 'inviavel' || det.classId === 1) ? 'inviable' as const : 'viable' as const
          };
        });
        const viaveis = propostos.filter(p => p.categoria === 'viable').length;
        const inviaveis = propostos.filter(p => p.categoria === 'inviable').length;
        const resumo = {
          contagem: propostos.length,
          medianaDaAreaPx: 0, // mock
          medianaDoFeretMaxPx: 0, // mock
          suspeitos: 0,
          viaveis,
          inviaveis
        };
        resultadoDoEnsaio = { propostos, escapes: 0, resumo };
      }
    } else {
      const deteccao = detectObjects(canvas, receita.localizacao);
      const objetos =
        deteccao.objects.length > TETO_DE_PONTOS ? deteccao.objects.slice(0, TETO_DE_PONTOS) : deteccao.objects;
      const pontos = objetos.map((o) => ({ x: o.x, y: o.y }));

      resultadoDoEnsaio = await executarReceita(
        receita,
        pontos,
        (p, opcoesDaOnda) => {
          const r = segmentarNoCanvas(canvas, p, opcoesDaOnda);
          return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
        },
        { cancelado: opcoes.cancelado }
      );
    }

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

    // Miniatura e prévia grande são desenhadas AGORA, com `canvas` ainda no
    // escopo (a imagem já decodificada) — depois desta função devolver, só o
    // `bitmap` é fechado, mas o `canvas` local (e os pixels que ele segura)
    // sai de escopo junto: gerar as prévias depois seria decodificar de novo.
    const miniatura = desenharPreviaComContornos(canvas, resultadoDoEnsaio.propostos, LADO_MAIOR_DA_MINIATURA);
    const imagemGrande = desenharPreviaComContornos(canvas, resultadoDoEnsaio.propostos, LADO_MAIOR_DA_IMAGEM_GRANDE);

    // Todo contorno proposto entra como 'viable'/'viavel' — mesma convenção
    // de `propostosParaSegmentacoes` (App.tsx): a onda não distingue viável de
    // inviável, isso é leitura de tetrazólio feita pela pessoa depois.
    return {
      resultado: {
        id: item.id,
        rotulo: item.rotulo,
        contagem: resultadoDoEnsaio.resumo.contagem,
        viaveis: (resultadoDoEnsaio.resumo as any).viaveis ?? resultadoDoEnsaio.resumo.contagem,
        inviaveis: (resultadoDoEnsaio.resumo as any).inviaveis ?? 0,
        suspeitos: resultadoDoEnsaio.resumo.suspeitos,
        escapes: resultadoDoEnsaio.escapes,
        duracaoMs,
        miniatura,
        imagemGrande,
      },
      propostos: resultadoDoEnsaio.propostos,
    };
  } finally {
    bitmap?.close();
  }
}
