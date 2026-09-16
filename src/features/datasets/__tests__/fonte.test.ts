import { describe, it, expect } from 'vitest';
import { agruparPorConjunto } from '../fonte';

/**
 * Só a parte pura de `fonte.ts` é testável em node: o resto depende de
 * `File`/`FileSystemDirectoryHandle`/DOM, que não existem aqui (ver o plano
 * do Lote B — "verificação no navegador fica para a B3").
 */
describe('agruparPorConjunto', () => {
  it('agrupa por subpasta de primeiro nível; raiz por último, ordenado por nome', () => {
    const r = agruparPorConjunto(['A/x/1.jpg', 'A/2.jpg', 'B/3.png', '4.jpg']);
    expect(r).toEqual([
      { nome: 'A', caminhos: ['A/x/1.jpg', 'A/2.jpg'] },
      { nome: 'B', caminhos: ['B/3.png'] },
      { nome: '(raiz)', caminhos: ['4.jpg'] },
    ]);
  });

  it('sem imagem solta na raiz, não há grupo (raiz)', () => {
    const r = agruparPorConjunto(['A/1.jpg', 'B/2.jpg']);
    expect(r.map((c) => c.nome)).toEqual(['A', 'B']);
  });

  it('só raiz: um único grupo (raiz)', () => {
    const r = agruparPorConjunto(['1.jpg', '2.jpg']);
    expect(r).toEqual([{ nome: '(raiz)', caminhos: ['1.jpg', '2.jpg'] }]);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(agruparPorConjunto([])).toEqual([]);
  });

  it('normaliza barra invertida (Windows) para "/"', () => {
    const r = agruparPorConjunto(['A\\1.jpg']);
    expect(r).toEqual([{ nome: 'A', caminhos: ['A/1.jpg'] }]);
  });
});
