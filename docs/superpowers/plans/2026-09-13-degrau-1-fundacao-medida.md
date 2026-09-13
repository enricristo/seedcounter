# Degrau 1 — Fundação medida: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os dois defeitos do código pendente, entregar Feret, tornar o detector de aglomerado relativo à população da imagem, tirar a inferência ONNX da thread principal, e preparar taxonomia hierárquica — sem quebrar os 766 testes.

**Architecture:** Cada tarefa é um módulo puro em `src/lib/` com teste em node, mais a ligação mínima em `App.tsx`. Nada de estado global novo, nada de dependência nova. A regra do projeto continua: humano localiza, máquina mede; limiar vem da população, não de constante.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (ambiente node), Dexie, onnxruntime-web (já presente), Tailwind com tokens do projeto.

**Spec:** `docs/superpowers/specs/2026-09-13-critica-do-scaleup.md` (seções 1, 3 e 4) — e as medições em `docs/datasets/README.md` §5.

## Global Constraints

- **Comentários em português explicando o PORQUÊ**, no estilo de `src/features/mascara/mascara.ts`. Sem comentário que só repete o código.
- **`src/lib/` nunca importa de `src/features/` nem de `src/components/`.** Há teste (`src/lib/__tests__/dependencias.test.ts`).
- **`src/components/` não importa barril (`index.ts`) de `src/features/`.** Mesmo teste.
- **Toda tecla nova entra em `src/features/ajuda/atalhos.ts`**, senão o teste estático de atalhos quebra.
- **Toda mutação de marca/contorno passa por `useMarks`** (`setMarks`/`setYoloSegmentations`); ação composta usa `{ fundir: true }`.
- **Número que vai para a tela de laboratório não usa `toFixed`** — usa `formatar(medido(v), casas)` de `src/lib/normas/valor-de-boletim.ts`.
- **Ciano (`#00e5ff`) e magenta (`#ff3dc8`) só como legenda de viável/inviável**, nunca como cromo de interface. Tokens: `bg-surface-1/2`, `text-ink-1/2/3`, `border-line`, `bg-accent`, `text-accent-on`.
- **Testes em ambiente node**: módulo de `src/lib/` não toca DOM, `localStorage` nem `Image`.
- **Nenhuma dependência nova.** `package.json` não muda.
- **Antes de cada commit:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint <arquivos tocados> --ext .ts,.tsx`. Falhou, não commita.
- **Mensagem de commit em português, explicando o porquê**, no estilo do `git log` do projeto. Termina com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Não tocar em `src/App.tsx` fora dos trechos que a tarefa nomeia.** Outras tarefas tocam nele; edição cirúrgica.

---

## Estado inicial

Working tree em `develop` com trabalho **não commitado** de outra sessão:
- `src/lib/priors-morfometricos.ts` + teste (novo)
- `src/components/canvas/SeedInspector.tsx` (novo)
- `src/App.tsx` (+44 linhas: `segmentacaoAtiva`, `handleProposeCut`, render do inspetor)
- `docs/datasets/README.md` (+4 linhas)
- cinco docs em `docs/superpowers/` (novos)

Compila; 766 testes passam. **Não commitar antes das Tarefas 1 e 2.**

Rastreador de progresso: `docs/superpowers/plans/2026-09-13-degrau-1-progress.md` — atualizar ao fim de cada tarefa.

---

### Task 1: `handleProposeCut` só seleciona — nunca aplica

**Por quê:** a regra do corte, registrada no commit `0f5a94f`, é *mostrar a proposta e nunca aplicar direto*, porque cortar por engano vira duas sementes onde havia uma e o número do laudo sobe. O gancho pendente aplica no segundo clique.

**Files:**
- Modify: `src/App.tsx` — o `useCallback` `handleProposeCut` (procure por `const handleProposeCut = useCallback`)
- Create: `src/__tests__/corte-nunca-automatico.test.ts`

**Interfaces:**
- Consumes: `handleAplicarCorte` (existe), `setActiveTool`, `setContornoSelecionado` (existem)
- Produces: nada novo — a garantia estrutural de que `handleProposeCut` não chama `handleAplicarCorte`

- [ ] **Step 1: Escrever o teste estático que falha**

```ts
// src/__tests__/corte-nunca-automatico.test.ts
// =============================================================================
// O corte nunca e aplicado sem o botao Separar.
//
// Cortar por engano vira duas sementes onde havia uma, e o numero do laudo
// SOBE. Por isso a regra do corte e mostrar a proposta e esperar a pessoa.
// Um gancho que aplica no segundo clique viola isso — e foi exatamente o que
// uma versao pendente do App fez. Este teste e estatico porque o defeito e de
// estrutura: da para ler no codigo-fonte quem chama quem.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function corpoDaFuncao(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`const ${nome} = useCallback(`);
  if (inicio < 0) return '';
  // Ate o fechamento do useCallback: a linha "  );" seguinte no mesmo nivel.
  const fim = fonte.indexOf('\n  );', inicio);
  return fonte.slice(inicio, fim < 0 ? undefined : fim);
}

describe('o corte por concavidade', () => {
  it('handleProposeCut NAO chama handleAplicarCorte', () => {
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    const corpo = corpoDaFuncao(app, 'handleProposeCut');
    expect(corpo.length, 'handleProposeCut existe').toBeGreaterThan(0);
    expect(corpo).not.toMatch(/handleAplicarCorte\s*\(/);
  });

  it('so o botao Separar aplica', () => {
    // Toda CHAMADA a handleAplicarCorte (com parenteses) fora da propria
    // definicao e proibida: aplicar so acontece pelo onClick do botao Separar,
    // que passa a referencia sem chamar.
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    const definicao = app.indexOf('const handleAplicarCorte = useCallback(');
    const fimDaDefinicao = app.indexOf('\n  );', definicao);
    const foraDaDefinicao = app.slice(0, definicao) + app.slice(fimDaDefinicao);
    expect(foraDaDefinicao).not.toMatch(/handleAplicarCorte\s*\(/);
    expect(app).toMatch(/onClick=\{handleAplicarCorte\}/);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/__tests__/corte-nunca-automatico.test.ts`
Expected: FAIL — o primeiro `it` encontra `handleAplicarCorte(` dentro de `handleProposeCut`.

- [ ] **Step 3: Corrigir o gancho**

Substituir o corpo de `handleProposeCut` em `src/App.tsx` por:

```ts
  /**
   * O inspetor pede para ver o corte: seleciona e mostra a linha. NUNCA aplica.
   *
   * A regra do corte e mostrar a proposta e esperar a pessoa decidir — cortar
   * por engano vira duas sementes onde havia uma, e o numero do laudo sobe.
   * Aplicar continua sendo so o botao Separar.
   */
  const handleProposeCut = useCallback(
    (id: number) => {
      setActiveTool('contorno');
      setContornoSelecionado(id);
    },
    [setActiveTool]
  );
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/__tests__/corte-nunca-automatico.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Verificar tudo e commitar**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/App.tsx src/__tests__/corte-nunca-automatico.test.ts --ext .ts,.tsx`
Expected: 768 testes passam, tsc limpo, eslint sem erro.

```bash
git add src/App.tsx src/__tests__/corte-nunca-automatico.test.ts
git commit -m "fix(corte): o inspetor so seleciona — aplicar continua sendo o botao Separar

O gancho pendente aplicava o corte no segundo clique no mesmo contorno. A regra
do corte, desde que foi ligado, e mostrar a proposta e esperar: cortar por
engano vira duas sementes onde havia uma, e o numero do laudo SOBE. Um duplo
clique acidental cortava.

Teste estatico garante que handleProposeCut nao chama handleAplicarCorte, e
que a unica chamada fora da definicao e o onClick do botao Separar.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `priors-morfometricos.ts` vira referência, não veredito

**Por quê:** o módulo pendente reintroduz limiar absoluto de solidez por espécie com números de conjuntos de terceiros — o padrão que a medição em 3530 orquídeas reais derrubou (78% de falso alarme). O veredito de aglomerado pertence a `aglomerado.ts` (Tarefa 4 o torna relativo à população). Os perfis continuam úteis como **referência de literatura**, no mesmo estatuto de `tamanhos-de-semente.ts`.

**Files:**
- Modify: `src/lib/priors-morfometricos.ts` — remover `diagnosticarContorno` e `DiagnosticoBiometrico`; adicionar `compararComPerfil`
- Modify: `src/lib/__tests__/priors-morfometricos.test.ts` — trocar os testes de veredito por testes de comparação
- Modify: `src/components/canvas/SeedInspector.tsx` — o bloco "Diagnóstico" vira "Referência (literatura)" e o veredito de aglomerado passa a vir de `analisarContorno`

**Interfaces:**
- Consumes: `analisarContorno(contorno, referenciaDeArea, limiares)` de `src/lib/aglomerado.ts` (existe); `PERFIS_BIOMETRICOS`, `PerfilBiometrico` (existem)
- Produces:
  ```ts
  export interface ComparacaoComPerfil {
    perfil: PerfilBiometrico | null;
    solidezForaDaFaixa: boolean;
    circularidadeForaDaFaixa: boolean;
    /** Frase para a interface. Vazia quando dentro da faixa ou sem perfil. */
    nota: string;
  }
  export function compararComPerfil(
    metricas: { solidez: number; circularidade: number },
    especieId?: string
  ): ComparacaoComPerfil;
  ```

- [ ] **Step 1: Escrever os testes novos (substituem os de veredito)**

Apagar de `src/lib/__tests__/priors-morfometricos.test.ts` os `it` que testam `diagnosticarContorno` (`aglomerado`, `danificada`, `impureza`, `sadia`, `perfil genérico`, `abóbora`). Manter o `it` "deve conter as espécies catalogadas". Acrescentar:

```ts
import { compararComPerfil, PERFIS_BIOMETRICOS } from '../priors-morfometricos';

describe('comparar com perfil de literatura — referencia, nao veredito', () => {
  it('dentro da faixa: sem nota', () => {
    const r = compararComPerfil({ solidez: 0.97, circularidade: 0.85 }, 'soja');
    expect(r.perfil?.id).toBe('soja');
    expect(r.solidezForaDaFaixa).toBe(false);
    expect(r.nota).toBe('');
  });

  it('fora da faixa: nota que NAO afirma aglomerado nem dano', () => {
    // A tabela vem de outro scanner e outra segmentacao. Ela orienta o olho;
    // quem decide aglomerado e o detector relativo a populacao da imagem.
    const r = compararComPerfil({ solidez: 0.7, circularidade: 0.85 }, 'soja');
    expect(r.solidezForaDaFaixa).toBe(true);
    expect(r.nota).toMatch(/literatura/i);
    expect(r.nota).not.toMatch(/aglomerado|quebrad|danific|impureza/i);
  });

  it('orquideia tem faixa larga por ter testa irregular', () => {
    const r = compararComPerfil({ solidez: 0.7, circularidade: 0.3 }, 'orquidea');
    expect(r.perfil?.contornoNaturalmenteIrregular).toBe(true);
    expect(r.solidezForaDaFaixa).toBe(false);
  });

  it('sem especie, sem perfil, sem nota', () => {
    const r = compararComPerfil({ solidez: 0.5, circularidade: 0.5 });
    expect(r.perfil).toBeNull();
    expect(r.nota).toBe('');
  });

  it('nao existe mais um "diagnostico" com veredito', async () => {
    const mod = await import('../priors-morfometricos');
    expect('diagnosticarContorno' in mod).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/priors-morfometricos.test.ts`
Expected: FAIL — `compararComPerfil` não existe; `diagnosticarContorno` ainda existe.

- [ ] **Step 3: Reescrever a metade decisória do módulo**

Em `src/lib/priors-morfometricos.ts`, **remover** `DiagnosticoBiometrico`, `diagnosticarContorno` e qualquer tipo/função que produza veredito (`tipo: 'aglomerado' | ...`). Substituir o cabeçalho a partir de "Em vez de limiares ad-hoc..." por:

```ts
// ESTES NUMEROS SAO REFERENCIA, NAO VEREDITO.
//
// A primeira versao deste modulo usava a solidez de literatura para DECIDIR
// "aglomerado", "danificada", "impureza". Foi retirada porque contradiz a
// medicao do projeto: limiar absoluto de solidez reprova 78% das orquideias
// sadias (3530 contornos reais). E os perfis vem de outros scanners e outras
// segmentacoes — a solidez 0,987 do feijao de Koklu e a solidez do contorno
// DELES.
//
// Quem decide aglomerado e `aglomerado.ts`, com limiar relativo a populacao da
// propria imagem. Aqui fica o que a literatura diz, para orientar o olho — o
// mesmo estatuto de `tamanhos-de-semente.ts`.
```

E acrescentar ao fim do arquivo:

```ts
export interface ComparacaoComPerfil {
  perfil: PerfilBiometrico | null;
  solidezForaDaFaixa: boolean;
  circularidadeForaDaFaixa: boolean;
  /** Frase para a interface. Vazia quando dentro da faixa ou sem perfil. */
  nota: string;
}

/**
 * Compara o contorno com o perfil de literatura da especie.
 *
 * Devolve SO a comparacao. Nao diz "aglomerado", nao diz "quebrada": isso
 * seria transformar um numero de outro laboratorio em veredito sobre este.
 */
export function compararComPerfil(
  metricas: { solidez: number; circularidade: number },
  especieId?: string
): ComparacaoComPerfil {
  const perfil = especieId ? (PERFIS_BIOMETRICOS[especieId] ?? null) : null;
  if (!perfil) {
    return { perfil: null, solidezForaDaFaixa: false, circularidadeForaDaFaixa: false, nota: '' };
  }

  // Testa irregular: a faixa de literatura nao se aplica com rigor, entao o
  // piso e afrouxado — nao se acusa o que a especie tem por natureza.
  const pisoSolidez = perfil.contornoNaturalmenteIrregular
    ? perfil.solidezMinimaTipica - 0.25
    : perfil.solidezMinimaTipica;

  const solidezForaDaFaixa = Number.isFinite(metricas.solidez) && metricas.solidez < pisoSolidez;
  const circularidadeForaDaFaixa =
    Number.isFinite(metricas.circularidade) &&
    metricas.circularidade < perfil.circularidadeMinimaTipica;

  if (!solidezForaDaFaixa && !circularidadeForaDaFaixa) {
    return { perfil, solidezForaDaFaixa, circularidadeForaDaFaixa, nota: '' };
  }

  const partes: string[] = [];
  if (solidezForaDaFaixa) {
    partes.push(`solidez ${metricas.solidez.toFixed(2)} abaixo do tipico na literatura (${pisoSolidez.toFixed(2)})`);
  }
  if (circularidadeForaDaFaixa) {
    partes.push(`circularidade ${metricas.circularidade.toFixed(2)} abaixo do tipico na literatura (${perfil.circularidadeMinimaTipica.toFixed(2)})`);
  }
  return {
    perfil,
    solidezForaDaFaixa,
    circularidadeForaDaFaixa,
    nota: `Fora da faixa de literatura para ${perfil.nomePopular}: ${partes.join('; ')}. Confira o contorno.`,
  };
}
```

(`toFixed` aqui é aceitável: o número vai numa frase de referência, não num campo de laudo.)

- [ ] **Step 4: Ajustar o `SeedInspector.tsx`**

Trocar a importação `diagnosticarContorno, type DiagnosticoBiometrico` por `compararComPerfil`. Importar `analisarContorno` de `'../../lib/aglomerado'`. No corpo, onde o diagnóstico era calculado, computar:

```tsx
const sinais = useMemo(
  () => analisarContorno(segmentation.polygon_points, medianaDaCena ?? NaN),
  [segmentation.polygon_points, medianaDaCena]
);
const comparacao = useMemo(
  () => compararComPerfil({ solidez: sinais.solidez, circularidade }, especieId),
  [sinais.solidez, circularidade, especieId]
);
```

(onde `circularidade` já é calculada no componente; se não for, calcular `4 * Math.PI * areaPx / (perimetro ** 2)` com o perímetro do polígono.) O bloco de UI que mostrava "Diagnóstico" passa a mostrar duas linhas separadas:
- **Aglomerado?** — `sinais.veredito === 'aglomerado' ? sinais.motivo : 'Não'` (vem do detector relativo à população)
- **Referência (literatura)** — `comparacao.nota || 'Dentro da faixa típica'`, em `text-ink-3`

O botão de corte continua chamando `onProposeCut`.

- [ ] **Step 5: Rodar tudo**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/lib/priors-morfometricos.ts src/components/canvas/SeedInspector.tsx --ext .ts,.tsx`
Expected: tudo passa.

- [ ] **Step 6: Commitar o trabalho pendente, agora corrigido**

```bash
git add src/lib/priors-morfometricos.ts src/lib/__tests__/priors-morfometricos.test.ts src/components/canvas/SeedInspector.tsx src/App.tsx docs/datasets/README.md docs/superpowers/
git commit -m "feat(inspetor): inspetor de semente, com a literatura como referencia e nao veredito

Liga o SeedInspector (morfometria, CIELAB, comparacao com a especie) e os cinco
documentos de scale-up de 13/09, mais a critica que os avalia contra as
medicoes.

O modulo de priors morfometricos entrou como referencia. A versao pendente
DECIDIA aglomerado/danificada/impureza por solidez absoluta de literatura — o
padrao que a medicao em 3530 orquideias reais derrubou (78% de falso alarme).
Quem decide aglomerado continua sendo aglomerado.ts, relativo a populacao da
imagem; os perfis de Koklu, Cinar e Mendeley orientam o olho, como
tamanhos-de-semente.ts ja faz.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Feret por rotating calipers — `src/lib/feret.ts`

**Por quê:** é a medida padrão do ImageJ e mapeia direto em **peneira comercial** (a UBS classifica por fenda/redonda em mm). A PCA atual aproxima; Feret mín/máx é o canônico e é O(n) sobre o fecho.

**Files:**
- Create: `src/lib/feret.ts`
- Create: `src/lib/__tests__/feret.test.ts`
- Modify: `src/lib/measurements.ts` — acrescentar `feretMaxPx`, `feretMinPx`, `feretMaxMm`, `feretMinMm` a `SeedMeasurement` e preenchê-los em `buildMeasurements`

**Interfaces:**
- Consumes: `indicesDoFechoConvexo(pontos)` de `src/lib/aglomerado.ts`
- Produces:
  ```ts
  export interface Feret { maximo: number; minimo: number; anguloDoMaximo: number }
  export function feret(pontos: [number, number][]): Feret | null;
  ```

- [ ] **Step 1: Testes que falham**

```ts
// src/lib/__tests__/feret.test.ts
// =============================================================================
// Diametro de Feret.
//
// E a medida do ImageJ e do paquimetro: a maior e a menor distancia entre dois
// planos paralelos que apertam o objeto. Os dois testes prescritos pela spec —
// circulo e retangulo — sao os que definem a funcao: no circulo min = max; no
// retangulo 10x20 o maximo e a DIAGONAL (22,36), nao o lado (20).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { feret } from '../feret';
import { calculateSeedDimensions } from '../pca-utils';

type P = [number, number];
const circulo = (r: number, n = 90): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [100 + r * Math.cos(t), 100 + r * Math.sin(t)];
  });
const retangulo = (l: number, a: number): P[] => [[0, 0], [l, 0], [l, a], [0, a]];
const elipse = (a: number, b: number, n = 120): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [a * Math.cos(t), b * Math.sin(t)];
  });

describe('feret', () => {
  it('circulo: minimo e maximo iguais ao diametro', () => {
    const f = feret(circulo(30))!;
    expect(f.maximo).toBeCloseTo(60, 0);
    expect(f.minimo).toBeCloseTo(60, 0);
  });

  it('retangulo 10x20: minimo 10, maximo e a diagonal 22,36', () => {
    const f = feret(retangulo(20, 10))!;
    expect(f.minimo).toBeCloseTo(10, 5);
    expect(f.maximo).toBeCloseTo(Math.hypot(20, 10), 5);
  });

  it('o maximo NUNCA e menor que o minimo', () => {
    for (const forma of [circulo(10), retangulo(5, 50), elipse(40, 12)]) {
      const f = feret(forma)!;
      expect(f.maximo).toBeGreaterThanOrEqual(f.minimo);
    }
  });

  it('e invariante a rotacao', () => {
    const base = elipse(40, 12);
    const rot = base.map(([x, y]): P => {
      const t = 0.7;
      return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    });
    const a = feret(base)!;
    const b = feret(rot)!;
    expect(b.maximo).toBeCloseTo(a.maximo, 3);
    expect(b.minimo).toBeCloseTo(a.minimo, 3);
  });

  it('na elipse, Feret bate com a PCA — sao a mesma medida ali', () => {
    // A PCA mede extensao nos eixos principais; numa elipse eles coincidem com
    // os planos de Feret. Diferenca aqui denunciaria erro num dos dois.
    const e = elipse(40, 12);
    const f = feret(e)!;
    const pca = calculateSeedDimensions(e);
    expect(f.maximo).toBeCloseTo(pca.width, 1);
    expect(f.minimo).toBeCloseTo(pca.height, 1);
  });

  it('devolve nulo para menos de tres pontos', () => {
    expect(feret([])).toBeNull();
    expect(feret([[0, 0], [1, 1]])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/feret.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/feret.ts
// =============================================================================
// SeedCounter — diametro de Feret
//
// O QUE E, E POR QUE NAO BASTA A PCA.
//
// Feret e a distancia entre dois planos paralelos que apertam o objeto — o que
// um paquimetro mede. O MAXIMO e a maior distancia entre dois pontos do
// contorno; o MINIMO e a menor largura em alguma direcao. E a medida do
// ImageJ, e e a que a usina de beneficiamento usa para escolher peneira: uma
// semente passa pela fenda se o Feret minimo couber.
//
// A PCA mede extensao ao longo dos eixos principais. Em elipse as duas
// coincidem; em forma assimetrica (reniforme, com bico) elas divergem, e a
// que o paquimetro daria e o Feret.
//
// COMO: rotating calipers sobre o fecho convexo.
//
// Feret nao muda se o contorno for trocado pelo fecho convexo — um plano que
// aperta o objeto so encosta em pontos do fecho. Sobre o fecho, o maximo e a
// maior distancia entre vertices, e o minimo e a menor altura sobre uma
// aresta (o minimo sempre encosta numa aresta do fecho por um lado). Ambos
// O(n) com n vertices do fecho.
// =============================================================================

import { indicesDoFechoConvexo } from './aglomerado';

export type Ponto = [number, number];

export interface Feret {
  /** Maior distancia entre dois pontos do contorno. */
  maximo: number;
  /** Menor largura entre planos paralelos. */
  minimo: number;
  /** Angulo (rad) da direcao do Feret maximo, para desenhar o eixo. */
  anguloDoMaximo: number;
}

export function feret(pontos: Ponto[]): Feret | null {
  if (!pontos || pontos.length < 3) return null;

  const idx = indicesDoFechoConvexo(pontos);
  if (idx.length < 2) return null;
  const h = idx.map((i) => pontos[i]);
  const n = h.length;

  // --- maximo: maior distancia entre vertices do fecho ---------------------
  // O(n^2) no fecho e barato (fecho de semente tem dezenas de vertices) e nao
  // tem o caso de borda do caliper para antipodais em fecho degenerado.
  let maximo = 0;
  let angulo = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = h[j][0] - h[i][0];
      const dy = h[j][1] - h[i][1];
      const d = Math.hypot(dx, dy);
      if (d > maximo) {
        maximo = d;
        angulo = Math.atan2(dy, dx);
      }
    }
  }

  // --- minimo: menor altura do fecho sobre cada aresta ---------------------
  // Para cada aresta, a largura na direcao perpendicular a ela e a maior
  // distancia de um vertice ate a reta da aresta. O minimo dessas larguras e
  // o Feret minimo — teorema classico: a largura minima e sempre atingida com
  // um dos planos apoiado numa aresta.
  let minimo = Infinity;
  for (let i = 0; i < n; i++) {
    const a = h[i];
    const b = h[(i + 1) % n];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    let largura = 0;
    for (let k = 0; k < n; k++) {
      const d = Math.abs((h[k][0] - a[0]) * ey - (h[k][1] - a[1]) * ex) / len;
      if (d > largura) largura = d;
    }
    if (largura < minimo) minimo = largura;
  }

  if (!Number.isFinite(minimo)) minimo = 0;
  return { maximo, minimo, anguloDoMaximo: angulo };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/feret.test.ts`
Expected: PASS (6 testes). Se o teste da elipse falhar por mais de 1 px, o erro é no `indicesDoFechoConvexo` retornar índices fora de ordem — verificar que o fecho é percorrido em ordem de contorno.

- [ ] **Step 5: Levar para as medidas exportadas**

Em `src/lib/measurements.ts`, na interface `SeedMeasurement`, acrescentar após `larguraMm`:

```ts
  /**
   * Feret maximo e minimo — a medida do paquimetro e da peneira comercial.
   * Em px sempre; em mm quando calibrado.
   */
  feretMaxPx?: number;
  feretMinPx?: number;
  feretMaxMm?: number;
  feretMinMm?: number;
```

Em `buildMeasurements`, onde `comprimentoPx`/`larguraPx` são preenchidos a partir do polígono, acrescentar:

```ts
      const f = feret(seg.polygon_points);
      if (f) {
        row.feretMaxPx = f.maximo;
        row.feretMinPx = f.minimo;
        if (umPerPixel && umPerPixel > 0) {
          row.feretMaxMm = (f.maximo * umPerPixel) / 1000;
          row.feretMinMm = (f.minimo * umPerPixel) / 1000;
        }
      }
```

(importar `feret` de `'./feret'`; o nome da variável da linha pode ser diferente — usar o que o código já usa). Acrescentar as quatro colunas ao CSV em `measurementsToCSV` na mesma posição, com cabeçalhos `feret_max_px, feret_min_px, feret_max_mm, feret_min_mm`.

- [ ] **Step 6: Teste do CSV**

Em `src/lib/__tests__/measurements.test.ts` (existe), acrescentar:

```ts
  it('exporta Feret nas colunas do CSV', () => {
    const rows = buildMeasurements({
      marks: [{ id: 1, x: 10, y: 5, type: 'viable' }],
      segmentations: [{
        id: 1, category: 'viable', class_name: 'viavel', confidence: 1,
        polygon_points: [[0, 0], [20, 0], [20, 10], [0, 10]],
      }],
      metadata: { researcher: '', project: '', treatment: '', plate: '', quadrant: '', notes: '', umPerPixel: 100 },
    });
    expect(rows[0].feretMinPx).toBeCloseTo(10, 5);
    expect(rows[0].feretMaxMm).toBeCloseTo(Math.hypot(20, 10) * 0.1, 5);
    const csv = measurementsToCSV(rows);
    expect(csv.split('\n')[0]).toMatch(/feret_max_px/);
  });
```

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/lib/feret.ts src/lib/measurements.ts --ext .ts`

```bash
git add src/lib/feret.ts src/lib/__tests__/feret.test.ts src/lib/measurements.ts src/lib/__tests__/measurements.test.ts
git commit -m "feat(morfometria): diametro de Feret por rotating calipers — a medida da peneira

Feret e o que o paquimetro mede: a maior e a menor distancia entre planos
paralelos que apertam a semente. E a medida do ImageJ e a que a usina usa
para escolher peneira — a semente passa pela fenda se o Feret minimo couber.

A PCA ja existente mede extensao nos eixos principais; em elipse coincide, em
forma reniforme ou com bico diverge, e o que o paquimetro daria e o Feret. Ha
teste que exige que os dois batam numa elipse — diferenca ali denunciaria erro
em um dos dois.

Os dois testes prescritos pela spec definem a funcao: circulo da min = max;
retangulo 10x20 da minimo 10 e maximo 22,36 (a diagonal, nao o lado).

Entra no CSV em quatro colunas, px e mm.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Limiar relativo à população em `aglomerado.ts`

**Por quê:** os padrões absolutos (`solidezMinima 0,92`, `profundidadeMaxima 0,15`) reprovam 78% das orquídeas sadias. Os presets por espécie são remendo. A conclusão registrada é: o limiar vem da **população da própria imagem** — como `medianaDaCena` já faz para a área.

**Files:**
- Modify: `src/lib/aglomerado.ts` — adicionar `limiaresDaPopulacao`
- Modify: `src/lib/__tests__/aglomerado.test.ts` — testes da derivação
- Modify: `src/App.tsx` — onde `analisarContorno` é chamado com `LIMIARES_DE_CONTORNO_IRREGULAR` ou padrões, passar os limiares derivados da cena

**Interfaces:**
- Consumes: `SinaisDeAglomerado` (existe), `LimiaresDeAglomerado` (existe)
- Produces:
  ```ts
  export interface EstatisticaRobusta { mediana: number; mad: number; n: number }
  export function estatisticaRobusta(valores: number[]): EstatisticaRobusta | null;
  export function limiaresDaPopulacao(
    contornos: [number, number][][],
    minimo?: number
  ): LimiaresDeAglomerado | null;
  ```

- [ ] **Step 1: Testes que falham**

Acrescentar a `src/lib/__tests__/aglomerado.test.ts`:

```ts
import { limiaresDaPopulacao, estatisticaRobusta, analisarContorno } from '../aglomerado';

/** Contorno com solidez e profundidade controladas: circulo com uma reentrancia. */
function comReentrancia(raio: number, profundidade: number, n = 64): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    // Uma cintura estreita centrada em t = 0, com a profundidade pedida.
    const cintura = Math.exp(-((t - Math.PI) ** 2) / 0.08) * profundidade;
    const r = raio - cintura;
    return [200 + r * Math.cos(t), 200 + r * Math.sin(t)];
  });
}

describe('limiar relativo a populacao', () => {
  it('estatistica robusta: mediana e MAD', () => {
    const e = estatisticaRobusta([1, 2, 3, 4, 100])!;
    expect(e.mediana).toBe(3);
    expect(e.mad).toBe(1); // desvios: 2,1,0,1,97 -> mediana 1
    expect(e.n).toBe(5);
    expect(estatisticaRobusta([])).toBeNull();
  });

  it('numa cena de sementes LISAS, o par e pego e as isoladas passam', () => {
    // 20 discos quase perfeitos + 2 com cintura funda.
    const isoladas = Array.from({ length: 20 }, () => comReentrancia(40, 1));
    const pares = [comReentrancia(40, 14), comReentrancia(40, 16)];
    const limiares = limiaresDaPopulacao([...isoladas, ...pares])!;
    expect(limiares).not.toBeNull();
    for (const c of isoladas) {
      expect(analisarContorno(c, NaN, limiares).veredito).toBe('semente');
    }
    for (const c of pares) {
      expect(analisarContorno(c, NaN, limiares).veredito).toBe('aglomerado');
    }
  });

  it('numa cena de sementes IRREGULARES, as isoladas NAO sao acusadas', () => {
    // E o caso da orquideia: toda semente tem reentrancia natural. Com limiar
    // absoluto 0,15, 78% eram reprovadas. Relativo a populacao, nenhuma.
    const isoladas = Array.from({ length: 20 }, (_, i) => comReentrancia(40, 6 + (i % 3)));
    const limiares = limiaresDaPopulacao(isoladas)!;
    const acusadas = isoladas.filter(
      (c) => analisarContorno(c, NaN, limiares).veredito === 'aglomerado'
    );
    expect(acusadas.length).toBe(0);
  });

  it('e o par continua sendo pego mesmo na cena irregular', () => {
    const isoladas = Array.from({ length: 20 }, (_, i) => comReentrancia(40, 6 + (i % 3)));
    const par = comReentrancia(40, 22);
    const limiares = limiaresDaPopulacao([...isoladas, par])!;
    expect(analisarContorno(par, NaN, limiares).veredito).toBe('aglomerado');
  });

  it('populacao pequena demais devolve nulo — usa-se o padrao', () => {
    expect(limiaresDaPopulacao([comReentrancia(40, 1)])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/aglomerado.test.ts`
Expected: FAIL — funções não existem.

- [ ] **Step 3: Implementar em `aglomerado.ts`** (acrescentar antes de `analisarContorno`)

```ts
export interface EstatisticaRobusta {
  mediana: number;
  /** Desvio absoluto mediano — o "sigma" que nao se deixa puxar por outlier. */
  mad: number;
  n: number;
}

export function estatisticaRobusta(valores: number[]): EstatisticaRobusta | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const med = (arr: number[]) =>
    arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
  const mediana = med(v);
  const desvios = v.map((x) => Math.abs(x - mediana)).sort((a, b) => a - b);
  return { mediana, mad: med(desvios), n: v.length };
}

/** Quantos MADs acima da mediana viram "suspeito". */
const K_DA_POPULACAO = 3.5;
/** Piso do MAD: numa cena de discos perfeitos o MAD e zero e o limiar colaria na mediana. */
const MAD_MINIMO_SOLIDEZ = 0.01;
const MAD_MINIMO_PROFUNDIDADE = 0.02;

/**
 * Limiares derivados da POPULACAO da imagem.
 *
 * A LICAO QUE ESTE MODULO APRENDEU TRES VEZES: constante nao serve, porque a
 * forma da semente muda o sinal. Os padroes absolutos reprovam 78% das
 * orquideias sadias — e servem bem a soja. O que distingue os dois casos nao e
 * a especie: e o que a MAIORIA dos contornos desta imagem tem.
 *
 * Entao o limiar e mediana + k*MAD sobre a propria cena. Semente de testa
 * irregular puxa a mediana da profundidade para cima, e o par — que e outlier
 * em qualquer especie — continua acima do limiar.
 *
 * Mediana e MAD, e nao media e desvio: um par fundido na cena e exatamente o
 * outlier que arrastaria a media.
 */
export function limiaresDaPopulacao(
  contornos: Ponto[][],
  minimo = 8
): LimiaresDeAglomerado | null {
  const solidez: number[] = [];
  const profundidade: number[] = [];
  for (const c of contornos) {
    const s = analisarContorno(c);
    if (s.veredito === 'nao-avaliavel') continue;
    solidez.push(s.solidez);
    profundidade.push(s.profundidadeRelativa);
  }
  if (solidez.length < minimo) return null;

  const es = estatisticaRobusta(solidez)!;
  const ep = estatisticaRobusta(profundidade)!;

  return {
    // Solidez cai quando ha cintura: limiar ABAIXO da mediana.
    solidezMinima: es.mediana - K_DA_POPULACAO * Math.max(es.mad, MAD_MINIMO_SOLIDEZ),
    // Profundidade sobe quando ha cintura: limiar ACIMA da mediana.
    profundidadeMaxima: ep.mediana + K_DA_POPULACAO * Math.max(ep.mad, MAD_MINIMO_PROFUNDIDADE),
    razaoDeAreaMaxima: PADROES.razaoDeAreaMaxima,
  };
}
```

`analisarContorno` precisa aceitar chamada sem `referenciaDeArea` e sem `limiares` (já aceita — os dois têm padrão).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/aglomerado.test.ts`
Expected: PASS. Se a cena "lisa" reprovar isoladas, o `MAD_MINIMO_*` está pequeno demais; se o par escapar, `K_DA_POPULACAO` está grande demais. Ajustar **uma** constante e registrar o valor final no comentário.

- [ ] **Step 5: Ligar no App**

Em `src/App.tsx`, localizar onde a triagem de aglomerado é calculada para a cena (procure por `analisarContorno(` e por `LIMIARES_DE_CONTORNO_IRREGULAR`). Acrescentar um `useMemo`:

```ts
  /**
   * Limiares de aglomerado derivados DESTA imagem.
   *
   * Substitui os presets por especie: o que a maioria dos contornos da cena
   * tem e a referencia, e o par e o outlier. Com menos de 8 contornos nao ha
   * populacao — cai no padrao.
   */
  const limiaresDaCena = useMemo(() => {
    const contornos = yoloSegmentations
      .filter((s) => s.visible !== false)
      .map((s) => s.polygon_points);
    return limiaresDaPopulacao(contornos) ?? undefined;
  }, [yoloSegmentations]);
```

e passar `limiaresDaCena` como terceiro argumento em toda chamada a `analisarContorno` no App (e ao `SeedInspector`, via prop `limiares`). Remover a escolha por `LIMIARES_DE_CONTORNO_IRREGULAR` no App se existir.

- [ ] **Step 6: Rodar tudo e commitar**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/lib/aglomerado.ts src/App.tsx --ext .ts,.tsx`

```bash
git add src/lib/aglomerado.ts src/lib/__tests__/aglomerado.test.ts src/App.tsx src/components/canvas/SeedInspector.tsx
git commit -m "feat(aglomerado): limiar relativo a populacao da imagem — a licao aprendida tres vezes

Constante nao serve porque a forma da semente muda o sinal: os padroes
absolutos reprovam 78% das orquideias sadias e servem bem a soja. O que
distingue os casos nao e a especie — e o que a MAIORIA dos contornos desta
imagem tem.

Limiar = mediana + k*MAD sobre a propria cena, para solidez e profundidade.
Testa irregular puxa a mediana para cima, e o par — outlier em qualquer
especie — continua acima. Mediana e MAD, nao media e desvio: um par fundido na
cena e exatamente o outlier que arrastaria a media.

Os presets por especie deixam de ser usados no App. Ficam exportados para quem
quiser um piso fixo, com o aviso de que sao remendo.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Critério de anotação visível no painel do modelo

**Por quê:** garimpado do spec de 03/09 — o modelo YOLO aprendeu um critério ("núcleo com qualquer vermelho → viável; branco → inviável; vazia → não anotada") que **não aparece em lugar nenhum do app**. Quem usa sem saber interpreta o número errado: o modelo distingue sementes com embrião, não estima quantas do lote estão cheias.

**Files:**
- Create: `src/lib/criterio-do-modelo.ts`
- Create: `src/lib/__tests__/criterio-do-modelo.test.ts`
- Modify: `src/features/ai-pointer/AiPointerPanel.tsx` — um bloco "Como o modelo foi treinado" acima do botão de detectar

**Interfaces:**
- Produces:
  ```ts
  export interface CriterioDeAnotacao { classe: string; regra: string }
  export const CRITERIO_DO_MODELO: CriterioDeAnotacao[];
  export const CONSEQUENCIA_DO_CRITERIO: string;
  ```

- [ ] **Step 1: Teste**

```ts
// src/lib/__tests__/criterio-do-modelo.test.ts
import { describe, it, expect } from 'vitest';
import { CRITERIO_DO_MODELO, CONSEQUENCIA_DO_CRITERIO } from '../criterio-do-modelo';

describe('o criterio que o modelo aprendeu', () => {
  it('declara as tres regras da anotacao original', () => {
    const classes = CRITERIO_DO_MODELO.map((c) => c.classe);
    expect(classes).toEqual(['viavel', 'inviavel', 'nao anotada']);
  });
  it('diz a consequencia: distingue embriao, nao estima lote cheio', () => {
    expect(CONSEQUENCIA_DO_CRITERIO).toMatch(/embri/i);
    expect(CONSEQUENCIA_DO_CRITERIO).toMatch(/vazia/i);
  });
});
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/criterio-do-modelo.ts
// =============================================================================
// SeedCounter — o criterio que o modelo YOLO aprendeu
//
// O modelo em producao foi treinado com uma regra de anotacao que nao aparecia
// em lugar nenhum da interface. Quem usa sem saber interpreta o numero errado:
// o modelo distingue sementes QUE TEM EMBRIAO, nao estima quantas do lote
// estao cheias — porque a semente visivelmente vazia foi tratada como fundo
// na anotacao.
//
// Isto e uma decisao metodologica com consequencia no laudo, e por isso e dado
// exibido, nao comentario de codigo.
// =============================================================================

export interface CriterioDeAnotacao {
  classe: string;
  regra: string;
}

/** As tres regras com que o conjunto de treino foi anotado (Roboflow v8). */
export const CRITERIO_DO_MODELO: CriterioDeAnotacao[] = [
  { classe: 'viavel', regra: 'Nucleo com QUALQUER grau de vermelho (tetrazolio).' },
  { classe: 'inviavel', regra: 'Nucleo branco ou opaco.' },
  {
    classe: 'nao anotada',
    regra: 'Semente visivelmente VAZIA, sem nucleo — tratada como fundo.',
  },
];

export const CONSEQUENCIA_DO_CRITERIO =
  'O modelo distingue sementes que tem embriao; nao estima quantas do lote estao vazias. ' +
  'Para forrageira, a espigueta vazia precisa ser contada a parte — ela e material inerte.';
```

- [ ] **Step 3: Mostrar no painel**

Em `src/features/ai-pointer/AiPointerPanel.tsx`, importar `CRITERIO_DO_MODELO, CONSEQUENCIA_DO_CRITERIO` de `'../../lib/criterio-do-modelo'` e, acima do botão de detectar, renderizar:

```tsx
<details className="border-line rounded-lg border p-2">
  <summary className="text-ink-2 cursor-pointer text-[11px] font-bold tracking-wide uppercase">
    Como o modelo foi treinado
  </summary>
  <ul className="mt-2 space-y-1">
    {CRITERIO_DO_MODELO.map((c) => (
      <li key={c.classe} className="text-ink-3 text-[11px] leading-snug">
        <span className="text-ink-1 font-semibold">{c.classe}</span> — {c.regra}
      </li>
    ))}
  </ul>
  <p className="text-ink-3 mt-2 text-[11px] leading-snug">{CONSEQUENCIA_DO_CRITERIO}</p>
</details>
```

- [ ] **Step 4: Rodar e commitar**

Run: `npx vitest run src/lib/__tests__/criterio-do-modelo.test.ts && npx tsc --noEmit && npx eslint src/lib/criterio-do-modelo.ts src/features/ai-pointer/AiPointerPanel.tsx --ext .ts,.tsx`

```bash
git add src/lib/criterio-do-modelo.ts src/lib/__tests__/criterio-do-modelo.test.ts src/features/ai-pointer/AiPointerPanel.tsx
git commit -m "feat(modelo): o criterio de anotacao aparece no painel — o app nao escondia, so nunca disse

O YOLO foi treinado com tres regras (nucleo vermelho -> viavel; branco ->
inviavel; vazia -> nao anotada, tratada como fundo) que nao apareciam em lugar
nenhum da interface. A terceira tem consequencia no laudo: o modelo distingue
sementes com embriao, nao estima quantas do lote estao vazias. Quem usava sem
saber interpretava o numero errado.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Taxonomia como caminho — `classe?: string[]`

**Por quê:** `classes-de-semente.ts` já tem 6 classes e protocolos. A RAS Cap. 4 subdivide plântula anormal em três categorias reconhecidas (danificada, deformada, deteriorada). Um caminho `string[]` no esquema que existe entrega hierarquia sem L-Tree nem DuckDB.

**Files:**
- Create: `src/lib/normas/taxonomia.ts`
- Create: `src/lib/normas/__tests__/taxonomia.test.ts`
- Modify: `src/types.ts` — `YoloSegmentation.classe?: string[]`
- Modify: `src/lib/db.ts` — `version(6)` com os mesmos stores (sem migração de dado: ausente = `[]`)

**Interfaces:**
- Produces:
  ```ts
  export interface NoDaTaxonomia { chave: string; rotulo: string; filhos?: NoDaTaxonomia[] }
  export const TAXONOMIA: NoDaTaxonomia[];
  export function caminhoValido(caminho: string[]): boolean;
  export function rotuloDoCaminho(caminho: string[]): string;
  export function classeRaiz(caminho: string[]): 'normal' | 'anormal' | 'dura' | 'dormente' | 'morta' | 'vazia' | null;
  ```

- [ ] **Step 1: Testes**

```ts
// src/lib/normas/__tests__/taxonomia.test.ts
import { describe, it, expect } from 'vitest';
import { TAXONOMIA, caminhoValido, rotuloDoCaminho, classeRaiz } from '../taxonomia';
import { CLASSES } from '../classes-de-semente';

describe('taxonomia como caminho', () => {
  it('as raizes sao exatamente as classes de germinacao', () => {
    expect(TAXONOMIA.map((n) => n.chave).sort()).toEqual(Object.keys(CLASSES).sort());
  });
  it('anormal tem as tres subcategorias da RAS', () => {
    const anormal = TAXONOMIA.find((n) => n.chave === 'anormal')!;
    expect(anormal.filhos!.map((f) => f.chave)).toEqual(['danificada', 'deformada', 'deteriorada']);
  });
  it('valida caminho pela arvore', () => {
    expect(caminhoValido(['anormal', 'danificada'])).toBe(true);
    expect(caminhoValido(['normal', 'danificada'])).toBe(false);
    expect(caminhoValido(['inexistente'])).toBe(false);
    expect(caminhoValido([])).toBe(false);
  });
  it('escreve o caminho como rotulo legivel', () => {
    expect(rotuloDoCaminho(['anormal', 'danificada'])).toBe('Plântula anormal › Danificada');
  });
  it('a raiz do caminho e a classe que o denominador usa', () => {
    expect(classeRaiz(['anormal', 'deformada'])).toBe('anormal');
    expect(classeRaiz([])).toBeNull();
  });
});
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/normas/taxonomia.ts
// =============================================================================
// SeedCounter — taxonomia como caminho
//
// A classe de uma semente vira uma lista: ['anormal', 'danificada']. A raiz e
// sempre uma das seis classes de germinacao — e o que o denominador e o laudo
// usam — e os niveis abaixo refinam sem mudar a conta.
//
// POR QUE `string[]`, E NAO L-TREE NEM JSONB.
//
// O esquema e Dexie no navegador. Um array de strings e indexavel, e
// serializavel, cabe no JSON da sessao e no CSV. L-Tree e recurso de banco de
// servidor para consultas por prefixo em milhoes de linhas — o projeto tem
// centenas por imagem. Quando houver a consulta que o array nao aguente, ai se
// discute.
//
// AS SUBCATEGORIAS SAO AS DA NORMA, NAO INVENTADAS.
//
// Plantula anormal: danificada, deformada, deteriorada — as tres categorias
// que a RAS e a ISTA reconhecem. Nada abaixo disso entra sem referencia ao
// capitulo.
// =============================================================================

import { CLASSES, type ClasseDeSemente } from './classes-de-semente';

export interface NoDaTaxonomia {
  chave: string;
  rotulo: string;
  filhos?: NoDaTaxonomia[];
}

export const TAXONOMIA: NoDaTaxonomia[] = (Object.keys(CLASSES) as ClasseDeSemente[]).map(
  (chave) => {
    const no: NoDaTaxonomia = { chave, rotulo: CLASSES[chave].rotulo };
    if (chave === 'anormal') {
      no.filhos = [
        { chave: 'danificada', rotulo: 'Danificada' },
        { chave: 'deformada', rotulo: 'Deformada' },
        { chave: 'deteriorada', rotulo: 'Deteriorada' },
      ];
    }
    return no;
  }
);

export function caminhoValido(caminho: string[]): boolean {
  if (caminho.length === 0) return false;
  let nivel: NoDaTaxonomia[] | undefined = TAXONOMIA;
  for (const chave of caminho) {
    const no = nivel?.find((n) => n.chave === chave);
    if (!no) return false;
    nivel = no.filhos;
  }
  return true;
}

export function rotuloDoCaminho(caminho: string[]): string {
  const rotulos: string[] = [];
  let nivel: NoDaTaxonomia[] | undefined = TAXONOMIA;
  for (const chave of caminho) {
    const no = nivel?.find((n) => n.chave === chave);
    if (!no) break;
    rotulos.push(no.rotulo);
    nivel = no.filhos;
  }
  return rotulos.join(' › ');
}

export function classeRaiz(caminho: string[]): ClasseDeSemente | null {
  const raiz = caminho[0];
  return raiz && raiz in CLASSES ? (raiz as ClasseDeSemente) : null;
}
```

- [ ] **Step 3: Esquema**

Em `src/types.ts`, na interface `YoloSegmentation`, acrescentar após `origem?`:

```ts
  /**
   * Caminho taxonomico: ['anormal', 'danificada']. A raiz e uma das classes de
   * germinacao. Ausente = so a categoria viavel/inviavel de sempre.
   */
  classe?: string[];
```

Em `src/lib/db.ts`, acrescentar após `version(5)`:

```ts
    // v6 — taxonomia como caminho. Sem migracao de dado: contorno antigo nao tem
    // `classe`, e isso significa exatamente "so viavel/inviavel", que e o que
    // ele sempre foi. Mesmos stores; a versao existe para o Dexie registrar a
    // mudanca de forma.
    this.version(6).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
      telemetryQueue: 'id, status, createdAt, retryCount',
    });
```

- [ ] **Step 4: Rodar e commitar**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/lib/normas/taxonomia.ts src/types.ts src/lib/db.ts --ext .ts`

```bash
git add src/lib/normas/taxonomia.ts src/lib/normas/__tests__/taxonomia.test.ts src/types.ts src/lib/db.ts
git commit -m "feat(taxonomia): classe como caminho — hierarquia sem L-Tree nem DuckDB

A classe vira ['anormal', 'danificada']: a raiz e sempre uma das seis classes
de germinacao (e o que o denominador e o laudo usam), os niveis abaixo refinam
sem mudar a conta. Plantula anormal ganha as tres subcategorias que a RAS e a
ISTA reconhecem — danificada, deformada, deteriorada — e nada abaixo disso
entra sem referencia ao capitulo.

string[] no Dexie que existe. L-Tree e recurso de banco de servidor para
consulta por prefixo em milhoes de linhas; o projeto tem centenas por imagem.
Esquema v6 sem migracao de dado: contorno sem `classe` significa exatamente o
que ele sempre foi.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Um worker para a inferência ONNX

**Por quê:** a inferência bloqueia a thread principal hoje. É engenharia legítima, independente do "Oráculo". Um worker, não três.

**Files:**
- Create: `src/workers/yolo.worker.ts`
- Create: `src/lib/yolo-worker-client.ts`
- Modify: `src/lib/yolo-onnx.ts` — extrair a parte pura de pré/pós-processamento se ainda estiver acoplada ao DOM (canvas → `ImageData`)
- Modify: o chamador de `detectWithYolo` no App / `features/ai-pointer` — passar a usar o cliente

**Interfaces:**
- Consumes: `detectWithYolo(...)` (existe em `yolo-onnx.ts`)
- Produces:
  ```ts
  // yolo-worker-client.ts
  export function detectarNoWorker(
    imagem: ImageData,
    opcoes: Parameters<typeof detectWithYolo>[1]
  ): Promise<ReturnType<typeof detectWithYolo>>;
  ```

**Atenção:** onnxruntime-web em worker precisa que os `.wasm` sejam servidos do mesmo caminho que na thread principal; verificar `ort.env.wasm.wasmPaths` no worker. Vite: `new Worker(new URL('../workers/yolo.worker.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 1: Verificar o acoplamento**

Run: `grep -n "document\.\|HTMLImageElement\|HTMLCanvasElement\|window\." src/lib/yolo-onnx.ts`
Se `detectWithYolo` recebe `HTMLImageElement`, criar em `yolo-onnx.ts` uma variante `detectWithYoloEmImageData(dados: ImageData, opcoes)` que faz o mesmo a partir de `ImageData` (o pré-processamento já produz um `Float32Array` a partir de pixels — reaproveitar).

- [ ] **Step 2: O worker**

```ts
// src/workers/yolo.worker.ts
// =============================================================================
// SeedCounter — a inferencia fora da thread principal
//
// Um worker so. O "Oraculo" com tres pipelines paralelos foi adiado por nao
// ter problema medido que o justifique; este worker resolve o problema que
// EXISTE — a inferencia travava o arraste e o zoom enquanto rodava.
// =============================================================================

import { detectWithYoloEmImageData } from '../lib/yolo-onnx';

self.onmessage = async (e: MessageEvent) => {
  const { id, imagem, opcoes } = e.data as {
    id: number;
    imagem: ImageData;
    opcoes: Parameters<typeof detectWithYoloEmImageData>[1];
  };
  try {
    const resultado = await detectWithYoloEmImageData(imagem, opcoes);
    self.postMessage({ id, ok: true, resultado });
  } catch (erro) {
    self.postMessage({ id, ok: false, erro: String(erro) });
  }
};
```

- [ ] **Step 3: O cliente**

```ts
// src/lib/yolo-worker-client.ts
import type { detectWithYoloEmImageData } from './yolo-onnx';

let worker: Worker | null = null;
let proximoId = 1;
const pendentes = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function obterWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/yolo.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const { id, ok, resultado, erro } = e.data;
    const p = pendentes.get(id);
    if (!p) return;
    pendentes.delete(id);
    if (ok) p.resolve(resultado);
    else p.reject(new Error(erro));
  };
  return worker;
}

export function detectarNoWorker(
  imagem: ImageData,
  opcoes: Parameters<typeof detectWithYoloEmImageData>[1]
): Promise<Awaited<ReturnType<typeof detectWithYoloEmImageData>>> {
  const id = proximoId++;
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve: resolve as (v: unknown) => void, reject });
    // ImageData e transferivel pelo buffer: sem copia da imagem inteira.
    obterWorker().postMessage({ id, imagem, opcoes }, [imagem.data.buffer]);
  });
}
```

- [ ] **Step 4: Trocar o chamador**

No lugar onde o App chama `detectWithYolo(image, ...)`: obter `ImageData` do canvas (já existe `lerPixelsDaImagem()` no App) e chamar `detectarNoWorker(dados, opcoes)`. Manter o caminho antigo atrás de um `try/catch`: se o worker falhar ao carregar (navegador sem suporte a module worker), cair para `detectWithYolo` na thread principal e registrar `console.warn`.

- [ ] **Step 5: Verificação — esta é manual, e precisa ser dita**

Não há como testar worker em vitest/node. Critério de pronto:
1. `npx tsc --noEmit` limpo; `npm run build` limpo; o worker aparece em `dist/assets/` como chunk separado.
2. No navegador (`npm run dev`), com uma digitalização de soja: iniciar a detecção e **arrastar a imagem durante a inferência**. Antes: trava. Depois: arrasta.
3. Registrar no `progress.md` a duração medida com `performance.now()` antes/depois e o navegador usado.

- [ ] **Step 6: Commitar**

```bash
git add src/workers/yolo.worker.ts src/lib/yolo-worker-client.ts src/lib/yolo-onnx.ts src/App.tsx
git commit -m "feat(yolo): inferencia num worker — o arraste nao trava mais durante a deteccao

Um worker so. Os tres pipelines paralelos do Oraculo foram adiados por nao
terem problema medido; este resolve o que existe: a inferencia bloqueava a
thread principal e o arraste travava.

ImageData vai por transferencia de buffer, sem copia. Sem module worker, cai
para a thread principal com aviso.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Spike do menu radial (atrás de flag, sem persistência)

**Por quê:** classificar sem sair do canvas é bom. Mas é *spike*: o critério é medir se é mais rápido que a tecla `X` e a galeria antes de virar produto.

**Files:**
- Create: `src/features/radial/geometria.ts` (puro)
- Create: `src/features/radial/__tests__/geometria.test.ts`
- Create: `src/features/radial/MenuRadial.tsx`
- Modify: `src/features/flags.ts` — flag `menuRadial`, `defaultEnabled: false`, `stable: false`, fase 'Spike'
- Modify: `src/components/canvas/MarkingCanvas.tsx` — `onContextMenu` num polígono abre o menu quando a flag está ligada

**Interfaces:**
- Produces:
  ```ts
  export function fatiaDoAngulo(dx: number, dy: number, fatias: number): number | null; // null se |d| < raioMorto
  export const RAIO_MORTO = 14;
  ```

- [ ] **Step 1: Teste da geometria**

```ts
import { describe, it, expect } from 'vitest';
import { fatiaDoAngulo, RAIO_MORTO } from '../geometria';

describe('fatia do angulo', () => {
  it('quatro fatias: direita, baixo, esquerda, cima', () => {
    expect(fatiaDoAngulo(30, 0, 4)).toBe(0);
    expect(fatiaDoAngulo(0, 30, 4)).toBe(1);
    expect(fatiaDoAngulo(-30, 0, 4)).toBe(2);
    expect(fatiaDoAngulo(0, -30, 4)).toBe(3);
  });
  it('dentro do raio morto nao escolhe — soltar no centro cancela', () => {
    expect(fatiaDoAngulo(RAIO_MORTO - 1, 0, 4)).toBeNull();
  });
  it('a fronteira entre fatias fica a 45 graus, nao no eixo', () => {
    // Um gesto quase reto para a direita nao pode cair em "baixo".
    expect(fatiaDoAngulo(30, 5, 4)).toBe(0);
    expect(fatiaDoAngulo(30, -5, 4)).toBe(0);
  });
});
```

- [ ] **Step 2: Implementar**

```ts
// src/features/radial/geometria.ts
// =============================================================================
// SeedCounter — a geometria do menu radial
//
// A fatia e escolhida pelo ANGULO do arraste a partir do ponto onde o botao
// foi pressionado. As fronteiras ficam a meio caminho entre as direcoes
// cardeais (45 graus para quatro fatias): um gesto quase reto para a direita
// cai em "direita", nao em "baixo".
//
// Ha um raio morto: soltar sem sair do centro cancela. Sem isso, um clique
// direito comum viraria uma classificacao acidental.
// =============================================================================

export const RAIO_MORTO = 14;

export function fatiaDoAngulo(dx: number, dy: number, fatias: number): number | null {
  if (Math.hypot(dx, dy) < RAIO_MORTO || fatias <= 0) return null;
  const passo = (Math.PI * 2) / fatias;
  // Desloca meio passo para a fronteira ficar entre direcoes, nao sobre elas.
  let angulo = Math.atan2(dy, dx) + passo / 2;
  if (angulo < 0) angulo += Math.PI * 2;
  return Math.floor(angulo / passo) % fatias;
}
```

- [ ] **Step 3: O componente (mínimo)**

```tsx
// src/features/radial/MenuRadial.tsx
import React from 'react';
import { fatiaDoAngulo, RAIO_MORTO } from './geometria';

export interface OpcaoRadial { chave: string; rotulo: string }

export function MenuRadial({
  origem,
  atual,
  opcoes,
}: {
  origem: { x: number; y: number };
  atual: { x: number; y: number } | null;
  opcoes: OpcaoRadial[];
}) {
  const escolhida = atual ? fatiaDoAngulo(atual.x - origem.x, atual.y - origem.y, opcoes.length) : null;
  const R = 64;
  return (
    <svg
      className="pointer-events-none fixed z-50"
      style={{ left: origem.x - R - 8, top: origem.y - R - 8 }}
      width={R * 2 + 16}
      height={R * 2 + 16}
      aria-hidden
    >
      <circle cx={R + 8} cy={R + 8} r={RAIO_MORTO} fill="var(--color-surface-1)" stroke="var(--color-line)" />
      {opcoes.map((o, i) => {
        const a = (i / opcoes.length) * Math.PI * 2;
        const x = R + 8 + Math.cos(a) * (R - 18);
        const y = R + 8 + Math.sin(a) * (R - 18);
        const ativa = escolhida === i;
        return (
          <g key={o.chave}>
            <circle cx={x} cy={y} r={18} fill={ativa ? 'var(--color-accent)' : 'var(--color-surface-1)'} stroke="var(--color-line)" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700}
              fill={ativa ? 'var(--color-accent-on)' : 'var(--color-ink-2)'}>
              {o.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Flag e ligação mínima no canvas**

Em `flags.ts`: `{ key: 'menuRadial', label: 'Menu radial (spike)', defaultEnabled: false, stable: false, phase: 'Spike', description: 'Segure o botão direito sobre um contorno e arraste para classificar. Experimento de velocidade.' }`. Acrescentar `'menuRadial'` ao tipo `FeatureKey`.

No `MarkingCanvas.tsx`: se `menuRadialAtivo` (prop nova, booleana), o `onMouseDown` com `e.button === 2` sobre um polígono guarda `origem` e o id; `onMouseMove` atualiza `atual`; `onMouseUp` calcula a fatia e chama `onClassificarRadial(id, opcoes[fatia].chave)`; `onContextMenu` faz `preventDefault` só quando a flag está ligada. Opções para o spike: as raízes de `TAXONOMIA` (Tarefa 6) — seis fatias.

- [ ] **Step 5: Critério de pronto — medido**

Registrar no `progress.md`: 20 classificações com o radial e 20 com a tecla `X` + clique, tempo total de cada, mesma imagem. Se o radial não for mais rápido, a flag fica e o spike **não avança** — e isso é um resultado, não um fracasso.

- [ ] **Step 6: Commitar**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/features/radial src/components/canvas/MarkingCanvas.tsx src/features/flags.ts --ext .ts,.tsx`

```bash
git add src/features/radial src/features/flags.ts src/components/canvas/MarkingCanvas.tsx src/App.tsx
git commit -m "feat(radial): spike do menu radial, atras de flag — para MEDIR, nao para lancar

Segurar o botao direito sobre um contorno e arrastar escolhe a classe pela
direcao. A fronteira entre fatias fica a 45 graus, nao sobre o eixo, e ha raio
morto: soltar no centro cancela — sem isso um clique direito comum viraria
classificacao acidental.

E spike: o criterio de pronto e cronometrar 20 classificacoes contra a tecla X.
Se nao for mais rapido, a flag fica e o spike nao avanca — e isso e resultado.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Checkpoints

| depois de | verificar | quem |
|---|---|---|
| Task 2 | `git log -1` mostra o commit do inspetor; `git status` limpo | orquestrador |
| Task 4 | rodar `python` sobre `datasets/Sementes de Orquideas` com os limiares derivados (script em `docs/datasets/README.md` §5.3) e registrar falso alarme / detecção reais no `progress.md` | orquestrador, opcional mas recomendado |
| Task 7 | teste manual do arraste durante inferência, com número | humano |
| Task 8 | cronometragem radial × tecla X | humano |
| fim | `npx vitest run` (≥ 790 testes), `npm run build`, `git push origin develop` | orquestrador |

**Ordem obrigatória:** 1 → 2 → (3, 4, 5, 6 em paralelo) → 7 → 8. As Tasks 3–6 tocam arquivos disjuntos exceto `App.tsx` (Tasks 4 e 6 não tocam; 3 e 5 não tocam). Task 7 e 8 tocam `App.tsx` e `MarkingCanvas.tsx` — sequenciais.
