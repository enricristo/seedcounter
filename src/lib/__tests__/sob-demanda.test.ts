// =============================================================================
// O pacote inicial não paga pelo que não usa.
//
// `recharts` (≈460 KB) e `jspdf` + `html2canvas` (≈580 KB) só servem a quem
// abre um gráfico ou gera um PDF. Até 21/09 os dois pedaços estavam na lista
// de pré-carregamento do `index.html`, porque bastava UM import estático em
// qualquer módulo alcançável a partir de `main.tsx` para o empacotador
// puxá-los para a abertura. Não é um defeito que apareça em teste de
// comportamento: cada componente funciona; é a FORMA do grafo de importação
// que decide o que o navegador baixa antes de mostrar a primeira tela.
//
// Estes testes percorrem só os imports ESTÁTICOS (`import x from`, `export x
// from`, `import 'x'`) a partir de `main.tsx`, ignorando `import()`. É a
// mesma travessia que o empacotador faz para decidir o pedaço inicial. Se
// alguém voltar a importar `recharts` de forma estática num componente que
// o App monta, o teste diz em qual arquivo.
//
// O padrão que resolve é `lib/sob-demanda.tsx`; o mesmo mecanismo vale para
// `jspdf` — hoje ele ainda chega pelo laudo (`lib/laudo/documento.ts`, via
// `App.tsx`), e o segundo teste registra isso como o próximo alvo, não como
// falha.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const relativo = (c: string) => c.slice(SRC.length + 1).replace(/\\/g, '/');

/**
 * Só os especificadores importados de forma ESTÁTICA por um arquivo.
 *
 * `[^;'"]*?` entre o `import`/`export` e o `from` impede o casamento de saltar
 * de uma instrução para a próxima, e exclui `import('x')`, que não tem `from`.
 */
function importesEstaticosDe(caminho: string): string[] {
  const texto = readFileSync(caminho, 'utf8');
  const achados: string[] = [];
  for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)\s+[^;'"]*?\s*from\s*['"]([^'"]+)['"]/g)) {
    achados.push(m[1]);
  }
  // `import './index.css'` — efeito colateral, sem `from`.
  for (const m of texto.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) {
    achados.push(m[1]);
  }
  return achados;
}

/** Um especificador relativo → o arquivo de origem, do jeito que o Vite acha. */
function resolverRelativo(deArquivo: string, especificador: string): string | null {
  const semSufixo = especificador.replace(/\?.*$/, '');
  if (/\.(css|svg|png|jpg|json)$/.test(semSufixo)) return null;
  const base = resolve(dirname(deArquivo), semSufixo);
  const candidatos = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  for (const c of candidatos) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/**
 * Percorre o grafo estático a partir de `main.tsx`. Devolve, para cada pacote
 * externo alcançado, QUEM o importa — é a resposta útil quando o teste falha.
 */
function pacotesAlcancaveis(): Map<string, string[]> {
  const inicio = join(SRC, 'main.tsx');
  const vistos = new Set<string>();
  const fila = [inicio];
  const porPacote = new Map<string, string[]>();

  while (fila.length > 0) {
    const arquivo = fila.pop() as string;
    if (vistos.has(arquivo)) continue;
    vistos.add(arquivo);

    for (const esp of importesEstaticosDe(arquivo)) {
      if (esp.startsWith('.') || esp.startsWith('/')) {
        const destino = resolverRelativo(arquivo, esp);
        if (destino) fila.push(destino);
        continue;
      }
      const lista = porPacote.get(esp) ?? [];
      lista.push(relativo(arquivo));
      porPacote.set(esp, lista);
    }
  }
  return porPacote;
}

describe('o pacote inicial', () => {
  const pacotes = pacotesAlcancaveis();

  it('a travessia enxerga o App (senão o teste não prova nada)', () => {
    expect(pacotes.get('react')).toBeDefined();
    expect(pacotes.get('lucide-react')).toBeDefined();
  });

  it('não alcança o recharts por import estático', () => {
    const quem = pacotes.get('recharts') ?? [];
    expect(quem, `recharts chega ao pacote inicial por: ${quem.join(', ')}`).toEqual([]);
  });

  it('registra por onde o jspdf ainda chega (próximo alvo, não regressão)', () => {
    // O laudo importa `jspdf` estaticamente e é montado pelo App. Quando isso
    // virar `import()`, troque este `toEqual` por `[]` — e o pedaço `pdf-export`
    // sai do `index.html` também.
    const quem = pacotes.get('jspdf') ?? [];
    expect(quem).toEqual(['lib/laudo/documento.ts']);
  });
});
