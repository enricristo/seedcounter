# Bancada Óptica — PR 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a camada de tokens do sistema Bancada Óptica e consertar as três falhas de apresentação que a impedem de funcionar, sem alterar comportamento algum.

**Architecture:** Tailwind v4 não usa `tailwind.config.js`: o bloco `@theme` no CSS *é* a configuração, e cada `--color-*` declarado ali vira simultaneamente uma variável CSS e uma classe utilitária. Isso permite uma fonte única de verdade: os utilitários compilam para `var(--color-x)`, então **redefinir o token dentro de `.dark` faz toda utilitária que o usa trocar de valor sozinha** — sem variante `dark:` e sem JavaScript. O mesmo `var()` funciona em atributo de apresentação SVG (verificado empiricamente), então os gráficos Recharts re-tematizam sem re-render.

**Tech Stack:** Vite 6, React 19, TypeScript 5.8, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts 3.8, Vitest 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-03-bancada-optica-design.md`

## Global Constraints

- **Zero mudanças funcionais.** Nenhum arquivo em `src/lib/`, `src/hooks/`, `src/context/`, `src/types.ts`. Nenhuma assinatura de props alterada.
- **P1 — Formatar por caminho.** Nunca rodar `npm run format` (formata `src` inteiro e conflita com os branches de teste da Jules). Usar `npx prettier --write <caminho>` apenas nos arquivos que o PR já altera.
- **P4 — Não alterar arquivos de teste existentes.** `src/lib/__tests__/stats.test.ts` e `src/lib/__tests__/calibration.test.ts` são intocáveis. Criar teste novo em caminho novo é permitido.
- **`src/App.tsx` fica fora deste PR.** Ele contém um fragmento `<>` vazio (linhas 987 e 1287) cuja remoção reindenta ~300 linhas; isso vai no PR 2 junto com a reescrita da apresentação dele. A única classe morta dele (`text-neutral-850`) vai junto.
- **Base do branch:** `design/lab-identity` sai de `origin/main`. O PR #20 foi mergeado em 2026-09-03 (`a79b25c`), levando ao `main` o conserto do type-check e a promoção do export YOLO. Antes desse merge a base teria de ser `fix/main-typecheck`, porque o `main` acumulava 4 erros `TS2300` e o critério nº 1 seria inverificável; com o merge feito, essa exceção deixou de existir.
- **Prettier:** `singleQuote: true`, `printWidth: 100`, `tabWidth: 2`, `trailingComma: es5`, `arrowParens: always`, `endOfLine: lf`.
- **Paleta de séries — valores exatos, claro / escuro:** 1 `#2a6fd6`/`#4a86e8` · 2 `#e0651f`/`#d15a1c` · 3 `#12a583`/`#149b7b` · 4 `#e0a020`/`#c28615` · 5 `#dd7fa6`/`#d0708f` · 6 `#157f2e`/`#2f9440` · 7 `#4f3fae`/`#8478df` · 8 `#d9433f`/`#e06661`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/index.css` | Variante `dark`, bloco `@theme` com todos os tokens, sobrescrita `.dark`, estilos base | Modificar |
| `index.html` | Carregamento das fontes, `theme-color` | Modificar |
| `src/theme/__tests__/design-tokens.test.ts` | Guarda automatizada: nenhuma classe morta, nenhum hex cru em gráfico | Criar |
| 15 `.tsx` de apresentação | Classes mortas → tokens de papel | Modificar |
| 5 componentes de gráfico | Hex literais → `var(--color-*)` | Modificar |

---

## Task 0: Criar o branch

- [ ] **Passo 1: Confirmar árvore limpa e criar o branch**

```bash
cd seedcounter
git status --porcelain          # deve listar apenas docs/superpowers/
git checkout -b design/lab-identity fix/main-typecheck
```

- [ ] **Passo 2: Commitar a spec e este plano**

```bash
git add docs/superpowers/
git commit -m "docs: spec e plano do sistema visual Bancada Optica

Guia visual, tokens validados para daltonismo nos dois temas, protocolo
de coordenacao entre os agentes e plano do PR de fundacao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Passo 3: Instalar exatamente o lock**

```bash
npm ci
```

Usar `npm ci`, **nunca `npm install`**: as dependências estão em faixas `^`, e `npm install` reescreve `package-lock.json` e sobe 245 pacotes, mudando o resultado do type-check por baixo do pé. `npm ci` instala o lock versionado — é o que o CI faz.

- [ ] **Passo 4: Registrar a linha de base**

```bash
npm run lint ; npm test
```

**Linha de base medida em 2026-09-03, em `origin/main` = `a79b25c`, com `npm ci`:**

- `npm test` — **61 testes passando** ✅
- `npm run lint` — **3 erros TS2322 pré-existentes** ❌

```
src/App.tsx(1022,13)                  handleImportJSON={processJSONFile}
    Sidebar declara (e: ChangeEvent<HTMLInputElement>) => void
    App passa   (file: File) => void
src/App.tsx(1068,23)                  <AiPointerPanel image={adjustedSource} />
    AiPointerPanel declara HTMLImageElement
    adjustedSource é HTMLCanvasElement | HTMLImageElement
src/features/stats/StatsView.tsx(579)  <HelpCircle title="..." />
    lucide-react não aceita a prop title
```

Os dois primeiros são fiação de props — território de lógica, fora da fronteira P4 deste ciclo. O terceiro é de ícone e pertence a este sistema (§5.4), mas entra num PR próprio para não misturar desbloqueio de CI com trabalho de design.

**Critério de aceitação ajustado enquanto esses 3 existirem:** o número de erros de `tsc` **não pode aumentar**. Registre a contagem antes e depois:

```bash
npm run type-check 2>&1 | grep -c "error TS"
```
Esperado antes e depois de cada tarefa: `3` (ou `0`, se o PR de desbloqueio já tiver entrado).

---

## Task 1: Ativar a variante `dark` por classe

O `useTheme` alterna a classe `.dark` no `<html>`, mas Tailwind v4 liga `dark:` a `@media (prefers-color-scheme)` por padrão. As 1.144 classes `dark:` do projeto hoje respondem só ao sistema operacional.

**Files:**
- Modify: `src/index.css:1`

**Interfaces:**
- Consumes: nada.
- Produces: a variante `dark:` passa a reagir a `.dark` no elemento raiz. Todas as tarefas seguintes e todo o código existente dependem disto.

- [ ] **Passo 1: Adicionar a variante logo após o import**

Em `src/index.css`, imediatamente abaixo de `@import 'tailwindcss';`:

```css
/* Liga a variante dark: à classe .dark no elemento raiz.
   Sem isto o Tailwind v4 usa @media (prefers-color-scheme) e o alternador
   de tema de useTheme.ts não tem efeito visual nenhum. */
@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Passo 2: Subir o dev server e verificar**

```bash
npm run dev
```
Abrir `http://localhost:3000`, clicar no botão sol/lua no cabeçalho.
Esperado: **a aparência muda.** Antes desta tarefa, não mudava.

- [ ] **Passo 3: Verificar que nada quebrou**

```bash
npm run lint && npm test
```
Esperado: lint limpo, 61 testes passando.

- [ ] **Passo 4: Commit**

```bash
git add src/index.css
git commit -m "fix(ui): liga a variante dark a classe .dark

Tailwind v4 usa @media (prefers-color-scheme) por padrao. useTheme.ts
alterna a classe .dark no elemento raiz, entao as 1.144 classes dark:
do projeto respondiam apenas ao sistema operacional e o botao sol/lua
nao tinha efeito visual.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Carregar as fontes

`src/index.css` declara `Inter` e `JetBrains Mono` sem `@font-face`, sem `<link>` e sem arquivos em `public/`. Tudo renderiza no fallback do sistema.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nada.
- Produces: as famílias `Archivo` e `IBM Plex Mono` disponíveis para os tokens `--font-sans` e `--font-mono` da Task 3.

- [ ] **Passo 1: Adicionar preconnect e o link das fontes**

Em `index.html`, dentro de `<head>`, logo após a tag `<meta name="viewport" ...>`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
    />
```

- [ ] **Passo 2: Corrigir o `theme-color`**

Na mesma `<head>`, trocar a linha existente:

```html
    <meta name="theme-color" content="#171717" />
```

por:

```html
    <meta name="theme-color" content="#101719" />
```

- [ ] **Passo 3: Verificar que a fonte chegou**

Com `npm run dev` rodando, no console do navegador:

```js
document.fonts.check('700 16px Archivo')
```
Esperado: `true`. Se vier `false`, a fonte não carregou — conferir o console por erro de rede.

- [ ] **Passo 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): carrega Archivo e IBM Plex Mono

index.css declarava Inter e JetBrains Mono sem @font-face, sem link e sem
arquivos em public/, entao tudo renderizava no fallback do sistema. Alinha
tambem o theme-color ao grafite-950 do sistema de tokens.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: A camada de tokens

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: a variante `dark` da Task 1; as fontes da Task 2.
- Produces: os utilitários `bg-surface-0|1|2`, `border-line`, `border-line-soft`, `text-ink-1|2|3`, `bg-accent`, `text-accent`, `bg-accent-tint`, `text-accent-on`, `text-danger`, `text-warn`, `text-ok`, `bg-stage`, `fill-ov-viable`, `stroke-ov-inviable`, `bg-graphite-25..950`, `stroke-series-1..8` — e as variáveis CSS de mesmo nome, consumíveis por `var(--color-*)` dentro de SVG. As Tasks 5 e 6 dependem destes nomes exatos.

- [ ] **Passo 1: Substituir o corpo de `src/index.css`**

Manter a linha `@import 'tailwindcss';` e a variante da Task 1 no topo. Substituir todo o restante do arquivo por:

```css
@theme {
  --font-sans: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Grafite — o neutro do sistema, matiz ≈200°. Substitui neutral-* e zinc-*. */
  --color-graphite-25: #f6f9fa;
  --color-graphite-50: #edf2f4;
  --color-graphite-100: #e1e8ea;
  --color-graphite-200: #cbd6d9;
  --color-graphite-300: #adbcc0;
  --color-graphite-400: #86959a;
  --color-graphite-500: #637378;
  --color-graphite-600: #4a585c;
  --color-graphite-700: #364245;
  --color-graphite-800: #242e31;
  --color-graphite-900: #182023;
  --color-graphite-950: #101719;

  /* Palco — lightness FIXA nos dois temas. Um entorno que muda de claridade
     altera a tonalidade percebida da amostra (contraste simultaneo) e invalida
     a comparacao entre sessoes. Nao sobrescrever em .dark. */
  --color-stage: #6f7a7d;

  /* Especime — marcas sobre a lamina. Ciano e magenta praticamente nao ocorrem
     em material biologico, entao sobrevivem a qualquer fundo. Iguais nos dois
     temas: a imagem nao muda de tema. */
  --color-ov-viable: #00e5ff;
  --color-ov-inviable: #ff3dc8;
  --color-ov-tool: #ffffff;

  /* Papeis — valores do tema claro. O bloco .dark abaixo redefine estes. */
  --color-surface-0: #f6f9fa;
  --color-surface-1: #ffffff;
  --color-surface-2: #edf2f4;
  --color-line: #cbd6d9;
  --color-line-soft: #e1e8ea;
  --color-ink-1: #182023;
  --color-ink-2: #4a585c;
  --color-ink-3: #86959a;

  /* Reticulo — o unico acento de cromo. Substitui emerald (CTA) e purple (nav). */
  --color-accent: #0c6e7a;
  --color-accent-strong: #095560;
  --color-accent-tint: #e0f0f2;
  --color-accent-on: #ffffff;

  /* Semantica de cromo — reservada. Nunca reutilizar como cor de serie. */
  --color-danger: #c0392e;
  --color-warn: #b5730c;
  --color-ok: #17864a;

  /* Series de dados — ordem fixa, nunca ciclada. Validadas para daltonismo
     nos dois temas (pior par adjacente ΔE 11,7 claro / 10,0 escuro). */
  --color-series-1: #2a6fd6;
  --color-series-2: #e0651f;
  --color-series-3: #12a583;
  --color-series-4: #e0a020;
  --color-series-5: #dd7fa6;
  --color-series-6: #157f2e;
  --color-series-7: #4f3fae;
  --color-series-8: #d9433f;
}

/* Tema escuro. Redefinir o token faz TODA utilitaria que o usa trocar de valor
   sozinha — inclusive dentro de SVG via var(). Nenhuma variante dark: e
   necessaria em quem usa estes papeis. */
.dark {
  --color-surface-0: #101719;
  --color-surface-1: #182023;
  --color-surface-2: #242e31;
  --color-line: #364245;
  --color-line-soft: #242e31;
  --color-ink-1: #edf2f4;
  --color-ink-2: #adbcc0;
  --color-ink-3: #637378;

  --color-accent: #3fb4c4;
  --color-accent-strong: #6fd0dc;
  --color-accent-tint: #0b2c31;
  --color-accent-on: #08252a;

  --color-danger: #e2685c;
  --color-warn: #e0a84a;
  --color-ok: #2fa05f;

  --color-series-1: #4a86e8;
  --color-series-2: #d15a1c;
  --color-series-3: #149b7b;
  --color-series-4: #c28615;
  --color-series-5: #d0708f;
  --color-series-6: #2f9440;
  --color-series-7: #8478df;
  --color-series-8: #e06661;
}

@layer base {
  body {
    @apply bg-surface-0 text-ink-1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer utilities {
  .tooltip {
    @apply relative;
  }
}

/* Barra de rolagem */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-surface-2;
}

::-webkit-scrollbar-thumb {
  @apply bg-line rounded-full border-2 border-surface-2 transition-colors;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-ink-3;
}
```

- [ ] **Passo 2: Verificar que os tokens resolvem nos dois temas**

Com `npm run dev` rodando, no console do navegador:

```js
const g = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
document.documentElement.classList.remove('dark');
const claro = { s1: g('--color-surface-1'), ink: g('--color-ink-1'), serie: g('--color-series-1') };
document.documentElement.classList.add('dark');
const escuro = { s1: g('--color-surface-1'), ink: g('--color-ink-1'), serie: g('--color-series-1') };
console.log({ claro, escuro });
```
Esperado exatamente:
`claro = { s1: "#ffffff", ink: "#182023", serie: "#2a6fd6" }`
`escuro = { s1: "#182023", ink: "#edf2f4", serie: "#4a86e8" }`

- [ ] **Passo 3: Verificar que nada quebrou**

```bash
npm run lint && npm test && npm run build
```
Esperado: tudo verde.

- [ ] **Passo 4: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): camada de tokens do sistema Bancada Optica

Rampa grafite, papeis de superficie e tinta, acento reticulo, semantica de
cromo, palco de lightness fixa, cores de especime e as 8 series de dados.
As series foram validadas para daltonismo nos dois temas: pior par adjacente
ΔE 11,7 (claro) e 10,0 (escuro), contra alvo de 8.

O tema escuro redefine o token em vez de duplicar utilitarias, entao quem usa
os papeis nao precisa de variante dark:.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: A guarda automatizada (teste que falha)

Transforma três critérios de aceitação manuais da spec em verificação automática. Este teste **deve falhar** ao final desta tarefa; as Tasks 5 e 6 o fazem passar.

**Files:**
- Create: `src/theme/__tests__/design-tokens.test.ts`

**Interfaces:**
- Consumes: os nomes de token da Task 3.
- Produces: `npm test` passa a reprovar classe morta e hex cru em gráfico.

- [ ] **Passo 1: Escrever o teste que falha**

```ts
// =============================================================================
// SeedCounter — guarda do sistema de design
// Converte em verificacao automatica os criterios da spec Bancada Optica que
// antes dependiam de revisao manual. Nao testa comportamento: testa que a
// camada de apresentacao nao volta a acumular cor fora do sistema.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Arquivos adiados para o PR 2 por exigirem reindentacao grande. */
const ADIADOS = ['App.tsx'];

function listarTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      listarTsx(caminho, acc);
    } else if (nome.endsWith('.tsx') && !ADIADOS.includes(nome)) {
      acc.push(caminho);
    }
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

describe('sistema de design', () => {
  it('nao usa tons de Tailwind que nao existem', () => {
    // 150, 250, 350, 450, 550, 650, 750 e 850 nao existem na escala padrao.
    // Classes assim nao geram CSS nenhum: sao bordas e textos invisiveis.
    const morto =
      /\b(?:dark:)?(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:neutral|zinc|gray|slate|stone|emerald|green|purple|amber|sky|red|blue|violet|teal|rose|indigo)-(?:150|250|350|450|550|650|750|850)\b/g;

    const achados: string[] = [];
    for (const arquivo of ARQUIVOS) {
      const conteudo = readFileSync(arquivo, 'utf8');
      for (const m of conteudo.matchAll(morto)) {
        achados.push(`${arquivo.replace(process.cwd(), '')}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('nao codifica cor de grafico em hex literal', () => {
    // Cor de serie vem de var(--color-series-N), senao o grafico nao acompanha
    // o tema e a ordem das series deixa de ser garantida.
    const hex = /#[0-9a-fA-F]{3,8}\b/g;

    const achados: string[] = [];
    for (const rel of GRAFICOS) {
      const conteudo = readFileSync(join(process.cwd(), rel), 'utf8');
      for (const m of conteudo.matchAll(hex)) {
        achados.push(`${rel}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('declara as 8 series nos dois temas', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    for (let i = 1; i <= 8; i++) {
      expect(css).toContain(`--color-series-${i}:`);
    }
    // Uma ocorrencia no @theme (claro) e outra no bloco .dark (escuro).
    const ocorrencias = css.match(/--color-series-1:/g) ?? [];
    expect(ocorrencias).toHaveLength(2);
  });
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```bash
npx vitest run src/theme/__tests__/design-tokens.test.ts
```
Esperado: **FAIL** nos dois primeiros testes — cerca de 79 classes mortas e mais de 40 hexes. O terceiro deve passar (Task 3 já entregou os tokens).

- [ ] **Passo 3: Commit do teste que falha**

```bash
npx prettier --write src/theme/__tests__/design-tokens.test.ts
git add src/theme/__tests__/design-tokens.test.ts
git commit -m "test(ui): guarda de classe morta e hex cru em grafico

Converte em verificacao automatica tres criterios da spec que dependiam de
revisao manual. Falha de proposito neste commit: as duas tarefas seguintes
a fazem passar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Classes mortas → tokens de papel

79 ocorrências em 15 arquivos apontam para tons que não existem na escala Tailwind e não geram CSS nenhum.

**Files (exatos, com a contagem por arquivo):**
- Modify: `src/features/stats/StatsView.tsx` (31)
- Modify: `src/components/modals/HistoryModal.tsx` (12)
- Modify: `src/components/sidebar/Counters.tsx` (7)
- Modify: `src/components/modals/ExportModal.tsx` (5)
- Modify: `src/components/canvas/ZoomControls.tsx` (5)
- Modify: `src/features/yolo-export/YoloExportModal.tsx` (4)
- Modify: `src/features/longitudinal/PlateRunModal.tsx` (4)
- Modify: `src/components/layout/Header.tsx` (3)
- Modify: `src/components/sidebar/HelpTip.tsx` (2)
- Modify: `src/features/longitudinal/ExperimentModal.tsx` (1)
- Modify: `src/components/sidebar/MetadataForm.tsx` (1)
- Modify: `src/components/sidebar/DifferentialMode.tsx` (1)
- Modify: `src/components/shared/CounterItem.tsx` (1)
- Modify: `src/components/canvas/EmptyState.tsx` (1)
- Modify: `src/features/stats/components/GerminationCurveChart.tsx` (1)

**Interfaces:**
- Consumes: os utilitários de papel da Task 3.
- Produces: primeiro teste da Task 4 passando.

- [ ] **Passo 1: Localizar cada ocorrência**

```bash
grep -rnE '\b(dark:)?(bg|text|border|ring|fill|stroke|from|to)-(neutral|zinc|gray|slate|stone|emerald|green|purple|amber|sky|red)-(150|250|350|450|550|650|750|850)\b' src --include=*.tsx
```

- [ ] **Passo 2: Aplicar a tabela de substituição**

Regra geral: **classe morta clara → token de papel; a `dark:` correspondente é removida**, porque o token já troca de valor sozinho no tema escuro (Task 3). Quando a classe morta é a variante `dark:` de um par, converta o par inteiro.

| Classe morta | Substituição |
|---|---|
| `border-neutral-250` | `border-line` |
| `dark:border-zinc-850` | remover (o par vira `border-line`) |
| `dark:border-zinc-750` | remover (o par vira `border-line`) |
| `text-neutral-450` | `text-ink-3` |
| `text-neutral-750` | `text-ink-2` |
| `text-neutral-850` | `text-ink-1` |
| `text-zinc-250` | `text-ink-2` |
| `text-zinc-650` | `text-ink-3` |
| `dark:text-zinc-150` | remover (o par vira `text-ink-1`) |
| `dark:text-zinc-350` | remover (o par vira `text-ink-2`) |
| `dark:text-zinc-450` | remover (o par vira `text-ink-2`) |
| `dark:text-zinc-550` | remover (o par vira `text-ink-3`) |
| `dark:text-zinc-650` | remover (o par vira `text-ink-3`) |
| `dark:text-zinc-750` | remover (o par vira `text-ink-3`) |
| `dark:text-emerald-350` | remover (o par vira `text-accent`) |
| `dark:text-emerald-450` | remover (o par vira `text-accent`) |
| `bg-zinc-850` | `bg-surface-2` |
| `dark:bg-zinc-850` | remover (o par vira `bg-surface-2`) |
| `text-red-650` | `text-danger` |

Exemplo concreto, de `src/components/layout/Header.tsx`:

```diff
-<p className="text-[9px] text-emerald-600 dark:text-emerald-450 uppercase tracking-widest font-bold">
+<p className="text-[9px] text-accent uppercase tracking-widest font-bold">
```

E de `src/features/stats/components/GerminationCurveChart.tsx`:

```diff
-<div className="flex items-center justify-center h-64 bg-neutral-50 dark:bg-zinc-900/30 border border-dashed border-neutral-250 dark:border-zinc-800 rounded-2xl">
-  <p className="text-xs text-neutral-400 dark:text-zinc-500 font-semibold">
+<div className="flex items-center justify-center h-64 bg-surface-2 border border-dashed border-line rounded-2xl">
+  <p className="text-xs text-ink-3 font-semibold">
```

- [ ] **Passo 3: Rodar a guarda**

```bash
npx vitest run src/theme/__tests__/design-tokens.test.ts -t 'tons de Tailwind'
```
Esperado: **PASS**.

- [ ] **Passo 4: Verificar que nada quebrou**

```bash
npm run lint && npm test && npm run build
```
Esperado: tudo verde, 61 testes anteriores + os novos.

- [ ] **Passo 5: Formatar só o que foi tocado e commitar**

```bash
npx prettier --write $(git diff --name-only --diff-filter=M | grep '\.tsx$' | tr '\n' ' ')
git add -u
git commit -m "refactor(ui): substitui 79 classes de tom inexistente por tokens

neutral-250, emerald-450, zinc-850 e afins nao existem na escala do Tailwind
e nao geravam CSS nenhum: eram bordas e textos invisiveis espalhados por 15
arquivos. Cada uma vira o token de papel correspondente, e a variante dark:
do par sai junto porque o token ja troca de valor no tema escuro.

src/App.tsx fica para o PR 2, junto com a remocao do fragmento vazio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Gráficos lendo tokens

Os cinco componentes de gráfico codificam mais de 40 hexes literais. O tooltip é escuro fixo mesmo no tema claro, e `GerminationCurveChart` cicla 6 cores com `index % COLORS.length` — o 7º tratamento recebe a cor do 1º e a leitura quebra em silêncio.

**Files:**
- Modify: `src/features/stats/components/GerminationCurveChart.tsx`
- Modify: `src/features/stats/components/GerminationBarChart.tsx`
- Modify: `src/features/stats/components/WilsonCIBar.tsx`
- Modify: `src/components/charts/PlateViabilityChart.tsx`
- Modify: `src/components/charts/SessionTrendChart.tsx`

**Interfaces:**
- Consumes: `--color-series-1..8`, `--color-line`, `--color-line-soft`, `--color-ink-1..3`, `--color-surface-1` da Task 3.
- Produces: segundo teste da Task 4 passando; gráficos que acompanham o tema sem re-render.

- [ ] **Passo 1: Listar todo hex nos gráficos**

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b' src/components/charts/*.tsx src/features/stats/components/*.tsx
```

- [ ] **Passo 2: Aplicar a tabela de mapeamento**

`var()` funciona em atributo de apresentação SVG e troca de valor sozinho quando `.dark` entra — verificado. Não é preciso `useTheme` nem re-render.

| Hex atual | Substituição |
|---|---|
| `#0ea5e9`, `#38bdf8`, `#3b82f6` | `var(--color-series-1)` |
| `#f97316` | `var(--color-series-2)` |
| `#10b981`, `#22c55e`, `#4ade80`, `#16a34a`, `#86efac` | `var(--color-series-3)` |
| `#f59e0b`, `#fbbf24`, `#fde68a` | `var(--color-series-4)` |
| `#ec4899` | `var(--color-series-5)` |
| `#8b5cf6`, `#a855f7`, `#a78bfa`, `#6366f1`, `#818cf8` | `var(--color-series-7)` |
| `#ef4444`, `#f43f5e`, `#f87171` | `var(--color-series-8)` |
| `#e5e5e5`, `#e4e4e7`, `#e2e8f0` (grade) | `var(--color-line-soft)` |
| `#888888`, `#9ca3af`, `#a3a3a3`, `#a1a1aa` (ticks) | `var(--color-ink-3)` |
| `#374151`, `#52525b`, `#64748b`, `#71717a` | `var(--color-ink-2)` |
| `#1f2937`, `#121214`, `#18181B` | `var(--color-surface-1)` |
| `#3f3f46` (borda de tooltip) | `var(--color-line)` |
| `#fff`, `#ffffff` (texto de tooltip) | `var(--color-ink-1)` |
| `rgba(24, 24, 27, 0.95)` | `var(--color-surface-1)` |

- [ ] **Passo 3: Reescrever o bloco de cores de `GerminationCurveChart.tsx`**

Trocar o array atual:

```ts
const COLORS = [
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f97316', // orange
];
```

por:

```ts
/**
 * Series de dados na ordem fixa do sistema. A ordem e o mecanismo de
 * seguranca para daltonismo: nunca reordenar, nunca ciclar. Acima de 8
 * tratamentos, agrupar em "Outros" ou facetar — gerar uma 9a cor quebra
 * a garantia validada da paleta.
 */
const SERIES = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
  'var(--color-series-6)',
  'var(--color-series-7)',
  'var(--color-series-8)',
] as const;

const TETO_SERIES = SERIES.length;
```

E trocar a atribuição ciclada:

```diff
-              stroke={COLORS[index % COLORS.length]}
+              stroke={SERIES[index]}
```

Antes do `.map`, cortar no teto em vez de ciclar:

```diff
-          {treatmentCodes.map((code, index) => (
+          {treatmentCodes.slice(0, TETO_SERIES).map((code, index) => (
```

- [ ] **Passo 4: Trocar o tooltip fixo pelos tokens**

Em `GerminationCurveChart.tsx`, o `contentStyle` do `<Tooltip>`:

```diff
             contentStyle={{
-              backgroundColor: 'rgba(24, 24, 27, 0.95)',
-              borderColor: '#3f3f46',
+              backgroundColor: 'var(--color-surface-1)',
+              borderColor: 'var(--color-line)',
               borderRadius: '12px',
-              color: '#e2e8f0',
+              color: 'var(--color-ink-1)',
               fontSize: '11px',
               fontFamily: 'sans-serif',
-              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
+              boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.28)',
             }}
```

E os ticks dos eixos, nos dois lugares onde aparecem:

```diff
-            tick={{ fill: '#888888', fontSize: 10 }}
+            tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
```

E a grade:

```diff
-          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:stroke-zinc-800" />
+          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-soft)" />
```

- [ ] **Passo 5: Aplicar o mesmo padrão nos outros quatro gráficos**

Usar a tabela do Passo 2 em `GerminationBarChart.tsx`, `WilsonCIBar.tsx`, `PlateViabilityChart.tsx` e `SessionTrendChart.tsx`. Regras que valem para todos:
- Nenhum eixo Y duplicado. Se algum gráfico tiver dois, **pare e reporte** — isso é mudança de leitura, não de estilo, e sai do escopo deste PR.
- Toda `className="dark:stroke-*"` ou `dark:fill-*` em elemento de gráfico sai: o token já troca.
- Texto de gráfico usa `--color-ink-3`, nunca a cor da série.

- [ ] **Passo 6: Rodar a guarda inteira**

```bash
npx vitest run src/theme/__tests__/design-tokens.test.ts
```
Esperado: **os três testes PASS**.

- [ ] **Passo 7: Verificar o tema visualmente**

Com `npm run dev`, abrir a vista Estatísticas, alternar o tema.
Esperado: as linhas da curva mudam de tom, a grade e os ticks acompanham, e o tooltip fica **claro no tema claro** — hoje ele é escuro nos dois.

- [ ] **Passo 8: Verificar que nada quebrou**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Passo 9: Formatar e commitar**

```bash
npx prettier --write src/components/charts src/features/stats/components
git add -u
git commit -m "refactor(charts): cor de grafico vem de token, nao de hex

Os cinco graficos codificavam 40+ hexes literais e o tooltip era escuro fixo
mesmo no tema claro. var() funciona em atributo de apresentacao SVG e troca de
valor sozinho quando a classe .dark entra, entao os graficos passam a
acompanhar o tema sem JavaScript e sem re-render.

GerminationCurveChart ciclava 6 cores com index % COLORS.length: o 7o
tratamento recebia a cor do 1o e a leitura quebrava em silencio. Passa a usar
as 8 posicoes fixas da paleta validada, com corte no teto em vez de ciclo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Fechar o PR 1

- [ ] **Passo 1: Verificar todos os critérios da spec §9**

```bash
npm run lint                                  # 1. limpo
npm test                                      # 2. verde
git diff --stat origin/main...HEAD -- src/lib src/hooks src/context src/types.ts   # 3. vazio
git diff --name-only origin/main...HEAD | grep '__tests__' | grep -v theme         # 7. so o arquivo novo
npx prettier --check $(git diff --name-only origin/main...HEAD | grep -E '\.(tsx|ts|css)$' | tr '\n' ' ')  # 8. limpo
```

- [ ] **Passo 2: Empurrar**

```bash
git push -u origin design/lab-identity
```

- [ ] **Passo 3: Abrir o PR** com base em `fix/main-typecheck` se ele ainda não tiver sido mergeado, ou em `main` se já tiver.

---

## Auto-revisão do plano

**Cobertura da spec:** §3 tokens → Task 3. §4 tipografia → Task 2 (carregamento) + Task 3 (tokens de família); a escala de tamanhos é aplicada no PR 2, junto com os componentes. §5 ícones e marca → PR 2 por definição da spec. §6 layout → PR 2. §7 gráficos → Task 6. §8 PR 1 passos 1–4 → Tasks 1, 2, 3, 5, 6. §9 verificação → Task 4 (automatiza 6, 7, 9) + Task 7 (checa 1–5, 8).

**Lacuna consciente:** o critério 5 da spec (o alternador de tema muda a aparência) permanece manual — é verificação visual, feita no Passo 2 da Task 1 e no Passo 7 da Task 6.

**Consistência de nomes:** os tokens produzidos na Task 3 (`--color-surface-1`, `--color-line`, `--color-ink-1..3`, `--color-accent`, `--color-series-1..8`) são os mesmos consumidos nas Tasks 4, 5 e 6. As utilitárias derivadas (`bg-surface-1`, `border-line`, `text-ink-3`, `text-accent`, `text-danger`) seguem a convenção do Tailwind v4 de remover o prefixo `--color-`.
