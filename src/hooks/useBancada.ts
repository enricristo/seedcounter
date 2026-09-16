import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useImageQueue } from './useImageQueue';
import { useMarks } from './useMarks';
import { useMetadata } from './useMetadata';
import { useZoom } from './useZoom';
import { usePanning } from './usePanning';
import { ESTADO_INICIAL as MASCARA_INICIAL, type Mascara } from '../features/mascara';
import { NEUTRAL_ADJUSTMENTS, type ImageAdjustments } from '../lib/image-adjust';
import type { Regiao } from '../lib/region';
import type { AnotacaoCarregada } from '../features/datasets/anotacao';
import type { Mark, YoloSegmentation } from '../types';

/**
 * Chave de uma imagem na fila: nome + tamanho, não índice — senão reordenar
 * a fila trocaria a contagem de lugar. Pura, sem estado: não precisa ser um
 * hook.
 */
function chaveDaImagem(file: File): string {
  return `${file.name}:${file.size}`;
}

/**
 * Uma cena: imagem, marcações, contornos, histórico, metadados, calibração e
 * ajustes sempre foram uma coisa só — só que espalhados em ~40 declarações
 * soltas no `App.tsx`. Com quatro bancadas (C2), estado de cena solto no App
 * vira estado COMPARTILHADO entre todas: mexer numa mudaria a outra, e o
 * defeito seria sutil (ver `docs/superpowers/plans/2026-09-16-bancadas.md`).
 *
 * Compõe os cinco hooks que já eram por-cena (`useImageQueue`, `useMarks`,
 * `useMetadata`, `useZoom`, `usePanning`) e os nove estados de cena que o
 * teste `bancada-e-a-unidade-da-cena.test.ts` cobra, mais dois que também são
 * vínculo com uma imagem específica (`anotacaoAtual`, `datasetContexto`) mas
 * têm nome próprio no App e por isso ficam fora da lista do teste.
 *
 * `marcasRef`, `segmentacoesRef`, `anotacoesPorImagem` e `chaveAtual` — que
 * guardam a anotação da imagem anterior ao trocar na fila — migraram do App
 * para cá na Task 2. No App elas eram UMA cópia só; com quatro bancadas isso
 * viraria estado COMPARTILHADO entre elas — o cache da bancada 1 serviria a
 * imagem da bancada 3. Aqui, cada `useBancada` tem o seu próprio `Map` e a
 * sua própria chave atual, e o próprio hook cuida de salvar a anotação que
 * sai e carregar a que entra sempre que a fila troca de imagem — é por isso
 * que `useImageQueue` recebe `onImageLoadedNaFila` (interno) em vez do
 * `onImageLoaded` que a bancada recebeu de fora: aquele cuida da cena, este
 * cuida do resto (dataset pendente, ensaio ao carregar, ajuste do zoom).
 *
 * `anotacoesPorImagem` e a função `chaveDaImagem` ficam só aqui dentro —
 * nada fora de `useBancada` precisa delas. `chaveAtual`, `marcasRef` e
 * `segmentacoesRef` continuam expostas por `cena`: o App ainda lê e zera
 * esses três em alguns pontos (restaurar sessão, cortar contorno, borracha).
 */
export interface EstadoDaCena {
  fundoAchatado: HTMLImageElement | null;
  setFundoAchatado: Dispatch<SetStateAction<HTMLImageElement | null>>;
  adjustments: ImageAdjustments;
  setAdjustments: Dispatch<SetStateAction<ImageAdjustments>>;
  adjustEnabled: boolean;
  setAdjustEnabled: Dispatch<SetStateAction<boolean>>;
  mascara: Mascara;
  setMascara: Dispatch<SetStateAction<Mascara>>;
  contornoSelecionado: number | null;
  setContornoSelecionado: Dispatch<SetStateAction<number | null>>;
  regiaoDeDeteccao: Regiao | null;
  setRegiaoDeDeteccao: Dispatch<SetStateAction<Regiao | null>>;
  ultimaGravacao: number | null;
  setUltimaGravacao: Dispatch<SetStateAction<number | null>>;
  forcarOriginalNasAutomacoes: boolean;
  setForcarOriginalNasAutomacoes: Dispatch<SetStateAction<boolean>>;
  /** Vínculo com o explorador de datasets, quando a imagem veio de lá. */
  anotacaoAtual: AnotacaoCarregada | null;
  setAnotacaoAtual: Dispatch<SetStateAction<AnotacaoCarregada | null>>;
  datasetContexto: { conjunto: string; caminho: string } | null;
  setDatasetContexto: Dispatch<SetStateAction<{ conjunto: string; caminho: string } | null>>;
  referenciaJaCarregada: boolean;
  setReferenciaJaCarregada: Dispatch<SetStateAction<boolean>>;
  /**
   * Espelhos de `anotacoes.marks`/`anotacoes.yoloSegmentations`, para leitura
   * dentro de callbacks (corte, borracha, arraste de vértice) sem depender do
   * fecho do render — o mesmo motivo que já valia quando essas refs moravam
   * no App.
   */
  marcasRef: MutableRefObject<Mark[]>;
  segmentacoesRef: MutableRefObject<YoloSegmentation[]>;
  /**
   * Chave (nome+tamanho) da imagem atualmente aberta NESTA bancada, para o
   * cache de anotações por imagem. Exposta porque restaurar uma sessão troca
   * a imagem sem passar pela fila — quem restaura precisa zerá-la para a
   * próxima imagem da fila não ser guardada sob a chave da sessão anterior.
   */
  chaveAtual: MutableRefObject<string | null>;
}

export interface Bancada {
  id: string;
  /** Tudo de `useImageQueue` (image, filename, imageQueue, loadFiles, …). */
  fila: ReturnType<typeof useImageQueue>;
  /** Tudo de `useMarks` (marks, yoloSegmentations, desfazer, mutar, …). */
  anotacoes: ReturnType<typeof useMarks>;
  meta: ReturnType<typeof useMetadata>;
  zoom: ReturnType<typeof useZoom>;
  pan: ReturnType<typeof usePanning>;
  cena: EstadoDaCena;
}

export function useBancada(
  id: string,
  opcoes?: { onImageLoaded?: (img: HTMLImageElement, file: File) => void }
): Bancada {
  const anotacoes = useMarks();
  const meta = useMetadata();
  const zoom = useZoom();
  const pan = usePanning();

  // Cache de anotações por imagem desta bancada (ver comentário do topo do
  // arquivo). `marcasRef`/`segmentacoesRef` espelham o estado corrente de
  // `anotacoes` para leitura síncrona dentro do cache e de callbacks do App.
  const anotacoesPorImagem = useRef<
    Map<string, { marks: Mark[]; yoloSegmentations: YoloSegmentation[] }>
  >(new Map());
  const chaveAtual = useRef<string | null>(null);
  const marcasRef = useRef<Mark[]>(anotacoes.marks);
  const segmentacoesRef = useRef<YoloSegmentation[]>(anotacoes.yoloSegmentations);

  useEffect(() => {
    marcasRef.current = anotacoes.marks;
  }, [anotacoes.marks]);
  useEffect(() => {
    segmentacoesRef.current = anotacoes.yoloSegmentations;
  }, [anotacoes.yoloSegmentations]);

  const onImageLoadedNaFila = (img: HTMLImageElement, file: File) => {
    // As anotações da imagem que estava aberta são guardadas ANTES de a nova
    // entrar. Sem isto, navegar na fila apagava a contagem anterior sem
    // aviso — e numa fila de 12 pedaços de scanner isso é perder o trabalho
    // de uma folha inteira. A leitura vem das refs, não do estado: este
    // callback roda dentro do fecho assíncrono do `FileReader`, onde o valor
    // capturado pelo fecho pode estar velho.
    if (chaveAtual.current) {
      anotacoesPorImagem.current.set(chaveAtual.current, {
        marks: marcasRef.current,
        yoloSegmentations: segmentacoesRef.current,
      });
    }

    const chave = chaveDaImagem(file);
    chaveAtual.current = chave;

    // Trocar de imagem RECOMEÇA o histórico: o Ctrl+Z desta imagem não pode
    // desfazer o que se fez na anterior.
    const guardado = anotacoesPorImagem.current.get(chave);
    anotacoes.carregar(
      guardado ? { marks: guardado.marks, segmentacoes: guardado.yoloSegmentations } : {}
    );

    opcoes?.onImageLoaded?.(img, file);
  };

  const fila = useImageQueue({ onImageLoaded: onImageLoadedNaFila });

  const [fundoAchatado, setFundoAchatado] = useState<HTMLImageElement | null>(null);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [adjustEnabled, setAdjustEnabled] = useState(true);
  const [mascara, setMascara] = useState<Mascara>(MASCARA_INICIAL);
  const [contornoSelecionado, setContornoSelecionado] = useState<number | null>(null);
  const [regiaoDeDeteccao, setRegiaoDeDeteccao] = useState<Regiao | null>(null);
  const [ultimaGravacao, setUltimaGravacao] = useState<number | null>(null);
  const [forcarOriginalNasAutomacoes, setForcarOriginalNasAutomacoes] = useState(false);
  const [anotacaoAtual, setAnotacaoAtual] = useState<AnotacaoCarregada | null>(null);
  const [datasetContexto, setDatasetContexto] = useState<{ conjunto: string; caminho: string } | null>(
    null
  );
  const [referenciaJaCarregada, setReferenciaJaCarregada] = useState(false);

  return {
    id,
    fila,
    anotacoes,
    meta,
    zoom,
    pan,
    cena: {
      fundoAchatado,
      setFundoAchatado,
      adjustments,
      setAdjustments,
      adjustEnabled,
      setAdjustEnabled,
      mascara,
      setMascara,
      contornoSelecionado,
      setContornoSelecionado,
      regiaoDeDeteccao,
      setRegiaoDeDeteccao,
      ultimaGravacao,
      setUltimaGravacao,
      forcarOriginalNasAutomacoes,
      setForcarOriginalNasAutomacoes,
      anotacaoAtual,
      setAnotacaoAtual,
      datasetContexto,
      setDatasetContexto,
      referenciaJaCarregada,
      setReferenciaJaCarregada,
      marcasRef,
      segmentacoesRef,
      chaveAtual,
    },
  };
}
