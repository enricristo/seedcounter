// =============================================================================
// Um registro de atalhos, e só um.
//
// O App chamava `useKeyboardShortcuts` DUAS VEZES no mesmo componente. Cada
// chamada registra seu próprio `keydown` na janela, então toda tecla disparava
// a ação duas vezes:
//
//   Ctrl+Z  desfazia DUAS marcações
//   Ctrl+S  gravava DUAS sessões no histórico, uma silenciosa e uma com alerta
//   D       alternava o tema duas vezes — ou seja, o tema não mudava
//
// Passou despercebido porque a maioria dos atalhos é idempotente ou quase, e
// porque a duplicata estava a novecentas linhas da original. Foi encontrado ao
// acrescentar o atalho da máscara, que tem TRÊS estados: dois avanços por tecla
// pulariam exatamente o estado "só pontos" — o mais útil dos três.
//
// Este teste é estático de propósito: o defeito é de estrutura do arquivo, e um
// teste de comportamento exigiria montar o App inteiro para provar algo que se
// lê no código-fonte.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function arquivosFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '__tests__') continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosFonte(caminho));
    else if (/\.tsx?$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

/**
 * Ganchos que instalam UM ouvinte global e por isso não podem ser montados duas
 * vezes no mesmo componente.
 */
const GANCHOS_GLOBAIS = ['useKeyboardShortcuts'];

describe('registro de atalhos', () => {
  it('cada gancho global é montado UMA vez por arquivo', () => {
    const duplicados: string[] = [];

    for (const arquivo of arquivosFonte(SRC)) {
      const fonte = readFileSync(arquivo, 'utf8');
      for (const gancho of GANCHOS_GLOBAIS) {
        // Só chamadas, não a declaração nem o import.
        const chamadas = fonte.match(new RegExp(`(?<![.\\w])${gancho}\\s*\\(`, 'g')) ?? [];
        const ehDeclaracao = new RegExp(`function\\s+${gancho}\\s*\\(`).test(fonte);
        const total = chamadas.length - (ehDeclaracao ? 1 : 0);
        if (total > 1) {
          duplicados.push(`${relative(SRC, arquivo)}: ${gancho} × ${total}`);
        }
      }
    }

    expect(duplicados).toEqual([]);
  });

  it('o gancho de atalhos existe e é o que está sendo vigiado', () => {
    // Se alguém renomear o gancho, o teste acima passaria a vigiar um nome que
    // não existe mais — e voltaria a permitir a duplicata em silêncio.
    const fonte = readFileSync(join(SRC, 'hooks', 'useKeyboardShortcuts.ts'), 'utf8');
    expect(fonte).toMatch(/export function useKeyboardShortcuts/);
    expect(fonte).toMatch(/addEventListener\('keydown'/);
  });
});
