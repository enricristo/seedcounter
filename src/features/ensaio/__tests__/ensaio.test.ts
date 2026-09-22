// =============================================================================
// SeedCounter — testes de receitas.ts e executar.ts
//
// Puro: sem DOM, sem localStorage, sem Image (regra de `src/lib/`, e aqui
// aplicada também às features que rodam em node). A cena sintética dá a
// verdade; `segmentarPorClique` é a mesma onda que o app usa via
// `segmentarNoCanvas`, só que sem o canvas no meio.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { RECEITAS, RECEITAS_DO_ENSAIO, resumir, receitaPelaEspecie, receitaDeSalva } from '../receitas';
import { executarReceita } from '../executar';
import { gerarCenaSintetica } from '../../../lib/synthetic-scene';
import { segmentarPorClique } from '../../../lib/region-growing';

describe('RECEITAS', () => {
  it('o ensaio roda entre 2 e 3 receitas — e nunca a de IA, que não é barata nem seria IA ali', () => {
    expect(RECEITAS_DO_ENSAIO.length).toBeGreaterThanOrEqual(2);
    expect(RECEITAS_DO_ENSAIO.length).toBeLessThanOrEqual(3);
    expect(RECEITAS_DO_ENSAIO.every((r) => !r.localizacao.usaModeloDeIA)).toBe(true);
    // A receita de IA existe no catálogo completo, para o Lote.
    expect(RECEITAS.some((r) => r.localizacao.usaModeloDeIA)).toBe(true);
    expect(new Set(RECEITAS.map((r) => r.id)).size).toBe(RECEITAS.length);
    for (const r of RECEITAS) expect(r.quando.length).toBeGreaterThan(10);
  });
});

describe('receitaPelaEspecie', () => {
  it('devolve null para espécie desconhecida', () => {
    expect(receitaPelaEspecie('bicho-de-pe', { areaDaImagemPx: 1_000_000 })).toBeNull();
  });

  it('devolve null quando a espécie não é informada', () => {
    expect(receitaPelaEspecie(undefined, { areaDaImagemPx: 1_000_000 })).toBeNull();
  });

  it('com calibração, deriva minArea/maxArea em px² a partir do tamanho típico', () => {
    // Soja: 5 a 11 mm, razão ~1,05–1,4. umPerPixel = 10 µm/px.
    const r = receitaPelaEspecie('soja', { umPerPixel: 10, areaDaImagemPx: 10_000_000 });
    expect(r).not.toBeNull();
    expect(r!.localizacao.minArea).toBeGreaterThan(0);
    expect(r!.localizacao.maxArea).toBeGreaterThan(r!.localizacao.minArea!);
    // maxElongation vem da razão típica com folga.
    expect(r!.localizacao.maxElongation).toBeGreaterThan(1.4);
    expect(r!.nome).toContain('Soja');
    expect(r!.quando.length).toBeGreaterThan(10);
  });

  it('sem calibração, ainda devolve minArea (fração da imagem) mas não maxArea', () => {
    const r = receitaPelaEspecie('orquidea', { areaDaImagemPx: 10_000_000 });
    expect(r).not.toBeNull();
    expect(r!.localizacao.minArea).toBeGreaterThan(0);
    expect(r!.localizacao.maxArea).toBeUndefined();
  });

  it('espécie maior implica minArea maior, na mesma calibração', () => {
    const ctx = { umPerPixel: 10, areaDaImagemPx: 10_000_000 };
    const soja = receitaPelaEspecie('soja', ctx)!;
    const orquidea = receitaPelaEspecie('orquidea', ctx)!;
    expect(soja.localizacao.minArea!).toBeGreaterThan(orquidea.localizacao.minArea!);
  });

  it('aceita o nome científico (mesma tabela de tamanhos-de-semente)', () => {
    expect(receitaPelaEspecie('Glycine max', { areaDaImagemPx: 1_000_000 })).not.toBeNull();
  });
});

describe('receitaDeSalva', () => {
  it('converte uma receita salva com o prefixo salva- no id', () => {
    const r = receitaDeSalva({
      id: 7,
      especie: 'soja',
      nome: 'Minha receita',
      quando: 'Scanner do laboratório X',
      localizacao: { sensitivity: 60 },
      onda: {},
      criadaEm: Date.now(),
    });
    expect(r.id).toBe('salva-7');
    expect(r.nome).toBe('Minha receita');
    expect(r.localizacao.sensitivity).toBe(60);
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
