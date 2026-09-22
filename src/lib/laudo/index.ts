// =============================================================================
// SeedCounter — exportação do laudo
//
// O ponto de entrada. Junta as peças: renderiza as imagens, carrega os
// logotipos, monta o modelo e compõe o PDF.
//
// É assíncrono porque logotipo e imagem salva se carregam por evento. A versão
// anterior era síncrona e, por isso, não conseguia embutir nem uma coisa nem
// outra — o laudo em lote saía com a foto crua, sem as anotações, com um
// comentário no código admitindo que as marcas não estavam ali.
// =============================================================================

import { contornoRepresentaSemente } from '../contagem';
import { buildMeasurements } from '../measurements';
import { renderizarImagensDoLaudo, type ImagensDoLaudo } from './imagens';
import { logotiposInstitucionais } from './marca';
import {
  adicionarLaudo,
  comporLaudo,
  desenharRodapes,
  novoDocumento,
  type Trecho,
} from './documento';
import { montarLaudo, montarMetricasAvancadas, nomeDoArquivo, type Bloco, type EntradaDoLaudo } from './montagem';
import type { Mark, Session, YoloSegmentation } from '../../types';
import type { IdentificacaoDoLaboratorio } from '../normas/identificacao';
import type { VersaoDaNorma } from '../normas/versao';

export * from './montagem';
export * from './layout';
export { LADO_MAXIMO } from './imagens';

export interface OpcoesDeExportacao {
  filename: string;
  metadata: EntradaDoLaudo['metadata'];
  viableCount: number;
  inviableCount: number;
  marks: Mark[];
  yoloSegmentations?: YoloSegmentation[];
  imageElement: HTMLImageElement | null;
  visualMode: 'dots' | 'numbers';
  laboratorio?: IdentificacaoDoLaboratorio;
  numero?: string;
  norma?: VersaoDaNorma;
  versaoDoApp?: string;
  commitDoBuild?: string;
  metricasAvancadas?: EntradaDoLaudo['metricasAvancadas'];
}

export interface ResultadoDaExportacao {
  ok: boolean;
  /** Motivo legível quando `ok` é falso. Quem chama decide como mostrar. */
  erro?: string;
  nomeDoArquivo?: string;
  especie?: 'boletim' | 'relatorio';
}

/**
 * Exporta o laudo de uma contagem.
 *
 * Devolve o resultado em vez de chamar `alert`: uma biblioteca que interrompe a
 * página com um diálogo do navegador tira da interface a chance de mostrar o
 * erro no lugar certo — e em teste, trava.
 */
export async function exportarLaudo(op: OpcoesDeExportacao): Promise<ResultadoDaExportacao> {
  try {
    const segmentacoes = op.yoloSegmentations ?? [];

    let imagens: ImagensDoLaudo | null = null;
    if (op.imageElement) {
      imagens = renderizarImagensDoLaudo({
        imagem: op.imageElement,
        marks: op.marks,
        segmentacoes,
        visualMode: op.visualMode,
      });
    }

    const logos = await logotiposInstitucionais();

    const laudo = montarLaudo({
      filename: op.filename,
      metadata: op.metadata,
      viableCount: op.viableCount,
      inviableCount: op.inviableCount,
      laboratorio: op.laboratorio,
      numero: op.numero,
      norma: op.norma,
      versaoDoApp: op.versaoDoApp,
      commitDoBuild: op.commitDoBuild,
      umPerPixel: op.metadata.umPerPixel,
      marcas: op.marks,
      metricasAvancadas: op.metricasAvancadas,
      ...contarProcedencia(segmentacoes),
    });

    const doc = comporLaudo(laudo, imagens, logos);
    const nome = nomeDoArquivo(laudo, op.filename);
    doc.save(nome);

    return { ok: true, nomeDoArquivo: nome, especie: laudo.especie };
  } catch (erro) {
    console.error('Falha ao gerar o laudo', erro);
    return { ok: false, erro: 'Não foi possível gerar o PDF do laudo.' };
  }
}

/**
 * Exporta um laudo por sessão, num arquivo só.
 *
 * Cada sessão vira um documento completo — cabeçalho, identificação, imagens e
 * assinatura — em vez da folha resumida que a versão anterior produzia. Um
 * lote de laudos é um lote de LAUDOS, não um índice deles.
 */
export async function exportarLaudosEmLote(
  sessions: Session[],
  op: {
    visualMode: 'dots' | 'numbers';
    laboratorio?: IdentificacaoDoLaboratorio;
    versaoDoApp?: string;
    commitDoBuild?: string;
  }
): Promise<ResultadoDaExportacao> {
  if (!sessions?.length) {
    return { ok: false, erro: 'Nenhuma sessão selecionada para exportar.' };
  }

  try {
    const logos = await logotiposInstitucionais();
    const doc = novoDocumento();
    const trechos: Trecho[] = [];
    let primeiro = true;

    for (const sessao of sessions) {
      const segmentacoes = sessao.yoloSegmentations ?? [];
      const imagem = sessao.imageData ? await carregarImagem(sessao.imageData) : null;

      // Calculadas AGORA e descartadas ao fim da iteração — ver `metricasDaSessao`.
      const metricasAvancadas = metricasDaSessao(sessao, imagem);

      const imagens = imagem
        ? renderizarImagensDoLaudo({
            imagem,
            marks: sessao.marks ?? [],
            segmentacoes,
            visualMode: op.visualMode,
          })
        : null;

      const laudo = montarLaudo({
        filename: sessao.filename,
        metadata: sessao.metadata,
        viableCount: sessao.viableCount,
        inviableCount: sessao.inviableCount,
        laboratorio: op.laboratorio,
        emitidoEm: new Date(sessao.date),
        versaoDoApp: op.versaoDoApp,
        commitDoBuild: op.commitDoBuild,
        umPerPixel: sessao.metadata.umPerPixel,
        marcas: sessao.marks,
        metricasAvancadas,
        ...contarProcedencia(segmentacoes),
      });

      // Cada laudo começa em página nova: um boletim não divide folha com o
      // seguinte, porque a folha é a unidade que se destaca e se arquiva.
      if (!primeiro) doc.addPage();
      primeiro = false;

      trechos.push(adicionarLaudo(doc, laudo, imagens, logos));
    }

    desenharRodapes(doc, trechos);

    const nome =
      sessions.length === 1
        ? nomeDoArquivo(
            montarLaudo({
              filename: sessions[0].filename,
              metadata: sessions[0].metadata,
              viableCount: sessions[0].viableCount,
              inviableCount: sessions[0].inviableCount,
              laboratorio: op.laboratorio,
            }),
            sessions[0].filename
          )
        : `laudos_${sessions.length}_amostras.pdf`;

    doc.save(nome);
    return { ok: true, nomeDoArquivo: nome };
  } catch (erro) {
    console.error('Falha ao gerar os laudos em lote', erro);
    return { ok: false, erro: 'Não foi possível gerar o PDF em lote.' };
  }
}

// ---------------------------------------------------------------------------

/**
 * Quantos contornos vieram da máquina e quantos da pessoa.
 *
 * Usa a MESMA regra da contagem na tela (`contornoRepresentaSemente`), para que
 * o laudo não descreva uma procedência que a contagem não usou.
 */
function contarProcedencia(segmentacoes: YoloSegmentation[]) {
  let contornosDoModelo = 0;
  let contornosDoClique = 0;
  for (const seg of segmentacoes) {
    if (seg.visible === false) continue;
    if (contornoRepresentaSemente(seg)) contornosDoModelo++;
    else if (seg.origem === 'clique') contornosDoClique++;
  }
  return { contornosDoModelo, contornosDoClique };
}

/**
 * O bloco de métricas de UMA sessão salva, calculado na hora.
 *
 * A sessão não guarda medidas (ver MEMORY.md): guarda marcas e contornos, e a
 * foto como JPEG. Para a cor é preciso reler os pixels — um `ImageData` de
 * ~117 MB numa digitalização de 7992×3672 — e por isso isto é feito UMA
 * sessão por vez, dentro do laço, e o buffer morre ao devolver. Trinta
 * laudos em lote nunca têm mais de uma imagem decodificada ao mesmo tempo.
 *
 * Sem imagem (sessão antiga sem foto, ou JPEG que não carregou) a área ainda
 * sai — vem do contorno —, só a cor fica de fora, e o bloco diz isso.
 */
function metricasDaSessao(sessao: Session, imagem: HTMLImageElement | null): Bloco | undefined {
  const marks = sessao.marks ?? [];
  const segmentacoes = sessao.yoloSegmentations ?? [];
  if (marks.length === 0 && segmentacoes.length === 0) return undefined;

  let imageData: ImageData | undefined;
  if (imagem) {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = imagem.width;
      cvs.height = imagem.height;
      const ct = cvs.getContext('2d', { willReadFrequently: true });
      if (ct) {
        ct.drawImage(imagem, 0, 0);
        imageData = ct.getImageData(0, 0, cvs.width, cvs.height);
      }
    } catch {
      // Canvas contaminado ou sem memória: o laudo sai sem cor, não sem laudo.
      imageData = undefined;
    }
  }

  const medicoes = buildMeasurements({
    marks,
    segmentations: segmentacoes,
    metadata: sessao.metadata,
    filename: sessao.filename,
    imageData,
    // Mesmo salto de `buildMeasurementContext` (App.tsx): um de cada quatro
    // pixels não muda a média e corta o custo em 4x.
    colorSampling: 2,
  });
  return montarMetricasAvancadas(medicoes) ?? undefined;
}

function carregarImagem(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
