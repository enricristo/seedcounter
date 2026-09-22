// =============================================================================
// Todo atalho prometido tem quem o atenda — e vice-versa.
//
// A pergunta do dono foi "os botões-atalhos estão todos funcionando?". Não
// dá para responder montando o App: o teste roda em Node, sem DOM, e mesmo
// com DOM um teste de comportamento cobriria só as teclas que alguém
// lembrou de listar. A resposta está na relação entre DOIS conjuntos que o
// código-fonte declara:
//
//   PROMETIDO — o que a interface diz à pessoa: a tabela da ajuda
//   (`features/ajuda/atalhos.ts`) e os `title="... (Ctrl+Z)"` dos botões.
//
//   ATENDIDO — o que algum ouvinte de `keydown` trata de fato:
//   `useKeyboardShortcuts` (geral), `useTools` (ferramentas, X, Alt, [ ]),
//   `MarkingCanvas` (Esc) e o painel de flags em `App.tsx` (Ctrl+Shift+D).
//
// Os dois lados são lidos do fonte e normalizados para a mesma grafia
// ("ctrl+shift+z", "espaço"). Prometido sem atendido é botão que mente;
// atendido sem prometido é tecla que ninguém descobre. Os dois são falha.
//
// O último bloco confere as três condições que fazem um atalho de uma letra
// ser seguro: não dispara com foco num campo de texto, o cronômetro que
// também escuta `keydown` é passivo (só observa), e Ctrl+Alt+dígito lê o
// CÓDIGO da tecla — em Windows com teclado ABNT2, Ctrl+Alt é AltGr e
// `e.key` de Ctrl+Alt+2 vem como "²", não "2".
// =============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRUPOS_DE_ATALHOS } from '../features/ajuda/atalhos';
import { TOOLS } from '../hooks/useTools';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ler = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

function arquivosTsx(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '__tests__') continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosTsx(caminho));
    else if (/\.tsx$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

// -----------------------------------------------------------------------------
// Grafia canônica: "ctrl+shift+alt+<tecla>", minúsculas, sem espaços.
// -----------------------------------------------------------------------------

const NOME_DA_TECLA: Record<string, string> = {
  ' ': 'espaço',
  espaco: 'espaço',
  space: 'espaço',
  escape: 'esc',
  '=': '+',
  _: '-',
  '−': '-',
};

function canonica(teclas: string): string {
  // O `case ' '` do gancho: a tecla é o próprio espaço, não um separador.
  if (teclas === ' ') return 'espaço';
  const partes = teclas
    .toLowerCase()
    .split(/\s*\+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  // "Ctrl + Z" vira ["ctrl","z"]; "+" sozinho vira [] — é a tecla "+".
  if (partes.length === 0) return '+';
  const mods = new Set<string>();
  let tecla = '';
  for (const p of partes) {
    if (p === 'ctrl' || p === 'shift' || p === 'alt') mods.add(p);
    else tecla = NOME_DA_TECLA[p] ?? p;
  }
  const ordem = ['ctrl', 'shift', 'alt'].filter((m) => mods.has(m));
  // "Alt" sozinho (borracha enquanto segurar) é modificador E tecla.
  return [...ordem, ...(tecla ? [tecla] : [])].join('+');
}

/** Uma tecla física que faz sentido prometer num `title`. */
const PARECE_TECLA = /^(?:(?:ctrl|shift|alt)\s*\+\s*)*(?:[a-z0-9]|espaço|backspace|esc|[+\-−=_[\]])$/i;

// -----------------------------------------------------------------------------
// PROMETIDO
// -----------------------------------------------------------------------------

function prometidoNaAjuda(): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of GRUPOS_DE_ATALHOS) {
    for (const a of g.atalhos) {
      // "+ / −" são duas teclas; "[ ]" também; "Alt" sozinho é modificador
      // segurado (borracha), tratado no `useTools` por `e.key === 'Alt'`.
      const variantes = a.teclas.includes(' / ')
        ? a.teclas.split(' / ')
        : a.teclas === '[ ]'
          ? ['[', ']']
          : [a.teclas];
      for (const v of variantes) m.set(canonica(v), `ajuda: ${g.titulo} › ${a.acao}`);
    }
  }
  return m;
}

function prometidoEmTitles(): Map<string, string> {
  const m = new Map<string, string>();
  for (const arquivo of arquivosTsx(SRC)) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const t of fonte.matchAll(/title=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const texto = t[1] ?? t[2] ?? '';
      const paren = /\(([^()]*)\)\s*$/.exec(texto.trim());
      if (!paren) continue;
      for (const pedaco of paren[1].split(/\s+ou\s+|\s*\/\s*/)) {
        if (!PARECE_TECLA.test(pedaco.trim())) continue;
        m.set(canonica(pedaco), `${relative(SRC, arquivo).replace(/\\/g, '/')}: "${texto}"`);
      }
    }
  }
  return m;
}

// -----------------------------------------------------------------------------
// ATENDIDO
// -----------------------------------------------------------------------------

function atendidoPeloGancho(): Set<string> {
  const fonte = ler('hooks/useKeyboardShortcuts.ts');
  const s = new Set<string>();

  // Teclas simples: cada `case '<tecla>':` do switch.
  for (const c of fonte.matchAll(/case '([^']+)':/g)) s.add(canonica(c[1]));

  // Bloco Ctrl/Meta: cada `e.key.toLowerCase() === '<letra>'` dentro dele.
  const inicioCtrl = fonte.indexOf('if (e.ctrlKey || e.metaKey) {');
  const fimCtrl = fonte.indexOf('if (isTyping) return;');
  expect(inicioCtrl).toBeGreaterThan(-1);
  expect(fimCtrl).toBeGreaterThan(inicioCtrl);
  const blocoCtrl = fonte.slice(inicioCtrl, fimCtrl);
  for (const c of blocoCtrl.matchAll(/e\.key\.toLowerCase\(\) === '([a-z])'/g)) {
    const letra = c[1];
    // Ctrl+Alt+N é o `if` que também testa `e.altKey`; os demais são Ctrl+letra.
    const linha = blocoCtrl.slice(blocoCtrl.lastIndexOf('\n', c.index ?? 0), c.index);
    if (linha.includes('e.altKey')) s.add(`ctrl+alt+${letra}`);
    else s.add(`ctrl+${letra}`);
  }
  // Ctrl+Shift+Z: o `if (e.shiftKey) onRedo()` dentro do ramo do 'z'.
  if (/=== 'z'[\s\S]*?if \(e\.shiftKey\) onRedo\(\)/.test(blocoCtrl)) s.add('ctrl+shift+z');
  // Ctrl+Alt+1..4: lidos pelo CÓDIGO da tecla (Digit1..Digit4).
  if (/Digit\(\[1-4\]\)/.test(blocoCtrl) || /\^\[1-4\]\$/.test(blocoCtrl)) {
    for (const n of [1, 2, 3, 4]) s.add(`ctrl+alt+${n}`);
  }
  return s;
}

function atendidoPelasFerramentas(): Set<string> {
  const fonte = ler('hooks/useTools.ts');
  const s = new Set<string>();
  for (const t of TOOLS) s.add(canonica(t.shortcut));
  if (/e\.key\.toLowerCase\(\) === 'x'/.test(fonte)) s.add('x');
  if (/e\.key === 'Alt'/.test(fonte)) s.add('alt');
  if (/e\.key === '\['/.test(fonte)) s.add('[');
  if (/e\.key === '\]'/.test(fonte)) s.add(']');
  return s;
}

/** Ouvintes fora dos dois ganchos, cada um com a prova de que trata a tecla. */
const OUTROS_OUVINTES: { tecla: string; arquivo: string; prova: RegExp }[] = [
  { tecla: 'esc', arquivo: 'components/canvas/MarkingCanvas.tsx', prova: /e\.key !== 'Escape'\) return/ },
  { tecla: 'ctrl+shift+d', arquivo: 'App.tsx', prova: /e\.ctrlKey && e\.shiftKey && e\.key\.toLowerCase\(\) === 'd'/ },
];

function atendidoPorOutros(): Set<string> {
  const s = new Set<string>();
  for (const o of OUTROS_OUVINTES) {
    if (o.prova.test(ler(o.arquivo))) s.add(o.tecla);
  }
  return s;
}

// -----------------------------------------------------------------------------

describe('atalhos prometidos × atendidos', () => {
  const ajuda = prometidoNaAjuda();
  const titles = prometidoEmTitles();
  const atendido = new Set([...atendidoPeloGancho(), ...atendidoPelasFerramentas(), ...atendidoPorOutros()]);

  it('a leitura enxerga os dois lados (senão o teste não prova nada)', () => {
    expect(ajuda.size).toBeGreaterThan(20);
    expect(titles.size).toBeGreaterThan(5);
    expect(atendido.size).toBeGreaterThan(20);
    expect(atendido.has('ctrl+z')).toBe(true);
    expect(atendido.has('espaço')).toBe(true);
  });

  it('toda tecla prometida na ajuda tem quem a atenda', () => {
    const orfas = [...ajuda].filter(([t]) => !atendido.has(t)).map(([t, onde]) => `${t} (${onde})`);
    expect(orfas).toEqual([]);
  });

  it('toda tecla prometida num title= tem quem a atenda', () => {
    const orfas = [...titles].filter(([t]) => !atendido.has(t)).map(([t, onde]) => `${t} (${onde})`);
    expect(orfas).toEqual([]);
  });

  it('toda tecla atendida está documentada na ajuda', () => {
    const escondidas = [...atendido].filter((t) => !ajuda.has(t));
    expect(escondidas).toEqual([]);
  });

  it('nenhum atalho usa Ctrl+1..4 nem Ctrl+Shift+N (o navegador é dono)', () => {
    for (const t of [...ajuda.keys(), ...titles.keys(), ...atendido]) {
      expect(t, t).not.toMatch(/^ctrl\+[1-4]$/);
      expect(t, t).not.toBe('ctrl+shift+n');
    }
  });
});

describe('atalho de uma letra não dispara enquanto se digita', () => {
  it('useKeyboardShortcuts sai antes do switch quando o foco está num campo', () => {
    const fonte = ler('hooks/useKeyboardShortcuts.ts');
    const guarda = fonte.indexOf('if (isTyping) return;');
    const troca = fonte.indexOf('switch (e.key.toLowerCase())');
    expect(guarda).toBeGreaterThan(-1);
    expect(troca).toBeGreaterThan(guarda);
    expect(fonte).toMatch(/tagName === 'INPUT'/);
    expect(fonte).toMatch(/tagName === 'TEXTAREA'/);
    expect(fonte).toMatch(/contenteditable/);
  });

  it('Ctrl+Z e Ctrl+Y ficam com o campo quando há um campo com foco', () => {
    // Nas Observações, Ctrl+Z desfaz o texto, não a última marca.
    const fonte = ler('hooks/useKeyboardShortcuts.ts');
    expect(fonte).toMatch(/!isTyping && e\.key\.toLowerCase\(\) === 'z'/);
    expect(fonte).toMatch(/!isTyping && e\.key\.toLowerCase\(\) === 'y'/);
  });

  it('useTools tem a mesma guarda (e ainda cobre <select>)', () => {
    const fonte = ler('hooks/useTools.ts');
    expect(fonte).toMatch(/isTyping\(e\.target\)/);
    expect(fonte).toMatch(/tag === 'SELECT'/);
    expect(fonte).toMatch(/isContentEditable/);
  });

  it('o cronômetro escuta keydown só para observar: passivo, em captura, sem preventDefault', () => {
    const fonte = ler('hooks/useCronometro.ts');
    expect(fonte).toMatch(/passive: true, capture: true/);
    expect(fonte).not.toMatch(/preventDefault|stopPropagation|stopImmediatePropagation/);
  });

  it('os ovos de páscoa ignoram campos de texto e combinações com modificador', () => {
    const fonte = ler('features/easter/useEasterEggs.ts');
    expect(fonte).toMatch(/e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/);
    expect(fonte).toMatch(/tagName === 'TEXTAREA'/);
  });
});

describe('Ctrl+Alt+dígito em teclado ABNT2', () => {
  it('as bancadas leem e.code (Digit1..4), não e.key', () => {
    // Em Windows, Ctrl+Alt é AltGr. Com layout ABNT2, AltGr+2 produz "²" —
    // `e.key` nunca seria "2" e o atalho prometido nunca dispararia. `e.code`
    // é a tecla física, igual em qualquer layout.
    const fonte = ler('hooks/useKeyboardShortcuts.ts');
    expect(fonte).toMatch(/Digit\(\[1-4\]\)/);
    expect(fonte).toMatch(/KeyN/);
  });
});
