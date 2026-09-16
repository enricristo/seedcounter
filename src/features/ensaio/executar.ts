// =============================================================================
// SeedCounter — executor do ensaio ao carregar
//
// Roda uma receita sobre pontos já localizados (a localização, que precisa de
// canvas, fica com quem chama). Puro o suficiente para ser testado em node
// com a cena sintética: a onda entra como função já fechada sobre a imagem.
// =============================================================================

import type { Receita, ContornoProposto, ResumoDaReceita } from './receitas';
import { resumir } from './receitas';
import type { Ponto } from '../../lib/aglomerado';

/** O que a onda devolve para cada ponto: só o que o ensaio usa. */
export interface OndaResumida {
  contorno: Ponto[];
  tocouBorda: boolean;
}

export interface ResultadoDoEnsaio {
  receita: Receita;
  propostos: ContornoProposto[];
  resumo: ResumoDaReceita;
  /** Pontos localizados em que a onda escapou. Informa, não some. */
  escapes: number;
  duracaoMs: number;
}

/**
 * Roda a onda a partir de cada ponto localizado, em lotes que cedem a tela.
 *
 * A localização (`detectObjects`) fica com quem chama, porque precisa de
 * canvas; aqui entra a função da onda já fechada sobre a imagem, o que deixa
 * isto testável em node com a cena sintética. `lote` = quantas ondas entre um
 * `await` e outro — mesmo padrão de `handleSegmentarPendentes` em `App.tsx`.
 */
export async function executarReceita(
  receita: Receita,
  pontos: { x: number; y: number }[],
  onda: (p: { x: number; y: number }, opcoes: Receita['onda']) => OndaResumida | null,
  opcoes: { lote?: number; cancelado?: () => boolean } = {}
): Promise<ResultadoDoEnsaio | null> {
  const { lote = 8, cancelado = () => false } = opcoes;
  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const contornos: Ponto[][] = [];
  let escapes = 0;
  for (let i = 0; i < pontos.length; i++) {
    if (cancelado()) return null;
    const r = onda(pontos[i], receita.onda);
    if (!r || r.tocouBorda) escapes++;
    else contornos.push(r.contorno);
    if ((i + 1) % lote === 0) await new Promise<void>((res) => setTimeout(res, 0));
  }
  const { propostos, resumo } = resumir(contornos);
  const fim = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { receita, propostos, resumo, escapes, duracaoMs: fim - inicio };
}
