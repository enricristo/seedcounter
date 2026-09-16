// =============================================================================
// SeedCounter — testes de receitas.ts e executar.ts
//
// Puro: sem DOM, sem localStorage, sem Image (regra de `src/lib/`, e aqui
// aplicada também às features que rodam em node). A cena sintética dá a
// verdade; `segmentarPorClique` é a mesma onda que o app usa via
// `segmentarNoCanvas`, só que sem o canvas no meio.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { RECEITAS, resumir } from '../receitas';
import { executarReceita } from '../executar';
import { gerarCenaSintetica } from '../../../lib/synthetic-scene';
import { segmentarPorClique } from '../../../lib/region-growing';

describe('RECEITAS', () => {
  it('há entre 2 e 3, com ids únicos e um "quando" cada', () => {
    expect(RECEITAS.length).toBeGreaterThanOrEqual(2);
    expect(RECEITAS.length).toBeLessThanOrEqual(3);
    expect(new Set(RECEITAS.map((r) => r.id)).size).toBe(RECEITAS.length);
    for (const r of RECEITAS) expect(r.quando.length).toBeGreaterThan(10);
  });
});

describe('resumir', () => {
  it('conta, tira mediana e não acusa nada numa população homogênea', () => {
    const quadrado = (s: number): [number, number][] => [
      [0, 0],
      [s, 0],
      [s, s],
      [0, s],
    ];
    const { resumo } = resumir(Array.from({ length: 12 }, () => quadrado(10)));
    expect(resumo.contagem).toBe(12);
    expect(resumo.medianaDaAreaPx).toBe(100);
    expect(resumo.suspeitos).toBe(0);
  });
});

describe('executarReceita', () => {
  it('sobre a cena sintética (preset soja, lado 1600), a receita padrão recupera quase todas as sementes e poucos escapes', async () => {
    // lado: 1600 para caber 20 sementes do preset soja (semieixo ~108 px)
    // sem esbarrar demais na rejeição por colisão.
    const cena = gerarCenaSintetica('soja', { semente: 5, quantidade: 20, lado: 1600 });
    const pontos = cena.sementes.map((s) => ({ x: s.x, y: s.y }));

    const onda = (p: { x: number; y: number }, op: (typeof RECEITAS)[0]['onda']) => {
      const r = segmentarPorClique(cena.imagem, p, { janela: 256, ...op });
      return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
    };

    const res = await executarReceita(RECEITAS[0], pontos, onda, { lote: 4 });
    expect(res).not.toBeNull();
    // Mesmo padrão de tolerância do teste de A2 (95%): a onda pode escapar
    // numa fração pequena por causa do ruído do fundo sintético.
    expect(res!.resumo.contagem / cena.sementes.length).toBeGreaterThanOrEqual(0.95);
    expect(res!.escapes / cena.sementes.length).toBeLessThanOrEqual(0.05);
    expect(res!.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it('cancelamento devolve null sem terminar', async () => {
    let chamadas = 0;
    const onda = () => {
      chamadas++;
      return { contorno: [[0, 0], [1, 0], [1, 1]] as [number, number][], tocouBorda: false };
    };
    const res = await executarReceita(RECEITAS[0], Array.from({ length: 20 }, () => ({ x: 0, y: 0 })), onda, {
      lote: 2,
      cancelado: () => chamadas >= 4,
    });
    expect(res).toBeNull();
    expect(chamadas).toBeLessThan(20);
  });
});
