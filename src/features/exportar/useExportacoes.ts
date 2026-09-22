// =============================================================================
// SeedCounter — as exportações da cena, fora do App
//
// POR QUE EXISTE. `App.tsx` chegou a 4 190 linhas e quatro agentes precisaram
// combinar "regiões" para não se pisarem nele. Exportar é a primeira
// responsabilidade a sair inteira: tudo o que lá começava com `handleExport*`
// e `handleImageExport*` mora aqui, com a trilha (`registrarEvento`) junto.
// O App só chama o hook e entrega os handlers aos mesmos componentes de antes.
//
// O QUE O HOOK NÃO FAZ. Não cria estado. Recebe a cena (marcas, contornos,
// metadados, imagem), a contagem já feita, a aparência da marca, o histórico
// e o que a procedência precisa (cronômetro, página do TIFF, calibração
// conferida). Modal aberto/fechado fica no App: alimenta `isAnyModalOpen`,
// que desliga atalhos e ferramentas — e isso é da casca, não da exportação.
//
// A PROCEDÊNCIA É MONTADA NA HORA. `montarProcedencia` lê o cronômetro no
// instante em que o arquivo sai; guardá-la em estado obrigaria a regravar
// metadado a cada segundo, e o valor que importa é o do instante em que o
// dado sai. `buildMeasurementContext` é o único lugar por onde CSV, SQL,
// laudo e analytics passam — a procedência entra ali, e os pixels também.
//
// O que é puro (nomes, textos, contexto, decisões) está em `contexto.ts`.
// =============================================================================

import { useCallback } from 'react';
import type { Mark, Metadata, Session, YoloSegmentation } from '../../types';
import type { EstiloDaMarca } from '../../theme/specimen';
import type { ModoVisual } from '../../lib/render-marks';
import type { ImageExportOptions } from '../../lib/export-image';
import type { EscopoDaExportacao } from '../../components/modals/ImageExportModal';
import type { IdentificacaoDoLaboratorio } from '../../lib/normas/identificacao';
import type { TempoDaAnalise } from '../../lib/cronometro-de-analise';
import { buildMeasurements, measurementsToCSV, measurementsToSQL } from '../../lib/measurements';
// O laudo entra por `import()` no clique, e não no topo: `lib/laudo` puxa o
// jsPDF, e um import estático aqui fazia o HTML pré-carregar o pedaço
// `pdf-export` (jspdf + html2canvas) na abertura do app — para quem só vai
// contar. O mesmo padrão que o app já usa para `jszip` e `export-image`.
// `montarMetricasAvancadas` é puro e leve, e vem de `montagem` direto.
import { montarMetricasAvancadas } from '../../lib/laudo/montagem';
import { baixarArquivo } from '../../lib/download';
import { registrarEvento } from '../../lib/diagnostico/trilha';
import { comAtividade } from '../atividade/atividade';
import {
  contextoDeMedicao,
  csvDeContagem,
  csvDoHistorico,
  nomeDoArquivoExportado,
  nomeDoBackupDoHistorico,
  nomeDoPngDaSessao,
  oQueEntraNoLaudo,
  procedenciaDaCena,
  relatorioEmTexto,
  sessaoEmJSON,
  sessoesComImagem,
  type CalibracaoConferida,
  type ResultadoDaContagem,
} from './contexto';

/** Como a marca aparece na tela — o PNG sai com a MESMA. */
export interface AparenciaDaCena {
  visualMode: ModoVisual;
  ajusteDaMarca: number;
  estiloDaMarca: EstiloDaMarca;
  opacidadeDaMarca: number;
}

export interface EntradaDasExportacoes {
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  metadata: Metadata;
  filename: string;
  image: HTMLImageElement | null;
  /** O histórico local — o lote de PDFs e de PNGs e os CSV/JSON dele. */
  sessions: Session[];
  contagem: ResultadoDaContagem;
  aparencia: AparenciaDaCena;
  laboratorio: IdentificacaoDoLaboratorio | undefined;
  /** `cronometro.ler` — chamado no instante da exportação, nunca antes. */
  lerTempo: () => TempoDaAnalise;
  /** Da fila: página do TIFF (base 0), total e o DPI que o arquivo declara. */
  pagina: { paginasDoTiff: number; paginaDoTiff: number; dpiDeclarado: number | null };
  calibracaoConferida: CalibracaoConferida | null;
}

export function useExportacoes(e: EntradaDasExportacoes) {
  const {
    marks,
    segmentacoes,
    metadata,
    filename,
    image,
    sessions,
    contagem,
    aparencia,
    laboratorio,
    lerTempo,
    pagina,
    calibracaoConferida,
  } = e;
  const { visualMode, ajusteDaMarca, estiloDaMarca, opacidadeDaMarca } = aparencia;

  const generateExportName = useCallback(
    (extensao: string, tipo?: string) =>
      nomeDoArquivoExportado({ filename, metadata }, extensao, tipo),
    [filename, metadata]
  );

  // --- Os formatos simples ------------------------------------------------

  const handleExportTextReport = () => {
    baixarArquivo(
      relatorioEmTexto({ filename, metadata, contagem }),
      generateExportName('txt', 'relatorio'),
      'text/plain'
    );
  };

  const handleExportJSON = () => {
    baixarArquivo(
      sessaoEmJSON({ filename, metadata, contagem, marks, segmentacoes }),
      generateExportName('json', 'sessao'),
      'application/json'
    );
  };

  const handleExportCSV = () => {
    registrarEvento('exportar', { tipo: 'CSV', saida: 'contagem', total: contagem.totalCount });
    baixarArquivo(
      csvDeContagem({ filename, metadata, contagem }),
      generateExportName('csv', 'contagem'),
      'text/csv'
    );
  };

  // --- Exportação por objeto (uma linha por semente) ---------------------
  // Funciona em qualquer cenário: sem calibração sai em pixels, sem
  // segmentação sai só posição e classe. Nenhuma camada é obrigatória.
  /**
   * Lê os pixels da imagem em exibição, para as medidas de cor por objeto.
   *
   * Feito sob demanda, só na hora de exportar: manter um ImageData de uma
   * digitalização de 7992×3672 vivo o tempo todo custaria ~117 MB de RAM por
   * imagem, e a contagem manual não precisa dele.
   *
   * Devolve undefined se algo falhar — as colunas de cor saem vazias e a
   * morfometria continua inteira, porque ela não depende dos pixels.
   */
  const lerPixelsDaImagem = useCallback(() => {
    if (!image) return undefined;
    try {
      const off = document.createElement('canvas');
      off.width = image.width;
      off.height = image.height;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    } catch {
      // Imagem de outra origem marca o canvas como contaminado e getImageData
      // lança. Não é motivo para abortar a exportação inteira.
      return undefined;
    }
  }, [image]);

  /**
   * O que produziu estes números: versão, página, escala e custo.
   *
   * Montado na hora de exportar, e não guardado no estado, porque o tempo muda
   * a cada segundo e guardá-lo obrigaria a regravar metadado o tempo todo. O
   * valor que importa é o do instante em que o dado sai.
   */
  const montarProcedencia = useCallback(
    (): Metadata['procedencia'] =>
      procedenciaDaCena({
        tempo: lerTempo(),
        paginasDoTiff: pagina.paginasDoTiff,
        paginaDoTiff: pagina.paginaDoTiff,
        dpiDeclarado: pagina.dpiDeclarado,
        calibracaoConferida,
        versaoDoApp: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
        commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : undefined,
      }),
    [lerTempo, pagina.paginasDoTiff, pagina.paginaDoTiff, pagina.dpiDeclarado, calibracaoConferida]
  );

  const buildMeasurementContext = useCallback(
    () =>
      contextoDeMedicao({
        marks,
        segmentacoes,
        metadata,
        filename,
        // A procedência é acrescentada AQUI, na saída, e não guardada no
        // estado: é o único lugar por onde todo export passa.
        procedencia: montarProcedencia(),
        imageData: lerPixelsDaImagem(),
      }),
    [marks, segmentacoes, metadata, filename, lerPixelsDaImagem, montarProcedencia]
  );

  const handleExportMeasurementsCSV = useCallback(() => {
    const ctx = buildMeasurementContext();
    const rows = buildMeasurements(ctx);
    const csv = measurementsToCSV(rows, ctx);
    // Trilha: quantas linhas saíram é o que separa "exportou vazio" de
    // "exportou errado" — dois relatos que chegam com a mesma frase.
    registrarEvento('exportar', { tipo: 'CSV', saida: 'medidas', linhas: rows.length });
    baixarArquivo(csv, generateExportName('csv', 'medidas'), 'text/csv;charset=utf-8;');
  }, [buildMeasurementContext, generateExportName]);

  const handleExportSQL = useCallback(() => {
    const ctx = buildMeasurementContext();
    const rows = buildMeasurements(ctx);
    const sql = measurementsToSQL(rows, ctx);
    registrarEvento('exportar', { tipo: 'SQL', linhas: rows.length });
    baixarArquivo(sql, generateExportName('sql', 'medidas'), 'text/plain;charset=utf-8;');
  }, [buildMeasurementContext, generateExportName]);

  // --- A foto anotada -------------------------------------------------------

  /**
   * O PNG anotado: a cena aberta, ou um ZIP com uma foto por sessão do
   * histórico. Quem chama fecha o diálogo antes; aqui só se desenha e baixa.
   */
  const handleImageExportWithOptions = async (
    options: ImageExportOptions,
    scope: EscopoDaExportacao
  ) => {
    if (scope === 'single') {
      if (!image) return;

      const { drawAnnotatedImageToCanvas } = await import('../../lib/export-image');
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = image.width;
      offscreenCanvas.height = image.height;

      drawAnnotatedImageToCanvas(
        offscreenCanvas,
        image,
        metadata,
        marks,
        segmentacoes,
        options,
        visualMode,
        ajusteDaMarca,
        // O PNG sai com a MESMA marca que a pessoa conferiu na tela — antes
        // saía sempre disco opaco, e a imagem exportada contradizia o canvas.
        { estiloDaMarca, opacidadeDaMarca }
      );

      offscreenCanvas.toBlob((blob) => {
        if (blob) baixarArquivo(blob, generateExportName('png', 'anotada'), 'image/png');
      }, 'image/png');
      registrarEvento('exportar', { tipo: 'PNG', saida: 'anotada' });
    } else {
      // BATCH EXPORT (Fila Inteira do Histórico)
      if (sessions.length === 0) return;

      const { drawAnnotatedImageToCanvas } = await import('../../lib/export-image');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      await comAtividade('png-batch', `Exportando ${sessions.length} fotos...`, async () => {
        for (const sessao of sessoesComImagem(sessions)) {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = sessao.imageData;
          });

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = img.width;
          offscreenCanvas.height = img.height;

          drawAnnotatedImageToCanvas(
            offscreenCanvas,
            img,
            sessao.metadata,
            sessao.marks || [],
            sessao.yoloSegmentations || [],
            options,
            visualMode,
            ajusteDaMarca,
            { estiloDaMarca, opacidadeDaMarca }
          );

          const blob = await new Promise<Blob | null>((resolve) =>
            offscreenCanvas.toBlob(resolve, 'image/png')
          );
          if (blob) zip.file(nomeDoPngDaSessao(sessao.filename), blob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      baixarArquivo(content, `Lote_PNGs_Anotados.zip`, 'application/zip');
      registrarEvento('exportar', { tipo: 'PNG-Batch', total: sessions.length });
    }
  };

  // --- O laudo em PDF -------------------------------------------------------

  const handleExportPDF = async () => {
    const plano = oQueEntraNoLaudo({ marks, segmentacoes, temImagem: !!image });
    registrarEvento('exportar', {
      tipo: 'PDF',
      total: contagem.totalCount,
      temImagem: plano.temImagem,
    });

    // Métricas por classe (área média, a*, L*, b*) a partir da MESMA tabela
    // do CSV. Os pixels são lidos sob demanda por `buildMeasurementContext`
    // (~117 MB numa digitalização) e morrem com esta chamada — nada fica no
    // estado. Sem imagem a área ainda sai (vem do contorno); só a cor não.
    const metricasAvancadas = plano.comMetricas
      ? (montarMetricasAvancadas(buildMeasurements(buildMeasurementContext())) ?? undefined)
      : undefined;

    const { exportarLaudo } = await import('../../lib/laudo');
    const r = await comAtividade('pdf', 'Gerando o laudo.', () =>
      exportarLaudo({
        filename: filename || 'sem-titulo.jpg',
        metadata,
        viableCount: contagem.viableCount,
        inviableCount: contagem.inviableCount,
        marks,
        yoloSegmentations: segmentacoes,
        imageElement: image,
        visualMode,
        laboratorio,
        versaoDoApp: `v${__APP_VERSION__}`,
        commitDoBuild: __BUILD_COMMIT__,
        metricasAvancadas,
      })
    );
    if (!r.ok && r.erro) alert(r.erro);
  };

  const handleExportHistoryBatchPDF = async () => {
    registrarEvento('exportar', { tipo: 'PDF', saida: 'historico', sessoes: sessions.length });
    const { exportarLaudosEmLote } = await import('../../lib/laudo');
    const r = await comAtividade('pdf', `Gerando ${sessions.length} laudos…`, () =>
      exportarLaudosEmLote(sessions, {
        visualMode,
        laboratorio,
        versaoDoApp: `v${__APP_VERSION__}`,
        commitDoBuild: __BUILD_COMMIT__,
      })
    );
    if (!r.ok && r.erro) alert(r.erro);
  };

  // --- O histórico em CSV e JSON -------------------------------------------

  const handleExportHistoryCSV = () => {
    if (sessions.length === 0) return;
    baixarArquivo(csvDoHistorico(sessions), 'historico_contagens.csv', 'text/csv');
  };

  const handleExportHistoryJSON = () => {
    if (sessions.length === 0) return;
    baixarArquivo(JSON.stringify(sessions, null, 2), nomeDoBackupDoHistorico(), 'application/json');
  };

  return {
    buildMeasurementContext,
    handleExportTextReport,
    handleExportJSON,
    handleExportCSV,
    handleExportMeasurementsCSV,
    handleExportSQL,
    handleImageExportWithOptions,
    handleExportPDF,
    handleExportHistoryBatchPDF,
    handleExportHistoryCSV,
    handleExportHistoryJSON,
  };
}
