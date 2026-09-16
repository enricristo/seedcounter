// =============================================================================
// SeedCounter — cliente do worker de inferência YOLO
// =============================================================================
// Um worker só, criado sob demanda, tira a inferência da thread principal —
// o arraste e o zoom não travam mais durante a detecção. Mas o worker é só
// engenharia de desempenho: se ele não puder ser criado (navegador sem
// module worker) ou falhar ao carregar o modelo, a detecção TEM que continuar
// funcionando — cai para a thread principal com aviso, nunca quebra para
// quem está usando.
//
// Cancelamento: se uma segunda detecção começar antes da primeira terminar, a
// primeira é cancelada — ela nunca pode entregar resultado velho por cima da
// imagem nova. O worker em si continua calculando em segundo plano (matá-lo
// custaria recarregar o modelo do zero na próxima chamada), mas o resultado
// atrasado chega e é descartado.
// =============================================================================

import { detectWithYoloEmImageData, type InferenceOptions, type YoloDetection } from './yolo-onnx';

type Resultado = YoloDetection[];

/** Espelha o discriminado de `yolo.worker.ts`: mensagens de progresso não
 * resolvem nem rejeitam, só repassam done/total; só 'final' encerra. */
type RespostaDoWorker =
  | { id: number; tipo: 'progresso'; done: number; total: number }
  | { id: number; tipo: 'final'; ok: boolean; resultado?: Resultado; erro?: string };

let worker: Worker | null = null;
// Uma vez que o worker se provou indisponível (sem module worker no
// navegador, ou falhou ao carregar o modelo), para de tentar de novo a cada
// chamada — cai direto para a thread principal pelo resto da sessão.
let workerIndisponivel = false;
let proximoId = 1;
const pendentes = new Map<
  number,
  {
    resolve: (v: Resultado) => void;
    reject: (e: Error) => void;
    /** Fica só no cliente — funções não atravessam `postMessage`. */
    onProgress?: (done: number, total: number) => void;
  }
>();

interface ChamadaEmAndamento {
  id: number;
  cancelada: boolean;
}

// A detecção "corrente": começar uma nova cancela esta, para que uma resposta
// atrasada da anterior nunca sobreponha o resultado da imagem nova.
let atual: ChamadaEmAndamento | null = null;
let cancelarAtualFn: (() => void) | null = null;

function cancelarChamadaAnterior() {
  if (!atual) return;
  atual.cancelada = true;
  pendentes.delete(atual.id);
  cancelarAtualFn?.();
  atual = null;
  cancelarAtualFn = null;
}

function obterWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/yolo.worker.ts', import.meta.url), { type: 'module' });
  console.info('[yolo] worker iniciado');

  worker.onmessage = (e: MessageEvent<RespostaDoWorker>) => {
    const msg = e.data;
    const p = pendentes.get(msg.id);
    if (!p) return; // resposta de uma detecção já cancelada — ignorada, como pede a regra

    if (msg.tipo === 'progresso') {
      p.onProgress?.(msg.done, msg.total);
      return; // não resolve nem rejeita: só a mensagem 'final' encerra
    }

    pendentes.delete(msg.id);
    if (msg.ok) p.resolve(msg.resultado as Resultado);
    else p.reject(new Error(msg.erro || 'Falha desconhecida no worker de inferência.'));
  };

  // Erro no próprio script do worker (ex.: módulo ou .wasm não encontrado)
  // chega aqui, não no onmessage — é sinal de que o worker inteiro não presta
  // mais nesta sessão.
  worker.onerror = (ev) => {
    workerIndisponivel = true;
    for (const [, p] of pendentes) {
      p.reject(new Error(ev.message || 'Falha ao carregar o worker de inferência.'));
    }
    pendentes.clear();
  };

  return worker;
}

/**
 * Detecta sementes num worker dedicado.
 *
 * Cai para a thread principal com `console.warn` se o worker não puder ser
 * criado ou falhar ao carregar o modelo — reusando a MESMA `ImageData`, por
 * isso ela não é transferida (só clonada). Cancela a detecção anterior se uma
 * nova começar antes dela terminar.
 */
export async function detectarNoWorker(
  imagem: ImageData,
  opcoes: InferenceOptions = {}
): Promise<Resultado> {
  cancelarChamadaAnterior();

  const meuId = proximoId++;
  const chamada: ChamadaEmAndamento = { id: meuId, cancelada: false };
  atual = chamada;

  // Promessa que só rejeita — vence a corrida se esta chamada for cancelada
  // por uma mais nova, não importa em qual caminho (worker ou reserva) a
  // detecção estava.
  let rejeitarPorCancelamento: (erro: Error) => void = () => {};
  const cancelavel = new Promise<never>((_resolve, reject) => {
    rejeitarPorCancelamento = reject;
  });
  cancelarAtualFn = () =>
    rejeitarPorCancelamento(new Error('Detecção cancelada: outra começou antes desta terminar.'));

  try {
    if (!workerIndisponivel) {
      try {
        const w = obterWorker();
        // `onProgress` é uma função: o algoritmo de clonagem estruturada do
        // postMessage lança DataCloneError na hora se ela for junto (foi
        // medido — quebrava TODA detecção). Fica só no cliente; o progresso
        // volta por mensagens 'progresso' que o worker posta sozinho.
        const { onProgress, ...opcoesTransmissiveis } = opcoes;
        const viaWorker = new Promise<Resultado>((resolve, reject) => {
          pendentes.set(meuId, { resolve, reject, onProgress });
          // SEM lista de transferência, de propósito: transferir o buffer o
          // esvazia do lado de cá (fica com length 0), e se o worker falhar
          // DEPOIS de aceitar a mensagem (foi medido: falha ao carregar o
          // modelo), o caminho de reserva abaixo reusa esta mesma `imagem` —
          // precisa continuar íntegra. A cópia estrutural custa um pouco mais
          // que a transferência, mas a garantia de que a detecção nunca quebra
          // vale mais que evitar essa cópia.
          //
          // baseDaPagina: dentro do worker, "models/..." resolveria contra a
          // URL do SCRIPT do worker, não da página — foi medido quebrando o
          // carregamento do modelo (protobuf parsing failed). A base certa só
          // a thread principal conhece.
          w.postMessage({ id: meuId, imagem, opcoes: opcoesTransmissiveis, baseDaPagina: document.baseURI });
        });
        return await Promise.race([viaWorker, cancelavel]);
      } catch (err) {
        if (chamada.cancelada) throw err; // outra detecção já assumiu — não cai para a thread principal
        pendentes.delete(meuId);
        console.warn('[yolo] worker falhou, caindo para a inferência na thread principal:', err);
        workerIndisponivel = true;
        // segue para o caminho de reserva abaixo
      }
    }

    return await Promise.race([detectWithYoloEmImageData(imagem, opcoes), cancelavel]);
  } finally {
    if (atual === chamada) {
      atual = null;
      cancelarAtualFn = null;
    }
  }
}
