// O guarda do pacote (`scripts/verificar-dist.mjs`) é testado como caixa
// preta: um `dist/` de mentira com e sem ciclo entre pedaços. Se alguém
// afrouxar a expressão que lê os imports, é aqui que aparece.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'verificar-dist.mjs');

function distDeMentira(pedacos: Record<string, string>, html?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'sc-dist-'));
  mkdirSync(join(dir, 'assets'));
  for (const [nome, texto] of Object.entries(pedacos))
    writeFileSync(join(dir, 'assets', nome), texto);
  writeFileSync(
    join(dir, 'index.html'),
    html ??
      '<script type="module" src="./assets/index-abc.js"></script><link rel="modulepreload" href="./assets/react-vendor-1.js">'
  );
  return dir;
}

function rodar(dir: string): { codigo: number; saida: string } {
  try {
    const saida = execFileSync(process.execPath, [SCRIPT, dir], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { codigo: 0, saida };
  } catch (e) {
    const err = e as { status: number; stderr: string; stdout: string };
    return { codigo: err.status, saida: `${err.stdout}${err.stderr}` };
  }
}

describe('verificar-dist', () => {
  it('aceita um pacote sem ciclo com tudo presente', () => {
    const dir = distDeMentira({
      'index-abc.js':
        'import{a}from"./react-vendor-1.js";import"./db-lib-2.js";const x=()=>import("./lazy-3.js");',
      'react-vendor-1.js': 'export const a=1;',
      'db-lib-2.js': 'import{a}from"./react-vendor-1.js";',
      'lazy-3.js': 'import{a}from"./index-abc.js";', // dinâmico a partir da entrada: não é ciclo
    });
    const r = rodar(dir);
    rmSync(dir, { recursive: true, force: true });
    expect(r.saida).toContain('sem ciclo');
    expect(r.codigo).toBe(0);
  });

  it('reprova ciclo de importação estática entre pedaços, e escreve o caminho', () => {
    const dir = distDeMentira({
      'index-abc.js': 'import{a}from"./db-lib-2.js";export const b=2;',
      'db-lib-2.js': 'import{b}from"./index-abc.js";export const a=1;',
      'react-vendor-1.js': '',
    });
    const r = rodar(dir);
    rmSync(dir, { recursive: true, force: true });
    expect(r.codigo).toBe(1);
    expect(r.saida).toMatch(
      /ciclo[\s\S]*index-abc\.js → db-lib-2\.js → index-abc\.js|db-lib-2\.js → index-abc\.js → db-lib-2\.js/
    );
  });

  it('reprova arquivo pedido pelo index.html ou por um pedaço que não existe', () => {
    const dir = distDeMentira({
      'index-abc.js': 'import{a}from"./sumido-9.js";',
      'react-vendor-1.js': '',
    });
    const r = rodar(dir);
    rmSync(dir, { recursive: true, force: true });
    expect(r.codigo).toBe(1);
    expect(r.saida).toContain('sumido-9.js, que não existe');
  });
});
