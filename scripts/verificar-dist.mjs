// =============================================================================
// SeedCounter — o pacote de produção, conferido antes de ir para o ar
//
// POR QUE ESTE SCRIPT EXISTE.
//
// Em 2026-09-06 o site caiu com tela branca ("Cannot access 'uo' before
// initialization") com todo o portão de qualidade verde. A causa foi um CICLO
// ENTRE PEDAÇOS do empacotamento — não entre arquivos: o Rollup pôs um módulo
// no pedaço `db-lib` e o principal passou a precisar dele durante a avaliação,
// enquanto o `db-lib` precisava do principal. O modo de desenvolvimento tolera
// (carrega módulo a módulo); só o pacote agrupado quebra. `npm run build`
// SUCEDE — o erro só aparece quando o navegador executa.
//
// Este script lê o `dist/` que o build acabou de gerar e confere o que o
// navegador vai encontrar, sem abrir navegador nenhum:
//
//   1. Todo arquivo que o `index.html` referencia em `./assets/` existe.
//   2. Todo `import … from "./x.js"` ESTÁTICO de cada pedaço aponta para um
//      arquivo que existe.
//   3. O grafo de importações ESTÁTICAS entre pedaços não tem ciclo. (Dinâmicas
//      — `import("./x.js")` — não contam: só rodam depois que tudo avaliou.)
//
// Falha = exit 1, com o caminho do ciclo escrito. Roda no CI logo depois do
// build, e localmente: `npm run build && node scripts/verificar-dist.mjs`.
// =============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const ASSETS = join(DIST, 'assets');

const falhas = [];

// --- 1. O que o index.html pede -------------------------------------------
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const pedidos = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
if (pedidos.length === 0)
  falhas.push('index.html não referencia nenhum arquivo em ./assets/ — o build saiu vazio?');
for (const p of pedidos) {
  if (!existsSync(join(DIST, p))) falhas.push(`index.html pede ${p}, que não existe`);
}
const entrada = pedidos.find((p) => /assets\/index-[^/]+\.js$/.test(p));
if (!entrada) falhas.push('index.html não tem o pedaço de entrada (assets/index-*.js)');

// --- 2 e 3. O grafo de importações estáticas entre pedaços ----------------
const pedacos = readdirSync(ASSETS).filter((n) => n.endsWith('.js'));

/** Importações estáticas de um pedaço: `import … from "./x.js"` e `export … from "./x.js"`. */
function importacoesEstaticas(texto) {
  // Só o que vem ANTES do primeiro código: o Rollup põe todos os imports no
  // topo. Um `import(` dinâmico tem parêntese e não casa com `from "…"`.
  const alvos = new Set();
  for (const m of texto.matchAll(
    /\b(?:import|export)\s*(?:[^;'"]*?\bfrom\s*)?["'](\.\/[^"']+\.js)["']/g
  )) {
    alvos.add(m[1].replace(/^\.\//, ''));
  }
  return [...alvos];
}

const grafo = new Map();
for (const nome of pedacos) {
  const alvos = importacoesEstaticas(readFileSync(join(ASSETS, nome), 'utf8'));
  for (const alvo of alvos) {
    if (!existsSync(join(ASSETS, alvo))) falhas.push(`${nome} importa ${alvo}, que não existe`);
  }
  grafo.set(nome, alvos);
}

/** Um ciclo no grafo dirigido, se houver — devolvido como caminho. */
function acharCiclo(grafo) {
  const BRANCO = 0,
    CINZA = 1,
    PRETO = 2;
  const cor = new Map([...grafo.keys()].map((k) => [k, BRANCO]));
  const pilha = [];
  function visitar(n) {
    cor.set(n, CINZA);
    pilha.push(n);
    for (const v of grafo.get(n) ?? []) {
      if (!cor.has(v)) continue; // alvo inexistente já foi reportado
      if (cor.get(v) === CINZA) return [...pilha.slice(pilha.indexOf(v)), v];
      if (cor.get(v) === BRANCO) {
        const c = visitar(v);
        if (c) return c;
      }
    }
    pilha.pop();
    cor.set(n, PRETO);
    return null;
  }
  for (const n of grafo.keys()) {
    if (cor.get(n) === BRANCO) {
      const c = visitar(n);
      if (c) return c;
    }
  }
  return null;
}

const ciclo = acharCiclo(grafo);
if (ciclo) {
  falhas.push(
    `ciclo de importação estática entre pedaços — é o que derrubou o site em 2026-09-06:\n    ${ciclo.join(' → ')}`
  );
}

// --- Veredito ---------------------------------------------------------------
const arestas = [...grafo.values()].reduce((s, a) => s + a.length, 0);
if (falhas.length > 0) {
  console.error(`verificar-dist: ${falhas.length} problema(s) em ${DIST}`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `verificar-dist: ok — ${pedacos.length} pedaços, ${arestas} importações estáticas, sem ciclo; index.html pede ${pedidos.length} arquivos, todos presentes.`
);
