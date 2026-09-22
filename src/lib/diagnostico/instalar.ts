// =============================================================================
// SeedCounter — captura global de erro
//
// POR QUE ELA VEM SEPARADA DO ErrorBoundary.
//
// O `ErrorBoundary` do React pega só o que estoura DURANTE o render de um
// componente. Fica de fora justamente o que mais quebra num aplicativo que faz
// trabalho pesado fora da árvore: um `await` que rejeita dentro de um handler
// de clique, um worker que não carrega, uma leitura de arquivo que falha. Esses
// chegam em `window` — e, sem estes dois ouvintes, sumiam no console de uma
// máquina que ninguém vai abrir.
//
// IDEMPOTENTE POR CONTRATO. O `StrictMode` monta duas vezes em
// desenvolvimento, e a instalação pode acabar chamada de mais de um lugar. Um
// erro registrado em dobro não é só feio: ele empurra dois eventos para fora do
// anel de 200, apagando o começo da sessão.
// =============================================================================

import { registrarErro } from './trilha';

let instalado = false;

/**
 * Liga a captura de erro não tratado e de promessa rejeitada.
 *
 * Só ESCUTA: não chama `preventDefault`, então o console continua mostrando o
 * erro exatamente como mostrava, e nada muda para quem depura com a ferramenta
 * do navegador aberta.
 */
export function instalarCapturaGlobal(): void {
  if (instalado) return;
  if (typeof window === 'undefined') return;
  instalado = true;

  window.addEventListener('error', (ev: ErrorEvent) => {
    // `ev.error` traz a pilha; `ev.message` é o que sobra quando o erro veio de
    // outra origem (script de terceiro), caso em que o navegador esconde o
    // resto por segurança.
    registrarErro(ev.error ?? ev.message, 'window');
  });

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    registrarErro(ev.reason, 'promise');
  });
}

/** Só para teste: permite instalar de novo num ambiente recriado. */
export function esquecerInstalacao(): void {
  instalado = false;
}
