// =============================================================================
// SeedCounter — explorador de datasets: carregar imagem e "Carregar referência"
//
// POR QUE EXISTE. Mesmo molde de `features/sessao` e `features/importar`: o
// App entrega o que os dois handlers precisam LER e ESCREVER, e recebe de
// volta o estado (`pastaDeDatasets`) e os handlers que `DatasetsPanel` e o
// aviso sobre o canvas sempre receberam.
//
// A TRADUÇÃO DA ANOTAÇÃO NÃO MORA AQUI. `normalizarClasseExterna` e
// `objetosDaReferencia`, em `referencia.ts`, são a parte pura — o que dá para
// provar em node contra o formato antigo do App. Este arquivo só orquestra:
// busca o arquivo, entrega à fila, e liga o resultado da tradução aos
// setters da cena.
//
// O QUE FICA NO APP, E POR QUÊ (não é deste hook):
//   `datasetPendente` — a ref que `onImageLoaded` lê para saber que a
//     imagem que acabou de chegar veio do explorador; é lida em outro ponto
//     do App, fora do que este hook controla, então só o REF entra aqui
//     (mesmo padrão de `chaveAtual` em `features/sessao/useSessao.ts`).
//   `anotacaoAtual`, `datasetContexto`, `referenciaJaCarregada` — estado de
//     CENA (`useBancada` → `bancada.cena`), porque trocar de bancada não
//     pode trocar a anotação pendente de OUTRA bancada. O hook só recebe o
//     que precisa; `datasetContexto` não entra aqui porque só é LIDO na
//     JSX (o aviso "Anotação do dataset disponível"), nunca escrito por um
//     handler além de `handleCarregarDoDataset`.
//   `recadoDaOnda` — estado do App, mostrado junto ao canvas para qualquer
//     aviso, não só o desta tela; o hook recebe um callback (`avisar`).
//   `loadFiles`, `image` — da fila e da cena; o hook só lê.
// =============================================================================

import { useCallback, useState, type MutableRefObject } from 'react';
import type { Mark, Metadata, YoloSegmentation } from '../../types';
import type { AnotacaoCarregada } from './anotacao';
import type { ArquivoDoDataset, PastaAberta } from './fonte';
import { objetosDaReferencia, podeCarregarReferencia as calcularPodeCarregarReferencia } from './referencia';

export interface EntradaDoExplorador {
  loadFiles: (files: File[]) => void;
  /** Ver o cabeçalho: mora no App, lida por `onImageLoaded`. */
  datasetPendente: MutableRefObject<Metadata['dataset'] | null>;

  // --- Estado de CENA (`bancada.cena`) ---------------------------------------
  image: HTMLImageElement | null;
  anotacaoAtual: AnotacaoCarregada | null;
  setAnotacaoAtual: (a: AnotacaoCarregada | null) => void;
  setDatasetContexto: (d: { conjunto: string; caminho: string } | null) => void;
  referenciaJaCarregada: boolean;
  setReferenciaJaCarregada: (v: boolean) => void;

  // --- Marcas e contornos da cena (`bancada.anotacoes`) -----------------------
  addYoloSegmentations: (segs: YoloSegmentation[]) => void;
  setMarks: (a: Mark[] | ((prev: Mark[]) => Mark[])) => void;

  /** Ver o cabeçalho: `recadoDaOnda` é do App — este hook só avisa. */
  avisar: (recado: { tom: 'ok' | 'aviso'; texto: string }) => void;
}

export function useExplorador(entrada: EntradaDoExplorador) {
  const {
    loadFiles,
    datasetPendente,
    image,
    anotacaoAtual,
    setAnotacaoAtual,
    setDatasetContexto,
    referenciaJaCarregada,
    setReferenciaJaCarregada,
    addYoloSegmentations,
    setMarks,
    avisar,
  } = entrada;

  // A pasta aberta mora aqui (não dentro do painel) porque é estado da
  // sessão: recolher a aba Datasets e voltar não a fecha.
  const [pastaDeDatasets, setPastaDeDatasets] = useState<PastaAberta | null>(null);

  const handleCarregarDoDataset = useCallback(
    async (arquivo: ArquivoDoDataset, anotacao: AnotacaoCarregada | null, conjunto: string, caminho: string) => {
      const file = await arquivo.obterFile();
      // O vínculo com o dataset é entregue a `onImageLoaded`, que zera o
      // vínculo de TODA imagem nova e só mantém o que foi anunciado aqui —
      // senão a classe da imagem anterior ficava colada na seguinte.
      datasetPendente.current = { conjunto, caminho, classesDaImagem: anotacao?.classesDaImagem };
      loadFiles([file]);
      setAnotacaoAtual(anotacao);
      setDatasetContexto({ conjunto, caminho });
      setReferenciaJaCarregada(false);
    },
    [loadFiles, datasetPendente, setAnotacaoAtual, setDatasetContexto, setReferenciaJaCarregada]
  );

  const podeCarregarReferencia = calcularPodeCarregarReferencia(image, referenciaJaCarregada, anotacaoAtual);

  /**
   * "Carregar referência" — o SEGUNDO gesto. Clicar na miniatura já carregou
   * a imagem; só agora a anotação do dataset vira marca/contorno de verdade.
   * `Date.now()` é lido UMA vez aqui (não dentro de `objetosDaReferencia`) —
   * ver o cabeçalho de `referencia.ts` sobre a colisão de ids que isso
   * reproduz de propósito.
   */
  const handleCarregarReferencia = useCallback(() => {
    if (!anotacaoAtual) return;

    const { segmentacoes, marcas } = objetosDaReferencia(anotacaoAtual, Date.now());
    if (segmentacoes.length > 0) addYoloSegmentations(segmentacoes);
    if (marcas.length > 0) setMarks((prev) => [...prev, ...marcas]);

    setReferenciaJaCarregada(true);
    avisar({ tom: 'ok', texto: 'Referência do dataset carregada.' });
  }, [anotacaoAtual, addYoloSegmentations, setMarks, setReferenciaJaCarregada, avisar]);

  return {
    pastaDeDatasets,
    setPastaDeDatasets,
    handleCarregarDoDataset,
    podeCarregarReferencia,
    handleCarregarReferencia,
  };
}
