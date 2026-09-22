// =============================================================================
// SeedCounter — a foto anotada que sai do aplicativo
//
// POR QUE EXISTE. A pessoa confere a contagem na tela e leva a imagem para o
// artigo, o laudo ou a mensagem para o orientador. Esta é a única saída
// visual que sobrevive fora do aplicativo, então ela precisa ser EXATAMENTE
// a cena conferida: mesmos contornos, mesmas marcas, mesmos números.
//
// A DECISÃO QUE ELE CARREGA. A imagem exportada não conta nada por conta
// própria. A versão anterior somava "contornos visíveis + marcações" e
// escrevia isso na legenda; uma semente clicada, que tem marcação E contorno,
// aparecia duas vezes no total do PNG e uma vez no CSV. Agora a legenda lê
// `enumerarObjetos`, como a contagem e a tabela — um objeto, um número.
//
// Omitir uma classe (só viáveis, só inviáveis) filtra a LISTA enumerada, não
// as entradas: os índices dos objetos que ficam continuam os do CSV. Um PNG
// "só inviáveis" com a semente 7 escrita como "1" não serviria para nada.
//
// O que é puro (filtro, resumo, dimensões, cabeçalho) fica em funções
// próprias, testáveis sem canvas. O desenho recebe o contexto pronto; o
// wrapper que pega `getContext` é a única linha que depende do DOM.
// =============================================================================

import type { Mark, YoloSegmentation, Metadata } from '../types';
import { corDoEspecime, ESPECIME_FILL, type EstiloDaMarca } from '../theme/specimen';
import { espessuraNaImagem } from './escala-da-marca';
import { enumerarObjetos, type ObjetoDaCena } from './objetos';
import { desenharObjetos, type ModoVisual } from './render-marks';

export type TipoDeSobreposicao = 'none' | 'table' | 'chart' | 'both';

export interface ImageExportOptions {
  includeViable: boolean;
  includeInviable: boolean;
  overlayType: TipoDeSobreposicao;
}

/** Como a exportação enxerga a cena: só o que foi pedido, sem renumerar. */
export function filtrarCena(
  objetos: readonly ObjetoDaCena[],
  options: Pick<ImageExportOptions, 'includeViable' | 'includeInviable'>
): ObjetoDaCena[] {
  return objetos.filter((o) =>
    o.categoria === 'viable' ? options.includeViable : options.includeInviable
  );
}

export interface ResumoDaCena {
  viaveis: number;
  inviaveis: number;
  total: number;
  /** Inteiros que somam 100 quando há objetos, 0 e 0 quando não há. */
  pctViaveis: number;
  pctInviaveis: number;
}

/**
 * Os números da legenda. Os dois percentuais são complementares por
 * construção — arredondar cada um separadamente dava 33% + 67% num caso e
 * 34% + 67% no outro, e uma legenda que soma 101% desacredita a imagem.
 */
export function resumoDaCena(objetos: readonly ObjetoDaCena[]): ResumoDaCena {
  const total = objetos.length;
  const viaveis = objetos.filter((o) => o.categoria === 'viable').length;
  const inviaveis = total - viaveis;
  const pctViaveis = total > 0 ? Math.round((viaveis / total) * 100) : 0;
  const pctInviaveis = total > 0 ? 100 - pctViaveis : 0;
  return { viaveis, inviaveis, total, pctViaveis, pctInviaveis };
}

/** Margem da caixa até a borda da imagem e recuo interno do texto. */
export const MARGEM_DA_CAIXA = 20;
export const RECUO_DA_CAIXA = 24;

/** Quanto cada linha de identificação avança o texto dentro da caixa. */
const ALTURA_DA_LINHA = 24;

/**
 * Largura e altura da caixa de legenda, por tipo de sobreposição.
 *
 * A altura base já reserva UMA linha de identificação; cada linha além dela
 * cresce a caixa pelo que o texto de fato avança. Antes o acréscimo era fixo
 * em 20 px para a segunda linha e nada para a terceira, e a caixa cortava.
 */
export function dimensoesDaCaixa(
  tipo: TipoDeSobreposicao,
  linhasDeIdentificacao: number
): { largura: number; altura: number } {
  const linhas = Number.isFinite(linhasDeIdentificacao) ? Math.max(0, Math.floor(linhasDeIdentificacao)) : 0;
  const extra = Math.max(0, linhas - 1) * ALTURA_DA_LINHA;
  switch (tipo) {
    case 'table':
      return { largura: 400, altura: 280 + extra };
    case 'chart':
      return { largura: 400, altura: 320 + extra };
    case 'both':
      return { largura: 400, altura: 430 + extra };
    case 'none':
      return { largura: 0, altura: 0 };
  }
}

function textoPreenchido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * As linhas de identificação sob o título. Sessão antiga pode chegar com
 * campo ausente, e campo em branco não vira "Pesquisador: " vazio.
 */
export function linhasDeCabecalho(metadata: Partial<Metadata> | null | undefined): string[] {
  const linhas: string[] = [];
  if (!metadata) return linhas;
  if (textoPreenchido(metadata.researcher)) linhas.push(`Pesquisador: ${metadata.researcher.trim()}`);
  const detalhes: string[] = [];
  if (textoPreenchido(metadata.plate)) detalhes.push(`Placa: ${metadata.plate.trim()}`);
  if (textoPreenchido(metadata.quadrant)) detalhes.push(`Quad: ${metadata.quadrant.trim()}`);
  if (detalhes.length > 0) linhas.push(detalhes.join(' | '));
  return linhas;
}

function fatiaDePizza(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  raio: number,
  anguloInicial: number,
  anguloFinal: number,
  cor: string
): void {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, raio, anguloInicial, anguloFinal);
  ctx.closePath();
  ctx.fill();
}

/** Contorno que vale desenhar: visível, da classe pedida e com área. */
function contornosADesenhar(
  segmentations: readonly YoloSegmentation[],
  options: ImageExportOptions
): YoloSegmentation[] {
  return segmentations.filter((seg) => {
    if (seg.visible === false) return false;
    if (!Array.isArray(seg.polygon_points) || seg.polygon_points.length < 3) return false;
    return seg.category === 'viable' ? options.includeViable : options.includeInviable;
  });
}

function desenharContornos(
  ctx: CanvasRenderingContext2D,
  contornos: readonly YoloSegmentation[],
  larguraDaImagem: number
): void {
  const traco = espessuraNaImagem(larguraDaImagem, 2);
  for (const seg of contornos) {
    const [primeiro, ...resto] = seg.polygon_points;
    ctx.beginPath();
    ctx.moveTo(primeiro[0], primeiro[1]);
    for (const [x, y] of resto) ctx.lineTo(x, y);
    ctx.closePath();

    ctx.fillStyle = seg.category === 'viable' ? ESPECIME_FILL.viable : ESPECIME_FILL.inviable;
    ctx.fill();
    ctx.strokeStyle = corDoEspecime(seg.category);
    ctx.lineWidth = traco;
    ctx.setLineDash([]);
    ctx.stroke();
  }
}

function desenharLegenda(
  ctx: CanvasRenderingContext2D,
  tipo: Exclude<TipoDeSobreposicao, 'none'>,
  cabecalho: readonly string[],
  resumo: ResumoDaCena
): void {
  const margem = MARGEM_DA_CAIXA;
  const recuo = RECUO_DA_CAIXA;
  const { largura, altura } = dimensoesDaCaixa(tipo, cabecalho.length);
  const esquerda = margem + recuo;
  const direita = margem + largura - recuo;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(23, 23, 23, 0.85)';
  ctx.beginPath();
  ctx.roundRect(margem, margem, largura, altura, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = 'white';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Relatório de Viabilidade', esquerda, margem + recuo);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#cbd6d9';
  let y = margem + 60;
  for (const linha of cabecalho) {
    ctx.fillText(linha, esquerda, y);
    y += ALTURA_DA_LINHA;
  }

  y += 10;
  ctx.strokeStyle = '#4a585c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(esquerda, y);
  ctx.lineTo(direita, y);
  ctx.stroke();
  y += 20;

  if (tipo === 'table' || tipo === 'both') {
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Tabela de Classes', esquerda, y);
    y += 30;

    ctx.font = '16px sans-serif';
    ctx.fillStyle = corDoEspecime('viable');
    ctx.textAlign = 'left';
    ctx.fillText('Viáveis:', esquerda, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${resumo.viaveis} (${resumo.pctViaveis}%)`, direita, y);

    y += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = corDoEspecime('inviable');
    ctx.fillText('Inviáveis/Mortas:', esquerda, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${resumo.inviaveis} (${resumo.pctInviaveis}%)`, direita, y);

    y += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.fillText('Total:', esquerda, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(String(resumo.total), direita, y);
    y += 30;
  }

  if (tipo === 'chart' || tipo === 'both') {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Gráfico de Proporção', esquerda, y);
    y += 20;

    const cx = margem + largura / 2;
    const cy = y + 60;
    const raio = 50;

    if (resumo.total === 0) {
      fatiaDePizza(ctx, cx, cy, raio, 0, 2 * Math.PI, '#4a585c');
    } else {
      // Disco inteiro na cor de inviável; a fatia viável vai por cima, a
      // partir do topo. Assim 100% viável cobre tudo e 0% não desenha nada.
      fatiaDePizza(ctx, cx, cy, raio, 0, 2 * Math.PI, corDoEspecime('inviable'));
      if (resumo.viaveis > 0) {
        const anguloViavel = (resumo.viaveis / resumo.total) * 2 * Math.PI;
        fatiaDePizza(ctx, cx, cy, raio, -Math.PI / 2, -Math.PI / 2 + anguloViavel, corDoEspecime('viable'));
      }
    }

    y = cy + raio + 20;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.fillText(`Viáveis (${resumo.viaveis})  |  Inviáveis (${resumo.inviaveis})`, cx, y);
  }

  ctx.restore();
}

/** Qualquer fonte que `drawImage` aceite e que saiba o próprio tamanho. */
export type ImagemDeBase = (HTMLImageElement | HTMLCanvasElement | ImageBitmap) & {
  width: number;
  height: number;
};

export interface AparenciaDaMarca {
  estiloDaMarca?: EstiloDaMarca;
  opacidadeDaMarca?: number;
}

/**
 * Desenha a cena anotada num contexto já obtido. É o que os testes exercitam
 * com um contexto falso; `drawAnnotatedImageToCanvas` só acrescenta o
 * `getContext`.
 *
 * Devolve o resumo que foi escrito na legenda, para que quem exporta possa
 * registrar o mesmo número que a imagem mostra.
 */
export function desenharCenaAnotada(
  ctx: CanvasRenderingContext2D,
  imagem: ImagemDeBase,
  metadata: Partial<Metadata> | null | undefined,
  marks: Mark[],
  segmentations: YoloSegmentation[],
  options: ImageExportOptions,
  visualMode: ModoVisual,
  ajusteDaMarca: number,
  aparencia: AparenciaDaMarca = {}
): ResumoDaCena {
  ctx.drawImage(imagem, 0, 0);

  desenharContornos(ctx, contornosADesenhar(segmentations, options), imagem.width);

  // Enumera a cena INTEIRA e só então filtra: é o que preserva os índices.
  const objetos = filtrarCena(enumerarObjetos(marks, segmentations), options);
  desenharObjetos(ctx, objetos, {
    modo: visualMode,
    larguraDaImagem: imagem.width,
    ajusteDaMarca,
    estiloDaMarca: aparencia.estiloDaMarca,
    opacidadeDaMarca: aparencia.opacidadeDaMarca,
  });

  const resumo = resumoDaCena(objetos);
  if (options.overlayType !== 'none') {
    desenharLegenda(ctx, options.overlayType, linhasDeCabecalho(metadata), resumo);
  }
  return resumo;
}

/**
 * A entrada que o App chama com um canvas fora da tela. Sem contexto 2D
 * (canvas sem suporte, memória esgotada) não há o que desenhar e o chamador
 * recebe `null` em vez de um PNG em branco disfarçado de resultado.
 */
export function drawAnnotatedImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  metadata: Metadata,
  marks: Mark[],
  segmentations: YoloSegmentation[],
  options: ImageExportOptions,
  visualMode: ModoVisual,
  ajusteDaMarca: number,
  aparencia: AparenciaDaMarca = {}
): ResumoDaCena | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return desenharCenaAnotada(
    ctx,
    image,
    metadata,
    marks,
    segmentations,
    options,
    visualMode,
    ajusteDaMarca,
    aparencia
  );
}
