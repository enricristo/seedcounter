# Segmentação de instâncias e curadoria assistida — requisitos capturados

- **Data:** 2026-09-03
- **Status:** requisitos capturados, **ainda não desenhados**. Não implementar antes de passar por brainstorming.
- **Origem:** pedido de Enrico S. Ambrosio, em uso real do SeedCounter.

## Procedência dos números citados

Os valores abaixo vêm do dossiê `orchid-seed-analyzer/pdf_apresentacao.pdf` — apresentação do **TCC de Paulo Motta** (XXIII Congresso Brasileiro de Sementes; Motta, Pazoti, Machado Neto & Ambrosio), projeto no qual Enrico participou **conceitualmente**. Aquele trabalho foi descontinuado; a continuação acontece aqui, no SeedCounter.

Registrar isso importa por duas razões: atribuição acadêmica, e porque os números são de **outro protótipo, em Python com PyQt6** — não medem o SeedCounter. Servem de linha de base a superar ou reproduzir, não de resultado herdado.

> Duas ideias que Enrico pediu para tratar "com calma". Este documento existe para que não se percam e para que o desenho parta do que já foi medido, não do zero.

## Linha de base do protótipo em Python

Medida em `Cattleya` spp. Qualquer coisa que o SeedCounter fizer no navegador precisa ser comparada contra isto.

| Valor | O que é |
|---|---|
| **91,9%** | mAP@0.5, métrica principal, no conjunto de teste |
| 0,939 / 0,898 | AP por classe: viável / inviável |
| 84,6% | precisão geral |
| **34 de 926** | viáveis lidas como inviáveis — **3,7% de falsos negativos** |
| 1.614 | sementes anotadas no teste (926 viáveis + 688 inviáveis) |
| 280 → 198 | imagens adquiridas → efetivamente anotadas |
| 122 / 38 / 38 | divisão treino / validação / teste |
| 610 | amostras de treino após augmentation ×5, **só no treino** |
| **946×946 px** | ladrilho padronizado; ROI recortada em grade **6×2 = 12** |
| **3600 DPI** | resolução do scanner ⇒ **1 px ≈ 7,06 µm** |
| 1,17 × 0,34 mm | comprimento × largura médios (165,21 × 48,29 px, eixos do PCA) |
| 283 · 72,79% | lote de referência: 206 viáveis + 77 inviáveis |

Inferência: `imgsz=960, conf=0.45, iou=0.5, agnostic_nms=True`. O NMS agnóstico remove sobreposições **entre classes diferentes** — impede que a mesma semente seja contada como viável e inviável ao mesmo tempo.

**O número que mais importa é o 3,7%.** Em conservação de germoplasma, um falso negativo é risco de descartar material vivo. Qualquer mudança no modelo ou no fluxo precisa ser avaliada contra ele, não contra o mAP.

## 1. Segmentação de instâncias — por que tem valor

O usuário identificou corretamente que o valor está em delimitar **cada semente como indivíduo, mesmo sobreposta**. O dossiê explica por quê, e a razão é geométrica, não estética:

> "Precisamos da geometria, não só da posição. A máscara pixel a pixel é o que permite o PCA medir comprimento e largura reais; uma caixa retangular não daria isso, e em sementes inclinadas superestimaria as dimensões."

E a consequência que fecha o argumento:

> "Como os eixos vêm da própria semente, a medida não muda se ela estiver torta na lâmina. Uma *bounding box* alinhada à imagem mudaria."

Ou seja: **a máscara não é um detalhe do modelo, é o que torna a morfometria válida.** Sem ela, comprimento e largura dependeriam de como a semente caiu na lâmina.

### Estado no SeedCounter

Já existe mais do que parece:

- `src/lib/yolo-onnx.ts` roda YOLOv8-seg no navegador e devolve `polygon` por detecção.
- `src/lib/pca-utils.ts` tem `calculateSeedDimensions`, que é o PCA sobre os pontos do polígono.
- `MarkingCanvas` desenha os polígonos, com clique para trocar classe e excluir.
- `src/lib/measurements.ts` exporta medidas por semente em CSV e SQL.

**O que falta é confiança, não capacidade.** A flag `aiPointer` está desligada por dois motivos já registrados: a morfometria não foi validada contra medição manual, e em produção o modelo servido é o int8, cuja quantização degrada a classificação (fp32 24/5 contra int8 7/9 na amostra `3_Lab1`).

### Questões em aberto

- Servir o fp32 (105 MB) muda a decisão de desligar a flag? Qual o custo real de download num laboratório?
- A morfometria do navegador bate com a do protótipo em Python nas mesmas imagens? Isso é um experimento, não uma opinião — dá para rodar e comparar.
- `agnostic_nms` está ativo na inferência do navegador? Se não, a mesma semente pode aparecer nas duas classes.
- A validação contra medição manual precisa de quantas sementes para ter significância?

## 2. Curadoria assistida com regras — "eu clico, ele aprende"

O usuário descreveu: marcar uma região onde está a semente, o app identifica, e a partir das aceitações e recusas vai formando regras.

**O protótipo em Python já tem a metade humana disto**, e o dossiê a nomeia:

> **Human-in-the-loop** — "A IA propõe, o especialista audita: duplo-clique troca a classe, DEL exclui. Cada edição fica registrada (`edited`) no JSON."

O registro do que foi editado é a peça que falta no SeedCounter, e é ela que transforma correção em dado de treino.

### Três níveis, do mais barato ao mais caro

Vale separar, porque o primeiro entrega valor sem modelo nenhum:

**Nível 1 — registrar a curadoria.** Toda correção humana (troca de classe, exclusão, marca adicionada onde a IA não viu) grava o motivo e a origem. Isso já produz o dado que alimenta o retreino, e aproveita o `yoloExport` que já existe. Não precisa de aprendizado nenhum.

**Nível 2 — regras sobre as medidas.** Com PCA já calculado, dá para expressar regra em unidade que o agrônomo entende: "descartar objetos com comprimento < 0,4 mm" ou "marcar como suspeito o que tiver razão comprimento/largura fora de 2:1 a 5:1". O lote de referência dá os limites: 1,17 × 0,34 mm de média. Regras assim são **auditáveis e explicáveis**, ao contrário de um limiar de confiança.

**Nível 3 — aprender com o clique na sessão.** A partir das aceitações e recusas do usuário, ajustar o limiar ou reordenar as propostas *dentro daquela sessão*. É o mais próximo do que o usuário descreveu e o mais caro: precisa de desenho cuidadoso para não virar uma caixa-preta que o pesquisador não consegue justificar num artigo.

### O critério de anotação precisa estar no app

O dossiê fixa a regra que o modelo aprendeu, e ela hoje não aparece em lugar nenhum da interface:

- Núcleo com **qualquer grau** de vermelho → **viável**
- Núcleo branco ou opaco → **inviável**
- Semente **visivelmente vazia** (sem núcleo) → **não anotada**, tratada como fundo

A terceira linha é uma decisão metodológica com consequência: o modelo distingue sementes **que têm embrião**, não estima quantas do lote estão cheias. Quem usar o app sem saber disso vai interpretar o número errado.

### Questões em aberto

- O registro de curadoria entra no JSON da sessão, no export YOLO, ou nos dois?
- Uma correção humana deve mudar a contagem imediatamente ou entrar como "pendente de revisão"?
- Regras de medida ficam por espécie? `Cattleya` tem 1,17 mm; outra espécie muda tudo.
- Como mostrar ao usuário por que o app propôs algo, sem transformar a tela num painel de depuração?

## 3. Ganho imediato, independente das duas ideias

**Calibração a partir do DPI do scanner.** O dossiê registra 3600 DPI ⇒ 7,06 µm/px. A conta é `25400 / DPI`. Hoje a calibração é medida à mão com a régua, o que é um passo a mais e uma fonte de erro em toda digitalização — quando o valor é determinístico e o scanner já o conhece.

Um campo "DPI da digitalização" no painel de calibração eliminaria isso. É pequeno, é exato, e serve a todos que forem usar scanner: o acervo do Nelson, os colaboradores futuros.

## Relação com o que já foi entregue

O divisor de digitalização implementado em 2026-09-03 **reproduz a metodologia publicada**: o modo de lado fixo em 946 px e a grade 6×2 são exatamente o pré-processamento do TCC. Isso não foi coincidência de projeto — foi descoberto ao inspecionar `DFhandPSOL1 - Copia.jpg`, que já é um ladrilho de 946×946.

Consequência prática: os pedaços que o app produz agora são **compatíveis com o banco de imagens existente**, e podem entrar no mesmo conjunto de treino sem reprocessamento.
