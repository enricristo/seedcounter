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
import { ehTiff } from '../lib/image-crop';
import { decodificarTiff } from '../lib/tiff';
import { deveReduzir, dimensoesReduzidas } from '../lib/reduzir-imagem';

/**
 * Chave de uma imagem na fila: nome + tamanho, não índice — senão reordenar
 * a fila trocaria a contagem de lugar. Pura, sem estado: não precisa ser um
 * hook.
 */
function chaveDaImagem(file: File): string {
  return `${file.name}:${file.size}`;
}

/**
 * Decodifica um `File` para `HTMLImageElement`, EM RESOLUÇÃO CHEIA, sem
 * nenhum efeito colateral de fila ou de cache de anotações — é usada só para
 * RECARREGAR a cheia depois de uma redução (Task 4), quando trocar de imagem
 * não é o que está acontecendo.
 *
 * Duplica (de propósito) o decodificador TIFF/normal de `useImageQueue.ts`:
 * extrair um utilitário compartilhado tocaria um arquivo fora do escopo desta
 * task (`useImageQueue.ts` não está entre os arquivos da Task 4), e os dois
 * decodificadores são pequenos o bastante para a duplicação ser mais barata
 * que o risco de mexer num hook usado por todas as bancadas.
 */
function decodificarImagemDeArquivo(file: File): Promise<HTMLImageElement> {
  if (ehTiff(file)) {
    return file.arrayBuffer().then((buffer) => {
      const dec = decodificarTiff(buffer);
      if (!dec) throw new Error('não é um TIFF que este leitor entenda');
      const canvas = document.createElement('canvas');
      canvas.width = dec.width;
      canvas.height = dec.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas indisponível');
      ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
      return new Promise<HTMLImageElement>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('não foi possível converter')); return; }
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
          img.src = url;
        }, 'image/png');
      });
    });
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem inválida ou corrompida'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gera uma versão reduzida (via canvas) de uma imagem já decodificada. Sai
 * como JPEG: é só para EXIBIÇÃO de uma bancada inativa — ninguém mede em
 * cima dela — e o formato com perda economiza ainda mais memória que reduzir
 * as dimensões sozinho.
 *
 * NÃO revoga a URL do blob no `onload`: `MarkingCanvas` (com `fundoEstatico`,
 * usado pela cena inativa) lê `image.src` num `<img>` PRÓPRIO, separado deste
 * objeto — revogar aqui quebraria esse `<img>` na primeira vez que tentasse
 * carregar. Quem revoga é `recarregarImagemCheia`, quando a reduzida deixa
 * de ser exibida.
 */
function gerarImagemReduzida(
  origem: HTMLImageElement,
  largura: number,
  altura: number
): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas indisponível'));
  ctx.drawImage(origem, 0, 0, largura, altura);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('não foi possível gerar a versão reduzida')); return; }
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem reduzida inválida')); };
        img.src = url;
      },
      'image/jpeg',
      0.85
    );
  });
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
  /**
   * Task 4 (memória): ao SAIR de ativa, gera uma reduzida (maior lado
   * ≤ 2000px) e troca `fila.image` por ela, SEM guardar a cheia em lugar
   * nenhum — é isso que de fato libera o bitmap para o coletor de lixo. Ao
   * VOLTAR a ativa, `recarregarImagemCheia` decodifica a cheia DE NOVO a
   * partir do `File` de origem (mais lento que ter mantido em memória, mas é
   * o ponto: aqui o recurso escasso é memória, não tempo). Enquanto a cheia
   * recarrega, a reduzida continua em `fila.image` — nada pisca (regra 1). A
   * reduzida tem `.width`/`.height` FORÇADOS para o tamanho da cheia, então
   * quem lê `image.width` (marcas, contornos, viewBox do SVG em
   * `MarkingCanvas`) não vê diferença — só o bitmap por trás é menor
   * (regra 2). Sem `File` de origem (sessão restaurada — ver `chaveAtual`)
   * ou abaixo do piso de 2500px no maior lado, estas duas funções não fazem
   * nada: mantêm a cheia (regras 4 e 5).
   *
   * Quem chama é `Bancadas.tsx`, reagindo à troca de bancada ativa — nunca a
   * própria bancada, que não sabe se é a ativa (isso é estado de
   * `useBancadas`, fora do escopo desta task).
   */
  liberarImagemCheia: () => void;
  recarregarImagemCheia: () => void;
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
  const meta = useMetadata(id);
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

  // --- Task 4 (memória): estado da redução de imagem, por bancada --------
  // `arquivoPorChave` guarda o `File` de origem de cada imagem que já passou
  // por esta bancada, indexado pela MESMA chave do cache de anotações acima
  // — é o que permite recarregar a cheia depois de reduzir. Uma sessão
  // restaurada zera `chaveAtual` sem passar por aqui (ver `App.handleLoadSession`),
  // então a busca por `chaveAtual.current` nesse caso não encontra `File`
  // nenhum — é assim que a regra 4 ("sem File, não libere a cheia") se aplica
  // sem precisar de um sinal explícito vindo de fora.
  const arquivoPorChave = useRef<Map<string, File>>(new Map());
  // `true` quando `fila.image` está mostrando a REDUZIDA desta bancada. Não
  // guarda o bitmap cheio em lugar NENHUM — só um `File` (metadado leve, sem
  // o decodificado por trás) e um booleano. É isso que de fato LIBERA o
  // bitmap: se guardássemos a referência à cheia "para reaproveitar depois",
  // o coletor de lixo nunca poderia recolhê-la, e a Task 4 não economizaria
  // memória nenhuma — só trocaria de nome o problema. `recarregarImagemCheia`
  // paga o preço de decodificar de novo do zero, de propósito.
  // `reduzindoOuRecarregando` evita duas operações assíncronas disputando o
  // mesmo `fila.image` ao mesmo tempo; `intencaoAtual` é o desempate quando a
  // bancada ativa/inativa troca DE NOVO enquanto a primeira ainda está em
  // voo — vence a intenção mais recente no momento em que a promessa
  // termina, não a que a iniciou.
  const estaReduzida = useRef(false);
  const reduzindoOuRecarregando = useRef(false);
  const intencaoAtual = useRef<'ativa' | 'inativa'>('ativa');

  const arquivoDeOrigemAtual = (): File | null => {
    const chave = chaveAtual.current;
    if (!chave) return null;
    return arquivoPorChave.current.get(chave) ?? null;
  };

  const liberarImagemCheia = () => {
    intencaoAtual.current = 'inativa';
    const imagemAtual = fila.image;
    if (!imagemAtual) return; // nada carregado ainda
    if (estaReduzida.current) return; // já é a reduzida — idempotente
    if (reduzindoOuRecarregando.current) return; // já há uma troca em voo
    if (!deveReduzir(imagemAtual.width, imagemAtual.height)) return; // abaixo do piso (regra 5)
    const arquivo = arquivoDeOrigemAtual();
    if (!arquivo) return; // sem File de origem: não haveria como recarregar depois (regra 4)

    reduzindoOuRecarregando.current = true;
    const { width, height } = dimensoesReduzidas(imagemAtual.width, imagemAtual.height);
    gerarImagemReduzida(imagemAtual, width, height)
      .then((reduzida) => {
        // A reduzida herda o tamanho DECLARADO da cheia (`.width`/`.height`,
        // não o tamanho real do bitmap) — regra 2: a geometria não muda.
        reduzida.width = imagemAtual.width;
        reduzida.height = imagemAtual.height;
        // A bancada pode ter voltado a ficar ativa (ou até trocado de
        // imagem) enquanto a reduzida gerava — só aplica se ainda for a
        // mesma cheia na tela E a intenção mais recente continuar sendo
        // ficar inativa. Regra 3: a ativa nunca mostra a reduzida. Depois
        // deste `setImage`, NADA nesta função continua segurando `imagemAtual`
        // — é o que deixa o bitmap cheio livre para o coletor de lixo.
        if (fila.image === imagemAtual && intencaoAtual.current === 'inativa') {
          estaReduzida.current = true;
          fila.setImage(reduzida);
        } else {
          URL.revokeObjectURL(reduzida.src); // nunca chegou a ser exibida
        }
      })
      .catch(() => {
        // Falhar em reduzir não é motivo para travar nada: fica com a cheia.
      })
      .finally(() => {
        reduzindoOuRecarregando.current = false;
      });
  };

  const recarregarImagemCheia = () => {
    intencaoAtual.current = 'ativa';
    if (!estaReduzida.current) return; // já está com a cheia — nada a fazer
    if (reduzindoOuRecarregando.current) return; // já há uma troca em voo
    const arquivo = arquivoDeOrigemAtual();
    if (!arquivo) return; // não deveria faltar (só reduzimos quando havia File), mas não presume

    const reduzidaNaTela = fila.image; // fica na tela até a cheia terminar — regra 1, nada pisca
    reduzindoOuRecarregando.current = true;
    decodificarImagemDeArquivo(arquivo)
      .then((cheia) => {
        if (fila.image === reduzidaNaTela && intencaoAtual.current === 'ativa') {
          fila.setImage(cheia);
          estaReduzida.current = false;
          if (reduzidaNaTela) URL.revokeObjectURL(reduzidaNaTela.src);
        } else if (reduzidaNaTela) {
          // A bancada já trocou de imagem, ou voltou a ficar inativa antes
          // de a cheia terminar de decodificar — descarta o resultado tardio
          // e libera o blob da reduzida que ficou para trás.
          URL.revokeObjectURL(reduzidaNaTela.src);
        }
      })
      .catch(() => {
        // Sem a cheia, fica com a reduzida na tela em vez de travar a
        // bancada — mesma política de `loadError` do resto da fila, só que
        // sem lugar na UI de uma bancada inativa para mostrar o aviso.
        console.error('Não foi possível recarregar a imagem em resolução completa; mantendo a reduzida.');
      })
      .finally(() => {
        reduzindoOuRecarregando.current = false;
      });
  };

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
    arquivoPorChave.current.set(chave, file);
    // Toda imagem NOVA entra sempre em resolução cheia — zera o estado de
    // redução do ciclo anterior desta bancada. Sem isto, fechar uma bancada
    // reduzida e reabrir o slot com outra imagem faria essa imagem nova
    // parecer "já reduzida" sem nunca ter sido.
    estaReduzida.current = false;

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
      liberarImagemCheia,
      recarregarImagemCheia,
    },
  };
}
