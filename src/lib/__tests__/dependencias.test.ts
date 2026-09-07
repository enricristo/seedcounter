// =============================================================================
// Guardas de dependência entre módulos.
//
// POR QUE EXISTEM.
//
// A build de produção quebrou com tela branca e
// "ReferenceError: Cannot access 'uo' before initialization". Causa: ciclo
// entre PEDAÇOS do bundle.
//
// `synthetic-scene.ts` importava `criarRng` de `synthetic-data.ts`. Esse
// último é alcançado pelo `demo-store`, que importa o Dexie — então o Rollup
// juntou os dois no pedaço `db-lib`, enquanto a cena ficou no principal. O
// principal passou a precisar do `db-lib` durante a avaliação dos módulos, e o
// `db-lib` precisava do principal.
//
// O modo de desenvolvimento NÃO mostra: ele carrega módulo a módulo e tolera o
// ciclo. Só o pacote agrupado quebra — e quebra a página inteira, não uma
// funcionalidade. Nenhum teste unitário pegaria isso, porque cada módulo
// isolado funciona.
//
// Estes testes são sobre a FORMA do grafo de importação, que é o que o
// empacotador enxerga.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function listarFontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      listarFontes(caminho, acc);
    } else if (/\.tsx?$/.test(nome)) {
      acc.push(caminho);
    }
  }
  return acc;
}

const ARQUIVOS = listarFontes(SRC);
const relativo = (c: string) => c.slice(SRC.length + 1).replace(/\\/g, '/');

/** Especificadores importados por um arquivo. */
function importesDe(caminho: string): string[] {
  const texto = readFileSync(caminho, 'utf8');
  const achados: string[] = [];
  // Cobre `import ... from 'x'`, `export ... from 'x'` e `import('x')`.
  for (const m of texto.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    achados.push(m[1]);
  }
  return achados;
}

describe('grafo de importação', () => {
  it('o sorteador mora num módulo folha, sem dependência pesada junto', () => {
    // `rng.ts` é importado por quem só quer sortear um número. Se ele passar a
    // importar qualquer coisa, volta a arrastar carga para dentro do pedaço de
    // quem o usa — que foi exatamente o que derrubou a página.
    const importes = importesDe(join(SRC, 'lib', 'rng.ts')).filter(
      (i) => !i.startsWith('node:') && !i.includes('vitest')
    );
    expect(importes, `rng.ts importa ${importes.join(', ')}`).toEqual([]);
  });

  it('a geração de cena não depende da geração de dados de ensaio', () => {
    // São coisas diferentes: cena é imagem, `synthetic-data` é experimento
    // gravado no banco. Ligar as duas recria o ciclo.
    const importes = importesDe(join(SRC, 'lib', 'synthetic-scene.ts'));
    expect(importes.some((i) => i.includes('synthetic-data'))).toBe(false);
  });

  it('componente de interface não alcança o banco por um barril', () => {
    // Um barril (`index.ts`) reexporta tudo da pasta. Importar dele traz junto
    // o que você não pediu — no caso, o DemoDataPanel e com ele o Dexie, para
    // dentro da barra lateral. Importar o módulo específico evita isso.
    const suspeitos: string[] = [];
    for (const arquivo of ARQUIVOS) {
      const rel = relativo(arquivo);
      if (!rel.startsWith('components/')) continue;
      for (const i of importesDe(arquivo)) {
        // Barril de feature: termina em `features/<nome>` sem arquivo.
        if (/features\/[a-z-]+$/.test(i)) suspeitos.push(`${rel}: ${i}`);
      }
    }
    expect(suspeitos).toEqual([]);
  });

  it('nenhum módulo de lib importa de features ou components', () => {
    // `lib/` é a camada de baixo. Se ela subir, cria ciclo com certeza — e o
    // empacotador só avisa quando já é tarde.
    const invertidos: string[] = [];
    for (const arquivo of ARQUIVOS) {
      const rel = relativo(arquivo);
      if (!rel.startsWith('lib/')) continue;
      for (const i of importesDe(arquivo)) {
        if (i.includes('/features/') || i.includes('/components/')) {
          invertidos.push(`${rel}: ${i}`);
        }
      }
    }
    expect(invertidos).toEqual([]);
  });
});
