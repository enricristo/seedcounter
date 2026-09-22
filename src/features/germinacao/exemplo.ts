// =============================================================================
// SeedCounter — germinação: o exemplo que a tela carrega
//
// É a MESMA fixture que o oráculo dos testes usa (`lib/germinacao/__tests__/
// fixtures/germinator-llanero.json`): 24 amostras reais de forrageira
// Llanero, priming de 0 a 48 h, quatro repetições, com a saída da planilha
// original ao lado. Uma fonte para cada número — copiar o arquivo para um
// segundo lugar seria convidar os dois a divergirem.
//
// O arquivo entra por `import()` com `?raw`, então só sai da rede quando a
// pessoa clica em "Exemplo", e não paga nada na abertura do aplicativo.
// =============================================================================

import type { AmostraDeGerminacao } from '../../lib/germinacao';

export const NOME_DO_EXEMPLO = 'Llanero — priming 0 a 48 h, 4 repetições';

/** Lê a fixture (texto JSON) como amostras. Lança se o formato não for o esperado. */
export function lerFixtureDoGerminator(texto: string): AmostraDeGerminacao[] {
  const bruto: unknown = JSON.parse(texto);
  if (typeof bruto !== 'object' || bruto === null) throw new Error('fixture: não é um objeto');
  const f = bruto as Record<string, unknown>;
  const tempos = f.tempos_h;
  const amostras = f.amostras;
  if (!Array.isArray(tempos) || !tempos.every((t) => typeof t === 'number'))
    throw new Error('fixture: tempos_h inválido');
  if (!Array.isArray(amostras)) throw new Error('fixture: amostras inválido');
  const horas = tempos as number[];
  return amostras.map((a: unknown, i) => {
    if (typeof a !== 'object' || a === null) throw new Error(`fixture: amostra ${i} inválida`);
    const r = a as Record<string, unknown>;
    const contagens = r.contagens;
    if (
      typeof r.codigo !== 'string' ||
      typeof r.sementes !== 'number' ||
      !Array.isArray(contagens) ||
      contagens.length !== horas.length
    ) {
      throw new Error(`fixture: amostra ${i} inválida`);
    }
    return {
      codigo: r.codigo,
      sementes: r.sementes,
      leituras: horas.map((h, k) => {
        const c = contagens[k];
        if (typeof c !== 'number')
          throw new Error(`fixture: contagem ${k} da amostra ${i} inválida`);
        return { horas: h, acumulado: c };
      }),
    };
  });
}

export async function carregarExemplo(): Promise<AmostraDeGerminacao[]> {
  const modulo =
    await import('../../lib/germinacao/__tests__/fixtures/germinator-llanero.json?raw');
  return lerFixtureDoGerminator(modulo.default);
}
