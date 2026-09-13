import { describe, it, expect } from 'vitest';
import { TAXONOMIA, caminhoValido, rotuloDoCaminho, classeRaiz } from '../taxonomia';
import { CLASSES } from '../classes-de-semente';

describe('taxonomia como caminho', () => {
  it('as raizes sao exatamente as classes de germinacao', () => {
    expect(TAXONOMIA.map((n) => n.chave).sort()).toEqual(Object.keys(CLASSES).sort());
  });
  it('anormal tem as tres subcategorias da RAS', () => {
    const anormal = TAXONOMIA.find((n) => n.chave === 'anormal')!;
    expect(anormal.filhos!.map((f) => f.chave)).toEqual(['danificada', 'deformada', 'deteriorada']);
  });
  it('valida caminho pela arvore', () => {
    expect(caminhoValido(['anormal', 'danificada'])).toBe(true);
    expect(caminhoValido(['normal', 'danificada'])).toBe(false);
    expect(caminhoValido(['inexistente'])).toBe(false);
    expect(caminhoValido([])).toBe(false);
  });
  it('escreve o caminho como rotulo legivel', () => {
    expect(rotuloDoCaminho(['anormal', 'danificada'])).toBe('Plântula anormal › Danificada');
  });
  it('a raiz do caminho e a classe que o denominador usa', () => {
    expect(classeRaiz(['anormal', 'deformada'])).toBe('anormal');
    expect(classeRaiz([])).toBeNull();
  });
});
