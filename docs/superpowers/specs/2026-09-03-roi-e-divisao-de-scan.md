# ROI e divisão de scan — requisitos capturados

- **Data:** 2026-09-03
- **Status:** requisitos capturados, **ainda não desenhados**. Não implementar antes de passar por brainstorming.
- **Origem:** pedido do usuário em uso real, durante o ciclo de design Bancada Óptica.

> Este documento existe para que os requisitos não se percam entre ciclos. Ele **não** é uma spec aprovada: não define arquitetura, componentes nem plano. As duas funcionalidades são **funcionais**, portanto fora do escopo "zero mudanças funcionais" do ciclo de design em andamento.

## 1. Dividir o scan em N

**Problema.** Ao digitalizar placas no scanner de mesa, a imagem resultante é muito grande e contém várias amostras. Hoje o pesquisador recorta fora do app, salva cada pedaço e carrega um por um.

**Comportamento desejado.** Carregar a imagem grande, delimitar a região útil, escolher em quantos pedaços dividir, e ter todos os pedaços **já na fila de imagens** do app, prontos para contagem sequencial.

**Referência.** `C:\Users\ambro\Documents\orchid-seed-analyzer_git\orchid-seed-analyzer\image_splitter_app.py` — protótipo em Tkinter, 246 linhas.

Geometria do protótipo:

| Constante | Valor |
|---|---|
| `RECT_ORIG_W` × `RECT_ORIG_H` | 5676 × 1892 px (região útil, retângulo arrastável) |
| `SUB_ORIG_W` × `SUB_ORIG_H` | 946 × 946 px (cada pedaço) |
| Grade resultante | 6 colunas × 2 linhas = **12 pedaços** |

O laço em `split_and_save` percorre `range(0, orig_rect_h, SUB_ORIG_H)` × `range(0, orig_rect_w, SUB_ORIG_W)`, recorta com `img.crop(box)` e grava arquivo por arquivo.

**O que o usuário pediu de diferente.** Não tão rígido quanto o protótipo: em vez de tamanho de bloco fixo, informar **quantos pedaços** (ou quantas colunas × linhas) e o app calcula a grade. "Definir em quantas seções quer que divida e automaticamente cria as seções para aquela quantidade."

**Fato relevante do código atual.** O SeedCounter **já tem fila de imagens** (`src/hooks/useImageQueue.ts`, com os botões Anterior/Próxima no cabeçalho). O divisor não precisa criar nada disso — só alimentar a fila. Isso reduz muito o tamanho da funcionalidade.

**Questões em aberto para o brainstorming.**

- A região útil é arrastável pelo usuário, detectada automaticamente, ou a imagem inteira por padrão?
- Sobra que não fecha a grade: descarta, inclui parcial, ou ajusta a grade?
- Os pedaços entram na fila apenas em memória, ou também viram arquivos exportáveis?
- Como o nome de cada pedaço se relaciona com placa/quadrante nos metadados? Há chance de preencher `quadrant` automaticamente.

## 2. Recorte circular de região de interesse (ROI)

**Problema.** Ao capturar direto pela câmera acoplada à lupa/estereomicroscópio, o campo útil é circular (o campo da ocular) e a imagem traz muita área irrelevante em volta.

**Comportamento desejado.** Delimitar um círculo sobre a imagem, definindo a região de interesse, e recortar por ele.

**Valor além do recorte — e é o principal.** A ROI deve informar **onde** a detecção assistida e o YOLO aplicam segmentação. Restringir a inferência ao campo útil reduz falso positivo na borda da placa e no fundo, e reduz o custo de inferência.

**Fatos relevantes do código atual.**

- `detectWithYolo` (`src/lib/yolo-onnx.ts:493`) aceita `HTMLImageElement | HTMLCanvasElement`, então uma ROI já recortada para canvas entra sem mudar a assinatura.
- `src/lib/detect.ts` implementa a detecção assistida clássica e também precisaria conhecer a ROI.
- `MarkingCanvas` já desenha sobreposições em SVG sobre a imagem, então o círculo de ROI tem onde viver.

**Questões em aberto para o brainstorming.**

- A ROI recorta a imagem de fato, ou vira uma máscara que só limita a detecção? As duas coisas têm consequências diferentes para medidas e para o relatório.
- Se recorta: a calibração µm/px acompanha o recorte?
- Só círculo, ou também retângulo e polígono livre?
- A ROI é por imagem, ou persiste entre imagens da mesma fila? Numa fila vinda do scanner, a mesma ROI provavelmente serve para todas.

## Relação entre as duas

Compartilham o conceito de **região de interesse**: uma para "recortar para contar em pedaços", outra para "restringir onde segmentar". Vale desenhá-las juntas para que a ROI seja um conceito só no código, com dois usos, em vez de duas implementações paralelas.

## Ordem sugerida

O divisor de scan primeiro: é menor (a fila já existe), resolve um atrito diário com o scanner, e não depende de decisão sobre máscara versus recorte.
