// =============================================================================
// Resultado de inferência × bancada que pediu — em node, sem DOM.
//
// Simula a mesma corrida que `yolo-worker-client.ts` resolve para o worker
// (a chamada mais recente cancela a anterior) mais o que ELE NÃO resolve
// sozinho: trocar a bancada ATIVA sem disparar uma nova detecção. O worker
// continua calculando em paz — ninguém o cancelou — e o resultado chega
// sozinho. `resultadoAindaVale` é o que decide, do lado de quem pediu, se
// esse resultado ainda pode ser aplicado.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { resultadoAindaVale } from '../resultado-por-bancada';

/**
 * Cliente falso: mesma forma de `detectarNoWorker` (uma promessa que resolve
 * depois de um tempo), sem worker de verdade nem DOM — só o suficiente para
 * exercitar a corrida em node.
 */
function clienteFalso<T>(valor: T, atrasoMs: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), atrasoMs));
}

describe('resultadoAindaVale', () => {
  it('vale quando a bancada que pediu continua ativa', () => {
    expect(resultadoAindaVale('b1', 'b1')).toBe(true);
  });

  it('não vale quando a bancada ativa mudou', () => {
    expect(resultadoAindaVale('b1', 'b2')).toBe(false);
  });
});

describe('a bancada trocou durante uma inferência em segundo plano', () => {
  it('descarta o resultado da bancada que deixou de ser a ativa', async () => {
    let ativa = 'b1';
    const aplicados: string[] = [];

    // b1 pede uma detecção lenta.
    const pedidoDeId = ativa; // capturado ANTES do await, como no painel real.
    const promessa = clienteFalso({ objetos: 3 }, 20).then((resultado) => {
      if (!resultadoAindaVale(pedidoDeId, ativa)) return; // ativa é lida de NOVO aqui
      aplicados.push(pedidoDeId);
      return resultado;
    });

    // A pessoa troca para b2 ANTES da detecção de b1 terminar — sem pedir
    // nada em b2, então nada cancela o cliente falso; ele só termina depois.
    ativa = 'b2';

    await promessa;

    expect(aplicados).toEqual([]); // o resultado de b1 foi descartado
  });

  it('aplica o resultado quando a bancada continua ativa até o fim', async () => {
    const ativa = { valor: 'b1' };
    const aplicados: string[] = [];

    const pedidoDeId = ativa.valor;
    await clienteFalso({ objetos: 5 }, 10).then((resultado) => {
      if (!resultadoAindaVale(pedidoDeId, ativa.valor)) return;
      aplicados.push(pedidoDeId);
      return resultado;
    });

    expect(aplicados).toEqual(['b1']);
  });

  it('quatro bancadas, uma detecção por vez: só a mais recente aplica', async () => {
    // Reproduz o cancelamento que `yolo-worker-client.ts` já faz — a chamada
    // anterior é rejeitada assim que uma nova começa, então seu resultado
    // nunca chega a ser comparado com `resultadoAindaVale`.
    let cancelarAnterior: (() => void) | null = null;
    const aplicados: string[] = [];

    async function pedir(idDaBancada: string, atrasoMs: number): Promise<void> {
      cancelarAnterior?.();
      let cancelada = false;
      cancelarAnterior = () => {
        cancelada = true;
      };

      const resultado = await clienteFalso({ id: idDaBancada }, atrasoMs);
      if (cancelada) return; // a mais recente venceu — esta nunca resolve com efeito
      aplicados.push(resultado.id);
    }

    // b1, b2, b3, b4 pedem quase juntas; só a última (b4) deveria vencer.
    const chamadas = [pedir('b1', 30), pedir('b2', 25), pedir('b3', 15), pedir('b4', 5)];
    await Promise.all(chamadas);

    expect(aplicados).toEqual(['b4']);
  });
});
