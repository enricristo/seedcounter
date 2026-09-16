# Degrau 2 — Lote A: soja medida, TIFF, cena sintética, ensaio ao carregar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar a medição que faltou no Degrau 1 (soja), abrir TIFF de scanner, ter cena sintética com verdade por pixel e fixtures reais com verdade, e o primeiro "identificador ao carregar" — opções lado a lado que a pessoa escolhe ou recusa.

**Architecture:** três tarefas puras e independentes agora (A0 medição, A1 TIFF, A2 cena), uma tarefa de integração depois (A3 ensaio), que toca `App.tsx` e por isso espera as Tasks 7 e 8 do Degrau 1 fecharem. O ensaio roda na thread principal, em lotes que cedem a tela (mesmo padrão de `handleSegmentarPendentes`), porque `detectObjects` e a onda são síncronas e o custo é pagar uma vez ao carregar — não precisa do worker.

**Tech Stack:** TypeScript, Vitest (node), React 19, `utif` (A1) e `pngjs` dev-only (A4).

**Spec:** `docs/superpowers/plans/2026-09-13-degraus-2-e-3-roteiro.md` itens 2.8, 2.11, 2.13 e o complemento da Task 4 do Degrau 1 (`2026-09-13-degrau-1-fundacao-medida.md`, "pronto quando: orquídea *e soja* passam").

**Não está neste lote (e por quê):** 2.9 contorno à la Corel e 2.10 borracha — esperam o Enrico dizer quais gestos; 3.8 esteira — Degrau 3, depende da A2 animada e do caminho do dataset de trigo; YOLO dentro do ensaio — depende da Task 7 e de haver modelo para a espécie.

## Global Constraints

Iguais ao Degrau 1, com duas mudanças marcadas:

- **Comentários em português explicando o PORQUÊ**, no estilo de `src/features/mascara/mascara.ts`. Sem comentário que só repete o código.
- **`src/lib/` nunca importa de `src/features/` nem de `src/components/`.** Há teste (`src/lib/__tests__/dependencias.test.ts`).
- **`src/components/` não importa barril (`index.ts`) de `src/features/`.** Mesmo teste.
- **Toda tecla nova entra em `src/features/ajuda/atalhos.ts`**, senão o teste estático de atalhos quebra.
- **Toda mutação de marca/contorno passa por `useMarks`** (`setMarks`/`setYoloSegmentations`/`addYoloSegmentations`); ação composta usa `{ fundir: true }`.
- **Número que vai para a tela de laboratório não usa `toFixed`** — usa `formatar(medido(v), casas)` de `src/lib/normas/valor-de-boletim.ts`.
- **Ciano (`#00e5ff`) e magenta (`#ff3dc8`) só como legenda de viável/inviável**, nunca como cromo de interface. Tokens: `bg-surface-1/2`, `text-ink-1/2/3`, `border-line`, `bg-accent`, `text-accent`.
- **Testes em ambiente node**: módulo de `src/lib/` não toca DOM, `localStorage` nem `Image`.
- **MUDOU: duas dependências novas, declaradas** — `utif` (A1, runtime) e `pngjs` (A4, **dev only**, para o teste ler PNG em node). Nenhuma outra. `package.json`/`package-lock.json` só entram nos commits da A1 e da A4.
- **Antes de cada commit:** `npx vitest run`, `npx tsc --noEmit`, `npx eslint <arquivos tocados> --ext .ts,.tsx`. Falhou, não commita. Falha em arquivo que **não é seu** (outra tarefa em andamento): espere 30 s e rode de novo; só falha nos seus arquivos bloqueia.
- **Commit SEMPRE com pathspec explícito:** `git add <seus arquivos>` e `git commit -m "..." -- <seus arquivos>`. `git commit` sem caminhos commita o índice inteiro, inclusive o que OUTRO agente deixou em stage.
- **Mensagem de commit em português, explicando o porquê**, no estilo do `git log`. Termina com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **MUDOU: `src/App.tsx` só na A3**, e só nos trechos que ela nomeia. A0, A1 e A2 não tocam em `App.tsx`, `MarkingCanvas.tsx` nem em `progress.md` do Degrau 1 (a Task 7 está escrevendo lá).
- **Ferramenta nunca decide sozinha.** O ensaio *propõe*; contorno só entra no estado quando a pessoa clica "Usar esta". Vale o mesmo que valeu para o corte.

---

## Estado inicial e paralelismo

- `develop`, 785+ testes, Task 7 (worker ONNX) em andamento por outro agente — ela edita `src/lib/yolo-onnx.ts`, `src/workers/yolo.worker.ts`, `src/lib/yolo-worker-client.ts`, `src/App.tsx`, `AiPointerPanel.tsx`, `progress.md`. **Não toque nesses arquivos.**
- Ordem: **A0, A1, A2 em paralelo agora** (arquivos disjuntos) → **A4** (depois da A2) e **A5a** (quando o Enrico indicar a imagem de orquídea) → Task 8 do Degrau 1 → **A3** e **A5b** (depois que ninguém mais está em `App.tsx`).
- Tracker deste lote: `docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md` — cada tarefa acrescenta a sua linha ao terminar, com pathspec.

---

### Task A0: Medição na soja — o limiar da população não pode piorar o caso fácil

**Files:**
- Create: `docs/datasets/medicao-limiar-populacao-soja.md`
- Modify: `docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md` (uma linha)
- Reusa: `<scratchpad>/medir_limiar_populacao.py` (script ad-hoc da Task 4, mesmo scratchpad desta sessão; espelha a geometria de `src/lib/aglomerado.ts`)

**Por quê:** a Task 4 mediu só a orquídea (13,2% de falso alarme, contra 78% do absoluto). O critério de pronto dizia *orquídea e soja*. Na soja o limiar absoluto funcionava; se o da população acusar mais sementes sadias que o preset, a decisão "população como default" está errada — e o default deve ser por forma, com população como fallback.

**Dados:** `seedcounter_git/Image Dataset of Local Indonesian Soybean Seed Var/` — 119 digitalizações, PNG RGBA em `Segmented_*/seed`, canal alfa = máscara de instância. **As sementes nunca se tocam** — toda instância é uma semente sadia isolada, então a fração acusada como aglomerado É o falso alarme, sem ambiguidade.

- [ ] **Step 1: Ler o script da Task 4 e `src/lib/aglomerado.ts` (`limiaresDaPopulacao`, `analisarContorno`, `PADROES`).** Confirme que o script espelha `estatisticaRobusta`, `K_DA_POPULACAO = 3.5`, os pisos de MAD e a regra "solidez < mediana − k·max(mad, piso)" / "profundidade > mediana + k·max(mad, piso)". Se o script diverge do `.ts`, corrija o script, não o `.ts`.

- [ ] **Step 2: Extrair contornos das máscaras.** Para cada digitalização (agrupe os PNG por imagem de origem — o nome do arquivo carrega o índice da digitalização), extraia o contorno externo de cada máscara alfa (OpenCV `findContours`, `RETR_EXTERNAL`, `CHAIN_APPROX_SIMPLE`) em coordenadas da própria máscara — o que importa é forma, não posição. Amostre **20 digitalizações** (seed 42), balanceadas entre as 3 variedades.

- [ ] **Step 3: Medir três limiares na mesma população.** Para cada digitalização: (a) `PADROES` absolutos de `aglomerado.ts`; (b) `limiaresDaPopulacao` da própria digitalização; (c) `LIMIARES_DE_CONTORNO_IRREGULAR` (só para registro — é preset de orquídea). Fração acusada por cada um. Reporte mediana e média sobre as 20, e a distribuição de solidez (p5/p50/p95) para o leitor ver *por que* o resultado é o que é.

- [ ] **Step 4: Escrever `docs/datasets/medicao-limiar-populacao-soja.md`** com: dados, amostra, método (3 linhas), tabela `limiar | falso alarme mediano | média`, a tabela equivalente da orquídea copiada do `progress.md` do Degrau 1 para ficarem lado a lado, e a **decisão** pela regra abaixo. Sem adjetivo; número e consequência.

**Regra de decisão (escreva o resultado literalmente):**
- Se população ≤ absoluto na soja **e** população ≪ absoluto na orquídea (já medido): *"população é o default para toda forma; presets absolutos viram referência"*. Nada muda no código.
- Se população > absoluto na soja por até 3 pontos percentuais: *"empate no caso fácil; população segue default pela generalidade"*. Nada muda.
- Se população > absoluto na soja por mais de 3 pp: *"default por forma: redonda usa absoluto, alongada/irregular usa população; população é fallback para forma desconhecida"* — e abra uma tarefa (não implemente aqui) para `App.tsx` escolher `limiares` por forma.

- [ ] **Step 5: Commit.**

```bash
git add docs/datasets/medicao-limiar-populacao-soja.md docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
git commit -m "docs(datasets): limiar da população medido na soja — o caso fácil não pode piorar

A Task 4 mediu só a orquídea. Aqui a mesma regra roda na soja indonésia
(máscara de instância, sementes nunca se tocam, então acusação = falso alarme)
e a decisão default/fallback sai de número, não de preferência.

Co-Authored-By: Claude <noreply@anthropic.com>" -- docs/datasets/medicao-limiar-populacao-soja.md docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
```

---

### Task A1: Leitor de TIFF

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm i utif`; se `tsc` reclamar de tipos, `npm i -D @types/utif`)
- Create: `src/lib/tiff.ts`
- Create: `src/lib/__tests__/tiff.test.ts`
- Modify: `src/hooks/useImageQueue.ts` (a guarda `ehTiff` vira caminho de decodificação; o filtro de `loadFiles` aceita TIFF sem `type`)
- Não mexer: `src/lib/image-crop.ts` — `ehTiff` fica onde está e continua sendo importado de lá.

**Interfaces:**
- Produces: `decodificarTiff(buffer: ArrayBuffer): ImagemDecodificada | null` com `ImagemDecodificada = { width; height; rgba: Uint8ClampedArray; paginas: number }`.

**Por quê:** scanner de laboratório salva TIFF (8 ou 16 bits, LZW). Hoje o app barra com "converta para JPG ou PNG" — a pessoa sai do app para abrir o próprio arquivo. O caminho certo é decodificar para `ImageData`, jogar num canvas e cair no mesmo fluxo do PNG; nada abaixo do carregador muda.

- [ ] **Step 1: Instalar.** `npm i utif`. Confirme `import UTIF from 'utif'` compila; se não houver tipos, `npm i -D @types/utif`.

- [ ] **Step 2: Escrever o teste que falha** — `src/lib/__tests__/tiff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import UTIF from 'utif';
import { decodificarTiff } from '../tiff';

/**
 * Monta um TIFF mínimo à mão — little-endian, sem compressão, uma tira —
 * para o teste não depender do encoder da mesma biblioteca que decodifica.
 * `bits` 8 ou 16; `amostras` 1 (cinza) ou 3 (RGB); `valores` em ordem de
 * varredura, uma entrada por amostra.
 */
function tiffMinimo(largura: number, altura: number, bits: 8 | 16, amostras: 1 | 3, valores: number[]): ArrayBuffer {
  const bytesPorAmostra = bits / 8;
  const dados = largura * altura * amostras * bytesPorAmostra;
  const entradas = 9;
  const ifdOffset = 8;
  const ifdTamanho = 2 + entradas * 12 + 4;
  const dadosOffset = ifdOffset + ifdTamanho;
  const buf = new ArrayBuffer(dadosOffset + dados);
  const v = new DataView(buf);
  v.setUint8(0, 0x49); v.setUint8(1, 0x49); // "II"
  v.setUint16(2, 42, true);
  v.setUint32(4, ifdOffset, true);
  let p = ifdOffset;
  v.setUint16(p, entradas, true); p += 2;
  const entrada = (tag: number, tipo: number, count: number, valor: number) => {
    v.setUint16(p, tag, true); v.setUint16(p + 2, tipo, true); v.setUint32(p + 4, count, true);
    if (tipo === 3) v.setUint16(p + 8, valor, true); else v.setUint32(p + 8, valor, true);
    p += 12;
  };
  entrada(256, 3, 1, largura);           // ImageWidth
  entrada(257, 3, 1, altura);            // ImageLength
  entrada(258, 3, 1, bits);              // BitsPerSample (um valor serve para todas as amostras)
  entrada(259, 3, 1, 1);                 // Compression = none
  entrada(262, 3, 1, amostras === 1 ? 1 : 2); // Photometric: BlackIsZero | RGB
  entrada(273, 4, 1, dadosOffset);       // StripOffsets
  entrada(277, 3, 1, amostras);          // SamplesPerPixel
  entrada(278, 3, 1, altura);            // RowsPerStrip
  entrada(279, 4, 1, dados);             // StripByteCounts
  v.setUint32(p, 0, true);               // próximo IFD: nenhum
  let q = dadosOffset;
  for (const val of valores) {
    if (bits === 8) { v.setUint8(q, val); q += 1; } else { v.setUint16(q, val, true); q += 2; }
  }
  return buf;
}

describe('decodificarTiff', () => {
  it('abre um RGB 8 bits sem compressão com largura, altura e pixels certos', () => {
    const buf = tiffMinimo(2, 1, 8, 3, [255, 0, 0, 0, 0, 255]);
    const img = decodificarTiff(buf);
    expect(img).not.toBeNull();
    expect(img!.width).toBe(2);
    expect(img!.height).toBe(1);
    expect(Array.from(img!.rgba.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(img!.rgba.slice(4, 8))).toEqual([0, 0, 255, 255]);
  });

  it('reduz 16 bits para 8 sem estourar: 0 → 0, 0x8000 → ~128, 0xFFFF → 255', () => {
    const buf = tiffMinimo(3, 1, 16, 1, [0, 0x8000, 0xffff]);
    const img = decodificarTiff(buf)!;
    const cinza = [img.rgba[0], img.rgba[4], img.rgba[8]];
    expect(cinza[0]).toBe(0);
    expect(Math.abs(cinza[1] - 128)).toBeLessThanOrEqual(1);
    expect(cinza[2]).toBe(255);
    // cinza: R = G = B
    expect(img.rgba[4]).toBe(img.rgba[5]);
    expect(img.rgba[5]).toBe(img.rgba[6]);
  });

  it('faz ida e volta pelo encoder da própria biblioteca (LZW não, mas RGBA sim)', () => {
    const w = 4, h = 3;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { rgba[i * 4] = i * 20; rgba[i * 4 + 1] = 7; rgba[i * 4 + 2] = 200 - i; rgba[i * 4 + 3] = 255; }
    const buf = UTIF.encodeImage(rgba, w, h);
    const img = decodificarTiff(buf)!;
    expect(img.width).toBe(w);
    expect(img.height).toBe(h);
    expect(Array.from(img.rgba)).toEqual(Array.from(rgba));
  });

  it('multipágina: devolve a primeira e conta as páginas', () => {
    // Dois IFDs encadeados exigem montar o segundo à mão; aqui basta garantir
    // que um TIFF de uma página conta 1 — a contagem vem de UTIF.decode.
    const img = decodificarTiff(tiffMinimo(1, 1, 8, 1, [9]))!;
    expect(img.paginas).toBe(1);
  });

  it('lixo devolve null em vez de lançar', () => {
    expect(decodificarTiff(new ArrayBuffer(3))).toBeNull();
    expect(decodificarTiff(new TextEncoder().encode('isto não é tiff').buffer)).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar.** `npx vitest run src/lib/__tests__/tiff.test.ts` → falha em "Cannot find module '../tiff'".

- [ ] **Step 4: Implementar `src/lib/tiff.ts`:**

```ts
import UTIF from 'utif';

/**
 * TIFF decodificado para o formato que o resto do app já entende: RGBA 8 bits.
 *
 * `paginas` existe porque scanner e microscópio às vezes gravam várias páginas
 * num arquivo; abrimos a primeira e dizemos quantas havia, para a interface
 * poder avisar em vez de fingir que só existe uma.
 */
export interface ImagemDecodificada {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  paginas: number;
}

/**
 * Decodifica a primeira página de um TIFF.
 *
 * Por que existe: nenhum navegador abre TIFF, e scanner de laboratório grava
 * TIFF — 8 ou 16 bits, LZW ou sem compressão. `utif` cobre isso e reduz 16
 * bits para 8 com o byte alto, que é o que um visualizador faria.
 *
 * Devolve `null` para qualquer coisa que não seja um TIFF legível. Quem chama
 * transforma isso em mensagem; aqui não se lança, porque um arquivo ruim é
 * caso esperado, não bug.
 */
export function decodificarTiff(buffer: ArrayBuffer): ImagemDecodificada | null {
  let ifds: ReturnType<typeof UTIF.decode>;
  try {
    ifds = UTIF.decode(buffer);
  } catch {
    return null;
  }
  if (!ifds || ifds.length === 0) return null;

  const ifd = ifds[0];
  try {
    UTIF.decodeImage(buffer, ifd, ifds);
  } catch {
    return null;
  }
  const width = ifd.width;
  const height = ifd.height;
  if (!width || !height) return null;

  let rgba: Uint8Array;
  try {
    rgba = UTIF.toRGBA8(ifd);
  } catch {
    return null;
  }
  if (rgba.length !== width * height * 4) return null;

  return {
    width,
    height,
    rgba: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length),
    paginas: ifds.length,
  };
}
```

Se o teste de 16 bits falhar por o `toRGBA8` mapear diferente (ex.: 0x8000 → 127 ou 129), a tolerância de ±1 já cobre; se falhar por mais, leia como `utif` trata `BitsPerSample = 16` e ajuste **o comentário**, não o teste, a menos que a redução esteja errada de fato.

- [ ] **Step 5: Rodar e ver passar.** `npx vitest run src/lib/__tests__/tiff.test.ts`.

- [ ] **Step 6: Ligar no carregador** — `src/hooks/useImageQueue.ts`. Substitua o bloco da guarda por um caminho de decodificação; o resto do hook não muda:

```ts
import { decodificarTiff } from '../lib/tiff';
// ...
      if (ehTiff(file)) {
        // Nenhum navegador abre TIFF, e scanner grava TIFF. Decodificamos
        // aqui e entregamos um <img> igual ao do PNG, para nada abaixo do
        // carregador precisar saber de onde veio.
        setFilename(file.name);
        setLoadError(null);
        const encerrar = iniciarAtividade('imagem', `Abrindo ${file.name}…`);
        file
          .arrayBuffer()
          .then((buffer) => {
            const dec = decodificarTiff(buffer);
            if (!dec) throw new Error('não é um TIFF que este leitor entenda');
            const canvas = document.createElement('canvas');
            canvas.width = dec.width;
            canvas.height = dec.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('canvas indisponível');
            ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
            // Blob + object URL em vez de data URL: uma digitalização de 6800
            // px viraria uma string de dezenas de MB só para virar imagem.
            return new Promise<HTMLImageElement>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('não foi possível converter')); return; }
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
                img.src = url;
              }, 'image/png');
            }).then((img) => {
              if (dec.paginas > 1) {
                // Aviso, não erro: a primeira página abriu.
                setLoadError(`"${file.name}" tem ${dec.paginas} páginas; foi aberta a primeira.`);
              }
              return img;
            });
          })
          .then((img) => {
            encerrar();
            setImage(img);
            onImageLoaded?.(img, file);
          })
          .catch((e: unknown) => {
            encerrar();
            const motivo = e instanceof Error ? e.message : 'erro desconhecido';
            setLoadError(`Não foi possível abrir "${file.name}" (${motivo}). Converta para PNG e tente de novo.`);
          });
        return;
      }
```

E em `loadFiles`, Windows às vezes entrega TIFF com `type` vazio:

```ts
      const validFiles = files.filter((f) => f.type.startsWith('image/') || ehTiff(f));
```

- [ ] **Step 7: Verificar no navegador.** `npm run dev`, abra `http://localhost:3000/`, carregue um TIFF real (peça ao Enrico um do scanner; se não houver, gere um com Python `PIL.Image.save('x.tif')` a partir de qualquer PNG do `docs/datasets/`, um em 8 bits e um em 16 bits `mode='I;16'`). Confirme que abre, que a onda funciona nele, e que um `.tif` inválido dá a mensagem e não silêncio.

- [ ] **Step 8: Checagens e commit.**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/lib/tiff.ts src/lib/__tests__/tiff.test.ts src/hooks/useImageQueue.ts --ext .ts,.tsx
git add package.json package-lock.json src/lib/tiff.ts src/lib/__tests__/tiff.test.ts src/hooks/useImageQueue.ts docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
git commit -m "feat(carregador): abre TIFF de scanner em vez de mandar converter

Scanner de laboratório grava TIFF (8/16 bits, LZW) e nenhum navegador o abre;
até aqui o app barrava com uma mensagem. Agora decodifica com utif, reduz 16
para 8 bits e entrega o mesmo <img> do PNG — nada abaixo do carregador muda.
Multipágina abre a primeira e avisa. Única dependência nova do lote.

Co-Authored-By: Claude <noreply@anthropic.com>" -- package.json package-lock.json src/lib/tiff.ts src/lib/__tests__/tiff.test.ts src/hooks/useImageQueue.ts docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
```

---

### Task A2: Cena sintética — rótulos por pixel, contorno por objeto, composição de recortes

**Antes de tudo:** leia `src/lib/synthetic-scene.ts` inteiro e os testes `synthetic-scene.test.ts` / `synthetic-data.test.ts`. Ele **já** gera cenas de elipses com rng determinístico (`criarRng`), tela com ruído (`criarTela`), presets `'soja' | 'orquidea-tz' | 'forrageira'`, e devolve `sementes: SementeSintetica[]` com centro, semieixos, ângulo, classe e `areaPx`. **Não duplique nada disso.** O que falta, e é o que esta tarefa acrescenta:

1. **`rotulos: Uint8Array`** na `CenaSintetica` — 0 fundo, senão o `id` da semente (o laço que pinta a elipse já sabe qual pixel é de quem; é só gravar). Necessário para IoU máscara-contra-máscara com a onda.
2. **`contorno: Ponto[]`** em cada `SementeSintetica` — a elipse paramétrica girada, 64 pontos, coordenadas absolutas.
3. **`comporCena(fundo, recortes, opcoes)`** — colar recortes arbitrários (os reais, vindos da galeria ou de um fixture) num fundo, com a mesma verdade. Reusa `criarRng` e a rejeição por colisão que `gerarCenaSintetica` já faz — extraia a função de colocação se estiver inline, em vez de escrever outra.
4. **`iouDeMascaras(a, b)`**.

**Files:**
- Modify: `src/lib/synthetic-scene.ts` (acrescenta; não muda assinatura do que existe — `gerarCenaSintetica` continua devolvendo o que devolvia, mais os campos novos)
- Modify: `src/lib/__tests__/synthetic-scene.test.ts` (acrescenta os casos abaixo)

**Interfaces:**
- Consumes: `DadosImagem` de `./color-features`; `Ponto` de `./aglomerado`; `segmentarPorClique` de `./region-growing` (no teste).
- Produces: `CenaSintetica.rotulos`, `SementeSintetica.contorno`, `Recorte`, `comporCena`, `iouDeMascaras`.

**Por quê:** a cena sintética tem verdade exata e é ilimitada, mas até aqui a verdade era só centro e área — não dava para perguntar "a onda recuperou ESTE pixel?". Com rótulo por pixel e contorno, qualquer "medir se" do roteiro vira um teste. E `comporCena` com recortes reais é o meio-termo entre o sintético (verdade perfeita, textura falsa) e o fixture real (textura real, verdade humana): textura real com posição exata. A esteira virtual (Degrau 3) é `comporCena` deslocada em x. **O que continua não provado:** sombra, encosto físico, desfoque — e o README já registra que dois critérios passaram no sintético e caíram na soja real; por isso a A4.

- [ ] **Step 1: Testes que falham** — acrescentar a `src/lib/__tests__/synthetic-scene.test.ts`:

```ts
import { gerarCenaSintetica, comporCena, iouDeMascaras } from '../synthetic-scene';
import type { Recorte } from '../synthetic-scene';
import { segmentarPorClique } from '../region-growing';

describe('rotulos e contorno', () => {
  it('cada semente aparece nos rótulos e o contorno é fechado em coordenadas absolutas', () => {
    const cena = gerarCenaSintetica('soja', { semente: 3, quantidade: 12, lado: 400 });
    expect(cena.rotulos.length).toBe(cena.imagem.width * cena.imagem.height);
    const ids = new Set(cena.rotulos);
    for (const s of cena.sementes) {
      expect(ids.has(s.id)).toBe(true);
      expect(s.contorno.length).toBeGreaterThanOrEqual(32);
      for (const [x, y] of s.contorno) {
        expect(Math.abs(x - s.x)).toBeLessThanOrEqual(s.a + 1);
        expect(Math.abs(y - s.y)).toBeLessThanOrEqual(s.a + 1);
      }
    }
    // A contagem de pixels rotulados bate com a areaPx que já era devolvida.
    for (const s of cena.sementes) {
      let n = 0;
      for (const r of cena.rotulos) if (r === s.id) n++;
      expect(n).toBe(s.areaPx);
    }
  });

  it('a onda recupera ≥ 95% das sementes com IoU > 0,8 no preset soja', () => {
    const cena = gerarCenaSintetica('soja', { semente: 5, quantidade: 20, lado: 600 });
    let bons = 0;
    for (const s of cena.sementes) {
      const r = segmentarPorClique(cena.imagem, { x: s.x, y: s.y }, { janela: 128 });
      if (!r || r.tocouBorda) continue;
      const { x: jx, y: jy, w, h } = r.janela;
      const verdade = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        verdade[y * w + x] = cena.rotulos[(jy + y) * cena.imagem.width + (jx + x)] === s.id ? 1 : 0;
      }
      if (iouDeMascaras(r.mascara, verdade) > 0.8) bons++;
    }
    expect(bons / cena.sementes.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('comporCena', () => {
  function quadrado(lado: number, cor: [number, number, number]): Recorte {
    const rgba = new Uint8ClampedArray(lado * lado * 4);
    const mascara = new Uint8Array(lado * lado).fill(1);
    for (let i = 0; i < lado * lado; i++) { rgba[i * 4] = cor[0]; rgba[i * 4 + 1] = cor[1]; rgba[i * 4 + 2] = cor[2]; rgba[i * 4 + 3] = 255; }
    return { largura: lado, altura: lado, rgba, mascara, contorno: [[0, 0], [lado, 0], [lado, lado], [0, lado]] };
  }

  it('coloca N recortes sem sobreposição, com rótulos e verdade consistentes', () => {
    const fundo = gerarCenaSintetica('soja', { semente: 1, quantidade: 0, lado: 300 }).imagem;
    const cena = comporCena(fundo, Array.from({ length: 15 }, () => quadrado(12, [220, 200, 150])), { semente: 2, margem: 3 });
    expect(cena.verdade).toHaveLength(15);
    expect(cena.naoColocados).toBe(0);
    for (let i = 0; i < 15; i++) for (let j = i + 1; j < 15; j++) {
      const a = cena.verdade[i].caixa, b = cena.verdade[j].caixa;
      const separadas = a.x + a.largura <= b.x || b.x + b.largura <= a.x || a.y + a.altura <= b.y || b.y + b.altura <= a.y;
      expect(separadas).toBe(true);
    }
    const ids = new Set(cena.rotulos);
    for (const o of cena.verdade) { expect(ids.has(o.id)).toBe(true); expect(o.areaPx).toBe(144); }
    expect(cena.rotulos[0]).toBe(0);
  });

  it('quando não cabe, devolve o que coube e conta os de fora', () => {
    const fundo = gerarCenaSintetica('soja', { semente: 1, quantidade: 0, lado: 40 }).imagem;
    const cena = comporCena(fundo, Array.from({ length: 4 }, () => quadrado(30, [200, 200, 200])), { semente: 3, tentativas: 50 });
    expect(cena.verdade.length).toBeLessThan(4);
    expect(cena.naoColocados).toBe(4 - cena.verdade.length);
  });
});

describe('iouDeMascaras', () => {
  it('iguais = 1, disjuntas = 0, metade = 1/3', () => {
    const a = new Uint8Array([1, 1, 0, 0]);
    expect(iouDeMascaras(a, a)).toBe(1);
    expect(iouDeMascaras(a, new Uint8Array([0, 0, 1, 1]))).toBe(0);
    expect(iouDeMascaras(a, new Uint8Array([1, 0, 1, 0]))).toBeCloseTo(1 / 3, 6);
  });
});
```

Se `gerarCenaSintetica` não aceitar `quantidade: 0` (para obter só o fundo), aceite — é uma linha — e comente por quê: "fundo sem semente é o que `comporCena` precisa".

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run src/lib/__tests__/synthetic-scene.test.ts`.

- [ ] **Step 3: Implementar.** Tipos novos no próprio `synthetic-scene.ts`:

```ts
/** Um objeto pronto para colar: pixels, máscara e contorno em coordenadas locais. */
export interface Recorte {
  largura: number;
  altura: number;
  /** RGBA; alfa 0 fora da máscara. */
  rgba: Uint8ClampedArray;
  /** 1 dentro do objeto. */
  mascara: Uint8Array;
  /** Contorno fechado, coordenadas locais do recorte. */
  contorno: Ponto[];
  classe?: string;
}
export interface Caixa { x: number; y: number; largura: number; altura: number }
export interface ObjetoDaVerdade {
  id: number;
  caixa: Caixa;
  centro: [number, number];
  contorno: Ponto[];
  areaPx: number;
  classe?: string;
}
export interface CenaComposta {
  imagem: DadosImagem;
  /** 0 fundo, senão o id do objeto. */
  rotulos: Uint8Array;
  verdade: ObjetoDaVerdade[];
  naoColocados: number;
}
export interface OpcoesDeComposicao { semente?: number; margem?: number; tentativas?: number }
```

`comporCena`: copia o fundo (`Uint8ClampedArray.from`), sorteia posição com `criarRng`, rejeita por colisão de caixa com `margem`, cola pixel a pixel onde `mascara = 1`, grava `rotulos`, acumula centro de massa e área, translada o contorno. Devolve `naoColocados`. `iouDeMascaras`: interseção/união sobre binários; união vazia → 1.

Em `gerarCenaSintetica`: no laço que pinta cada elipse, gravar `rotulos[i] = id`; ao montar cada `SementeSintetica`, acrescentar `contorno` (64 pontos: `[x + a·cos t·cos θ − b·sin t·sin θ, y + a·cos t·sin θ + b·sin t·cos θ]`). Se o laço de pintura usa anti-aliasing ou borda suave, o rótulo entra onde o pixel foi contado em `areaPx` — o teste exige que batam.

- [ ] **Step 4: Rodar e ver passar.** Se o teste da onda ficar abaixo de 95%, **não afrouxe**: veja se `janela: 128` cobre o semieixo do preset soja (se `a` > 60, suba a janela no teste e comente); veja o ruído do preset. Registre no comentário do teste o que foi.

- [ ] **Step 5: Checagens e commit.**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/lib/synthetic-scene.ts src/lib/__tests__/synthetic-scene.test.ts --ext .ts,.tsx
git add src/lib/synthetic-scene.ts src/lib/__tests__/synthetic-scene.test.ts docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
git commit -m "feat(cena sintética): rótulos por pixel, contorno por semente e composição de recortes

A cena já tinha verdade de centro e área; agora tem verdade por pixel e por
contorno, o que deixa perguntar 'a onda recuperou ESTE pixel?' — e todo
'medir se' do roteiro vira teste. comporCena cola recortes reais num fundo:
textura real com posição exata, meio-termo entre o sintético e o fixture real.

Co-Authored-By: Claude <noreply@anthropic.com>" -- src/lib/synthetic-scene.ts src/lib/__tests__/synthetic-scene.test.ts docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
```

---

### Task A3: Ensaio ao carregar — opções lado a lado, a pessoa escolhe

**Pré-requisito:** Tasks 7 e 8 do Degrau 1 fechadas (ninguém mais em `App.tsx`). A2 fechada (o teste usa a cena sintética).

**Files:**
- Create: `src/features/ensaio/receitas.ts` — as receitas (conjuntos de parâmetros) e o resumo por receita, puro.
- Create: `src/features/ensaio/executar.ts` — roda uma receita sobre pontos já localizados: onda por ponto + limiar da população; puro, cede a tela por lotes.
- Create: `src/features/ensaio/__tests__/ensaio.test.ts`
- Create: `src/features/ensaio/EnsaioPanel.tsx` — as "janelinhas". Invoque a skill `building-components` antes de escrever (acessibilidade, composição).
- Modify: `src/features/flags.ts` — flag `ensaioAoCarregar`, default **off**.
- Modify: `src/App.tsx` — só: (1) estado `ensaio`, (2) disparo em `onImageLoaded` quando a flag está ligada, (3) render do painel ao lado do canvas, (4) `handleUsarEnsaio` que chama `addYoloSegmentations`.

**Interfaces:**
- Consumes: `detectObjects(image, options): DetectionResult` de `src/lib/detect.ts` (localiza; precisa de DOM, por isso fica no App); `segmentarNoCanvas(imagem, ponto, opcoes?)` de `src/features/segmentacao/onda-no-canvas.ts`; `limiaresDaPopulacao`, `analisarContorno` de `src/lib/aglomerado.ts`; `feret` de `src/lib/feret.ts`; `addYoloSegmentations` de `useMarks`.
- Produces: `RECEITAS: Receita[]`, `resumir(contornos): ResumoDaReceita`, `executarReceita(...)`, `ResultadoDoEnsaio`.

**Por quê:** numa espécie nova ninguém sabe qual parâmetro funciona. Em vez de a pessoa tentar um por um, o app roda 2–3 conjuntos ao carregar e mostra cada resultado como miniatura com contagem, mediana de área e Feret; a pessoa escolhe **uma ou nenhuma**. É o "Oráculo" do spec de 13/09 na forma barata: sequencial, uma vez, sem worker permanente. O YOLO entra depois, quando a Task 7 estiver fechada e houver modelo para o que a pessoa disse que está olhando.

**Regra que não cai:** nada entra no estado sem "Usar esta". Recusar não deixa rastro além do registro de que o ensaio rodou.

- [ ] **Step 1: Receitas** — `src/features/ensaio/receitas.ts`:

```ts
import type { DetectionOptions } from '../../lib/detect';
import type { OpcoesDaOnda } from '../../lib/region-growing';
import type { Ponto } from '../../lib/aglomerado';
import { areaDoPoligono, limiaresDaPopulacao, analisarContorno } from '../../lib/aglomerado';
import { feret } from '../../lib/feret';

/**
 * Uma receita é um conjunto de parâmetros com nome. Três, não trinta: o
 * objetivo é a pessoa olhar e escolher, e três miniaturas cabem na lateral.
 */
export interface Receita {
  id: string;
  nome: string;
  /** Uma frase: em que cena esta receita tende a acertar. */
  quando: string;
  localizacao: DetectionOptions;
  onda: OpcoesDaOnda;
}

export const RECEITAS: Receita[] = [
  {
    id: 'padrao',
    nome: 'Padrão',
    quando: 'Semente clara em fundo escuro (ou o inverso), bem separada.',
    localizacao: { sensitivity: 0.5, splitTouching: false },
    onda: {},
  },
  {
    id: 'sensivel',
    nome: 'Sensível',
    quando: 'Semente pequena ou de cor próxima do fundo; pega mais, erra mais.',
    localizacao: { sensitivity: 0.7, splitTouching: false, denoise: 1 },
    onda: { recuoDoEscape: 0.15 },
  },
  {
    id: 'conservador',
    nome: 'Conservador',
    quando: 'Cena com sujeira ou sombra; só o que é inequívoco.',
    localizacao: { sensitivity: 0.35, splitTouching: false, denoise: 2, maxElongation: 4 },
    onda: { recuoDoEscape: 0.05 },
  },
];

export interface ContornoProposto {
  contorno: Ponto[];
  areaPx: number;
  /** Marcado por `analisarContorno` com o limiar da própria população. */
  suspeitoDeAglomerado: boolean;
}

export interface ResumoDaReceita {
  contagem: number;
  medianaDaAreaPx: number | null;
  medianaDoFeretMaxPx: number | null;
  suspeitos: number;
}

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Marca suspeitos com o limiar DA PRÓPRIA população (Degrau 1, Task 4) e
 * resume. Tudo em px: o resumo é para comparar receitas entre si na mesma
 * imagem, não para o laudo — por isso não passa por `valor-de-boletim`.
 */
export function resumir(contornos: Ponto[][]): { propostos: ContornoProposto[]; resumo: ResumoDaReceita } {
  const limiares = limiaresDaPopulacao(contornos) ?? undefined;
  const propostos = contornos.map((c) => {
    const analise = analisarContorno(c, limiares);
    return { contorno: c, areaPx: areaDoPoligono(c), suspeitoDeAglomerado: analise.veredito === 'aglomerado' };
  });
  const ferets = contornos.map((c) => feret(c)?.maximo).filter((v): v is number => typeof v === 'number');
  return {
    propostos,
    resumo: {
      contagem: propostos.length,
      medianaDaAreaPx: mediana(propostos.map((p) => p.areaPx)),
      medianaDoFeretMaxPx: mediana(ferets),
      suspeitos: propostos.filter((p) => p.suspeitoDeAglomerado).length,
    },
  };
}
```

Confira a assinatura real de `analisarContorno` e de `feret` antes de escrever — o nome do campo do veredito e o segundo argumento podem diferir; adapte ao que existe, não o contrário.

- [ ] **Step 2: Executor** — `src/features/ensaio/executar.ts`:

```ts
import type { Receita, ContornoProposto, ResumoDaReceita } from './receitas';
import { resumir } from './receitas';
import type { Ponto } from '../../lib/aglomerado';

/** O que a onda devolve para cada ponto: só o que o ensaio usa. */
export interface OndaResumida {
  contorno: Ponto[];
  tocouBorda: boolean;
}

export interface ResultadoDoEnsaio {
  receita: Receita;
  propostos: ContornoProposto[];
  resumo: ResumoDaReceita;
  /** Pontos localizados em que a onda escapou. Informa, não some. */
  escapes: number;
  duracaoMs: number;
}

/**
 * Roda a onda a partir de cada ponto localizado, em lotes que cedem a tela.
 *
 * A localização (detectObjects) fica com quem chama, porque precisa de canvas;
 * aqui entra a função da onda já fechada sobre a imagem, o que deixa isto
 * testável em node com a cena sintética. `lote` = quantas ondas entre um
 * `await` e outro — mesmo padrão de `handleSegmentarPendentes`.
 */
export async function executarReceita(
  receita: Receita,
  pontos: { x: number; y: number }[],
  onda: (p: { x: number; y: number }, opcoes: Receita['onda']) => OndaResumida | null,
  opcoes: { lote?: number; cancelado?: () => boolean } = {}
): Promise<ResultadoDoEnsaio | null> {
  const { lote = 8, cancelado = () => false } = opcoes;
  const inicio = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const contornos: Ponto[][] = [];
  let escapes = 0;
  for (let i = 0; i < pontos.length; i++) {
    if (cancelado()) return null;
    const r = onda(pontos[i], receita.onda);
    if (!r || r.tocouBorda) escapes++;
    else contornos.push(r.contorno);
    if ((i + 1) % lote === 0) await new Promise<void>((res) => setTimeout(res, 0));
  }
  const { propostos, resumo } = resumir(contornos);
  const fim = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { receita, propostos, resumo, escapes, duracaoMs: fim - inicio };
}
```

- [ ] **Step 3: Teste** — `src/features/ensaio/__tests__/ensaio.test.ts`, com a cena da A2:

```ts
import { describe, it, expect } from 'vitest';
import { RECEITAS, resumir } from '../receitas';
import { executarReceita } from '../executar';
import { fundoUniforme, elipseSintetica, comporCena } from '../../../lib/cena-sintetica';
import { segmentarPorClique } from '../../../lib/region-growing';

describe('receitas', () => {
  it('há entre 2 e 3, com ids únicos e um "quando" cada', () => {
    expect(RECEITAS.length).toBeGreaterThanOrEqual(2);
    expect(RECEITAS.length).toBeLessThanOrEqual(3);
    expect(new Set(RECEITAS.map((r) => r.id)).size).toBe(RECEITAS.length);
    for (const r of RECEITAS) expect(r.quando.length).toBeGreaterThan(10);
  });
});

describe('resumir', () => {
  it('conta, tira mediana e não acusa nada numa população homogênea', () => {
    const quadrado = (s: number): [number, number][] => [[0, 0], [s, 0], [s, s], [0, s]];
    const { resumo } = resumir(Array.from({ length: 12 }, () => quadrado(10)));
    expect(resumo.contagem).toBe(12);
    expect(resumo.medianaDaAreaPx).toBe(100);
    expect(resumo.suspeitos).toBe(0);
  });
});

describe('executarReceita', () => {
  it('sobre a cena sintética, a receita padrão recupera todos os objetos e nenhum escape', async () => {
    const fundo = fundoUniforme(500, 400, [70, 75, 80], 1, 9);
    const rec = elipseSintetica(14, 9, [225, 205, 160]);
    const cena = comporCena(fundo, Array.from({ length: 15 }, () => rec), { semente: 5, margem: 6 });
    const pontos = cena.verdade.map((o) => ({ x: o.centro[0], y: o.centro[1] }));
    const onda = (p: { x: number; y: number }, op: (typeof RECEITAS)[0]['onda']) => {
      const r = segmentarPorClique(cena.imagem, p, { janela: 128, ...op });
      return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
    };
    const res = await executarReceita(RECEITAS[0], pontos, onda, { lote: 4 });
    expect(res).not.toBeNull();
    expect(res!.resumo.contagem).toBe(15);
    expect(res!.escapes).toBe(0);
    expect(res!.resumo.suspeitos).toBe(0);
    expect(res!.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it('cancelamento devolve null sem terminar', async () => {
    let chamadas = 0;
    const onda = () => { chamadas++; return { contorno: [[0, 0], [1, 0], [1, 1]] as [number, number][], tocouBorda: false }; };
    const res = await executarReceita(RECEITAS[0], Array.from({ length: 20 }, () => ({ x: 0, y: 0 })), onda, {
      lote: 2,
      cancelado: () => chamadas >= 4,
    });
    expect(res).toBeNull();
    expect(chamadas).toBeLessThan(20);
  });
});
```

- [ ] **Step 4: Rodar; passar; commit parcial (só os puros):**

```bash
git add src/features/ensaio/receitas.ts src/features/ensaio/executar.ts src/features/ensaio/__tests__/ensaio.test.ts
git commit -m "feat(ensaio): receitas e executor do ensaio ao carregar, puros e testados na cena sintética

Co-Authored-By: Claude <noreply@anthropic.com>" -- src/features/ensaio/receitas.ts src/features/ensaio/executar.ts src/features/ensaio/__tests__/ensaio.test.ts
```

- [ ] **Step 5: Painel** — `src/features/ensaio/EnsaioPanel.tsx`. Uma coluna de cartões, um por receita: miniatura (canvas pequeno, ~160 px de largura, imagem reduzida com os contornos propostos por cima em traço fino da cor de `text-accent`; suspeitos em traço tracejado), nome, `quando`, linha `N contornos · área mediana X px · Feret Y px · Z suspeitos · escapes E`, botão **Usar esta**. No rodapé, **Nenhuma** (fecha o painel) e, enquanto roda, "Ensaiando… 2/3" com botão **Parar**. Sem `toFixed` para número que vá ao laudo — aqui são px de comparação, inteiros: `Math.round`.

Props:

```ts
interface EnsaioPanelProps {
  imagem: HTMLImageElement | HTMLCanvasElement;
  resultados: ResultadoDoEnsaio[];
  emAndamento: boolean;
  onUsar: (r: ResultadoDoEnsaio) => void;
  onNenhuma: () => void;
  onParar: () => void;
}
```

- [ ] **Step 6: Flag** — em `src/features/flags.ts`, ao lado de `aiPointer`: `ensaioAoCarregar`, rótulo "Ensaio ao carregar (experimental)", descrição "Ao abrir uma imagem, roda 3 conjuntos de parâmetros e mostra os resultados lado a lado para você escolher.", default **false**.

- [ ] **Step 7: App** — quatro pontos, cirúrgicos:
  1. Estado: `const [ensaio, setEnsaio] = useState<{ resultados: ResultadoDoEnsaio[]; emAndamento: boolean } | null>(null);` e um `ensaioCancelado = useRef(false)`.
  2. Disparo: dentro do `onImageLoaded` que já existe (ache onde `useImageQueue({ onImageLoaded })` é montado), se `flags.ensaioAoCarregar`: `ensaioCancelado.current = false; setEnsaio({ resultados: [], emAndamento: true });` e um `for` sequencial sobre `RECEITAS`: `const det = detectObjects(img, receita.localizacao)` → pontos `det.objects.map(o => ({x: o.x, y: o.y}))` → `executarReceita(receita, pontos, (p, op) => { const r = segmentarNoCanvas(imagemDeTrabalho ?? img, p, op); return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null; }, { cancelado: () => ensaioCancelado.current })` → acumula em `setEnsaio`. Ao fim, `emAndamento: false`. Confira a assinatura de `segmentarNoCanvas` — ela pode não aceitar `OpcoesDaOnda`; se não aceitar, acrescente o terceiro parâmetro repassado para `segmentarPorClique` (edição pequena em `onda-no-canvas.ts`, que é seu nesta tarefa).
  3. `handleUsarEnsaio(r)`: `addYoloSegmentations(r.propostos.map((p, i) => ({ id: Date.now() + i, category: 'viable', class_name: 'viavel', confidence: 1, polygon_points: p.contorno, visible: true, ...calculateSeedDimensions(p.contorno), origem: 'modelo' })))`; `setEnsaio(null)`. Origem `'modelo'` porque é proposta aceita sem marca manual — mesma semântica do AI Pointer. Suspeitos entram também (a pessoa vê o tracejado e decide no inspetor); **não** filtre por conta própria.
  4. Render: ao lado do canvas, onde o `AiPointerPanel` é renderizado, `{ensaio && image && <EnsaioPanel imagem={image} resultados={ensaio.resultados} emAndamento={ensaio.emAndamento} onUsar={handleUsarEnsaio} onNenhuma={() => setEnsaio(null)} onParar={() => { ensaioCancelado.current = true; }} />}`.

- [ ] **Step 8: Verificação humana (preparar; o Enrico faz).** Com a flag ligada, abrir o exemplo "Soja" e uma orquídea: os três cartões aparecem sem travar o arraste (o lote cede a tela); "Usar esta" preenche; "Nenhuma" não deixa nada; "Parar" interrompe. Registrar no `progress.md` do lote: duração de cada receita em ms nas duas imagens, e a contagem de cada receita contra a contagem que a pessoa faria à mão na mesma imagem.

- [ ] **Step 9: Checagens e commit final.**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/features/ensaio src/features/flags.ts src/App.tsx --ext .ts,.tsx
git add src/features/ensaio/EnsaioPanel.tsx src/features/flags.ts src/App.tsx docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
git commit -m "feat(ensaio): ao carregar, três receitas lado a lado — a pessoa escolhe uma ou nenhuma

Numa espécie nova ninguém sabe o parâmetro certo. O app roda três conjuntos
ao abrir a imagem (localiza, onda por ponto, limiar da própria população) e
mostra cada um como miniatura com contagem, área e Feret. Nada entra no estado
sem 'Usar esta'. Atrás de flag, desligada por padrão, até a medição dizer que
a taxa de contorno rejeitado cai.

Co-Authored-By: Claude <noreply@anthropic.com>" -- src/features/ensaio/EnsaioPanel.tsx src/features/flags.ts src/App.tsx docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
```

---

### Task A4: Fixtures reais recortados, com verdade — teste de regressão sobre imagem de verdade

**Pré-requisito:** A2 (usa `iouDeMascaras`).

**Files:**
- Create: `scripts/gerar-fixtures-reais.py` (Python, PIL + numpy; **sem OpenCV**, que não está instalado)
- Create: `src/lib/__tests__/fixtures/soja-512.png` + `soja-512.rotulos.png` + `soja-512.json`
- Create: `src/lib/__tests__/fixtures/orquidea-512.png` + `orquidea-512.json`
- Create: `src/lib/__tests__/fixtures/README.md` (origem, licença, como regenerar, o que cada um prova)
- Create: `src/lib/__tests__/fixtures-reais.test.ts`
- Modify: `package.json` / `package-lock.json` — **`pngjs` como devDependency** (exceção declarada: teste em node precisa ler PNG; é puro JS e não entra no bundle). Segunda e última dependência do lote.

**Por quê (Enrico, 13/09):** a cena sintética tem verdade exata, mas o README dos datasets registra que *dois critérios de tolerância passaram no sintético e falharam na soja real*. Temos orquídea, soja e mais com anotação; um recorte pequeno de cada, com a verdade recortada junto, entra no repositório e vira teste de regressão sobre **imagem de verdade**. Regra de tamanho: cada fixture ≤ 300 KB; recortes de no máximo 512 px.

**Orçamento de honestidade:** os limiares dos testes **não são escolhidos para passar**. O executor roda a medição primeiro, registra o número no comentário do teste, e fixa a asserção em *medido − margem*. Um teste que passa porque o número foi ajustado até passar não é regressão, é decoração.

- [ ] **Step 1: Script de recorte.** `scripts/gerar-fixtures-reais.py`:
  - **Soja:** abra uma digitalização de `Image Dataset of Local Indonesian Soybean Seed Var/` (caminho no `docs/datasets/README.md` §2.1; o script recebe o caminho por argumento, não o grava). Escolha uma janela 512×512 que contenha entre 8 e 20 sementes **inteiras** (máscara de instância totalmente dentro da janela; as parcialmente cortadas ficam fora da verdade e são pintadas com a cor mediana do fundo na imagem — para não haver objeto sem verdade). Salve `soja-512.png` (RGB) e `soja-512.rotulos.png` (8 bits, 0 fundo, 1..N instância) e `soja-512.json` com `{ origem, licenca, janela: {x,y}, escala_um_por_px (do README, se conhecida), objetos: [{id, centro:[x,y], areaPx}] }`.
  - **Orquídea:** use as labels de segmentação que a Task 4 usou (o script `medir_limiar_populacao.py` do scratchpad tem o caminho). Escolha uma imagem, uma janela ≤ 512 com 10–30 contornos inteiros; salve `orquidea-512.png` e `orquidea-512.json` com `{ origem, janela, objetos: [{id, poligono: [[x,y],...] em coordenadas do recorte}] }`. Não há máscara: a verdade é polígono humano, e o README do fixture diz isso.
  - Determinístico: a janela é escolhida por varredura (primeira que satisfaz), não por sorteio.

- [ ] **Step 2: Rodar o script, conferir os PNG a olho (abra-os), escrever `fixtures/README.md`.**

- [ ] **Step 3: Medir antes de afirmar.** Escreva `fixtures-reais.test.ts` primeiro com `console.log` das grandezas abaixo e `expect(true)`; rode; anote; depois troque por asserções em *medido − margem*:
  - **Soja:** para cada objeto, `segmentarPorClique(imagem, centro, { janela: 160 })` → IoU contra `rotulos === id`. Grandeza: fração com IoU > 0,8. Margem: 5 pp.
  - **Soja:** `limiaresDaPopulacao(contornos da onda)` → fração acusada como aglomerado. Como nenhuma encosta, é falso alarme. Margem: 5 pp acima do medido.
  - **Orquídea:** `limiaresDaPopulacao(poligonos)` → fração acusada; é o número da Task 4 (13,2% mediana) como regressão neste recorte. Margem: 5 pp.
  - **Orquídea:** onda no centroide de cada polígono → área da onda / área do polígono; fração dentro de ±30%. Margem: 10 pp (é o caso difícil; o número vai ser feio e é para ser registrado, não escondido).

- [ ] **Step 4: Teste final** (esqueleto; os números vêm do Step 3):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { segmentarPorClique } from '../region-growing';
import { limiaresDaPopulacao, analisarContorno, areaDoPoligono } from '../aglomerado';
import { iouDeMascaras } from '../synthetic-scene';

const DIR = join(__dirname, 'fixtures');
function png(nome: string) {
  const p = PNG.sync.read(readFileSync(join(DIR, nome)));
  return { data: new Uint8ClampedArray(p.data.buffer, p.data.byteOffset, p.data.length), width: p.width, height: p.height };
}
function rotulos(nome: string): Uint8Array {
  const p = PNG.sync.read(readFileSync(join(DIR, nome)));
  const out = new Uint8Array(p.width * p.height);
  for (let i = 0; i < out.length; i++) out[i] = p.data[i * 4]; // cinza: R = índice
  return out;
}

describe('soja real (recorte 512, máscara de instância)', () => {
  const imagem = png('soja-512.png');
  const rot = rotulos('soja-512.rotulos.png');
  const meta = JSON.parse(readFileSync(join(DIR, 'soja-512.json'), 'utf8'));

  it('a onda recupera as sementes com IoU > 0,8 — medido: __%, asserção em __%', () => {
    let bons = 0;
    for (const o of meta.objetos) {
      const r = segmentarPorClique(imagem, { x: o.centro[0], y: o.centro[1] }, { janela: 160 });
      if (!r || r.tocouBorda) continue;
      const { x: jx, y: jy, w, h } = r.janela;
      const v = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) v[y * w + x] = rot[(jy + y) * imagem.width + (jx + x)] === o.id ? 1 : 0;
      if (iouDeMascaras(r.mascara, v) > 0.8) bons++;
    }
    expect(bons / meta.objetos.length).toBeGreaterThanOrEqual(0 /* medido − 0,05 */);
  });

  it('limiar da população não acusa semente isolada — medido: __%, asserção ≤ __%', () => {
    const contornos: [number, number][][] = [];
    for (const o of meta.objetos) {
      const r = segmentarPorClique(imagem, { x: o.centro[0], y: o.centro[1] }, { janela: 160 });
      if (r && !r.tocouBorda) contornos.push(r.contorno);
    }
    const lim = limiaresDaPopulacao(contornos) ?? undefined;
    const acusados = contornos.filter((c) => analisarContorno(c, lim).veredito === 'aglomerado').length;
    expect(acusados / contornos.length).toBeLessThanOrEqual(1 /* medido + 0,05 */);
  });
});

describe('orquídea real (recorte, polígonos humanos)', () => {
  const imagem = png('orquidea-512.png');
  const meta = JSON.parse(readFileSync(join(DIR, 'orquidea-512.json'), 'utf8'));
  const poligonos: [number, number][][] = meta.objetos.map((o: { poligono: [number, number][] }) => o.poligono);

  it('limiar da população: falso alarme neste recorte — medido: __%, asserção ≤ __%', () => {
    const lim = limiaresDaPopulacao(poligonos) ?? undefined;
    const acusados = poligonos.filter((c) => analisarContorno(c, lim).veredito === 'aglomerado').length;
    expect(acusados / poligonos.length).toBeLessThanOrEqual(1 /* medido + 0,05 */);
  });

  it('onda no centroide: área dentro de ±30% do polígono — medido: __%, asserção ≥ __%', () => {
    let dentro = 0;
    for (const p of poligonos) {
      const cx = p.reduce((s, [x]) => s + x, 0) / p.length, cy = p.reduce((s, [, y]) => s + y, 0) / p.length;
      const r = segmentarPorClique(imagem, { x: cx, y: cy }, { janela: 128 });
      if (!r || r.tocouBorda) continue;
      const razao = r.areaPx / areaDoPoligono(p);
      if (razao > 0.7 && razao < 1.3) dentro++;
    }
    expect(dentro / poligonos.length).toBeGreaterThanOrEqual(0 /* medido − 0,10 */);
  });
});
```

Confira os nomes reais (`veredito`, `areaPx`, `janela`) contra o código; adapte o teste ao código, nunca o contrário.

- [ ] **Step 5: Checagens e commit.**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/lib/__tests__/fixtures-reais.test.ts --ext .ts,.tsx
git add scripts/gerar-fixtures-reais.py src/lib/__tests__/fixtures src/lib/__tests__/fixtures-reais.test.ts package.json package-lock.json docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
git commit -m "test(fixtures reais): recorte de soja com máscara e de orquídea com polígonos, como regressão

A cena sintética tem verdade exata e textura falsa; o README dos datasets
registra critérios que passaram nela e caíram na soja real. Um recorte de
512 px de cada, com a verdade recortada junto, vira teste sobre imagem de
verdade. As asserções são o número medido menos uma margem, escritas no
próprio teste — não foram ajustadas até passar.

Co-Authored-By: Claude <noreply@anthropic.com>" -- scripts/gerar-fixtures-reais.py src/lib/__tests__/fixtures src/lib/__tests__/fixtures-reais.test.ts package.json package-lock.json docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md
```

---

### Task A5: Exemplos reais embutidos no app — imagem, metadados, verdade carregável

**Pedido (Enrico, 13/09):** "temos muita coisa boa no dataset; usa o README e já deixa embedado para carregar facilmente no app". Hoje os botões de exemplo (`src/features/demo/exemplos.ts`, `ImageActions.tsx`) só geram cena sintética.

**Regra que o README dos datasets já impõe e que esta tarefa respeita:** imagem de terceiro não entra no repositório sem licença clara. Filtro por origem:
- **Orquídea (GPEOrq/GPSEM):** material do próprio grupo → entra, com o Enrico indicando qual imagem pode ser pública.
- **Soja (Mendeley, `c733bjz4m3`):** entra **só** se a licença na página for CC BY (ou mais permissiva); a atribuição vai no app, ao lado da imagem. Sem confirmação de licença, o exemplo de soja fica de fora e o README diz por quê.
- **Roboflow/Kaggle:** cada conjunto na sua licença; nenhum entra nesta tarefa.

**Tamanho:** recorte ≤ 1024 px no maior lado, PNG (não JPEG — a borda é onde a segmentação decide), ≤ 1,5 MB cada, em `public/exemplos/` — carregado por `fetch` sob demanda, **nunca** importado no bundle.

**Duas metades, porque a segunda mexe em `App.tsx`:**

**A5a — assets, catálogo e carregador (agora, arquivos disjuntos):**
- Create: `public/exemplos/<slug>.png` (+ `<slug>.verdade.json` quando houver verdade)
- Create: `public/exemplos/README.md` — origem, licença, autor, escala, como o recorte foi feito (reuse `scripts/gerar-fixtures-reais.py` da A4 com um modo `--exemplo`, ou um script irmão `scripts/gerar-exemplos-reais.py`)
- Create: `src/features/demo/exemplos-reais.ts`:

```ts
/**
 * Exemplos REAIS embutidos: digitalizações do grupo (ou de terceiros com
 * licença que permite), recortadas, com metadados e — quando há — a verdade.
 *
 * Ficam em public/exemplos/ e são buscadas sob demanda: uma imagem real de
 * 1 MB no bundle atrasaria toda abertura do app por causa de um botão.
 */
export interface ExemploReal {
  slug: string;
  rotulo: string;
  /** Uma frase: o que este exemplo mostra e o que ele não mostra. */
  dica: string;
  especieId?: string;
  /** µm por pixel, quando a origem declara; ausente = sem escala. */
  umPorPixel?: number;
  origem: { fonte: string; licenca: string; atribuicao: string; url?: string };
  /** Caminho relativo a public/. */
  imagem: string;
  /** Contornos de referência em coordenadas da imagem recortada, quando existem. */
  verdade?: string;
}

export const EXEMPLOS_REAIS: ExemploReal[] = [
  // preenchido pela tarefa com o que passou no filtro de licença
];

export interface VerdadeDoExemplo {
  origem: 'mascara-de-instancia' | 'poligono-humano';
  objetos: { id: number; poligono: [number, number][]; classe?: string }[];
}

/** Busca a imagem como File PNG, pronto para a fila de imagens. */
export async function carregarExemploReal(ex: ExemploReal): Promise<{ arquivo: File; verdade: VerdadeDoExemplo | null }> {
  const base = import.meta.env.BASE_URL ?? '/';
  const r = await fetch(`${base}${ex.imagem}`);
  if (!r.ok) throw new Error(`Exemplo "${ex.rotulo}" não encontrado (${r.status}).`);
  const blob = await r.blob();
  const arquivo = new File([blob], `${ex.slug}.png`, { type: 'image/png' });
  let verdade: VerdadeDoExemplo | null = null;
  if (ex.verdade) {
    const v = await fetch(`${base}${ex.verdade}`);
    if (v.ok) verdade = (await v.json()) as VerdadeDoExemplo;
  }
  return { arquivo, verdade };
}
```

- Test: `src/features/demo/__tests__/exemplos-reais.test.ts` — para cada entrada de `EXEMPLOS_REAIS`: o arquivo existe em `public/` (fs), tem ≤ 1,5 MB, a licença não é vazia, e se há `verdade`, o JSON abre e todo polígono tem ≥ 3 pontos dentro da imagem (largura/altura lidas do cabeçalho PNG — 8 bytes de assinatura + IHDR — sem `pngjs` aqui, para o teste não depender da A4).
- Commit A5a com pathspec.

**A5b — ligar no app (depois da Task 8 do Degrau 1, `App.tsx` livre):**
- Modify: `src/components/sidebar/ImageActions.tsx` — os botões de `EXEMPLOS_REAIS` ao lado dos sintéticos, rotulados "real"; ao lado, a atribuição em texto pequeno (`text-ink-3`).
- Modify: `src/App.tsx` — um `handleCarregarExemploReal(ex)` ao lado do `carregarExemplo` que já existe (linha ~1252): chama `carregarExemploReal`, passa o `File` para `loadFiles([arquivo])`, grava `especieId` e `umPorPixel` nos metadados quando existem, e, se veio `verdade`, guarda em estado e mostra um botão **"Carregar referência"** que faz `addYoloSegmentations(...)` com os polígonos e `origem: 'referencia'`. Confira se `origem` aceita `'referencia'` em `src/types.ts` e `contornoRepresentaSemente` em `src/lib/contagem.ts`; se não, acrescente com comentário: referência é semente (conta), mas não é medição do app (o CSV deve marcar a origem).
- A referência **nunca** carrega sozinha: a pessoa vê o app primeiro, depois compara.
- Commit A5b com pathspec; linha A5 no progress.

**Bloqueio declarado:** A5a precisa do Enrico dizer **qual imagem de orquídea do GPEOrq pode ser pública** e da **licença do Mendeley** conferida (o executor abre a página `https://data.mendeley.com/datasets/c733bjz4m3/3` e registra o texto da licença no README; se não conseguir abrir, deixa a soja de fora e diz).

---

## Checkpoint final do lote

- `npx vitest run` — 785 + testes novos (A1 ≈ 5, A2 ≈ 5, A3 ≈ 4, A4 = 4), zero falhas.
- `npx tsc --noEmit` limpo; `npm run build` passa.
- `docs/datasets/medicao-limiar-populacao-soja.md` existe com a decisão escrita literalmente.
- Um TIFF real do scanner abre no app.
- `git push origin develop`. **Nunca em `main`.**

## Self-review do plano

- Cobertura: 2.8 → A1; 2.13 → A2 (estendendo `synthetic-scene.ts`, que já existia) + A4 (fixtures reais, pedido do Enrico); 2.11 → A3; complemento da Task 4 → A0; exemplos reais no app (pedido do Enrico) → A5, com filtro de licença do README. 2.9/2.10/3.8 ficam de fora de propósito (motivo no cabeçalho).
- Consistência de tipos: `Recorte.contorno` é `Ponto[]` de `aglomerado.ts`, o mesmo que `feret` e `analisarContorno` consomem; `DadosImagem` é o de `color-features.ts`, o mesmo que `segmentarPorClique` consome; `ResultadoDoEnsaio` é o que o painel recebe e o que `handleUsarEnsaio` desmonta.
- Ponto de fragilidade admitido: A3 depende de assinaturas (`analisarContorno`, `feret`, `segmentarNoCanvas`) que o executor deve **conferir** antes de escrever — o plano diz isso em cada ponto.
