// =============================================================================
// letras.ts — a propriedade que a tabela promete: dois tratamentos
// compartilham uma letra SE E SOMENTE SE o teste não os separou.
// =============================================================================

import { describe, expect, it } from 'vitest';
import type { ComparisonPair } from '../../../types';
import { letrasDeComparacao } from '../letras';

const par = (a: string, b: string, significant: boolean): ComparisonPair => ({
  groupA: a,
  groupB: b,
  meanDiff: 0,
  significant,
  pAdj: significant ? 0.05 : 1,
});

/** Todos os pares (i < j) dos rótulos, com o conjunto dos significativos. */
function pares(rotulos: string[], diferentes: [string, string][]): ComparisonPair[] {
  const chave = (a: string, b: string) => [a, b].sort().join('|');
  const dif = new Set(diferentes.map(([a, b]) => chave(a, b)));
  const r: ComparisonPair[] = [];
  for (let i = 0; i < rotulos.length; i++)
    for (let j = i + 1; j < rotulos.length; j++) r.push(par(rotulos[i], rotulos[j], dif.has(chave(rotulos[i], rotulos[j]))));
  return r;
}

/** A propriedade, verificada em cima do resultado. */
function compartilham(letras: Map<string, string>, a: string, b: string): boolean {
  const la = letras.get(a) ?? '';
  const lb = letras.get(b) ?? '';
  return [...la].some((c) => lb.includes(c));
}

describe('letrasDeComparacao', () => {
  it('nenhuma diferença: todos "a"', () => {
    const g = [
      { rotulo: 'T0', media: 10 },
      { rotulo: 'T8', media: 9 },
      { rotulo: 'T16', media: 8 },
    ];
    const l = letrasDeComparacao(g, pares(['T0', 'T8', 'T16'], []));
    expect([...l.values()]).toEqual(['a', 'a', 'a']);
  });

  it('todos diferentes: a, b, c pela média decrescente', () => {
    const g = [
      { rotulo: 'baixo', media: 1 },
      { rotulo: 'alto', media: 3 },
      { rotulo: 'medio', media: 2 },
    ];
    const l = letrasDeComparacao(
      g,
      pares(['baixo', 'alto', 'medio'], [
        ['baixo', 'alto'],
        ['baixo', 'medio'],
        ['alto', 'medio'],
      ]),
    );
    expect(l.get('alto')).toBe('a');
    expect(l.get('medio')).toBe('b');
    expect(l.get('baixo')).toBe('c');
  });

  it('o caso que o passe guloso erra: A ≠ C, A = B, B = C → a, ab, b', () => {
    const g = [
      { rotulo: 'A', media: 10 },
      { rotulo: 'B', media: 8 },
      { rotulo: 'C', media: 6 },
    ];
    const l = letrasDeComparacao(g, pares(['A', 'B', 'C'], [['A', 'C']]));
    expect(l.get('A')).toBe('a');
    expect(l.get('B')).toBe('ab');
    expect(l.get('C')).toBe('b');
  });

  it('dois grupos: iguais → a/a; diferentes → a/b', () => {
    const g = [
      { rotulo: 'X', media: 5 },
      { rotulo: 'Y', media: 4 },
    ];
    expect([...letrasDeComparacao(g, pares(['X', 'Y'], [])).values()]).toEqual(['a', 'a']);
    const l = letrasDeComparacao(g, pares(['X', 'Y'], [['X', 'Y']]));
    expect(l.get('X')).toBe('a');
    expect(l.get('Y')).toBe('b');
  });

  it('cinco grupos em cadeia: cada um difere só do que está a dois passos', () => {
    // médias 5,4,3,2,1; vizinhos iguais, distância ≥ 2 diferentes.
    const rotulos = ['g5', 'g4', 'g3', 'g2', 'g1'];
    const g = rotulos.map((r, i) => ({ rotulo: r, media: 5 - i }));
    const dif: [string, string][] = [];
    for (let i = 0; i < 5; i++) for (let j = i + 2; j < 5; j++) dif.push([rotulos[i], rotulos[j]]);
    const l = letrasDeComparacao(g, pares(rotulos, dif));
    expect(l.get('g5')).toBe('a');
    expect(l.get('g4')).toBe('ab');
    expect(l.get('g3')).toBe('bc');
    expect(l.get('g2')).toBe('cd');
    expect(l.get('g1')).toBe('d');
  });

  it('propriedade: compartilhar letra ⇔ não diferir (varredura de padrões)', () => {
    const rotulos = ['A', 'B', 'C', 'D'];
    const todosOsPares: [string, string][] = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) todosOsPares.push([rotulos[i], rotulos[j]]);
    const g = rotulos.map((r, i) => ({ rotulo: r, media: 4 - i }));
    // 2^6 subconjuntos de pares "diferentes". Nem todos são consistentes com
    // uma ordenação de médias, mas a propriedade tem que valer mesmo assim.
    for (let mascara = 0; mascara < 64; mascara++) {
      const dif = todosOsPares.filter((_, k) => (mascara >> k) & 1);
      const ps = pares(rotulos, dif);
      const l = letrasDeComparacao(g, ps);
      for (const p of ps) {
        expect(compartilham(l, p.groupA, p.groupB), `${p.groupA}-${p.groupB} máscara ${mascara}`).toBe(!p.significant);
      }
      for (const r of rotulos) expect((l.get(r) ?? '').length, `${r} sem letra, máscara ${mascara}`).toBeGreaterThan(0);
    }
  });

  it('grupo que não aparece nos pares (n = 1) simplesmente não é separado de ninguém', () => {
    const g = [
      { rotulo: 'A', media: 2 },
      { rotulo: 'B', media: 1 },
    ];
    const l = letrasDeComparacao(g, []);
    expect(l.get('A')).toBe('a');
    expect(l.get('B')).toBe('a');
  });
});
