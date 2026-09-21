// =============================================================================
// SeedCounter — `processar` real do lote (Task C1)
//
// A implementação de verdade do que `lote.ts` chama de `processar`: abre o
// `File`, localiza e resume. Não toca no estado do app — devolve os contornos
// propostos para quem chama decidir se aceita.
//
// DOIS CAMINHOS, UM FORMATO. A receita decide como localizar:
//
//   - clássico: `detectObjects` (limiarização, teto de 400 pontos — mesmo do
//     ensaio ao carregar) e a onda em cada ponto (`features/ensaio/executar.ts`);
//   - modelo (`localizacao.usaModeloDeIA`): o YOLO no worker devolve caixa,
//     classe e — só se pedido com `withMasks` — o contorno da máscara.
//
// Os dois devolvem o MESMO `ContornoProposto[]` + `ResumoDaReceita`, passando
// pelo mesmo `resumir` (mediana de área, Feret, suspeitos pelo limiar da
// própria população). A tabela, a miniatura, o CSV e o aceite não sabem qual
// caminho rodou — a única diferença visível é que o modelo traz `categoria`
// (viável/inviável) e a onda não.
//
// CUIDADO DE MEMÓRIA: uma digitalização de 6800×9359 decodificada é ~254 MB
// de RGBA (ver `onda-no-canvas.ts`). O canvas que `decodificarParaCanvas`
// devolve vive só nesta função; o `ImageData` lido para o modelo é clonado
// para o worker e sai de escopo aqui. Nada disto sobrevive entre iterações
// do lote. Os `propostos` devolvidos são só arrays de pontos (polígonos), não
// pixels: leves o bastante para ficar em memória enquanto a pessoa confere a
// tabela antes de aceitar.
// =============================================================================

import { detectObjects } from '../../lib/detect';
import { segmentarNoCanvas } from '../segmentacao/onda-no-canvas';
import { executarReceita } from '../ensaio/executar';
import { resumir, type Receita, type ContornoProposto, type ResumoDaReceita } from '../ensaio/receitas';
import { decodificarParaCanvas } from './abrir-imagem';
import type { InferenceOptions, YoloDetection } from '../../lib/yolo-onnx';
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

/** A assinatura de `detectarNoWorker` — o que um dublê de teste precisa imitar. */
export type Detector = (imagem: ImageData, opcoes: InferenceOptions) => Promise<YoloDetection[]>;

/** Cor do contorno proposto - mesma técnica de `EnsaioPanel` (Miniatura): lê `--color-accent`, com fallback fixo fora do navegador/tema. */
function corDoContorno(): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '#00e5ff';
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

// ---------------------------------------------------------------------------
// O desvio para o modelo
// ---------------------------------------------------------------------------

/** A classe do modelo, no vocabulário do app. Só `className` decide: `classId === 1` é 'viavel' em `YOLO_CLASSES`, não inviável. */
export function categoriaDaDeteccao(det: Pick<YoloDetection, 'className'>): 'viable' | 'inviable' {
  return det.className === 'inviavel' ? 'inviable' : 'viable';
}

/**
 * Converte o que o modelo devolveu no MESMO formato que a onda devolve.
 *
 * Só detecção COM contorno (máscara com 3+ pontos) vira proposta. Uma caixa
 * sem máscara não tem área, não se desenha e não vira contorno na sessão —
 * `enumerarObjetos` ignora polígono com menos de 3 pontos, então contá-la
 * aqui faria a tabela dizer um número e a Galeria outro. Ela entra em
 * `escapes`, que é exatamente o que esse campo significa no caminho clássico:
 * a localização achou algo, o contorno não saiu.
 *
 * Passa por `resumir` de propósito: mediana de área, Feret e suspeitos
 * saem da mesma régua do caminho clássico (antes eram zero, "mock"), e a
 * categoria é reencaixada por índice — `resumir` preserva a ordem.
 */
export function propostosDeDeteccoes(deteccoes: YoloDetection[]): {
  propostos: ContornoProposto[];
  escapes: number;
  resumo: ResumoDaReceita;
} {
  const comContorno = deteccoes.filter((d) => d.polygon !== undefined && d.polygon.length >= 3);
  const { propostos, resumo } = resumir(comContorno.map((d) => d.polygon ?? []));
  return {
    propostos: propostos.map((p, i) => ({ ...p, categoria: categoriaDaDeteccao(comContorno[i]) })),
    escapes: deteccoes.length - comContorno.length,
    resumo,
  };
}

/**
 * Traduz a falha do modelo para uma frase que explica o que fazer.
 *
 * O erro cru do ONNX Runtime ("protobuf parsing failed", "no available
 * backend") não diz à pessoa que o arquivo do modelo não está no servidor
 * ou que a primeira execução precisa de rede. Mesmas expressões que
 * `AiPointerPanel` usa — o Lote não pode dizer uma coisa e o painel outra.
 */
export function descreverFalhaDoModelo(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (/cancelad/i.test(msg)) return 'Detecção interrompida: outra detecção começou antes desta terminar.';
  if (/fetch|404|not found|protobuf/i.test(msg)) return 'Modelo de IA não encontrado em public/models/.';
  if (/wasm|backend|no available backend/i.test(msg)) {
    return 'Falha ao carregar o motor de inferência (WASM). Verifique a conexão na primeira execução.';
  }
  return `Falha ao executar o modelo: ${msg.slice(0, 120)}`;
}

async function detectorPadrao(): Promise<Detector> {
  const { detectarNoWorker } = await import('../../lib/yolo-worker-client');
  return detectarNoWorker;
}

// ---------------------------------------------------------------------------

export interface ProcessamentoDeUmaImagem {
  resultado: ResultadoDeUmaImagem;
  /** Ausente quando `resultado.erro` está definido — nada para aceitar. */
  propostos?: ContornoProposto[];
}

export interface OpcoesDeProcessamento {
  cancelado?: () => boolean;
  /**
   * Dublês. Existem porque o ambiente de teste é node puro, sem canvas nem
   * worker: o teste injeta um canvas falso e um detector que devolve o que o
   * teste quer, e o resto do caminho — categoria, resumo, prévia, formato do
   * resultado — roda de verdade.
   */
  abrirImagem?: (file: File) => Promise<HTMLCanvasElement>;
  detectar?: Detector;
}

type ResultadoDaLocalizacao = { propostos: ContornoProposto[]; escapes: number; resumo: ResumoDaReceita };

/**
 * Processa uma imagem do lote: decodifica, localiza, roda a onda (ou o
 * modelo), resume.
 *
 * NÃO engole exceção (arquivo corrompido, TIFF ilegível, canvas indisponível,
 * modelo ausente propagam) - isolar erro por imagem é responsabilidade de
 * `executarLote`, que envolve cada chamada a `processar` num `try/catch`;
 * aqui só o caso "a onda foi cancelada no meio" vira `resultado.erro`
 * diretamente, porque isso não é uma exceção, é `executarReceita` devolvendo
 * `null`.
 */
export async function processarImagemDoLote(
  item: ItemDoLote,
  receita: Receita,
  opcoes: OpcoesDeProcessamento = {}
): Promise<ProcessamentoDeUmaImagem> {
  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const abrir = opcoes.abrirImagem ?? decodificarParaCanvas;

  const file = await item.obterFile();
  const canvas = await abrir(file);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  let resultadoDoEnsaio: ResultadoDaLocalizacao | null = null;

  if (receita.localizacao.usaModeloDeIA) {
    const detectar = opcoes.detectar ?? (await detectorPadrao());
    // Lido e despachado numa expressão só: o `ImageData` não fica numa
    // variável viva durante o `await` — o worker recebe uma cópia estrutural
    // e a nossa pode ser coletada enquanto a inferência roda.
    let deteccoes: YoloDetection[];
    try {
      deteccoes = await detectar(ctx.getImageData(0, 0, canvas.width, canvas.height), {
        confThreshold: (receita.localizacao.sensitivity ?? 50) / 100,
        // Sem isto o modelo devolve só caixas, e uma caixa não é contorno —
        // era a razão de a fila gravar sessões que nenhuma tela enumerava.
        withMasks: true,
      });
    } catch (erro) {
      // Um modelo ausente NÃO pode virar "0 objetos": zero é um resultado,
      // ausência é uma falha — e a linha da tabela precisa dizer qual.
      throw new Error(descreverFalhaDoModelo(erro));
    }
    resultadoDoEnsaio = opcoes.cancelado?.() ? null : propostosDeDeteccoes(deteccoes);
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
  // escopo (a imagem já decodificada) — depois desta função devolver, o
  // `canvas` local (e os pixels que ele segura) sai de escopo junto: gerar
  // as prévias depois seria decodificar de novo.
  const { propostos, escapes, resumo } = resultadoDoEnsaio;
  const miniatura = desenharPreviaComContornos(canvas, propostos, LADO_MAIOR_DA_MINIATURA);
  const imagemGrande = desenharPreviaComContornos(canvas, propostos, LADO_MAIOR_DA_IMAGEM_GRANDE);

  // Sem `categoria` o contorno entra como viável — mesma convenção de
  // `propostosParaSegmentacoes` (App.tsx e LotePanel): a onda não distingue
  // viável de inviável, isso é leitura de tetrazólio feita pela pessoa depois.
  // Com o modelo a categoria vem preenchida e é ela que conta.
  const inviaveis = propostos.filter((p) => p.categoria === 'inviable').length;
  return {
    resultado: {
      id: item.id,
      rotulo: item.rotulo,
      contagem: resumo.contagem,
      viaveis: resumo.contagem - inviaveis,
      inviaveis,
      suspeitos: resumo.suspeitos,
      escapes,
      duracaoMs,
      miniatura,
      imagemGrande,
    },
    propostos,
  };
}
