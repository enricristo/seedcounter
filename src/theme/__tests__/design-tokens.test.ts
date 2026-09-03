// =============================================================================
// SeedCounter — guarda do sistema de design (Bancada Óptica)
// Spec: docs/superpowers/specs/2026-09-03-bancada-optica-design.md
//
// Converte em verificação automática os critérios de aceitação que antes
// dependiam de revisão manual. Não testa comportamento: testa que a camada de
// apresentação não volta a acumular cor fora do sistema.
//
// Não toca nenhum teste existente — vive em src/theme/ justamente para não
// colidir com src/lib/__tests__/, que outro agente mantém.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const SRC = join(RAIZ, 'src');

/**
 * Adiado para o PR 2: App.tsx tem um fragmento <> vazio cuja remoção reindenta
 * ~300 linhas. Os dois consertos saem juntos, para não enterrar o diff.
 */
const ADIADOS = ['App.tsx'];

function listarTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) listarTsx(caminho, acc);
    else if (nome.endsWith('.tsx') && !ADIADOS.includes(nome)) acc.push(caminho);
  }
  return acc;
}

const ARQUIVOS = listarTsx(SRC);

const GRAFICOS = [
  'src/components/charts/PlateViabilityChart.tsx',
  'src/components/charts/SessionTrendChart.tsx',
  'src/features/stats/components/GerminationBarChart.tsx',
  'src/features/stats/components/GerminationCurveChart.tsx',
  'src/features/stats/components/WilsonCIBar.tsx',
];

const relativo = (caminho: string) => caminho.slice(RAIZ.length + 1).replace(/\\/g, '/');

describe('sistema de design — Bancada Óptica', () => {
  it('não usa tons de Tailwind que não existem', () => {
    // A escala do Tailwind tem 50, 100..900 e 950. Os passos intermediários
    // (150, 250, 350, 450, 550, 650, 750, 850) não geram CSS nenhum: viram
    // bordas e textos invisíveis que ninguém percebe na revisão.
    const morto =
      /\b(?:dark:)?(?:[a-z-]+:)?(?:bg|text|border|ring|fill|stroke|from|to|via|divide|placeholder|outline|shadow|accent|caret|decoration)-(?:neutral|zinc|gray|slate|stone|emerald|green|lime|purple|violet|indigo|amber|yellow|orange|sky|blue|cyan|teal|red|rose|pink|fuchsia)-(?:150|250|350|450|550|650|750|850)\b/g;

    const achados: string[] = [];
    for (const arquivo of ARQUIVOS) {
      for (const m of readFileSync(arquivo, 'utf8').matchAll(morto)) {
        achados.push(`${relativo(arquivo)}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('não codifica cor de gráfico em hex literal', () => {
    // Cor de gráfico vem de var(--color-*). Hex literal não acompanha o tema:
    // era por isso que o tooltip ficava escuro mesmo no tema claro.
    const hex = /#[0-9a-fA-F]{3,8}\b/g;

    const achados: string[] = [];
    for (const rel of GRAFICOS) {
      for (const m of readFileSync(join(RAIZ, rel), 'utf8').matchAll(hex)) {
        achados.push(`${rel}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('não recicla cor de série acima do teto da paleta', () => {
    // Ciclar com índice % tamanho repete a cor da 1a série na 9a e quebra a
    // leitura em silêncio. Acima do teto o excedente vira neutro.
    const ciclo = /\[\s*\w+\s*%\s*\w+(?:\.length)?\s*\]/g;

    const achados: string[] = [];
    for (const rel of GRAFICOS) {
      for (const m of readFileSync(join(RAIZ, rel), 'utf8').matchAll(ciclo)) {
        achados.push(`${rel}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('declara as 8 séries nos dois temas', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    for (let i = 1; i <= 8; i++) {
      expect(css, `--color-series-${i} ausente`).toContain(`--color-series-${i}:`);
      // Uma no @theme (claro), outra no bloco .dark (escuro).
      expect(css.match(new RegExp(`--color-series-${i}:`, 'g'))).toHaveLength(2);
    }
  });

  it('mantém o palco com lightness fixa nos dois temas', () => {
    // Contraste simultâneo: um entorno que muda de claridade altera a
    // tonalidade percebida da amostra e invalida a comparação entre sessões.
    // Se alguém "corrigir" isso adicionando um valor escuro, este teste cai.
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    expect(css.match(/--color-stage:/g)).toHaveLength(1);
  });

  it('liga a variante dark à classe, não ao sistema operacional', () => {
    // useTheme.ts alterna a classe .dark no elemento raiz. Sem esta linha o
    // Tailwind v4 usa @media (prefers-color-scheme) e o alternador de tema
    // não tem efeito visual nenhum.
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    expect(css).toContain('@custom-variant dark');
  });
});
