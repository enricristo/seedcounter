# Degraus 2 e 3 — roteiro do que foi garimpado

**Data:** 2026-09-13
**Estatuto:** roteiro, não plano. Cada item vira plano de implementação (com código e testes) **quando chegar a vez** — planejar agora o que só se executa depois é desperdício e envelhece.

O que qualifica um item para entrar aqui: apareceu em algum spec, é pequeno o bastante para não virar frente própria, e tem um critério de aceite que dá para verificar. O que **não** entra: DuckDB, Zustand, três pipelines, QuadTree — voltam se uma medição pedir (ver `specs/2026-09-13-critica-do-scaleup.md` §2).

---

## Degrau 2 — depois do Degrau 1, mesma natureza (medida e curadoria)

| # | item | de onde veio | por que vale | aceite |
|---|---|---|---|---|
| 2.1 | **Registro de curadoria** — toda correção humana grava `origem`, `motivo`, `antes/depois` num diário da sessão | spec 03/09 "regras lógicas, nível 1" | é o dado que alimenta retreino; `yoloExport` já existe e passa a exportar junto; **pré-requisito** de tudo que aprende | diário no JSON da sessão; export YOLO leva o campo; teste: trocar classe gera entrada com `motivo: 'humano'` |
| 2.2 | **Regras sobre medida, editáveis** — "descartar < 0,4 mm", "razão C/L fora de 2–5 → suspeito" | spec 03/09 "nível 2" | é a versão **honesta** dos priors: regra que o agrônomo escreve e defende numa banca; `conferirForma`/`conferirEscala` já fazem o cálculo | painel com regras por espécie salvas no Dexie; cada regra gera sugestão via o motor existente; teste: regra `< 0,4 mm` marca um objeto de 0,3 mm |
| 2.3 | **Peneira comercial a partir do Feret** | doc 13/09 "Vetor B" | Feret mín mapeia em fenda (mm); é o uso concreto do Feret entregue no Degrau 1 | tabela de peneiras (5,0/5,5/6,0/6,5/7,0 mm para soja, referenciada) + histograma "quantas passam em cada"; teste: Feret 5,3 mm cai na 5,0 |
| 2.4 | **Histograma com alerta de clipping** | ToupView §3 | barato; diz ao operador que a exposição estourou antes de segmentar; o `ImageAdjustPanel` já desenha histograma | linha vermelha quando > 1% dos pixels em 0 ou 255; teste puro sobre `Histogram` |
| 2.5 | **Ghost preview da onda antes de confirmar** | doc 13/09 "hipótese com 50% de opacidade" — adaptado | a ideia de *pré-visualizar antes de aceitar* é boa mesmo sem três pipelines; hoje a onda aceita direto | ao passar o mouse com a ferramenta S, o contorno que a onda daria aparece a 50%; clique confirma; **medir** se a taxa de contorno rejeitado cai |
| 2.6 | **I4 — classes a partir da galeria** | ideias 09/09 | é a interface do TZ topográfico e das classes de forrageira; depende de Task 6 (taxonomia) | na galeria, selecionar N células e atribuir caminho; `consolidar` recebe as contagens por classe |
| 2.8 | **Leitor de TIFF** | Enrico, 13/09 | scanner de laboratório salva TIFF; hoje o app manda converter (`useImageQueue.ts`). Decodificar em `ImageData` e cair no mesmo fluxo do PNG. Uma dependência pequena (UTIF.js); 8/16 bits, LZW, multipágina → primeira página | fixture TIFF pequeno abre com largura/altura certas; TIFF 16 bits vira 8 bits sem estourar; mensagem de erro só para TIFF que a lib não lê |
| 2.9 | **Contorno: edição de nós à la Corel** | Enrico, 13/09 | o que existe: arrastar vértice (Shift = rígido), clique na borda cria nó, raspar por dentro (Shift acrescenta). Candidatos: apagar nó (Delete/duplo clique), suavizar um trecho, pincel de deformação com raio visível e ajustável por `[` `]`, **alternância acrescentar/remover sem segurar tecla** (segurar Shift com caneta é ruim) | **detalhar com o Enrico** quais gestos do Corel; cada gesto entra com teste de geometria puro |
| 2.10 | **Borracha: corrigir sem apagar** | Enrico, 13/09; ideias 09/09 | o que existe: apaga marcas inteiras no raio; Alt temporário. Candidatos: pré-visualização do raio; borracha que só remove contorno e mantém a marca; borracha só de ponto; desfazer por pincelada (histórico por gesto já existe) | **detalhar com o Enrico**; teste: raspar de fora reassenta o contorno sem perder a marca |
| 2.11 | **Identificador ao carregar (ensaio de parâmetros)** | Enrico, 13/09 — é o Oráculo do spec 13/09 na forma barata | ao carregar a imagem, o worker (Task 7) roda a onda com 2–3 conjuntos de parâmetros — e YOLO quando houver modelo para o que a pessoa disse que está olhando — e mostra cada resultado como miniatura lateral com contagem, mediana de área e Feret. A pessoa escolhe **uma ou nenhuma**; nada se aplica sem escolha. O que a pessoa informa (forma/espécie) escolhe os *defaults por forma*. Sequencial, num worker, uma vez — não três workers permanentes. Serve ao multicultura: numa espécie nova ninguém sabe o parâmetro certo; mostrar e deixar escolher é a resposta | depende de Task 7; com soja e orquídea as opções aparecem sem travar o arraste; escolher aplica; **medir** se a taxa de contorno rejeitado cai. O "se refinar" continua sendo 2.1 + 2.2 (registro e regras, explicáveis), nunca peso oculto |
| 2.12 | **Watershed opcional para semente redonda** | crítica 13/09 §2, reaberto pelo enquadramento multicultura | falha em alongado (medido), mas em redonda pode separar bem; a soja tem máscara de referência, então dá para medir de verdade | só entra se, na soja, separar mais pares certos do que fatiar sementes inteiras; nunca default para alongada/irregular |
| 2.7 | **Tolerâncias: UI de reconhecimento** | plano de normatização F2 | o mecanismo existe (`tolerancias.ts`), sem tela; **bloqueado** pela Tabela 4.1 não conferida | só depois de alguém conferir a tabela no Wikisda |

**Ordem sugerida:** 2.8 (TIFF, destrava o scanner) → 2.11 (assim que a Task 7 fechar) → 2.1 → 2.2 → 2.9/2.10 (depois de detalhar com o Enrico) → 2.3 → 2.4 → 2.5 → 2.6 → 2.12 (com a medição na soja). O 2.7 espera a conferência humana.

**Enquadramento (Enrico, 13/09):** a orquídea é o caso extremo, não a régua. Soja e trigo são datasets tranquilos onde ferramenta simples funciona e é útil. O padrão muda **por forma**, nunca por espécie; toda medição cobre o caso fácil *e* o difícil.

---

## Degrau 3 — captura ao vivo e hardware (só quando a lupa for fluxo principal)

| # | item | de onde veio | ressalva |
|---|---|---|---|
| 3.1 | **Travar exposição e balanço (UVC via `MediaTrackConstraints`)** | doc 13/09 §3.3, ToupView §1.2 | suporte falho em Firefox/Safari — o doc admite; fallback honesto é dizer "seu navegador não expõe" |
| 3.2 | **Anti-flicker 50/60 Hz** — exposição múltipla do período da rede | ToupView §1.2 | uma constante e uma dica; depende de 3.1 |
| 3.3 | **Flat field ao vivo em WebGL** | ToupView §1.1 | é `achatar-fundo.ts` para vídeo; o núcleo existe; WebGL só se o CPU não der 30 fps |
| 3.4 | **Focus peaking** (Laplaciano no shader) | doc performance §2 | útil na lupa; irrelevante no scanner |
| 3.5 | **Calibre por linhas paralelas e círculo por 3 pontos** | ToupView §2 | ferramentas de medição manual; a régua de 2 pontos existe; Feret já dá a largura ortogonal automaticamente, então o calibre manual serve para *conferir* |
| 3.6 | **Pedal HID para congelar quadro** | doc 13/09 "Vetor A" | pequeno; só com pedal físico para testar |
| 3.7 | **PMS completo (Cap. 9)** e **emergência de radícula** | plano de normatização F4/F5 | frentes normativas inteiras; cada uma é um plano próprio |

---

## O que ficou explicitamente de fora, e por quê

| proposta | motivo | volta se |
|---|---|---|
| DuckDB-Wasm | 25 MB para consultas que o Dexie responde em ms; centenas de objetos por imagem | alguma consulta medir > 500 ms no Dexie |
| Migração para Zustand | reescrever estado de app com 766 testes sem jank medido | `performance.now()` mostrar reconciliação > 16 ms no arraste |
| Três pipelines paralelos (Oráculo) | triplica custo; contradiz o fluxo medido (humano localiza, máquina mede); OOM em tablet | **voltou na forma barata como 2.11**: sequencial, num worker, ao carregar, uma vez; a pessoa escolhe |
| Watershed | falha estrutural em objeto alongado; concavidade mede 95,8% dos pares | nunca para forrageira/orquídea; **para redonda é o 2.12**, com gate medido na soja |
| QuadTree / Path2D cache | maior imagem tem 104 objetos | uma imagem com > 1.000 contornos travar o hover |
| ΔE00 como veredito de TZ | critério da norma é topográfico | nunca como veredito; ColorChecker entra como calibração de cor, sem promessa |
| "Segurar Alt mostra overlay técnico" | **Alt já é borracha temporária** (`useTools`) — conflito registrado em memória | outra tecla |
