// =============================================================================
// SeedCounter — resumo do lote ("lote redondo", item 2)
//
// "A receita Sensível é estável nesta bancada?" — 12 números numa tabela não
// respondem isso, uma dispersão sim. Mesma lógica de `limiaresDaPopulacao`
// (`lib/aglomerado.ts`): o limiar/sinal vem da própria amostra, não de um
// preset fixo — só que aqui a amostra é "quantos objetos por imagem", não
// "que área tem cada objeto".
//
// Função pura, sem canvas, sem Dexie, sem imagem: entra o array de
// resultados (mesmo `ResultadoDeUmaImagem[]` de `lote.ts`), sai o resumo.
// =============================================================================

import type { ResultadoDeUmaImagem } from './lote';

export interface ResumoDoLote {
  imagens: number;
  imagensComErro: number;
  /** Soma da contagem das imagens sem erro. */
  totalDeObjetos: number;
  /** Mediana da contagem por imagem — só sobre as imagens sem erro; `null` quando nenhuma. */
  medianaPorImagem: number | null;
  /** Dispersão mín–máx da contagem por imagem; `null` quando nenhuma imagem sem erro. */
  dispersao: { min: number; max: number } | null;
  duracaoTotalMs: number;
  /** Duração média por imagem, sobre TODAS as imagens (erro incluso: decodificar e falhar também custa tempo). */
  duracaoMediaPorImagemMs: number | null;
}

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Resume o lote inteiro.
 *
 * DISPERSÃO É MÍN–MÁX, NÃO p5–p95: um lote típico é uma dúzia de imagens, não
 * uma centena de pontos — com poucos itens, p5–p95 exigiria interpolar sobre
 * 5 a 20 valores e colapsaria perto dos próprios extremos, só trocando uma
 * leitura direta por uma fórmula que não diz mais. Mín–máx é a mesma
 * informação, sem o disfarce de precisão.
 */
export function resumirLote(resultados: ResultadoDeUmaImagem[]): ResumoDoLote {
  const semErro = resultados.filter((r) => !r.erro);
  const contagens = semErro.map((r) => r.contagem);
  const duracaoTotalMs = resultados.reduce((acc, r) => acc + r.duracaoMs, 0);

  return {
    imagens: resultados.length,
    imagensComErro: resultados.length - semErro.length,
    totalDeObjetos: contagens.reduce((a, b) => a + b, 0),
    medianaPorImagem: mediana(contagens),
    dispersao: contagens.length > 0 ? { min: Math.min(...contagens), max: Math.max(...contagens) } : null,
    duracaoTotalMs,
    duracaoMediaPorImagemMs: resultados.length > 0 ? duracaoTotalMs / resultados.length : null,
  };
}
