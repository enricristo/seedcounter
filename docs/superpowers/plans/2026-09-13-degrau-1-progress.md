# Degrau 1 — progresso

Rastreador vivo. Atualizado ao fim de cada tarefa, para uma sessao nova
retomar sem reconstruir contexto. Plano: `2026-09-13-degrau-1-fundacao-medida.md`.

| tarefa | estado | commit | quem | observacao |
|---|---|---|---|---|
| 1. handleProposeCut so seleciona | feito | 60a14ad | agente | 781 testes, tsc e eslint limpos (0 erros, so 3 warnings pre-existentes em App.tsx sem relacao); commit MISTO com a Tarefa 5 por corrida de `git add` concorrente — meu `git add` so tinha `src/App.tsx` e o teste novo, mas outro agente ja tinha `src/features/ai-pointer/AiPointerPanel.tsx` e `src/lib/criterio-do-modelo.ts`/teste staged quando rodei `git commit` (sem pathspec, na epoca); conteudo integro (ver `git show --stat 60a14ad`), so a mensagem do commit e a da Tarefa 1 |
| 2. priors vira referencia + commit do inspetor | feito | 2741889 | agente | 780 testes, tsc e eslint limpos nos 2 arquivos tocados; commit feito com pathspec explicito (`git commit -m ... -- <arquivos>`) apos a correcao de protocolo, entao ficou limpo — so os 4 arquivos da Tarefa 2 (`src/lib/priors-morfometricos.ts`, seu teste, `SeedInspector.tsx`, `docs/datasets/README.md`); `src/App.tsx` nao teve diff no commit porque ja tinha sido commitado inteiro na Tarefa 1. Adaptacao: `MetricasContorno` foi mantida (nao pedida para remover, so os tipos/funcoes de veredito); `especieId.toLowerCase()` mantido em `compararComPerfil` como no `diagnosticarContorno` original |
| 3. Feret | feito | 1584bf5 | agente | 782 testes (feret.test.ts 6/6, elipse bateu com a PCA de primeira — indicesDoFechoConvexo ja devolve ordem correta, sem precisar investigar); tsc e eslint limpos nos 4 arquivos; measurements.test.ts nao existia (so measurements-mm.test.ts) — criado do zero com o teste do CSV, adaptando measurementsToCSV(rows, ctx) pois a assinatura real exige ctx; commit MISTO com a Tarefa 6 por corrida de `git add` concorrente — outro agente commitou enquanto meus 4 arquivos ja estavam staged; conteudo integro (ver `git show --stat 1584bf5`), so a mensagem do commit e a da Tarefa 6 |
| 4. limiar relativo a populacao | feito | b75e384 | agente | 785 testes, tsc e eslint limpos nos 4 arquivos (so os 3 warnings pre-existentes em App.tsx, sem relacao); nenhuma constante precisou ser ajustada — K_DA_POPULACAO=3,5 e os pisos MAD_MINIMO_SOLIDEZ=0,01/MAD_MINIMO_PROFUNDIDADE=0,02 do plano passaram nos quatro cenarios (lisa: par pego e isoladas passam; irregular: isoladas nao acusadas; irregular+par: par pego; populacao pequena: nulo) de primeira. `LIMIARES_DE_CONTORNO_IRREGULAR` nao estava em uso no App (so em aglomerado.ts e seu teste), entao nao houve o que remover — so acrescentar `limiaresDaCena` (useMemo) e a prop `limiares` no SeedInspector. Checkpoint feito: script Python (nao existia um pronto no repo para adaptar — escrito do zero espelhando a geometria de aglomerado.ts) mediu falso alarme em 14 imagens reais do conjunto de orquidea (de 20 amostradas; 6 tinham menos de 8 contornos), mediana 13,2%, media 10,8% — bem abaixo dos padroes absolutos (78%/40%), mas acima do preset `LIMIARES_DE_CONTORNO_IRREGULAR` calibrado especificamente (5,8%/8,4%), como esperado de um limiar generico por cena |
| 5. criterio do modelo visivel | feito | 60a14ad | agente | 782 testes, tsc e eslint limpos nos 3 arquivos; commit MISTO com a Tarefa 1 por corrida de `git add` concorrente — outro agente rodou `git commit` enquanto meus 3 arquivos ja estavam staged; conteudo integro (ver `git show --stat 60a14ad`), so a mensagem do commit e a da Tarefa 1 |
| 6. taxonomia como caminho | feito | a5837ea (feature); 1584bf5 (docs) | agente | 782 testes (isolado); suite completa teve 1 falha transitoria em challenger.test.ts (nao e meu arquivo, passou ao rodar isolado e ao repetir a suite completa). O commit de docs 1584bf5 saiu MISTO com `src/lib/feret.ts`, `src/lib/measurements.ts` e seus testes (Tarefa 3) por corrida de `git add` concorrente — eu so tinha adicionado o progress.md, mas outro agente ja tinha esses arquivos staged quando rodei `git commit`; conteudo integro (ver `git show --stat 1584bf5`), so a mensagem/atribuicao do commit e a de docs da Tarefa 6, nao a de feat da Tarefa 3 |
| 7. worker ONNX | feito | f5d7a32 | agente | 785 testes, tsc e eslint limpos nos 4 arquivos (App.tsx nao precisou ser tocado — a chamada mora em `AiPointerPanel.tsx`); build gera `dist/assets/yolo.worker-Cf-deA18.js` (6.31 kB) como chunk separado. Verificado de verdade no Chromium via Playwright (nao so vitest, que nao roda worker): dois defeitos reais so apareceram rodando — `onProgress` (funcao) lancava DataCloneError no primeiro `postMessage`, e dentro do worker o caminho relativo do modelo resolvia contra a URL do PROPRIO SCRIPT do worker (nao da pagina), entao o ONNX Runtime recebia o HTML de fallback do Vite e falhava com "protobuf parsing failed". Os dois foram corrigidos (progresso por mensagem `tipo:'progresso'` separada; `document.baseURI` mandado no pedido e usado para resolver `models/...` dentro do worker). Por causa do segundo defeito, a ImageData deixou de ser transferida (so clonada) — sem isso, cair para o fallback DEPOIS que o worker ja aceitou a mensagem quebraria com `InvalidStateError: source data has been detached` (tambem medido, tambem corrigido) |
| 8. spike do radial | feito (codigo) | 0a1d05f | agente | 798 testes na suite completa (2 falhas transitorias, nenhuma nos meus arquivos: `synthetic-scene.test.ts` — nao e meu arquivo, timeout de 5s, listado como fora do meu escopo — e `challenger.test.ts`, a mesma falha transitoria ja registrada na Tarefa 6; isolado, `geometria.test.ts` passa 3/3); tsc e eslint limpos nos 4 arquivos tocados (so os 3 warnings pre-existentes em App.tsx/MarkingCanvas.tsx, sem relacao); `npm run build` limpo. Adaptacao: o plano supunha `onContextMenu` num polígono; no codigo real o botao direito ja tinha `onMouseDown` proprio no polígono (apagava o contorno) — o gesto radial passou a ramificar dali (`menuRadialAtivo` desvia para o gesto ANTES de chamar `handlePolygonClick`), e o `onContextMenu` (so `preventDefault` com a flag ligada) foi para o `<div>` raiz do componente, que recebe o evento por bolha de qualquer filho. A classificacao escrita e a subclasse da MARCA vinculada ao contorno (`seg.marcaId`), via `setSubclasse` — nao existe ainda um setter para `YoloSegmentation.classe` (caminho da Tarefa 6) no `useMarks`, e reaproveitar `setSubclasse` evita abrir uma segunda porta de mutacao so para o spike. Falta a cronometragem: e do humano, roteiro abaixo. Ressalva registrada: com a ferramenta `contorno` ou `eraser` ativa, a camada interativa (zIndex 8, `pointer-events:auto`) cobre o polígono (zIndex 5) inteiro e intercepta o botao direito antes dele chegar — o gesto radial so funciona com uma ferramenta de marcacao (viavel/inviavel) ativa, que e o caso do roteiro de cronometragem |

## Medicoes registradas

- **Falso alarme de `limiaresDaPopulacao` em orquidea real (checkpoint da Tarefa 4):**
  script Python ad-hoc (nao havia um pronto para adaptar; escrito espelhando a
  geometria de `aglomerado.ts` — area por cadarco, fecho convexo por cadeia
  monotona, maior defeito de convexidade restrito ao arco) sobre
  `datasets/Sementes de Orquideas/train/labels`. Amostra aleatoria de 20
  imagens (seed 42); 14 tinham os >=8 contornos exigidos por
  `limiaresDaPopulacao`. Para cada imagem, os limiares vieram da propria
  populacao da imagem e todas as sementes anotadas sao instancias isoladas
  reais (a anotacao nao funde encostadas) — entao a fracao acusada e
  diretamente o falso alarme.
  - mediana do falso alarme: **13,2%**
  - media do falso alarme: **10,8%**
  - contra os padroes absolutos calibrados para soja (78%/40%) e uma melhora
    grande; contra `LIMIARES_DE_CONTORNO_IRREGULAR`, calibrado especificamente
    para este conjunto (5,8%/8,4%), fica acima — esperado, ja que o limiar por
    cena e generico e nao foi ajustado a este conjunto especifico.
  - ressalva: o conjunto de labels tem copias aumentadas (`_hflip`, `_rot90`,
    `_rot180`, `_vflip`); o filtro excluiu `_hflip`/`_rot*` mas nao `_vflip`,
    entao algumas das 14 imagens sao espelhos verticais umas das outras — a
    mediana/media tem correlacao entre si, nao 14 cenas totalmente
    independentes. Nao invalida a ordem de grandeza, mas nao e uma amostra
    perfeitamente i.i.d.
  - script: `medir_limiar_populacao.py` (scratchpad da sessao; nao commitado —
    e uma medicao ad-hoc de checkpoint, nao parte do codigo do produto)

- **Duracao da inferencia via worker (Tarefa 7), medida com `performance.now()`
  no cliente, Chromium (Playwright), `npm run dev`, exemplos simulados do
  proprio app:**
  - Soja (960x960, 4 janelas), modelo fp32 carregando pela primeira vez nesta
    sessao do worker (carga fria do modelo + WASM): **8268 ms**, 0 deteccoes —
    o modelo foi treinado em semente de orquidea, near-zero e esperado nessa
    cena sintetica desenhada por codigo, nao e sinal de regressao.
  - Orquidea TZ, modelo ja em cache no worker (mesma sessao, segunda chamada):
    **815 ms**, 56 deteccoes — confirma que o pipeline completo (tiling,
    tensor, NMS, mascara) roda corretamente de ponta a ponta dentro do
    worker, nao so que ele "responde".
  - Nao ha uma medicao "antes" comparavel isolando so a thread principal
    nesta sessao (a versao pre-worker foi substituida antes de medir); o que
    ficou registrado e que o worker em si funciona e devolve os numeros
    certos — o ganho qualitativo (arraste nao trava mais) fica para o roteiro
    de arraste abaixo, que precisa de um humano.

## Roteiro para o humano testar o arraste (3 linhas)

1. `npm run dev`, carregar o exemplo "Soja" (ou uma digitalizacao real
   grande), ligar a flag "AI Pointer (Beta)" no frasco do cabecalho se ainda
   nao estiver ligada, abrir "3 Detectar automaticamente" e clicar "Detectar
   com IA".
2. Enquanto a barra mostrar "Analisando X/Y…", arrastar a imagem no canvas
   (clique e arraste, ou roda do mouse para zoom).
3. Esperado: arraste e zoom respondem imediatamente, sem travar — antes deste
   commit, a inferencia rodava na thread principal e o arraste engasgava
   pelo tempo inteiro da deteccao.

## Roteiro para o humano cronometrar o radial (Tarefa 8)

1. `npm run dev`, ligar a flag "Menu radial (spike)" no frasco do cabecalho
   (Ctrl+Shift+D abre o painel de debug se o frasco nao estiver visivel) — com
   a flag desligada nada muda, o botao direito continua so apagando o contorno.
2. O gesto: com uma ferramenta de marcacao ativa (`V`/`I`), segurar o botao
   direito sobre um contorno e arrastar numa direcao; soltar longe do centro
   classifica na raiz de TAXONOMIA daquela direcao, soltar perto do centro
   cancela. Comparar contra a tecla `X` (inverte viavel/inviavel) + clique.
3. Cronometrar 20 classificacoes pelo radial e 20 pela tecla `X`, na mesma
   imagem, com `performance.now()` ou cronometro — total de cada, nao por
   clique.
4. Critério: se o radial não for mais rápido, a flag fica desligada por
   padrão e o spike não avança — registrar aqui os dois tempos e a decisão.

## Bloqueios

- Tabela 4.1 de tolerancia nao conferida (humano) — nao afeta o Degrau 1.
