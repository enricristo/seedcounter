// =============================================================================
// SeedCounter — a dívida do sistema de design, medida e vigiada
//
// POR QUE ESTE TESTE EXISTE.
//
// A Lei 5 (AGENTS.md) diz: raio só `rounded-control`/`rounded-panel`/
// `rounded-full`; cor só por token. O `design-tokens.test.ts` vigia tons que
// não existem e hex em gráfico — mas não vigiava isto. Em 23/09 medimos:
// centenas de `rounded-xl`, `text-white`, `text-emerald-600` fora do sistema,
// espalhados por dezenas de arquivos. Tirar tudo de uma vez é um PR grande e
// visual, que o dono precisa ver; deixar sem teto é garantir que cresce.
//
// Este teste é a CATRACA: mede a dívida de hoje, grava em
// `divida-de-tokens.json`, e reprova quando ela SOBE. Quando ela DESCE, também
// reprova — de propósito, pedindo para baixar o teto, porque um teto frouxo
// deixa de ser teto. Atualizar o JSON: `ATUALIZAR_DIVIDA=1 npx vitest run
// src/theme` — e conferir no diff que só desceu.
//
// `App.tsx` ENTRA na conta (ao contrário do design-tokens): a extração do
// App.tsx por tema move código para `features/`, e mover não pode parecer
// dívida nova. Por isso o teto é o TOTAL; a lista por arquivo é diagnóstico.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const SRC = join(RAIZ, 'src');
const ARQUIVO_DA_DIVIDA = join(SRC, 'theme', '__tests__', 'divida-de-tokens.json');

/** Cor literal do Tailwind (paleta, white/black ou hex arbitrário) — o tema escuro redefine o token, não a utilitária. */
const COR_LITERAL =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|placeholder|outline|shadow|accent|caret|decoration)-(?:white|black|\[#[0-9a-fA-F]{3,8}\]|(?:neutral|zinc|gray|slate|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?![\w-])/g;

/** Raio fora do sistema: tudo que não é control, panel ou full. */
const RAIO_FORA =
  /\brounded(?!-(?:control|panel|full)\b)(?:-[tblrse]{1,2})?(?:-(?:none|sm|md|lg|xl|2xl|3xl)|-\[[^\]]+\])?(?![\w-])/g;

interface Medida {
  total: number;
  porArquivo: Record<string, number>;
}
interface Divida {
  corLiteral: Medida;
  raioFora: Medida;
}

function listarTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== '__tests__') listarTsx(caminho, acc);
    } else if (nome.endsWith('.tsx')) acc.push(caminho);
  }
  return acc;
}

const relativo = (caminho: string) => caminho.slice(RAIZ.length + 1).replace(/\\/g, '/');

function medir(regex: RegExp): Medida {
  const porArquivo: Record<string, number> = {};
  let total = 0;
  for (const arquivo of listarTsx(SRC)) {
    const n = [...readFileSync(arquivo, 'utf8').matchAll(regex)].length;
    if (n > 0) {
      porArquivo[relativo(arquivo)] = n;
      total += n;
    }
  }
  return { total, porArquivo: Object.fromEntries(Object.entries(porArquivo).sort()) };
}

function lerDivida(): Divida {
  return JSON.parse(readFileSync(ARQUIVO_DA_DIVIDA, 'utf8')) as Divida;
}

/** Os arquivos em que a conta subiu — é onde a dívida nova está. */
function ondeSubiu(antes: Medida, agora: Medida): string[] {
  return Object.entries(agora.porArquivo)
    .filter(([arquivo, n]) => n > (antes.porArquivo[arquivo] ?? 0))
    .map(([arquivo, n]) => `${arquivo}: ${antes.porArquivo[arquivo] ?? 0} → ${n}`);
}

describe('dívida do sistema de design — a catraca', () => {
  const agora: Divida = { corLiteral: medir(COR_LITERAL), raioFora: medir(RAIO_FORA) };

  if (process.env.ATUALIZAR_DIVIDA) {
    writeFileSync(ARQUIVO_DA_DIVIDA, JSON.stringify(agora, null, 2) + '\n');
  }

  const teto = lerDivida();

  for (const chave of ['corLiteral', 'raioFora'] as const) {
    const nome = chave === 'corLiteral' ? 'cor literal do Tailwind' : 'raio fora do sistema';

    it(`${nome}: não sobe (teto ${teto[chave].total})`, () => {
      const subiu = ondeSubiu(teto[chave], agora[chave]);
      expect(
        agora[chave].total,
        `${nome} subiu de ${teto[chave].total} para ${agora[chave].total}. Use token (Lei 5). Onde:\n  ${subiu.join('\n  ')}`
      ).toBeLessThanOrEqual(teto[chave].total);
    });

    it(`${nome}: o teto acompanha a dívida (hoje ${agora[chave].total})`, () => {
      expect(
        agora[chave].total,
        `${nome} desceu de ${teto[chave].total} para ${agora[chave].total} — boa notícia. Abaixe o teto: ATUALIZAR_DIVIDA=1 npx vitest run src/theme`
      ).toBeGreaterThanOrEqual(teto[chave].total);
    });
  }

  it('os raios do sistema não contam como dívida', () => {
    const amostra = 'rounded-control rounded-panel rounded-full rounded-t-panel';
    expect([...amostra.matchAll(RAIO_FORA)]).toEqual([]);
  });

  it('os raios de fora contam, inclusive o bare e o arbitrário', () => {
    const amostra = 'rounded rounded-lg rounded-3xl rounded-t-xl rounded-[10px] rounded-none';
    expect([...amostra.matchAll(RAIO_FORA)].map((m) => m[0])).toEqual([
      'rounded',
      'rounded-lg',
      'rounded-3xl',
      'rounded-t-xl',
      'rounded-[10px]',
      'rounded-none',
    ]);
  });

  it('a cor por token não conta; a literal e a branca contam', () => {
    expect([...'bg-accent text-ink-2 border-line text-accent-on'.matchAll(COR_LITERAL)]).toEqual(
      []
    );
    expect(
      [
        ...'text-white bg-emerald-600 dark:text-zinc-400 dark:bg-[#09090B]'.matchAll(COR_LITERAL),
      ].map((m) => m[0])
    ).toEqual(['text-white', 'bg-emerald-600', 'text-zinc-400', 'bg-[#09090B]']);
  });
});
