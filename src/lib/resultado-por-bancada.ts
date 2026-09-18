// =============================================================================
// Resultado assíncrono × bancada que pediu
// =============================================================================
// Com quatro bancadas e um worker de inferência só (`yolo-worker-client.ts`),
// uma detecção pode continuar rodando em segundo plano depois que a pessoa
// trocou de bancada ativa. O worker já cancela a chamada anterior quando uma
// NOVA começa — mas trocar de bancada sem pedir uma nova detecção não cancela
// nada: o resultado da bancada antiga chega, sozinho, e cairia sobre a cena
// errada se ninguém conferisse.
//
// A regra é simples e por isso mora aqui, em `src/lib/`, sem depender de React
// nem de `useBancadas`: o resultado só vale se a bancada que pediu ainda for a
// bancada ativa no momento em que ele chega.
// =============================================================================

/**
 * `idDeQuemPediu` é capturado no INÍCIO do pedido (antes do `await`);
 * `idAtivoAgora` é lido de novo quando o resultado chega — os dois vêm de
 * fontes diferentes de propósito, para o teste (e o chamador) não poderem
 * comparar um valor com ele mesmo por engano.
 */
export function resultadoAindaVale(idDeQuemPediu: string, idAtivoAgora: string): boolean {
  return idDeQuemPediu === idAtivoAgora;
}
