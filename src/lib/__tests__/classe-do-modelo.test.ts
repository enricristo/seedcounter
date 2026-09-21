// =============================================================================
// A tabela do treino é `[inviavel, viavel]`: 0 é inviável, 1 é viável.
// Foi decorada ao contrário duas vezes (fila com IA, importador de JSON).
// Estes testes fixam a tabela e os três caminhos de tradução.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  YOLO_CLASSES,
  categoriaDaDeteccao,
  categoriaDoIndice,
  categoriaDoNome,
  categoriaImportada,
  nomeDaCategoria,
} from '../classe-do-modelo';

describe('classe do modelo', () => {
  it('a tabela é a do treino: 0 inviável, 1 viável', () => {
    expect(YOLO_CLASSES).toEqual(['inviavel', 'viavel']);
    expect(categoriaDoIndice(0)).toBe('inviable');
    expect(categoriaDoIndice(1)).toBe('viable');
    expect(categoriaDoIndice(2)).toBeNull();
    expect(categoriaDoIndice(-1)).toBeNull();
  });

  it('a detecção traduz só pelo nome', () => {
    expect(categoriaDaDeteccao({ className: 'viavel' })).toBe('viable');
    expect(categoriaDaDeteccao({ className: 'inviavel' })).toBe('inviable');
  });

  it('o nome tolera acento, caixa e inglês; o resto é nulo', () => {
    expect(categoriaDoNome('inviável')).toBe('inviable');
    expect(categoriaDoNome('  Viável ')).toBe('viable');
    expect(categoriaDoNome('INVIABLE')).toBe('inviable');
    expect(categoriaDoNome('viable')).toBe('viable');
    expect(categoriaDoNome('with mold')).toBeNull();
    expect(categoriaDoNome('')).toBeNull();
  });

  it('nome e categoria são inversos', () => {
    expect(nomeDaCategoria('viable')).toBe('viavel');
    expect(nomeDaCategoria('inviable')).toBe('inviavel');
    expect(categoriaDoNome(nomeDaCategoria('inviable'))).toBe('inviable');
  });

  describe('registro importado de JSON', () => {
    it('confia em `category` antes de tudo', () => {
      expect(categoriaImportada({ category: 'inviable', class_name: 'viavel', class: 1 })).toBe('inviable');
    });

    it('sem `category`, lê `class_name` — inclusive acentuado, como o script Python escreve', () => {
      expect(categoriaImportada({ class_name: 'inviável' })).toBe('inviable');
      expect(categoriaImportada({ class_name: 'viável', class: 0 })).toBe('viable');
    });

    it('só por último cai no índice — e pela tabela do treino, não por "1 = ruim"', () => {
      // Era o defeito: `class === 1` virava inviável. 1 é VIÁVEL.
      expect(categoriaImportada({ class: 1 })).toBe('viable');
      expect(categoriaImportada({ class: 0 })).toBe('inviable');
      expect(categoriaImportada({ class_id: 0 })).toBe('inviable');
    });

    it('nome desconhecido não decide; índice desconhecido tampouco; o padrão é viável', () => {
      expect(categoriaImportada({ class_name: 'trigo duro', class: 0 })).toBe('inviable');
      expect(categoriaImportada({ class_name: 'trigo duro' })).toBe('viable');
      expect(categoriaImportada({ class: 7 })).toBe('viable');
      expect(categoriaImportada({})).toBe('viable');
      expect(categoriaImportada(null)).toBe('viable');
      expect(categoriaImportada('inviavel')).toBe('viable');
    });
  });
});
