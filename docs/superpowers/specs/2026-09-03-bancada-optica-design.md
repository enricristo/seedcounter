# Bancada Óptica — sistema de identidade visual do SeedCounter

- **Data:** 2026-09-03
- **Status:** aprovado para implementação (fundação)
- **Escopo:** apresentação apenas — `src/index.css`, `index.html` e as camadas de estilo dos componentes React
- **Fora de escopo:** `src/lib/`, `src/hooks/`, `src/context/`, algoritmos, Dexie, estatística, PDF/YOLO/ONNX, assinaturas públicas de componentes
- **Guia visual:** [Bancada Óptica](https://claude.ai/code/artifact/b967b8aa-44bb-40c9-b2fa-b7a757f1752f)

## 1. Motivação

Auditoria de `src/` em 2026-09-03 (branch `fix/main-typecheck`). Cinco falhas, todas na camada de apresentação:

| # | Falha | Medida | Causa |
|---|---|---|---|
| 1 | Alternador de tema escuro não tem efeito | 1.144 classes `dark:` em 38 arquivos | Tailwind v4 usa `@media (prefers-color-scheme)` por padrão; `useTheme` alterna a classe `.dark`, mas falta `@custom-variant dark` em `src/index.css` |
| 2 | Fontes nunca carregadas | 2 famílias declaradas, 0 carregadas | `--font-sans` e `--font-mono` em `src/index.css:4-5` apontam para Inter e JetBrains Mono sem `@font-face`, sem `<link>` e sem arquivos em `public/` |
| 3 | Classes sem CSS gerado | 80 ocorrências | Tons inexistentes no Tailwind: `neutral-250`, `neutral-450`, `neutral-750`, `neutral-850`, `zinc-150`, `zinc-250`, `zinc-350`, `zinc-450`, `zinc-550`, `zinc-650`, `zinc-750`, `zinc-850`, `emerald-350`, `emerald-450`, `red-650` |
| 4 | Gráficos fora do sistema de tema | 40+ hex fixos | Recharts recebe cor como string JS; nenhum ponto lê token. O tooltip é escuro fixo mesmo no tema claro |
| 5 | Ausência de hierarquia | 7 raios, 2 acentos, 2 famílias de cinza | `rounded-sm/md/lg/xl/2xl/3xl/full` em uso simultâneo; emerald como CTA e purple como navegação sem regra; `neutral` (quente) e `zinc` (frio) misturados |
| 6 | Ícones sem escala nem peso | 17 tamanhos, 66 ícones, 0 `strokeWidth` | Tamanhos de 9 a 52px atribuídos caso a caso, a maioria fora da grade de 4px; nenhum ícone define `strokeWidth`, então todos herdam o padrão 2 do lucide em qualquer tamanho |
| 7 | Produto sem marca própria | 1 arquivo duplicado | `public/logo.png` tem MD5 idêntico a `public/gpeorq.jpg`; o "logo do app" é o logo do grupo de pesquisa. `index.html` ainda declara `theme-color: #171717`, fora de qualquer escala do sistema |

Colisão semântica que motiva a §2: `#ef4444` significa **semente viável** em `src/components/canvas/MarkingCanvas.tsx:442` e **ação destrutiva** (limpar marcações) em `src/components/layout/Header.tsx`. A mesma cor, dois sentidos opostos, na mesma tela.

## 2. Arquitetura: três linguagens de cor

Toda cor do produto pertence a exatamente uma linguagem. Nenhuma cor atravessa a fronteira. Esta é a regra estruturante do sistema e o critério de revisão de qualquer PR de estilo.

| Linguagem | Onde vive | Nunca aparece em |
|---|---|---|
| **Cromo** | navegação, botões, campos, foco, estados do sistema, painéis | sobre a imagem da amostra |
| **Espécime** | marcas e sobreposições desenhadas sobre a lâmina | cromo, gráficos |
| **Dados** | séries de tratamento em gráficos e tabelas | botões, foco, estados |

**Invariantes:**

- Um token de série (`--series-1` a `--series-8`) nunca pinta um controle de interface.
- O acento de cromo nunca pinta uma série.
- Vermelho tem um único significado no cromo: ação destrutiva.
- Cor semântica sempre acompanha ícone e rótulo — nunca cor sozinha.

## 3. Tokens

Todos declarados em `@theme` de `src/index.css`. O bloco claro é a definição completa; o escuro apenas redefine valores.

### 3.1 Grafite (neutro, matiz ≈200°)

| Passo | Hex | Passo | Hex |
|---|---|---|---|
| 25 | `#F6F9FA` | 500 | `#637378` |
| 50 | `#EDF2F4` | 600 | `#4A585C` |
| 100 | `#E1E8EA` | 700 | `#364245` |
| 200 | `#CBD6D9` | 800 | `#242E31` |
| 300 | `#ADBCC0` | 900 | `#182023` |
| 400 | `#86959A` | 950 | `#101719` |

Substitui integralmente `neutral-*` e `zinc-*`.

### 3.2 Papéis de superfície e tinta

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--surface-0` | grafite-25 | grafite-950 | fundo da aplicação |
| `--surface-1` | `#FFFFFF` | grafite-900 | painéis, barra, modais |
| `--surface-2` | grafite-50 | grafite-800 | campos, trilhos, inset |
| `--line` | grafite-200 | grafite-700 | separador de 1px |
| `--line-soft` | grafite-100 | grafite-800 | separador interno de tabela |
| `--ink-1` | grafite-900 | grafite-50 | texto primário |
| `--ink-2` | grafite-600 | grafite-300 | texto de apoio |
| `--ink-3` | grafite-400 | grafite-500 | rótulo, eyebrow |

### 3.3 Retículo (acento de cromo)

| Token | Claro | Escuro |
|---|---|---|
| `--accent` | `#0C6E7A` | `#3FB4C4` |
| `--accent-strong` | `#095560` | `#6FD0DC` |
| `--accent-tint` | `#E0F0F2` | `#0B2C31` |
| `--accent-on` | `#FFFFFF` | `#08252A` |

Contraste: 5,9:1 sobre `#FFFFFF`; 7,1:1 sobre grafite-900. Substitui emerald (CTA) e purple (navegação).

### 3.4 Semântica de cromo (reservada)

| Token | Claro | Escuro |
|---|---|---|
| `--sem-danger` | `#C0392E` | `#E2685C` |
| `--sem-warn` | `#B5730C` | `#E0A84A` |
| `--sem-ok` | `#17864A` | `#2FA05F` |

### 3.5 Palco

`--stage: #6F7A7D` — **valor idêntico nos dois temas**.

Justificativa: contraste simultâneo. Um entorno que muda de lightness altera a tonalidade percebida da amostra, e a comparação entre sessões deixa de ser válida. O valor é fixo pelo mesmo motivo que editores de imagem usam cinza médio neutro.

### 3.6 Espécime (sobreposição sobre a lâmina)

| Token | Hex | Forma | Significado |
|---|---|---|---|
| `--ov-viable` | `#00E5FF` | disco preenchido | viável |
| `--ov-inviable` | `#FF3DC8` | anel vazado (2px) | inviável |
| `--ov-tool` | `#FFFFFF` | — | medição, régua, borracha |

Halo preto de 1,5px em todas as marcas. A forma é codificação redundante: a distinção sobrevive ao daltonismo e à impressão em escala de cinza.

Justificativa da escolha de matiz: ciano e magenta praticamente não ocorrem em material biológico. Sementes, tegumento, ágar e embrião corado por tetrazólio ocupam a faixa âmbar–carmim, que é exatamente onde o código atual desenha as marcas.

**Decisão registrada (2026-09-03):** inverte o hábito atual (vermelho = viável). Aprovado. A alternativa descartada era manter carmim/âmbar no canvas e trocar o destrutivo do cromo por cinza com ícone.

### 3.7 Séries de dados

Oito posições, ordem fixa, atribuídas em sequência, **nunca cicladas**.

| Pos. | Matiz | Claro | Escuro |
|---|---|---|---|
| 1 | Azure | `#2a6fd6` | `#4a86e8` |
| 2 | Ocre | `#e0651f` | `#d15a1c` |
| 3 | Teal | `#12a583` | `#149b7b` |
| 4 | Latão | `#e0a020` | `#c28615` |
| 5 | Rosa | `#dd7fa6` | `#d0708f` |
| 6 | Folha | `#157f2e` | `#2f9440` |
| 7 | Índigo | `#4f3fae` | `#8478df` |
| 8 | Carmim | `#d9433f` | `#e06661` |

Verificada por script (`dataviz/scripts/validate_palette.js`), não por inspeção visual:

- Claro (superfície `#F7F9FA`): faixa de lightness PASS · piso de croma PASS · separação CVD **ΔE 11,7** (pior par adjacente, protanopia) PASS · piso de visão normal **ΔE 18,7** PASS · contraste WARN em 3 tons
- Escuro (superfície `#141B1D`): as cinco verificações PASS · CVD ΔE 10,0 · visão normal ΔE 15,9

Alvo do método: CVD ΔE ≥ 8, piso de visão normal ≥ 15.

**Regras de uso:**

- **Teto de séries:** dispersão, bolha, mapa e small multiples suportam **3 séries** (qualquer par pode encostar). Linha, barra, área e pilha suportam as 8. Acima do teto: agrupar em "Outros" ou facetar. Nunca gerar uma 9ª cor.
- **Alívio obrigatório:** teal, latão e rosa ficam abaixo de 3:1 sobre a superfície clara. Onde forem usadas, o gráfico precisa de rótulo direto ou tabela equivalente.
- **Cor segue a entidade, nunca a posição no ranking.** Um filtro que muda a contagem de séries não pode repintar as que sobraram.

## 4. Tipografia

| Papel | Família | Tam./Altura | Ajuste |
|---|---|---|---|
| Leitura primária | IBM Plex Mono 600 | 38 / 1.0 | tabular, −0.02em |
| Título de vista | Archivo 700 | 23 / 1.15 | `wdth` 90 |
| Título de painel | Archivo 700 | 14 / 1.3 | `wdth` 88 |
| Corpo | Archivo 400 | 15 / 1.6 | `wdth` 100 |
| Rótulo / eyebrow | Archivo 700 | 10 / 1.4 | `wdth` 82, +0.16em, caixa alta |
| Valor medido | IBM Plex Mono 500 | 12 / 1.5 | tabular |
| Botão | Archivo 700 | 10 / 1 | `wdth` 84, +0.09em, caixa alta |

**Regra de atribuição:** se foi uma máquina que mediu, é Mono; se foi um humano que escreveu, é Archivo. Vão para Mono: contagens, µm/px, coordenadas, valores-p, IDs de amostra, datas, percentuais de germinação.

Carregamento: `<link>` para Google Fonts em `index.html`, com `preconnect`. Eixos: `Archivo:wdth,wght@75..100,400..700` e `IBM+Plex+Mono:wght@400;500;600`. Pilha de fallback declarada em ambos os tokens.

## 5. Iconografia e marca

### 5.1 Estado atual

- **17 tamanhos distintos** em uso (9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 32, 36, 38, 52) entre 66 ícones `lucide-react`. A maioria fora da grade de 4px.
- **`strokeWidth` nunca é definido.** Todo ícone herda o padrão 2 do lucide, em qualquer tamanho.
- `public/logo.png` tem MD5 idêntico a `public/gpeorq.jpg` (`a51ac15d…`). O produto não tem marca própria: usa a do grupo de pesquisa.
- `index.html` declara `<meta name="theme-color" content="#171717">`, um cinza quente que não pertence a nenhuma escala do sistema.

### 5.2 Escala de tamanho

Quatro passos, todos na grade de 4px. Substituem os 17 atuais.

| Passo | Tamanho | Uso |
|---|---|---|
| `icon-sm` | 14px | dentro de linha de texto, pílulas, tabelas densas |
| `icon-md` | 16px | padrão de todo controle e botão |
| `icon-lg` | 20px | cabeçalho de seção, título de painel |
| `icon-xl` | 24px | estado vazio, cabeçalho de modal |

Acima de 24px não é ícone, é ilustração, e não usa lucide.

### 5.3 Compensação óptica de traço

Ícones lucide são desenhados num `viewBox` 24×24 com traço 2. Ao renderizar em 14px o traço efetivo cai para 1,17px e perde definição; em 24px fica pesado ao lado de texto de 15px. O traço é corrigido por passo para manter a espessura efetiva entre 1,3 e 1,5px em toda a escala:

| Tamanho | `strokeWidth` | Traço efetivo |
|---|---|---|
| 14px | 2.25 | 1.31px |
| 16px | 2 | 1.33px |
| 20px | 1.75 | 1.46px |
| 24px | 1.5 | 1.50px |

### 5.4 Regras semânticas

- Um ícone representa **uma** ação em todo o produto. `RotateCcw` é limpar marcações e nada mais; `Undo2` é desfazer e nada mais.
- Ícone destrutivo é `--ink-2` em repouso e `--sem-danger` apenas no `hover`/`focus`. Cor de alerta em repouso dessensibiliza.
- Ícone nunca é o único portador de significado: todo controle só-ícone carrega `title` e `aria-label`.
- Ícone de seção herda `--ink-3`; ícone de estado ativo herda `--accent`.

### 5.5 Auditoria de mapeamento ícone → ação

Quatro colisões encontradas no mapeamento atual. As duas primeiras são risco de uso, não estética.

**A1 — `RotateCcw` significa "Limpar Marcações".** O ícone é uma seta circular: em toda a indústria significa desfazer, refazer ou atualizar. Aqui ele dispara a ação **destrutiva** de apagar todas as marcações. Pior: em `Header.tsx` ele fica imediatamente ao lado de `Undo2` (desfazer último ponto), ambos a 17px. São duas setas circulares adjacentes, uma reversível e outra não. Em 17px a memória muscular não separa as duas. Trocar por `Eraser`, que não pertence à família de setas.

**A2 — `Ruler` tem dois donos.** É o alternador de réguas do canvas (`size 18`) e também o cartão de exportação "Por Semente (CSV)" (`size 20`, violeta). Duas ações sem relação, um ícone.

**A3 — O modal de exportação codifica formato por cor.** Seis matizes decorativas: `FileCheck2` esmeralda, `FileText` azul, `Table` teal, `Ruler` violeta, `Database` índigo, `FileJson` âmbar. A cor não carrega informação alguma — o rótulo do cartão já diz o formato. É a violação exata do §2: matiz de dados vazando para o cromo. Todos passam a `--ink-2`; a forma do ícone diferencia, e onde dois formatos são iguais (os dois CSVs) os ícones devem ser iguais, porque a diferença está no rótulo.

**A4 — Mesmo ícone, tamanhos incoerentes.** `History` aparece em 13, 17, 20 e 52px; `Save` em 14 e 18; `Download` em 14 e 15; `MousePointer` e `MousePointer2` coexistem para o mesmo conceito.

Trocas propostas, todas restritas a `.tsx` de apresentação:

| Ação | Hoje | Proposto | Motivo |
|---|---|---|---|
| Limpar marcações | `RotateCcw` 17 | `Eraser` 16 | sai da família de setas; deixa de imitar o Undo vizinho (A1) |
| Desfazer ponto | `Undo2` 17 | `Undo2` 16 | correto; só normaliza o tamanho |
| Aba "Contagem" | `Activity` 13 | `Target` 14 | `Activity` é traçado de batimento cardíaco |
| Painel de funcionalidades | `Sparkles` 17 | `FlaskConical` 16 | `Sparkles` virou taquigrafia de "IA"; `FlaskConical` já é usado 4× no projeto e é vocabulário de laboratório |
| Réguas do canvas | `Ruler` 18 | `Ruler` 16 | dono legítimo do ícone (A2) |
| Export "Por Semente (CSV)" | `Ruler` 20 violeta | `FileSpreadsheet` 20 `--ink-2` | libera `Ruler`; entra na família de arquivo (A2, A3) |
| Export "Tabela (CSV)" | `Table` 20 teal | `FileSpreadsheet` 20 `--ink-2` | mesmo formato, mesmo ícone; o rótulo diferencia (A3) |
| Demais cartões de export | 6 matizes | `--ink-2` | cor sem informação (A3) |
| Ponteiro | `MousePointer` + `MousePointer2` | `MousePointer2` | um conceito, um ícone (A4) |

### 5.6 A marca — Retículo

O produto ganha marca própria, e `logo.png` deixa de ser cópia do logo do grupo. As marcas GPEOrq e GPSEM permanecem como estão: são de terceiros e não se redesenham aqui.

Construção, em `viewBox` 32×32:

- Círculo central `r=12`, traço 1.6 — o campo da ocular.
- Quatro traços internos em N/L/S/O, de `r=8.5` a `r=11.5` — as marcas do retículo.
- Uma elipse `rx=5 ry=3` em `(15,17)`, rotacionada −30°, preenchida em `--accent` — a semente registrada no campo.

Reduz bem: em 16px sobrevivem o círculo, os quatro traços e a semente como massa. Monocromática, funciona em favicon, cabeçalho e ícone de PWA. O nome amarra a marca ao acento de cromo (§3.3), que é o mesmo retículo.

Assinatura tipográfica: `SEEDCOUNTER` em Archivo `wdth` 82 / 700 / +0.16em, caixa alta — o mesmo idioma de rótulo de instrumento definido em §4.

`theme-color` passa a grafite-950 (`#101719`), alinhado a `--surface-0` do tema escuro.

## 6. Layout

- **Raio — de 7 valores para 3:** `2px` controles e campos · `6px` painéis e modais · `999px` apenas pílulas de contagem. `rounded-3xl` sai.
- **Elevação — fio antes de sombra:** separação padrão é 1px em `--line`. Sombra reservada ao que flutua: modais e `ZoomControls`.
- **Densidade — grade de 4px:** toda medida é múltipla de 4. Espaçamento por `gap` no contêiner, nunca margem por elemento.
- **Foco da tela:** a contagem sai de item de lista dentro de `Counters` e passa a mostrador fixo no topo do trilho — número em Mono 38px, proporção viável/inviável em barra segmentada, controles recuando para `--ink-3`.

## 7. Especificação de gráficos

Aplica-se a `PlateViabilityChart`, `SessionTrendChart`, `GerminationBarChart`, `GerminationCurveChart` e `WilsonCIBar`.

- Cor lida de token (`var(--series-N)`), nunca hex literal.
- Eixo único. Nunca dois eixos Y.
- Grade recuada em `--line-soft`; eixo em `--line`.
- Texto do gráfico em tokens de tinta (`--ink-3`), nunca na cor da série.
- Legenda sempre presente com 2 ou mais séries; rótulo direto na ponta quando houver até 4.
- Numerais tabulares em todo valor.
- Tooltip com superfície e borda de token — o tooltip atual é `rgba(24,24,27,.95)` fixo e não acompanha o tema.
- `GerminationCurveChart` hoje faz `COLORS[index % COLORS.length]` com 6 cores: o 7º tratamento recebe a cor do 1º. Substituir pela atribuição em sequência com corte no teto de séries.

## 8. Implementação

### PR 1 — fundação (aprovado para execução)

| Passo | Arquivo | Mudança |
|---|---|---|
| 1 | `src/index.css` | adicionar a variante `dark` baseada em classe, para que `.dark` no elemento raiz passe a acionar as 1.144 classes `dark:` |
| 2 | `index.html` | `<link>` Google Fonts + `preconnect` |
| 2 | `src/index.css` | bloco `@theme` completo com todos os tokens da §3; `--font-sans` e `--font-mono` atualizados |
| 3 | `src/**/*.tsx` | substituir as 80 classes de tom inexistente pelo token de papel correspondente |
| 4 | `src/components/charts/*.tsx`, `src/features/stats/components/*.tsx` | hex literais para `var(--series-N)` e tokens de tinta |

Superfície estimada: ~6 arquivos de fundação mais a varredura das 80 classes.

Formatação: `npx prettier --write` apenas nos caminhos alterados por este PR — nunca `npm run format` (ver P1).

### PR 2 — cromo, ícones e marca

`Header.tsx`, `Sidebar.tsx`, `Counters.tsx`, `Footer.tsx`, `Toolbar.tsx`, `ZoomControls.tsx`: acento único, raio e elevação disciplinados, mostrador primário promovido.

Inclui, no mesmo PR:

- Escala de ícones e compensação de traço (§5.2, §5.3) aplicadas aos controles destes arquivos.
- Remapeamento ícone → ação (§5.5), incluindo a troca de `RotateCcw` por `Eraser` em "Limpar Marcações" e a retirada das seis matizes decorativas do `ExportModal.tsx`.
- Marca Retículo como SVG inline em `Header.tsx`, `public/logo.png` substituído, `theme-color` corrigido em `index.html`.
- Remoção do fragmento `<>` vazio de `src/App.tsx` (linhas 987 e 1287) e a reindentação que ela provoca, junto com o acerto de Prettier do arquivo — ver P3.

### PR 3 — canvas e painéis

`MarkingCanvas.tsx` e `ImageViewport.tsx` recebem palco e espécime. Painéis em `src/features/*` e modais passam a herdar o sistema.

### Coordenação entre agentes

Três agentes trabalham nesta árvore ao mesmo tempo: **Jules** (testes e `src/lib/`), **Antigravity** e **Claude** (interface e integração). O protocolo abaixo existe para que nenhum PR de estilo colida com trabalho de lógica.

**P1 — Formatar por caminho, nunca o repositório.** `npm run format` roda `prettier --write src`, ou seja, a árvore inteira. Em 2026-09-03 o `prettier --check src` reprova quatro arquivos: `src/App.tsx`, `src/features/ai-pointer/AiPointerPanel.tsx`, `src/lib/__tests__/stats.test.ts` e `src/lib/__tests__/calibration.test.ts`. Os dois últimos são território da Jules, com branches abertos. Um PR de estilo que rode `npm run format` reformata esses testes e gera conflito em todos eles — sem mudar comportamento nenhum. Regra: formatar apenas os caminhos que o PR já altera, com `npx prettier --write <caminho>`.

**P2 — Ramificar depois do merge.** `design/lab-identity` sai do `main` **depois** que o PR pendente entrar, nunca de um branch não mergeado.

Resolvido em 2026-09-03: o PR #20 foi mergeado (`a79b25c`), levando ao `main` o conserto do type-check e a promoção do export YOLO. O motivo da regra ficou explícito no processo — enquanto o merge não saiu, `origin/main` acumulava 4 erros `TS2300`, e ramificar dali tornaria o critério de aceitação nº 1 (`npm run lint` passa) inverificável por causa alheia. A regra tem duas faces: não ramificar de trabalho não mergeado, **e** não ramificar de uma base que não passa na própria verificação.

**P3 — O fragmento vazio do `App.tsx` pertence a este ciclo.** `src/App.tsx` abre um fragmento `<>` na linha 987 e fecha na 1287 sem nada entre ele e o elemento raiz — sobra de um bot da Vercel. Removê-lo reindenta ~300 linhas, o que enterraria qualquer mudança de lógica no diff. Como o `App.tsx` já reprova no Prettier e o PR 2 reescreve a camada de apresentação dele, os dois consertos são o mesmo movimento e saem juntos no PR 2. Nenhum outro agente precisa tocar nisso.

**P4 — Fronteira de arquivos.** PRs de estilo não alteram `src/lib/`, `src/hooks/`, `src/context/`, `src/types.ts` nem nada em `__tests__/`. PRs de lógica não alteram `src/index.css` nem tokens. Onde os dois precisarem do mesmo `.tsx`, o de lógica entra primeiro.

### Sistema existente a preservar

O commit `071dc7f` ("reorganiza interface em etapas", 2026-08-23, ancestral de `origin/main`) já estabeleceu a estrutura da barra lateral e o componente `CollapsibleSection`: etapa numerada, resumo exibido quando a seção está fechada, e estado de atenção para configuração pendente. Esse é sistema de design existente e permanece.

Este documento o ratifica em vez de substituí-lo. O rótulo em caixa alta com tracking que o `CollapsibleSection` já usa é exatamente o papel formalizado como *eyebrow* em §4; a pílula numerada da etapa passa a usar `--accent-tint`, e o estado de atenção passa a usar `--sem-warn`. A estrutura, o comportamento e a API do componente não mudam.

Nota: o commit `c32c9b7` ("feat: Add uncertain classification and redesign result summary", PR #19, já em `main`) altera apenas `finish_task_submission.py`. Não existe classificação "incerto" em `src/`. Este documento trata a viabilidade como binária (`src/types.ts:14`). Se a terceira classe for implementada no futuro, o par ciano/magenta admite um ponto neutro em `--ink-3` como estado intermediário.

## 9. Verificação

Critérios de aceitação para qualquer PR deste ciclo:

1. `npm run lint` (que já roda `tsc --noEmit`) passa.
2. `npm run test` passa sem alteração em nenhum arquivo de teste.
3. `git diff --stat` não toca `src/lib/`, `src/hooks/`, `src/context/`, `src/types.ts`.
4. Nenhuma assinatura de props alterada.
5. O alternador de tema muda a aparência da aplicação (verificação manual — hoje não muda).
6. Nenhum hex literal novo introduzido em `.tsx`; toda cor vem de token.
7. `git diff --name-only` não inclui nenhum caminho em `__tests__/` (P1).
8. `npx prettier --check` passa nos caminhos alterados pelo PR; nenhum caminho fora deles foi reformatado.
9. Nenhum tamanho de ícone fora de {14, 16, 20, 24}; todo ícone define `strokeWidth` conforme §5.3.
