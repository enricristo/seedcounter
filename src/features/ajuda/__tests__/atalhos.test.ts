// =============================================================================
// A ajuda não pode ficar para trás do código.
//
// Foi o que aconteceu: a onda, o ajuste, o desenho, a máscara e a galeria
// ganharam tecla e a ajuda continuou listando as sete de sempre. Estes testes
// leem o que os ganchos de teclado tratam e conferem que a ajuda fala de cada
// tecla — estáticos de propósito, porque o defeito é de esquecimento, e um
// teste que exigisse montar o App não seria escrito.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRUPOS_DE_ATALHOS, INSTRUCOES_DO_MOUSE } from '../atalhos';
import { TOOLS } from '../../../hooks/useTools';

const HOOKS = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'hooks');

const TECLAS_LISTADAS = GRUPOS_DE_ATALHOS.flatMap((g) => g.atalhos.map((a) => a.teclas.toLowerCase()));

/**
 * A ajuda menciona esta tecla em algum atalho?
 *
 * Separadores só contam com espaço dos dois lados: "+ / −" é a tecla "+" e a
 * tecla "−", não três separadores.
 */
function listada(tecla: string): boolean {
  return TECLAS_LISTADAS.some((t) => t.split(/\s+[+/·]\s+|\s+/).includes(tecla));
}

/** Como o `case` do gancho escreve a tecla → como a ajuda escreve. */
const NOME_NA_AJUDA: Record<string, string | null> = {
  ' ': 'espaço',
  backspace: 'backspace',
  // Variantes de teclado: '=' e '_' são '+' e '-' sem Shift. A ajuda mostra
  // o símbolo que a pessoa procura, não o código da tecla.
  '=': null,
  _: null,
  '+': '+',
  '-': '−',
};

describe('ajuda de teclado', () => {
  it('toda ferramenta da barra tem a tecla na ajuda', () => {
    for (const t of TOOLS) {
      expect(listada(t.shortcut), `ferramenta ${t.id} (${t.shortcut})`).toBe(true);
    }
  });

  it('toda tecla que useKeyboardShortcuts trata aparece na ajuda', () => {
    const fonte = readFileSync(join(HOOKS, 'useKeyboardShortcuts.ts'), 'utf8');
    const casos = [...fonte.matchAll(/case '([^']+)':/g)].map((m) => m[1]);
    expect(casos.length).toBeGreaterThan(5);

    const esquecidas: string[] = [];
    for (const caso of casos) {
      const nome = caso in NOME_NA_AJUDA ? NOME_NA_AJUDA[caso] : caso;
      if (nome === null) continue;
      if (!listada(nome)) esquecidas.push(caso);
    }
    expect(esquecidas).toEqual([]);
  });

  it('os atalhos com Ctrl do gancho aparecem na ajuda', () => {
    const fonte = readFileSync(join(HOOKS, 'useKeyboardShortcuts.ts'), 'utf8');
    const comCtrl = [...fonte.matchAll(/e\.key\.toLowerCase\(\) === '([a-z])'/g)].map((m) => m[1]);
    expect(comCtrl).toContain('z');
    for (const letra of new Set(comCtrl)) {
      const achou = TECLAS_LISTADAS.some((t) => t.startsWith('ctrl') && t.endsWith(letra));
      expect(achou, `Ctrl + ${letra.toUpperCase()}`).toBe(true);
    }
  });

  it('desfazer e refazer estão os dois na ajuda', () => {
    const acoes = GRUPOS_DE_ATALHOS.flatMap((g) => g.atalhos.map((a) => a.acao.toLowerCase()));
    expect(acoes).toContain('desfazer');
    expect(acoes).toContain('refazer');
  });
});

describe('ajuda de mouse', () => {
  it('cada ferramenta de instrumento tem um grupo de instruções com a própria tecla', () => {
    const teclasDosGrupos = INSTRUCOES_DO_MOUSE.flatMap((g) => (g.tecla ?? '').toLowerCase().split(/\s*·\s*/));
    for (const t of TOOLS.filter((t) => t.grupo !== 'navegacao')) {
      expect(teclasDosGrupos, `ferramenta ${t.id}`).toContain(t.shortcut);
    }
  });

  it('a ferramenta de contorno explica os quatro gestos: alça, borda, remover, raspar', () => {
    const grupo = INSTRUCOES_DO_MOUSE.find((g) => g.tecla === 'C');
    const texto = grupo?.instrucoes.map((i) => `${i.gesto} ${i.efeito}`.toLowerCase()).join(' ') ?? '';
    expect(texto).toMatch(/alça/);
    expect(texto).toMatch(/borda/);
    expect(texto).toMatch(/remove/);
    expect(texto).toMatch(/raspa/);
  });

  it('nenhuma instrução vazia', () => {
    for (const g of INSTRUCOES_DO_MOUSE) {
      expect(g.instrucoes.length, g.titulo).toBeGreaterThan(0);
      for (const i of g.instrucoes) {
        expect(i.gesto.trim().length).toBeGreaterThan(0);
        expect(i.efeito.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
