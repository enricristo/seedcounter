import { describe, it, expect } from 'vitest';
import { resumirLote } from '../resumo';
import type { ResultadoDeUmaImagem } from '../lote';

function ok(id: string, contagem: number, duracaoMs = 10): ResultadoDeUmaImagem {
  return { id, rotulo: `${id}.png`, contagem, viaveis: contagem, inviaveis: 0, suspeitos: 0, escapes: 0, duracaoMs };
}

function comErro(id: string, erro: string, duracaoMs = 5): ResultadoDeUmaImagem {
  return { id, rotulo: `${id}.png`, contagem: 0, viaveis: 0, inviaveis: 0, suspeitos: 0, escapes: 0, duracaoMs, erro };
}

describe('resumirLote', () => {
  it('lote vazio: tudo zero ou nulo, sem lançar', () => {
    const r = resumirLote([]);
    expect(r).toEqual({
      imagens: 0,
      imagensComErro: 0,
      totalDeObjetos: 0,
      medianaPorImagem: null,
      dispersao: null,
      duracaoTotalMs: 0,
      duracaoMediaPorImagemMs: null,
    });
  });

  it('uma imagem só: mediana e dispersão colapsam nela mesma', () => {
    const r = resumirLote([ok('a', 42, 100)]);
    expect(r.imagens).toBe(1);
    expect(r.imagensComErro).toBe(0);
    expect(r.totalDeObjetos).toBe(42);
    expect(r.medianaPorImagem).toBe(42);
    expect(r.dispersao).toEqual({ min: 42, max: 42 });
    expect(r.duracaoTotalMs).toBe(100);
    expect(r.duracaoMediaPorImagemMs).toBe(100);
  });

  it('lote com erros: imagens com erro contam para "imagens" e "imagensComErro", mas não entram na contagem/mediana/dispersão', () => {
    const r = resumirLote([ok('a', 10), comErro('b', 'TIFF ilegível'), ok('c', 20), comErro('d', 'canvas indisponível')]);
    expect(r.imagens).toBe(4);
    expect(r.imagensComErro).toBe(2);
    expect(r.totalDeObjetos).toBe(30);
    expect(r.medianaPorImagem).toBe(15);
    expect(r.dispersao).toEqual({ min: 10, max: 20 });
  });

  it('lote onde todas as imagens falharam: sem número nenhum para resumir', () => {
    const r = resumirLote([comErro('a', 'x'), comErro('b', 'y')]);
    expect(r.imagens).toBe(2);
    expect(r.imagensComErro).toBe(2);
    expect(r.totalDeObjetos).toBe(0);
    expect(r.medianaPorImagem).toBeNull();
    expect(r.dispersao).toBeNull();
  });

  it('mediana com número par de imagens é a média das duas do meio', () => {
    const r = resumirLote([ok('a', 100), ok('b', 118), ok('c', 120), ok('d', 121)]);
    expect(r.medianaPorImagem).toBe(119); // (118+120)/2
    expect(r.dispersao).toEqual({ min: 100, max: 121 });
  });

  it('duracaoTotalMs soma inclusive as que falharam (decodificar e falhar também custa tempo)', () => {
    const r = resumirLote([ok('a', 5, 30), comErro('b', 'x', 7)]);
    expect(r.duracaoTotalMs).toBe(37);
    expect(r.duracaoMediaPorImagemMs).toBeCloseTo(18.5);
  });
});
