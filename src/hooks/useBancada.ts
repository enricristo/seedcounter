import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useImageQueue } from './useImageQueue';
import { useMarks } from './useMarks';
import { useMetadata } from './useMetadata';
import { useZoom } from './useZoom';
import { usePanning } from './usePanning';
import { ESTADO_INICIAL as MASCARA_INICIAL, type Mascara } from '../features/mascara';
import { NEUTRAL_ADJUSTMENTS, type ImageAdjustments } from '../lib/image-adjust';
import type { Regiao } from '../lib/region';
import type { AnotacaoCarregada } from '../features/datasets/anotacao';

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
 * O que NÃO mora aqui ainda: as refs `marcasRef`, `segmentacoesRef`,
 * `anotacoesPorImagem` e `chaveAtual`, que o `onImageLoaded` do App usa para
 * lembrar a anotação da imagem anterior ao trocar na fila. Elas SÃO estado de
 * cena por natureza, mas nesta Task 1 `onImageLoaded` continua no App (não
 * sabe de bancada) e as lê direto — migram para dentro de `useBancada` na
 * Task 2, quando `onImageLoaded` passar a receber o índice da bancada e puder
 * indexar por bancada em vez de globalmente. Migração pela metade seria pior
 * que a honestidade de deixar isto escrito.
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
  const fila = useImageQueue({ onImageLoaded: opcoes?.onImageLoaded });

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
    },
  };
}
