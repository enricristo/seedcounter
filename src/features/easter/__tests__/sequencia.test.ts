// =============================================================================
// O detector é a parte testável do easter egg — puro, sem DOM, sem tempo.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { criarDetector } from '../sequencia';

function digitar(detector: ReturnType<typeof criarDetector>, texto: string): (string | null)[] {
  return texto.split('').map((tecla) => detector.registrar(tecla));
}

describe('criarDetector', () => {
  it('completa a sequência quando as teclas batem em ordem', () => {
    const detector = criarDetector({ semente: 'semente' });
    const resultados = digitar(detector, 'semente');
    expect(resultados.slice(0, -1)).toEqual(new Array(6).fill(null));
    expect(resultados.at(-1)).toBe('semente');
  });

  it('não completa quando uma tecla no meio está errada', () => {
    const detector = criarDetector({ semente: 'semente' });
    // 's','e','m','x','e','n','t','e' — o 'x' quebra a sequência; mesmo
    // terminando em "...ente" (sufixo de "semente"), o restante não bate.
    const resultados = digitar(detector, 'semxente');
    expect(resultados.every((r) => r === null)).toBe(true);
  });

  it('ignora maiúsculas — normaliza para minúscula antes de comparar', () => {
    const detector = criarDetector({ semente: 'semente' });
    const resultados = digitar(detector, 'SEMENTE');
    expect(resultados.at(-1)).toBe('semente');
  });

  it('duas sequências independentes, cada uma completando a si mesma', () => {
    const detector = criarDetector({ semente: 'semente', orquidea: 'orquidea' });

    const r1 = digitar(detector, 'semente');
    expect(r1.at(-1)).toBe('semente');
    // Completar limpou o buffer: o restante da primeira rodada não vaza para a segunda.
    expect(r1.slice(0, -1).every((r) => r === null)).toBe(true);

    const r2 = digitar(detector, 'orquidea');
    expect(r2.at(-1)).toBe('orquidea');
    expect(r2.slice(0, -1).every((r) => r === null)).toBe(true);
  });

  it('uma sequência não dispara a outra por engano', () => {
    const detector = criarDetector({ semente: 'semente', orquidea: 'orquidea' });
    const resultados = digitar(detector, 'orquidea');
    expect(resultados.filter((r) => r === 'semente')).toEqual([]);
    expect(resultados.at(-1)).toBe('orquidea');
  });

  it('limpar() zera o buffer acumulado', () => {
    const detector = criarDetector({ semente: 'semente' });
    digitar(detector, 'seme');
    detector.limpar();
    const resultados = digitar(detector, 'nte');
    expect(resultados.every((r) => r === null)).toBe(true);
  });
});
