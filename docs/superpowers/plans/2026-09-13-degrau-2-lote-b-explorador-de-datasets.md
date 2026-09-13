# Degrau 2 — Lote B: Explorador de datasets — abrir a pasta, reconhecer o formato, carregar com a anotação, medir por classe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o SeedCounter abre a pasta `seedcounter_git/datasets/` (ou qualquer outra), reconhece cada conjunto pelo que há nele, lista as imagens com miniatura, e um clique carrega a imagem **com a anotação** — caixa, polígono ou classe — como referência. Depois, para conjuntos de classificação (uma semente por foto + classe), mede a morfometria de todas e produz um **perfil por classe** medido com a nossa própria segmentação.

**Architecture:** três camadas. (1) **Leitores puros** em `src/lib/datasets/` — detecção de formato por lista de caminhos, parsers de YOLO (caixa e polígono), `data.yaml`, CSV multiclasse do Roboflow, pasta-por-classe; tudo testável em node com strings. (2) **Fonte de arquivos** em `src/features/datasets/` — File System Access API (`showDirectoryPicker`, handle guardado no Dexie para não pedir de novo) com fallback `<input webkitdirectory>`; as duas produzem a mesma lista `ArquivoDoDataset`. (3) **Painel** — escolher pasta, ver conjuntos e imagens, clicar para carregar; e **Medir esta pasta**, que roda localização + onda + Feret em lote e agrega por classe.

**Tech Stack:** TypeScript, React 19, Dexie (`version(7)`, um store novo), Vitest node. **Nenhuma dependência nova** (o `data.yaml` desses conjuntos é simples o bastante para um parser de 20 linhas; não instalar `yaml`).

**Spec:** roteiro `2026-09-13-degraus-2-e-3-roteiro.md` (2.6 classes, 2.11, 2.13) + pedido do Enrico em 13/09: "esses são os datasets que quero utilizar e que o app seja útil para eles; pode linkar, local ou online, mas clicar e carregar; e classes/subclasses, morfometria por classe, já ir complementando".

**Licença:** por decisão do Enrico (13/09), **não é gate**. Cada conjunto ganha uma entrada no `docs/datasets/README.md` com o que se sabe da licença (texto ou "a conferir"), e segue. Nada deste lote copia imagem de terceiro para o repositório — a pasta é lida no disco da pessoa; o único material que pode ir para `public/` é o do próprio grupo (`images/digitalizar_scan`, `nelson_phd_images_orquid_enrico`), e isso fica para o Lote A (A5).

## O que há na pasta (levantamento de 13/09)

| pasta | imagens | anotação | formato que o detector deve reconhecer | serve para |
|---|---|---|---|---|
| `Sementes de Orquideas` | 772 | `labels/*.txt` polígonos YOLO, `data.yaml` (`inviavel`, `viavel`) | **yolo** (segmentação) | contagem + contorno de referência + classe |
| `seed detect.v3i.yolov8` | 113 (trigo) | `labels/*.txt` caixas YOLO | **yolo** (caixa) | contagem; caixa vira marca no centro |
| `peanuts.v2-release.multiclass`, `rice.v1i.multiclass`, `wheat quality detection.v2i.multiclass`, `wheat seed classification.v2i.multiclass` | 387 / ? / 7.217 / 538 | `_classes.csv` (`filename, classeA, classeB, ...` one-hot) | **roboflow-multiclass** | classe por imagem → perfil por classe |
| `green-coffee-defects`, `coffee-beans-roasting`, `maize-seed-dataset`, `Seed dataset` | 11 / 1.600 / 17.724 / 4.496 | pasta por classe (a conferir uma a uma) ou Excel | **pasta-por-classe** quando os nomes das subpastas são classes; senão **solto** | classe por imagem → perfil por classe |
| `Image Dataset of Local Indonesian Soybean Seed Var` | 12.802 | `Scanned_*` digitalizações + `Segmented_*/seed/*.png` RGBA (instância, sem posição) | **mascara-de-instancia** | as digitalizações carregam soltas; as instâncias entram como galeria de recortes com verdade de forma |
| `lucasiturriago-seeds` | 8.421 | máscaras binárias 512×512 | **mascara-binaria** | segmentação de referência semântica (não instância) |
| `durum-wheat-dataset` | 325 (1,6 GB — imagens grandes) | txt de citação; classes por pasta a conferir | pasta-por-classe ou solto | morfometria de trigo |
| `images/digitalizar_scan` | 1.067 (GPEOrq) | CSV/JSON de análise ao lado (`Informações da Análise`, espécie) | **solto** + metadados do SeedCounter | material próprio; o CSV traz espécie e análise |
| `nelson_phd_images_orquid_enrico` | 59 TIF | — | **solto** (precisa do leitor de TIFF, Lote A/A1) | orquídea real do doutorado |
| `mayara_images`, `referencias-tabulares` | 4 / 0 | — | solto / ignorar | — |

Formatos que o detector reconhece nesta ordem (o primeiro que casa vence): `yolo` → `roboflow-multiclass` → `mascara-de-instancia` → `mascara-binaria` → `pasta-por-classe` → `solto`.

## Global Constraints

As mesmas do Lote A (`2026-09-13-degrau-2-lote-a.md`), mais:

- **`src/lib/datasets/` é puro**: recebe strings e listas de caminhos, nunca `File`, `FileSystemHandle` ou DOM. Só assim testa em node.
- **Anotação carregada é referência, não medição.** Contorno vindo de dataset entra com `origem: 'referencia'`; conta como semente (é uma), mas o CSV e o laudo dizem de onde veio. Marca vinda de caixa YOLO entra como marca normal com `origemDaMarca: 'referencia'` se `Mark` tiver esse campo; se não tiver, acrescente com comentário.
- **Nada carrega sozinho.** Clicar na imagem carrega a imagem. A anotação entra por um segundo gesto ("Carregar referência"), para a pessoa poder ver o app trabalhar antes de ver a resposta.
- **A pasta nunca é copiada nem alterada.** Só leitura. Handles guardados no Dexie são revalidados com `queryPermission` antes de usar.
- **Miniaturas sob demanda.** `createImageBitmap(file, { resizeWidth: 160 })` só para o que está visível; nunca decodificar 17.724 imagens de uma vez.
- **Nenhuma dependência nova.**
- **Commit com pathspec.** Sempre.

---

## Ordem e paralelismo

- **B1** (leitores puros) e **B2** (fonte local + Dexie) — **agora, em paralelo**, arquivos disjuntos entre si e disjuntos da A3 (que está em `App.tsx`, `features/ensaio/`, `flags.ts`, `onda-no-canvas.ts`) e da A4 (`__tests__/fixtures/`, `package.json`).
- **B3** (painel + ligar no App) — depois da A3 (mesmo `App.tsx`) e de B1/B2.
- **B4** (medir por classe) — depois de B3.
- Tracker: `docs/superpowers/plans/2026-09-13-degrau-2-lote-b-progress.md`.

---

### Task B1: Leitores puros — formato, YOLO, data.yaml, CSV multiclasse, pasta-por-classe

**Files:**
- Create: `src/lib/datasets/formato.ts`
- Create: `src/lib/datasets/yolo.ts`
- Create: `src/lib/datasets/data-yaml.ts`
- Create: `src/lib/datasets/roboflow-multiclass.ts`
- Create: `src/lib/datasets/pasta-por-classe.ts`
- Create: `src/lib/datasets/__tests__/formato.test.ts`, `yolo.test.ts`, `data-yaml.test.ts`, `roboflow-multiclass.test.ts`, `pasta-por-classe.test.ts`

**Interfaces (produces):**

```ts
// formato.ts
export type FormatoDeDataset =
  | 'yolo' | 'roboflow-multiclass' | 'mascara-de-instancia' | 'mascara-binaria' | 'pasta-por-classe' | 'solto';
export interface DatasetReconhecido {
  formato: FormatoDeDataset;
  /** Caminhos (relativos à raiz do conjunto) das imagens que o formato considera "imagens de trabalho". */
  imagens: string[];
  /** Arquivos que carregam a anotação, quando o formato tem: data.yaml, _classes.csv, labels/*.txt … */
  anotacao: string[];
  /** Classes declaradas, quando o formato as declara (yolo: data.yaml; multiclass: cabeçalho do CSV; pasta-por-classe: nomes das pastas). */
  classes: string[];
  /** Uma frase para o painel: o que este formato permite carregar. */
  descricao: string;
}
export function reconhecerFormato(caminhos: string[]): DatasetReconhecido;
export function ehImagem(caminho: string): boolean; // jpg jpeg png tif tiff bmp webp
export function parDeLabelYolo(caminhoDaImagem: string): string; // .../images/x.jpg → .../labels/x.txt

// yolo.ts
export interface AnotacaoYolo {
  classe: number;
  /** Caixa em px quando a linha tem 5 valores. */
  caixa?: { x: number; y: number; largura: number; altura: number };
  /** Polígono em px quando a linha tem ≥ 7 valores (ímpar: classe + pares). */
  poligono?: [number, number][];
}
export function lerLabelYolo(texto: string, largura: number, altura: number): AnotacaoYolo[];
export function centroDaAnotacao(a: AnotacaoYolo): [number, number];

// data-yaml.ts
export function lerNamesDoDataYaml(texto: string): string[];  // aceita `names: ['a', 'b']`, `names: ["a","b"]`, e lista em linhas `- a`

// roboflow-multiclass.ts
export interface ClassesPorImagem { classes: string[]; porImagem: Map<string, string[]> }
export function lerClassesCsv(texto: string): ClassesPorImagem; // cabeçalho `filename, c1, c2…`; valores 0/1; espaços aparados

// pasta-por-classe.ts
export function classesPorPasta(caminhos: string[]): Map<string, string[]> | null;
// raiz/<classe>/<img> — devolve classe → imagens; null se não houver ≥ 2 subpastas com imagens e sem imagens soltas na raiz
```

**Por quê:** é a parte que faz o app entender os 14 conjuntos sem que ninguém renomeie nada. Tudo em cima de caminhos e texto, o que significa que os testes são strings e rodam em 100 ms.

- [ ] **Step 1: Testes** — cada arquivo com casos reais copiados das pastas (use exatamente os formatos abaixo; eles vêm do levantamento):

```ts
// yolo.test.ts
import { describe, it, expect } from 'vitest';
import { lerLabelYolo, centroDaAnotacao } from '../yolo';

describe('lerLabelYolo', () => {
  it('caixa: 5 valores normalizados viram px com centro e tamanho', () => {
    const [a] = lerLabelYolo('1 0.5 0.25 0.2 0.1', 1000, 800);
    expect(a.classe).toBe(1);
    expect(a.caixa).toEqual({ x: 400, y: 160, largura: 200, altura: 80 });
    expect(a.poligono).toBeUndefined();
    expect(centroDaAnotacao(a)).toEqual([500, 200]);
  });
  it('polígono: classe + pares viram pontos em px (formato do conjunto de orquídeas)', () => {
    const linha = '0 0.5112431289640592 0.03574841437632135 0.5024027484143764 0.0765507399577167 0.5062463002114165 0.12884355179704016';
    const [a] = lerLabelYolo(linha, 640, 640);
    expect(a.classe).toBe(0);
    expect(a.poligono).toHaveLength(3);
    expect(a.poligono![0][0]).toBeCloseTo(327.2, 0);
    expect(a.poligono![0][1]).toBeCloseTo(22.9, 0);
    const [cx, cy] = centroDaAnotacao(a);
    expect(cx).toBeGreaterThan(320); expect(cy).toBeGreaterThan(20);
  });
  it('várias linhas, linhas vazias e comentários são tolerados; linha malformada é descartada', () => {
    const r = lerLabelYolo('0 0.5 0.5 0.1 0.1\n\n# c\n1 0.2 0.2 0.05 0.05\n0 0.1 0.2\n', 100, 100);
    expect(r).toHaveLength(2);
  });
});
```

```ts
// data-yaml.test.ts
import { describe, it, expect } from 'vitest';
import { lerNamesDoDataYaml } from '../data-yaml';

describe('lerNamesDoDataYaml', () => {
  it('lista inline com aspas simples (formato do Roboflow)', () => {
    const y = "train: ../train/images\nval: ../valid/images\n\nnc: 2\nnames: ['inviavel', 'viavel']\n\nroboflow:\n  workspace: x\n";
    expect(lerNamesDoDataYaml(y)).toEqual(['inviavel', 'viavel']);
  });
  it('lista em linhas', () => {
    expect(lerNamesDoDataYaml('nc: 2\nnames:\n  - a\n  - b\n')).toEqual(['a', 'b']);
  });
  it('sem names devolve vazio', () => {
    expect(lerNamesDoDataYaml('nc: 0\n')).toEqual([]);
  });
});
```

```ts
// roboflow-multiclass.test.ts
import { describe, it, expect } from 'vitest';
import { lerClassesCsv } from '../roboflow-multiclass';

describe('lerClassesCsv', () => {
  it('cabeçalho com espaços e one-hot (formato do conjunto de amendoim)', () => {
    const csv = 'filename, with mold, without mold\nA.jpg, 0, 1\nB.jpg, 1, 0\n';
    const r = lerClassesCsv(csv);
    expect(r.classes).toEqual(['with mold', 'without mold']);
    expect(r.porImagem.get('A.jpg')).toEqual(['without mold']);
    expect(r.porImagem.get('B.jpg')).toEqual(['with mold']);
  });
  it('imagem com duas classes marcadas devolve as duas', () => {
    const r = lerClassesCsv('filename,a,b\nX.png,1,1\n');
    expect(r.porImagem.get('X.png')).toEqual(['a', 'b']);
  });
});
```

```ts
// pasta-por-classe.test.ts
import { describe, it, expect } from 'vitest';
import { classesPorPasta } from '../pasta-por-classe';

describe('classesPorPasta', () => {
  it('raiz/<classe>/<img> vira classe → imagens', () => {
    const m = classesPorPasta(['sadia/1.jpg', 'sadia/2.jpg', 'mofada/3.jpg', 'README.md']);
    expect([...m!.keys()].sort()).toEqual(['mofada', 'sadia']);
    expect(m!.get('sadia')).toHaveLength(2);
  });
  it('só uma subpasta, ou imagens soltas na raiz, não é pasta-por-classe', () => {
    expect(classesPorPasta(['a/1.jpg', 'a/2.jpg'])).toBeNull();
    expect(classesPorPasta(['a/1.jpg', 'b/2.jpg', '3.jpg'])).toBeNull();
  });
});
```

```ts
// formato.test.ts
import { describe, it, expect } from 'vitest';
import { reconhecerFormato, parDeLabelYolo, ehImagem } from '../formato';

describe('reconhecerFormato', () => {
  it('yolo: data.yaml + labels', () => {
    const r = reconhecerFormato(['data.yaml', 'train/images/a.jpg', 'train/labels/a.txt', 'valid/images/b.jpg', 'valid/labels/b.txt', 'README.roboflow.txt']);
    expect(r.formato).toBe('yolo');
    expect(r.imagens).toEqual(['train/images/a.jpg', 'valid/images/b.jpg']);
    expect(r.anotacao).toContain('data.yaml');
  });
  it('roboflow-multiclass: _classes.csv em train/valid/test', () => {
    const r = reconhecerFormato(['train/_classes.csv', 'train/a.jpg', 'valid/_classes.csv', 'valid/b.jpg']);
    expect(r.formato).toBe('roboflow-multiclass');
    expect(r.anotacao).toEqual(['train/_classes.csv', 'valid/_classes.csv']);
  });
  it('mascara-de-instancia: Scanned_* e Segmented_*/seed', () => {
    const r = reconhecerFormato(['Scanned_A/1.jpg', 'Segmented_A/seed/1.png', 'Segmented_A/seed/2.png']);
    expect(r.formato).toBe('mascara-de-instancia');
    expect(r.imagens).toEqual(['Scanned_A/1.jpg']);
  });
  it('pasta-por-classe e solto', () => {
    expect(reconhecerFormato(['x/1.jpg', 'y/2.jpg']).formato).toBe('pasta-por-classe');
    expect(reconhecerFormato(['1.jpg', '2.png', 'notas.csv']).formato).toBe('solto');
  });
  it('parDeLabelYolo troca images→labels e extensão→txt', () => {
    expect(parDeLabelYolo('train/images/a.rf.123.jpg')).toBe('train/labels/a.rf.123.txt');
  });
  it('ehImagem cobre tif/tiff', () => {
    expect(ehImagem('x.TIF')).toBe(true); expect(ehImagem('x.txt')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run src/lib/datasets`.

- [ ] **Step 3: Implementar** — cada módulo curto, com o porquê no cabeçalho. Pontos de atenção:
  - `lerLabelYolo`: `split(/\r?\n/)`, apara, ignora vazio e `#`; tokens numéricos; 5 → caixa (`cx,cy,w,h` normalizados × largura/altura, caixa `x = (cx − w/2)·L`); ≥ 7 e ímpar → polígono; senão descarta. Não lançar.
  - `lerNamesDoDataYaml`: regex para `names:\s*\[(.*)\]` (split por vírgula, tirar aspas) e, se não houver, coletar linhas `^\s*-\s*(.+)$` logo após `names:` até a próxima chave de nível 0.
  - `lerClassesCsv`: primeira linha = cabeçalho; `split(',')` + `trim`; linha por linha, coluna 0 = filename, demais `=== '1'`.
  - `reconhecerFormato`: normalize `\\` → `/`; regras na ordem declarada acima; `imagens` sempre ordenadas.
  - `classesPorPasta`: só primeiro nível.

- [ ] **Step 4: Ver passar; checagens; commit.**

```bash
npx vitest run src/lib/datasets && npx tsc --noEmit && npx eslint src/lib/datasets --ext .ts
git add src/lib/datasets docs/superpowers/plans/2026-09-13-degrau-2-lote-b-progress.md
git commit -m "feat(datasets): leitores puros — formato, YOLO, data.yaml, CSV multiclasse, pasta por classe

Primeiro passo do explorador: entender os conjuntos como estão no disco, sem
renomear nada. Tudo sobre caminhos e texto, testável em node com os formatos
reais copiados das pastas (orquídea YOLO-seg, amendoim multiclasse).

Co-Authored-By: Claude <noreply@anthropic.com>" -- src/lib/datasets docs/superpowers/plans/2026-09-13-degrau-2-lote-b-progress.md
```

---

### Task B2: Fonte de arquivos — pasta local com permissão lembrada, e fallback

**Files:**
- Create: `src/features/datasets/fonte.ts` — tipos e as duas implementações
- Create: `src/features/datasets/__tests__/fonte.test.ts` — só a parte pura (montagem da lista a partir de `webkitRelativePath`, agrupamento por conjunto de primeiro nível)
- Modify: `src/lib/db.ts` — `version(7)` com store `pastasDeDatasets` (`++id, nome, aberta`), mesmos stores anteriores; sem migração de dados
- Create: `src/types/file-system-access.d.ts` — `declare global { interface Window { showDirectoryPicker?(o?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle> } }` (o TS não declara `showDirectoryPicker`; `FileSystemDirectoryHandle` e `.values()` já existem em lib.dom)

**Interfaces (produces):**

```ts
export interface ArquivoDoDataset {
  /** Caminho relativo à pasta escolhida, com `/`. */
  caminho: string;
  obterFile(): Promise<File>;
}
export interface PastaAberta {
  nome: string;
  arquivos: ArquivoDoDataset[];
  /** Conjuntos = subpastas de primeiro nível (e a raiz, se tiver imagens soltas). */
  conjuntos: { nome: string; caminhos: string[] }[];
  /** 'handle' quando veio do File System Access (permissão lembrada); 'input' no fallback (não lembra). */
  origem: 'handle' | 'input';
}
export function suportaHandles(): boolean;
export async function abrirPastaComHandle(): Promise<PastaAberta | null>;   // showDirectoryPicker + varredura recursiva com limite (ver abaixo)
export function abrirPastaComInput(files: FileList): PastaAberta;         // <input type=file webkitdirectory>
export async function reabrirUltimaPasta(): Promise<PastaAberta | null>;   // handle do Dexie + queryPermission/requestPermission
export function agruparPorConjunto(caminhos: string[]): { nome: string; caminhos: string[] }[]; // puro, testado
```

**Por quê:** a pessoa aponta a pasta uma vez e o app lembra (handle no IndexedDB é serializável e a permissão persiste em Chrome/Edge). Firefox/Safari não têm `showDirectoryPicker` — o fallback por `<input webkitdirectory>` funciona, só não lembra; o painel diz isso em uma linha, sem drama.

**Varredura com limite:** a pasta tem ~60.000 arquivos. A varredura recursiva lista **caminhos** (barato) mas nunca abre arquivo; `obterFile()` é preguiçoso. Limite de profundidade 6 e de 100.000 entradas; acima disso, para e avisa. Cede a tela a cada 500 entradas (`await` num `setTimeout(0)`).

- [ ] **Step 1: Teste do puro** — `agruparPorConjunto(['A/x/1.jpg','A/2.jpg','B/3.png','4.jpg'])` → `[{nome:'A',…2},{nome:'B',…1},{nome:'(raiz)',…1}]`, ordenado por nome, raiz por último.
- [ ] **Step 2: Implementar** `fonte.ts` (varredura com `for await (const [nome, h] of dir.entries())`, `h.kind === 'file'` → `{ caminho, obterFile: () => h.getFile() }`), `db.ts` v7, o `.d.ts`.
- [ ] **Step 3: Verificação humana — preparar:** no tracker, "B2 — roteiro": abrir o app, painel Datasets (chega na B3) — aqui só vale `tsc` + teste puro. Diga isso.
- [ ] **Step 4: Checagens e commit** com pathspec (`src/features/datasets/fonte.ts`, teste, `src/lib/db.ts`, `src/types/file-system-access.d.ts`, tracker).

---

### Task B3: Painel — conjuntos, miniaturas, carregar imagem, carregar referência

**Pré-requisito:** A3 fechada (`App.tsx`), B1, B2.

**Files:**
- Create: `src/features/datasets/DatasetsPanel.tsx` — botão "Abrir pasta…" (handle ou input conforme `suportaHandles()`), lista de conjuntos com formato reconhecido e contagem, grade de miniaturas paginada (48 por página, `createImageBitmap` com `resizeWidth: 160`, cache `Map<caminho, ImageBitmap>` limitado a 300), filtro por classe quando o formato tem classes, clique → `onCarregar(arquivo, anotacao)`.
- Create: `src/features/datasets/anotacao.ts` — `async function lerAnotacaoDe(pasta, conjunto, caminhoDaImagem, largura, altura): Promise<AnotacaoCarregada | null>` que usa B1: yolo → lê o `.txt` par e o `data.yaml` → `{ contornos?: {poligono, classe}[], marcas?: {x,y,classe}[], classes: string[] }`; multiclass → `{ classesDaImagem: string[] }`; pasta-por-classe → idem; solto → null. Puro exceto pelo `obterFile()`.
- Modify: `src/types.ts` — `YoloSegmentation.origem` ganha `'referencia'` se não tiver; `Mark` ganha `origem?: 'humano' | 'referencia'` se não tiver; `Metadata` ganha `dataset?: { conjunto: string; caminho: string; classesDaImagem?: string[] }`.
- Modify: `src/lib/contagem.ts` — `contornoRepresentaSemente`: referência conta.
- Modify: `src/lib/measurements.ts` — coluna `origem` no CSV se ainda não houver.
- Modify: `src/App.tsx` — estado `pastaAberta`, `handleCarregarDoDataset(arquivo, anotacao)`: `loadFiles([file])`, grava `metadata.dataset`; guarda `anotacao` em estado; botão **"Carregar referência"** (visível só quando há anotação e a imagem já abriu) → polígonos via `addYoloSegmentations` com `origem: 'referencia'` e `classe` = caminho da taxonomia quando o nome bate (`viavel`/`inviavel` → categoria; outro nome → `classeExterna: nome`, campo novo em `YoloSegmentation`, string crua, sem forçar taxonomia); caixas → `setMarks` com marca no centro; classes por imagem → só metadados + chip no painel.
- Modify: onde o `AiPointerPanel`/`EnsaioPanel` vivem na lateral: uma aba/seção "Datasets".

**Regra de UX que não cai:** clicar na miniatura carrega **a imagem**. A referência é o segundo gesto.

- [ ] Steps: teste de `anotacao.ts` com uma fonte falsa em memória (`ArquivoDoDataset` com `obterFile` devolvendo `new File([texto], nome)`) cobrindo yolo-caixa, yolo-polígono, multiclass; painel; App; `tsc`, `eslint`, `build`; commit com pathspec; roteiro para o Enrico no tracker (abrir `datasets/`, ver os 14 reconhecidos com o formato certo, abrir uma orquídea e carregar a referência, abrir um amendoim e ver a classe).

---

### Task B4: Medir esta pasta — perfil morfométrico por classe, com a nossa segmentação

**Pré-requisito:** B3.

**Files:**
- Create: `src/lib/perfil-medido.ts` — puro: `agregarPerfil(medidas: MedidaDeUmObjeto[]): PerfilMedido` com `{ n, areaPx: {mediana,p5,p95}, feretMaxPx, feretMinPx, solidez, razaoDeAspecto }`; `PerfilPorClasse = Map<string, PerfilMedido>`; `compararComPerfilMedido(metricas, perfil)` no mesmo formato de `compararComPerfil` (referência, nunca veredito).
- Create: `src/lib/__tests__/perfil-medido.test.ts` — medianas/percentis certos; classe com n < 20 marcada `insuficiente`.
- Create: `src/features/datasets/medir-pasta.ts` — laço em lotes (cede a tela; cancelável) sobre as imagens de um conjunto de classificação: abre, `detectObjects` (reduzido), onda no maior objeto (uma semente por foto), Feret/área/solidez → `MedidaDeUmObjeto { caminho, classe, … }`; salva `PerfilPorClasse` no Dexie (`version(8)`, store `perfisMedidos`: `++id, conjunto, classe, medidoEm`).
- Modify: `src/components/canvas/SeedInspector.tsx` — no bloco "Referência (literatura)", se houver perfil medido para a espécie/conjunto ativo, mostrar **"Referência (medida, n=…)"** antes da literatura. Mesma nota; nunca decide.
- Modify: `DatasetsPanel.tsx` — botão **Medir esta pasta** com progresso e **Parar**; tabela por classe (n, mediana de área, Feret, solidez) e **Exportar CSV**.
- Modify: `src/lib/priors-morfometricos.ts` — `compararComPerfil` aceita um perfil medido opcional e o prefere.

**Por quê:** é a versão honesta dos priors. Os números da literatura foram medidos com outra segmentação, outro scanner; um perfil medido com a nossa onda nas nossas condições é comparável com o que o app mede na bancada. E é o que o Enrico chama de "ir complementando": cada conjunto de classificação vira um perfil por classe, e as classes viram candidatas a subclasse na taxonomia (Task 6).

**O que continua não sendo:** veredito. O inspetor diz "fora da faixa medida em n=387 amendoins com mofo"; quem decide é a pessoa.

- [ ] Steps: teste do puro; laço; Dexie v8; inspetor; painel; `tsc`, `eslint`, `build`; commit; roteiro para o Enrico (medir `peanuts`, ver a tabela, abrir uma foto e ver "Referência (medida)").

---

## Checkpoint final do lote

- `vitest` todo verde; `tsc`; `build`.
- Roteiro humano: abrir `datasets/`, os 14 conjuntos aparecem com o formato certo; orquídea carrega com polígonos de referência e classe; `seed detect` carrega com marcas; amendoim mostra a classe; "Medir esta pasta" no amendoim produz perfil por classe e o inspetor o mostra.
- `docs/datasets/README.md` ganha uma linha por conjunto novo (maize, coffee-roasting, nelson, durum) com "licença: a conferir (Enrico)".
- `git push origin develop`. Nunca em `main`.

## Self-review

- Cobertura do pedido: "clicar e carregar" → B2+B3; "útil para eles" → leitores dos formatos reais (B1) + referência carregável (B3); "classes e subclasses, morfometria, ir complementando" → B4 + `classeExterna` + perfil por classe no inspetor; "local ou online" → local é o caso principal; online fica registrado como limitação (Roboflow/Kaggle exigem login; entrada por URL só onde há CORS — não neste lote).
- Consistência: `AnotacaoYolo` (B1) → `lerAnotacaoDe` (B3) → `addYoloSegmentations`/`setMarks`; `MedidaDeUmObjeto` (B4) usa `feret`/`areaDoPoligono`/`analisarContorno` que já existem; `PerfilMedido` tem o mesmo formato de saída que `compararComPerfil` consome.
- Fragilidade admitida: os nomes de campo de `Mark`/`YoloSegmentation`/`Metadata` (`origem`, `classe`, `subclasse`) mudaram nas últimas sessões; B3 manda conferir `src/types.ts` antes de escrever.
