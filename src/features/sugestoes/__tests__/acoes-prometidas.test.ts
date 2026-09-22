// =============================================================================
// Toda ação de sugestão prometida tem quem a atenda — e vice-versa.
//
// O painel de sugestões oferece um botão ("Mostrar eixos", "Carregar
// referência", "Abrir funcionalidades") e o App decide o que ele faz num
// `switch (acao)`. Em 23/09 três ids das regras não tinham `case` nenhum: o
// botão aparecia, a pessoa clicava, nada acontecia — o pior tipo de defeito
// para um app que promete se explicar sozinho. E o `case` de calibração
// rolava para um `id` que não existe em componente nenhum.
//
// Como no `atalhos-prometidos`, a resposta está em DOIS conjuntos que o
// código declara: os ids que as REGRAS emitem (`acao: { id: '…' }`) e os
// `case '…':` do `switch` do App. Um sem o outro é falha. E cada
// `getElementById('…')` dentro do switch tem de apontar para um `id` que
// alguém renderiza.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const ler = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

function arquivosTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosTsx(caminho, acc);
    else if (nome.endsWith('.tsx')) acc.push(caminho);
  }
  return acc;
}

/** Os ids que as regras prometem à pessoa. */
function acoesPrometidas(): Set<string> {
  const regras = ler('features/sugestoes/regras.ts');
  return new Set([...regras.matchAll(/acao:\s*\{[^}]*\bid:\s*'([a-z-]+)'/g)].map((m) => m[1]));
}

/** O `switch (acao)` do App, e os `case` dentro dele. */
function switchDeAcoes(): string {
  const app = ler('App.tsx');
  const inicio = app.indexOf('switch (acao)');
  expect(inicio, 'App.tsx não tem `switch (acao)`').toBeGreaterThan(-1);
  // Do `switch` até o fecho do useCallback que o contém: o primeiro `},` na
  // coluna 4 depois dele é suficiente para conter todos os `case`.
  const fim = app.indexOf('\n    },', inicio);
  return app.slice(inicio, fim === -1 ? undefined : fim);
}

function acoesAtendidas(): Set<string> {
  return new Set([...switchDeAcoes().matchAll(/case\s+'([a-z-]+)'/g)].map((m) => m[1]));
}

describe('ações de sugestão', () => {
  it('toda ação que uma regra promete tem um case no App', () => {
    const prometidas = acoesPrometidas();
    const atendidas = acoesAtendidas();
    expect(prometidas.size).toBeGreaterThan(3);
    const semCase = [...prometidas].filter((a) => !atendidas.has(a));
    expect(semCase, `botão que mente: ${semCase.join(', ')}`).toEqual([]);
  });

  it('todo case do App corresponde a uma ação que alguma regra emite', () => {
    const prometidas = acoesPrometidas();
    const semRegra = [...acoesAtendidas()].filter((a) => !prometidas.has(a));
    expect(semRegra, `case sem regra: ${semRegra.join(', ')}`).toEqual([]);
  });

  it('cada getElementById do switch aponta para um id que alguém renderiza', () => {
    const ids = [...switchDeAcoes().matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
    const fontes = arquivosTsx(SRC).map((a) => readFileSync(a, 'utf8'));
    for (const id of ids) {
      const renderizado = fontes.some(
        (f) =>
          f.includes(`id="${id}"`) ||
          f.includes(`id={'${id}'}`) ||
          (f.includes(`'${id}'`) && f.includes('id={id}'))
      );
      expect(renderizado, `getElementById('${id}') — nenhum componente renderiza esse id`).toBe(
        true
      );
    }
  });
});
