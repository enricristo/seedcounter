// =============================================================================
// SeedCounter — "Medir esta pasta" (Task B4)
//
// Roda a MESMA onda que o app usa no clique sobre cada foto de um conjunto de
// classificação (uma semente por foto, classe já conhecida pelo dataset), e
// produz `MedidaDeUmObjeto` por foto — matéria-prima de `perfil-medido.ts`.
//
// LAÇO CANCELÁVEL EM LOTES, mesmo padrão de `features/ensaio/executar.ts`:
// cede a tela a cada `lote` fotos, e para na hora se `cancelado()` virar
// verdadeiro — a pasta real tem conjuntos de milhares de imagens
// (wheat quality: 7.217), e sem ceder a tela a aba trava.
//
// UMA FOTO RUIM NÃO DERRUBA O LOTE: arquivo corrompido, TIFF que o navegador
// não decodifica, permissão revogada no meio — cada falha conta como
// descartada e o laço segue. É o mesmo espírito de `executarReceita`: a
// pessoa vê quantas descartou, não uma exceção sem contexto.
// =============================================================================

import { detectObjects, type DetectionOptions } from '../../lib/detect';
import { segmentarNoCanvas } from '../segmentacao/onda-no-canvas';
import type { OpcoesDaOnda } from '../../lib/region-growing';
import { areaDoPoligono, fechoConvexo } from '../../lib/aglomerado';
import { feret } from '../../lib/feret';
import type { MedidaDeUmObjeto } from '../../lib/perfil-medido';
import type { ArquivoDoDataset } from './fonte';

/** Uma imagem do conjunto, com a classe já resolvida (CSV multiclasse ou nome da subpasta). */
export interface ImagemParaMedir {
  /** Caminho relativo ao conjunto — vira `MedidaDeUmObjeto.caminho`. */
  caminho: string;
  classe: string;
  arquivo: ArquivoDoDataset;
}

export interface ResultadoDaMedicao {
  medidas: MedidaDeUmObjeto[];
  descartadas: number;
  duracaoMs: number;
}

/**
 * Localização reduzida: a foto tem uma semente só (é a premissa do formato de
 * classificação), então não vale o custo de uma varredura fina — o objetivo é
 * achar ONDE está a semente para dar o clique de partida à onda, não contar.
 */
const LOCALIZACAO_REDUZIDA: DetectionOptions = {
  maxProcessingSize: 900,
  minArea: 40,
};

const ONDA_PADRAO: OpcoesDaOnda = {};

export interface OpcoesDeMedicao {
  /** Fotos processadas entre um `await` e outro. Padrão 4 — decodificar imagem é mais caro que rodar a onda. */
  lote?: number;
  cancelado?: () => boolean;
  /** Chamado após cada foto, para a barra de progresso do painel. */
  progresso?: (feito: number, total: number) => void;
  /**
   * Como medir UMA foto. Injetável de propósito — é o que separa o laço
   * (cancelamento, lotes, contagem de descartadas — testável em node, sem
   * DOM) da parte que toca canvas/`detectObjects`/onda (`medirUmaFoto` neste
   * mesmo módulo, padrão real). Testes trocam por um dublê síncrono.
   */
  medirImagem?: (item: ImagemParaMedir) => Promise<MedidaDeUmObjeto | null>;
}

/**
 * Mede um conjunto de imagens já resolvidas para classe. Devolve as medidas
 * válidas e quantas fotos foram descartadas — nunca lança por causa de uma
 * foto ruim.
 */
export async function medirPasta(
  imagens: ImagemParaMedir[],
  opcoes: OpcoesDeMedicao = {}
): Promise<ResultadoDaMedicao> {
  const {
    lote = 4,
    cancelado = () => false,
    progresso,
    medirImagem = medirUmaFoto,
  } = opcoes;

  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const medidas: MedidaDeUmObjeto[] = [];
  let descartadas = 0;

  for (let i = 0; i < imagens.length; i++) {
    if (cancelado()) break;
    const item = imagens[i];
    try {
      const medida = await medirImagem(item);
      if (medida) medidas.push(medida);
      else descartadas++;
    } catch {
      descartadas++;
    }
    progresso?.(i + 1, imagens.length);
    if ((i + 1) % lote === 0) await new Promise<void>((res) => setTimeout(res, 0));
  }

  const fim = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { medidas, descartadas, duracaoMs: fim - inicio };
}

/**
 * Uma foto de verdade: decodifica, acha o maior objeto (a semente), joga a
 * onda a partir dele, mede o contorno resultante. Devolve `null` (não lança)
 * quando qualquer etapa não produz um contorno utilizável — `medirPasta` conta
 * isso como descartada. É a implementação padrão de `medirImagem`; só toca
 * DOM (canvas, `createImageBitmap`), por isso fica fora do que os testes de
 * `medirPasta` exercitam diretamente.
 */
export async function medirUmaFoto(
  item: ImagemParaMedir,
  localizacao: DetectionOptions = LOCALIZACAO_REDUZIDA,
  onda: OpcoesDaOnda = ONDA_PADRAO
): Promise<MedidaDeUmObjeto | null> {
  const file = await item.arquivo.obterFile();
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);

    // Maior objeto detectado = a semente da foto — é a premissa do próprio
    // formato (uma semente por imagem) que classifica o conjunto.
    const deteccao = detectObjects(canvas, localizacao);
    if (deteccao.objects.length === 0) return null;
    const maior = deteccao.objects.reduce((a, b) => (b.area > a.area ? b : a));

    const resultado = segmentarNoCanvas(canvas, { x: maior.x, y: maior.y }, onda);
    if (!resultado || resultado.contorno.length < 3) return null;

    const areaPx = areaDoPoligono(resultado.contorno);
    if (areaPx <= 0) return null;
    const f = feret(resultado.contorno);
    if (!f || f.minimo <= 0) return null;
    const areaDoFecho = areaDoPoligono(fechoConvexo(resultado.contorno));
    const solidez = areaDoFecho > 0 ? Math.min(1, areaPx / areaDoFecho) : NaN;

    return {
      caminho: item.caminho,
      classe: item.classe,
      areaPx,
      feretMaxPx: f.maximo,
      feretMinPx: f.minimo,
      solidez,
      razaoDeAspecto: f.maximo / f.minimo,
    };
  } finally {
    bitmap.close();
  }
}
