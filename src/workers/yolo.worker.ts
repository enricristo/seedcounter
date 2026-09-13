// =============================================================================
// SeedCounter — a inferência YOLO fora da thread principal
// =============================================================================
// Um worker só. O "Oráculo" com três pipelines paralelos foi adiado por não
// ter problema medido que o justifique; este worker resolve o problema que
// EXISTE — a inferência bloqueava a thread principal e o arraste travava
// enquanto o modelo processava as janelas de uma digitalização grande.
//
// Não há tsconfig separado para workers neste projeto: o programa TypeScript
// inteiro usa a lib "DOM". Por isso este arquivo não referencia a lib
// "webworker" (colidiria com "DOM" no mesmo programa — os dois declaram
// `self` de formas diferentes); os globais que usa (`self`, `postMessage`,
// `MessageEvent`) já existem em "DOM" com assinaturas compatíveis com o uso
// abaixo.
// =============================================================================

import {
  detectWithYoloEmImageData,
  definirBaseDosModelos,
  type InferenceOptions,
  type YoloDetection,
} from '../lib/yolo-onnx';

/**
 * As opções que atravessam a mensagem NUNCA incluem `onProgress`: é uma
 * função, e o algoritmo de clonagem estruturada do `postMessage` lança
 * `DataCloneError` na hora se alguma propriedade não for clonável — o
 * cliente (`yolo-worker-client.ts`) já remove esse campo antes de mandar.
 */
type OpcoesTransmissiveis = Omit<InferenceOptions, 'onProgress'>;

interface PedidoDeInferencia {
  id: number;
  imagem: ImageData;
  opcoes: OpcoesTransmissiveis;
  /**
   * `document.baseURI` da página, medida no cliente. `models/...` é um
   * caminho relativo — dentro do worker ele resolveria contra a URL do
   * PRÓPRIO SCRIPT do worker (endereço errado), não contra a página. Sem
   * isto o fetch do modelo caía no HTML de fallback do Vite e o ONNX Runtime
   * falhava com "protobuf parsing failed" (foi medido, não é hipotético).
   */
  baseDaPagina: string;
}

/** `tipo: 'progresso'` chega várias vezes por detecção; `'final'` é a única
 * mensagem que resolve ou rejeita a promessa do lado do cliente. */
type RespostaDeInferencia =
  | { id: number; tipo: 'progresso'; done: number; total: number }
  | { id: number; tipo: 'final'; ok: true; resultado: YoloDetection[] }
  | { id: number; tipo: 'final'; ok: false; erro: string };

self.onmessage = async (e: MessageEvent<PedidoDeInferencia>) => {
  const { id, imagem, opcoes, baseDaPagina } = e.data;
  definirBaseDosModelos(baseDaPagina);
  try {
    const resultado = await detectWithYoloEmImageData(imagem, {
      ...opcoes,
      // Reconstruída aqui dentro: o progresso volta por postMessage próprio,
      // em vez de tentar atravessar a fronteira como função.
      onProgress: (done, total) => {
        const progresso: RespostaDeInferencia = { id, tipo: 'progresso', done, total };
        self.postMessage(progresso);
      },
    });
    const resposta: RespostaDeInferencia = { id, tipo: 'final', ok: true, resultado };
    self.postMessage(resposta);
  } catch (erro) {
    const resposta: RespostaDeInferencia = { id, tipo: 'final', ok: false, erro: String(erro) };
    self.postMessage(resposta);
  }
};
