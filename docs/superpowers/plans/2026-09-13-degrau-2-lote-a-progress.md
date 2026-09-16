# Degrau 2 — Lote A — progresso

Plano: `2026-09-13-degrau-2-lote-a.md`. Cada agente acrescenta a linha da sua tarefa ao terminar (commit com pathspec, só este arquivo e os seus).

| task | commit | status | nota |
|---|---|---|---|
| A0 soja medida | (doc, sem código) | feito | `docs/datasets/medicao-limiar-populacao-soja.md`. 20 digitalizações (seed 42, 7/7/6 entre variedades), 2.114 sementes avaliáveis; falso alarme 0,0% (mediana e média) nos três limiares — absoluto, população e irregular. Ramo 1 da regra de decisão: "população é o default para toda forma; presets absolutos viram referência", nada muda no código. Sem OpenCV/skimage disponíveis, contorno extraído por traçado de borda próprio (Moore-neighbor tracing), validado contra quadrado e círculo sintéticos antes de rodar no conjunto real. Desvio documentado: dataset não amarra instância a digitalização por nome de arquivo (ao contrário do que o plano supunha); "digitalização" foi aproximada por blocos contíguos do tamanho real de cada variedade (30/45/47) — ver nota de desvio no próprio doc. |
| A1 TIFF | (ver `git log --oneline -1 -- src/lib/tiff.ts`) | feito, falta teste humano no navegador | 5/5 testes de `tiff.test.ts`, 795 no total (as 4 falhas de `synthetic-scene.test.ts` são da A2, em andamento por outro agente); tsc e eslint limpos nos arquivos tocados (só o warning pré-existente de `exhaustive-deps` em `handlePrevImage`, linha não tocada). `@types/utif` não foi preciso: `tsconfig.json` não tem `noImplicitAny`/`strict`, então `import UTIF from 'utif'` compila sem tipos. `toRGBA8` reduz 16→8 pegando o byte alto de cada amostra (`data[off+2*i+1]`, ver `UTIF.js` linha 1010): 0→0, 0x8000→128, 0xFFFF→255, exatamente como o teste espera — nenhum ajuste na asserção. Desvio no teste: o `tiffMinimo` do plano gravava `BitsPerSample` com 1 valor só; `UTIF.toRGBA8` usa `t258.length` (não `SamplesPerPixel`) para saber quantos canais tem o pixel RGB, então o teste de 8 bits RGB falhava (tudo zero) até o fixture passar a gravar uma entrada de `BitsPerSample` por amostra (offset fora do IFD quando não cabe inline) — comportamento confirmado contra o próprio `UTIF.encodeImage`, que sempre grava `t258:[8,8,8,8]`; fixture corrigido, não a asserção. Verificação humana no navegador **pendente** (instrução do Enrico: sem Playwright neste lote) — roteiro abaixo. |
| A2 cena: rótulos, contorno, comporCena | (ver `git log --oneline -1 -- src/lib/synthetic-scene.ts`) | feito | 798/798 testes (16 em `synthetic-scene.test.ts`), tsc e eslint limpos nos dois arquivos tocados. `rotulos` virou `Uint8Array` (o `Int32Array` interno já existia; só passou a ser exposto e a caber em 1 byte, porque `id` nunca passa de umas poucas centenas nestas cenas). `contorno` por semente: elipse paramétrica, 64 pontos, coordenadas absolutas — calculado na criação, não depende do desenho. `comporCena`/`iouDeMascaras` reusam `criarRng` e a mesma amostragem por rejeição (posição aleatória + rejeita por colisão de caixa com `margem`), sem duplicar a lógica de `gerarCenaSintetica`. `quantidade: 0` já funcionava sem mudança (o laço de posicionamento simplesmente não entra) — nenhuma linha nova precisou disso. Desvio registrado no teste da onda: com `janela: 128` o resultado media 0/4 (IoU sempre ~0,53) — o preset soja tem semieixo `a` ≈ 108±11% (até ~120 px) e meia-janela 64 é MENOR que isso, então a janela termina dentro da própria semente e a onda confunde a rampa de sombreamento interna (curvatura de `desenharSoja`) com a borda real. Subi a janela do teste para 320 (meia-janela 160, folga de 40+ px além do semieixo maior); com isso a fração medida foi **100% (4/4 e, em 10 sementes de rng testadas à parte, sempre 1,0)** — acima do piso de 95% do plano. Também registrado: com `lado: 600` e este preset, a amostragem por rejeição nunca coloca as 20 sementes pedidas (só cabem 2–4, dependendo da semente) — o teste mede a fração sobre o que de fato coube, não sobre 20; isso é geometria da cena, não bug da onda. |
| A4 fixtures reais | — | **interrompida (crédito), sem arquivo escrito** | A2 fechou (25d85d3); redespachar do zero com a instrução: licença não é gate, soja entra |
| A3 ensaio ao carregar | (ver `git log --oneline -2 -- src/features/ensaio src/App.tsx`) | feito, falta teste humano | 815/815 testes, tsc e eslint limpos (`src/features/ensaio`, `flags.ts`, `App.tsx`, `onda-no-canvas.ts` — este último não precisou de mudança, já aceitava `OpcoesDaOnda`), build ok. Dois desvios de assinatura contra o plano: `analisarContorno(contorno, referenciaDeArea, limiares)` tem a referência de área como 2º parâmetro (não os limiares) — `resumir()` chama `analisarContorno(c, NaN, limiares)`; e `DetectionOptions.sensitivity` é 0–100 (padrão 50), não 0–1 — as três receitas usam 50/70/35. `segmentarNoCanvas` já aceitava `OpcoesDaOnda` como 3º parâmetro; nada a acrescentar em `onda-no-canvas.ts`. O painel entra na aba Inspetor (não flutuando ao lado do canvas como o texto original do plano descrevia) — instrução explícita do despacho, porque a lateral esquerda hoje é abas (`rightSidebarTab`), mudança posterior ao plano. `onImageLoaded` usa o parâmetro `img` (a imagem recém-carregada), não `imagemDeTrabalho ?? img`: no fecho daquele callback `imagemDeTrabalho` ainda é o valor do render anterior (da imagem que está saindo da fila), então usá-lo arriscaria rodar o ensaio sobre a imagem errada. Teto de 400 pontos por receita implementado em `App.tsx` (não em `executar.ts`, que não localiza nada) — campo `limitado?: boolean` acrescentado a `ResultadoDoEnsaio` e preenchido por quem chama. |
| A5a exemplos reais: assets + catálogo | — | bloqueada | precisa: imagem de orquídea liberada pelo Enrico; licença do Mendeley conferida |
| A5b exemplos reais: botões + referência | — | pendente | espera Task 8 |
| C3 eixos + auditoria de medida | (ver `git log --oneline -- src/lib/eixos.ts scripts/auditar-regua.py docs/datasets/auditoria-de-medida.md`) | feito (C3.1, C3.2, C3.4); C3.3 adiada | 815/815 testes (7 novos em `eixos.test.ts`), tsc e eslint limpos nos arquivos tocados, build ok. **C3.1:** `src/lib/eixos.ts` (`eixosDoContorno`) duplica a PCA de `calculateSeedDimensions` para expor os segmentos (não só os comprimentos) e reimplementa Feret com pontos reais (não só `{maximo,minimo}`); `EixosOverlay.tsx` desenha os dois eixos PCA (traço contínuo) e os dois Feret (tracejado) do contorno selecionado, com rótulo "≠" quando a discordância relativa passa de 15% — `MarkingCanvas` ganhou a prop `mostrarEixosDeTodos` (default `false`) para desenhar em todo contorno visível sem rótulo. **C3.2:** `scripts/auditar-regua.py` mediu `digitalizar0001.jpg` (a única digitalização do lote com régua enquadrada) — 1864 px para 10 mm por detecção automática (perfil de coluna escura, 27 marcas) e 1895,3 px por conferência manual; DPI declarado 3600 → DPI efetivo ≈ 4735–4814, desvio +31,5% a +33,7%. Acima de 1%: o DPI declarado NÃO é o efetivo — ver `docs/datasets/auditoria-de-medida.md` para o que o app deveria avisar (não implementado; é UI). **C3.3** (PCA×Feret contra máscara da soja) fica para quando os fixtures da A4 existirem. **C3.4:** lidos `measurements.ts`, `calibration.ts`, `pca-utils.ts`, `detect.ts`; das 5 suspeitas da spec, 4 não são furo (área px² já eleva µm/px ao quadrado; `detect.ts` desfaz o `scale` do processamento reduzido antes de devolver o contorno; `width`/`height` já são recalculados em todo handler de edição de vértice em `App.tsx`, e `buildMeasurements` nunca lê o campo gravado — sempre recalcula do polígono atual; nenhuma unidade misturada) e 1 é lacuna real e não implementada (TIFF não lê `XResolution` do cabeçalho — exigiria acoplar em `App.tsx`, fora do escopo). Nada em `src/lib/` foi alterado por essa leitura: nenhuma suspeita provou um teste que falhasse. |

## Medições registradas

- **Falso alarme de `limiaresDaPopulacao` na soja indonésia (Task A0):**
  20 digitalizações amostradas (seed 42, balanceadas 7 Anjasmoro / 7 Dega /
  6 Grobogan), 2.114 sementes avaliáveis. Neste conjunto as sementes nunca
  se tocam (dispostas em grade à mão), então a fração acusada por qualquer
  limiar é diretamente o falso alarme.
  - absoluto (`PADROES`): mediana **0,0%**, média **0,0%**
  - população (`limiaresDaPopulacao`): mediana **0,0%**, média **0,0%**
  - `LIMIARES_DE_CONTORNO_IRREGULAR` (só registro): mediana **0,0%**, média **0,0%**
  - solidez: p5 0,990 · p50 0,992 · p95 0,994 — margem grande acima de
    qualquer um dos três limiares (o mais apertado, o da população, ficou em
    ~0,956–0,958).
  - decisão: ramo 1 da regra do plano — população é o default para toda
    forma; nada muda no código. Detalhe completo, tabela lado a lado com a
    orquídea e a nota de desvio (dataset não amarra instância a
    digitalização por nome de arquivo) em
    `docs/datasets/medicao-limiar-populacao-soja.md`.
  - script: `medir_limiar_populacao_soja.py` (scratchpad da sessão; não
    commitado — medição ad-hoc de checkpoint, não parte do código do produto)

(falta: duração de cada receita do ensaio; números dos fixtures reais)

## A1 TIFF — roteiro para o Enrico testar no navegador

Gerados a partir de `public/icon-512.png` (512×512) com Python/PIL, no scratchpad da sessão
`C:/Users/ambro/AppData/Local/Temp/claude/c--Users-ambro-Documents-seedcounter-git/091b39a2-879d-44af-93c7-a1c8c6e9dab3/scratchpad/`:
`teste-8bits-rgb.tif` (RGB 8 bits), `teste-16bits.tif` (`mode='I;16'`, 16 bits) e `invalido.tif` (texto renomeado).
Sanidade já conferida por script Node ad-hoc: `decodificarTiff` abre os dois primeiros (512×512, pixels não-zero) e devolve `null` para o inválido — falta só o navegador.

1. `npm run dev`, abrir `http://localhost:3000/`, arrastar `teste-8bits-rgb.tif` para a área de carregar imagem — esperado: a imagem aparece (o ícone do app em 512×512), sem mensagem de erro nem console vermelho; testar a onda (tecla `S`, clicar num ponto de contraste do ícone) e ver se ela produz um contorno.
2. Repetir com `teste-16bits.tif` — esperado: mesma imagem, agora em cinza (é escala de cinza 16 bits), abre igual, sem tela em branco nem exceção no console.
3. Arrastar `invalido.tif` — esperado: mensagem de erro do tipo `Não foi possível abrir "invalido.tif" (...)`, nunca silêncio (sem imagem e sem aviso).

## A3 — roteiro para o Enrico

1. Ligue a flag `ensaioAoCarregar` no ícone de frasco (painel de flags experimentais) — vem desligada por padrão.
2. Abra o exemplo "Soja" e, depois, uma imagem real de orquídea de `docs/datasets/` (ou do que estiver disponível) — em cada uma, espere os três cartões (Padrão, Sensível, Conservador) aparecerem na aba Inspetor.
3. Teste os três caminhos: "Usar esta" num cartão preenche a lista de sementes com aquela receita; "Nenhuma" fecha o painel sem deixar contorno nenhum; "Parar" no meio do ensaio interrompe antes da terceira receita.
4. Anote, para as duas imagens, a linha `console.info('[ensaio] <id>', ms)` de cada receita (abra o console do navegador antes de carregar a imagem).
5. Conte à mão as sementes de cada imagem e compare com a contagem de cada uma das três receitas — a diferença é o dado que falta para decidir se a flag pode ligar por padrão.

## C5 — roteiro para o Enrico

1. Ligue `ensaioAoCarregar` e `assistedDetection` no painel de flags. Abra um exemplo real de soja (`Exemplos` → Soja). Na lateral esquerda, dentro de "Encontrar objetos", confira a ordem: **Encontrar** primeiro, **Modelo (IA)** depois — e recolhido, porque a espécie não é orquídea.
2. Espere os cartões do ensaio na aba Inspetor (agora podem ser 3, 4 ou mais: as três fixas mais "Pela espécie: Soja" quando a soja é reconhecida). Clique "Usar esta" num cartão — os contornos entram na contagem, e os controles do painel Encontrar mudam para os valores daquela receita.
3. No painel Encontrar, mude "Tamanho mínimo" para a aba "× mediana" e arraste o valor — em menos de 1 segundo o fantasma tracejado no canvas deve mudar sozinho (sem precisar clicar em nada), mostrando a nova proposta. Confira a frase abaixo do campo: deve mostrar o valor em px² e, se a imagem estiver calibrada, também em mm².
4. Clique "Aplicar" — o fantasma vira contorno de verdade (linha sólida) e entra na contagem, exatamente como "Usar esta" faria.
5. Digite um nome em "Salvar como receita" e clique "Salvar". Recarregue a página (F5), abra outro exemplo de soja com o ensaio ligado — a receita salva deve aparecer como mais um cartão do ensaio, ao lado dos três fixos.
6. Abra um exemplo de orquídea — confira que "Modelo (IA)" aparece expandido por padrão (a espécie contém "orqu"), e "Encontrar" continua primeiro.
7. Na seção "Remover fundo" do Encontrar, confira que o número muda sozinho conforme a mediana de área muda (é "2 × o raio esperado"); clique "Auto" depois de arrastar manualmente para conferir que ele volta a seguir a mediana.
8. Na seção "Fundo" no topo do painel, confira a frase ("Fundo claro, objeto escuro" ou o inverso) e clique "Inverter" — a proposta deve rodar de novo com a polaridade trocada.

## C1 — roteiro para o Enrico

1. Abra 3 imagens reais na fila (arraste os 3 arquivos juntos, ou use "Exemplos" mais de uma vez — qualquer jeito que deixe `imageQueue` com 3 itens). Na lateral direita, abra a aba **Lote** (ícone de camadas, ao lado de Datasets).
2. Em "Fonte", confira que **Fila de imagens** já vem selecionada (as outras duas — Regiões, Pasta — mostram "indisponível" quando não há imagem aberta ou pasta aberta, e ficam desabilitadas até isso mudar). Em "Receita", escolha **Padrão**.
3. Clique **Rodar**. Acompanhe "Processando 1/3", "2/3", "3/3" — cada imagem é decodificada, localizada e a onda roda ponto a ponto, uma imagem de cada vez (não em paralelo).
4. Confira a tabela: uma linha por imagem, com contagem/viáveis/inviáveis/suspeitos/duração. Se alguma imagem falhar (arquivo corrompido, por exemplo), a linha dela mostra o erro em vez dos números, e as outras linhas continuam normais — o lote não para por causa de uma imagem ruim.
5. Clique **Exportar CSV** — confira que o arquivo baixado abre no Excel com `;` separando colunas e vírgula decimal nos números (não ponto).
6. Clique **Aceitar** numa única linha — a linha vira "aceita" (não pode aceitar de novo). Abra o histórico de sessões (ícone de relógio) e confira que apareceu uma sessão nova com o nome daquela imagem, a contagem batendo com a linha da tabela, e a miniatura da imagem. Abra a sessão e confira, no formulário de metadados (ou exportando), que `metadata.receita.id` é `"padrao"`.
7. Teste **Parar**: rode de novo com mais imagens na fila (ou uma pasta grande do explorador) e clique Parar no meio — a tabela deve conter só as imagens processadas até ali, sem travar a aba.
8. Teste a fonte **Regiões da digitalização atual**: abra uma digitalização de scanner (uma imagem grande), mude "Pedaços" para, por exemplo, 6, e rode — a tabela deve ter 6 linhas, uma por região recortada.

## Ponto de parada — 2026-09-13, fim do crédito

- Fechadas: A0 (c7c4406), A1 (a2f83dd), A2 (25d85d3 + 80b9677). Degrau 1 inteiro fechado (Task 7 f5d7a32, Task 8 0a1d05f).
- Interrompidas antes de escrever qualquer arquivo: A3, A4. Árvore limpa. Redespachar as duas quando houver crédito; o prompt de cada uma está no histórico da sessão e o plano é autossuficiente.
- Não iniciadas: A5 (exemplos reais; redesenhada como Lote B), Lote B inteiro (B1 e B2 podem ir em paralelo).
- Testes humanos pendentes: arraste durante inferência (degrau-1-progress §roteiro), TIFF (seção A1 acima), cronometragem do radial (degrau-1-progress §roteiro).
- Estado: 798 testes, tsc limpo, build ok.
