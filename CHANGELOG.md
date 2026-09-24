# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento conforme [SemVer](https://semver.org/lang/pt-BR/).

## [3.8.0] — 2026-09-23

Detalhe em linguagem de quem usa: `src/lib/novidades.ts`.

### Adicionado
- `features/perfis/` — cinco pré-definições (spec `docs/superpowers/specs/2026-09-22-predefinicoes-por-perfil-design.md`): `TelaDePerfil` na primeira abertura, `SecaoDePerfil` em Configurações com `oQueMuda`, origem no `MenuExibir`; chaves novas `sc:perfil`, `sc:receitaPadrao`, `sc:protocoloPadrao`, `sc:modoDeAnalisePadrao`; `aplicar(modo, sobrescritas, {persistir})` no contexto de visualização. 25 testes.
- `features/germinacao/` — a aba Germinação: `entrada.ts` (colar INPUT / escrever INPUT / do longitudinal), `analise.ts` (output + ANOVA/Tukey), `letras.ts` (Piepho 2004), `curvas.ts`, `saida.ts` (CSV/TSV `output`), `colunas.ts` (ajuda por coluna), `PainelDeGerminacao` e `GraficoDeGerminacao` sob demanda; parte `germinacao` em `visualizacao/modo.ts`; `uniformidadeEntre` em `lib/germinacao`. 85 testes.
- `lib/regressao-polinomial.ts` — graus 1–3, F sequencial, ponto de ótimo dentro da faixa; `fCdf` exportada de `stats.ts`. 12 testes.
- `features/stats/fator-quantitativo.ts` + `CardFatorQuantitativo` — a regressão na aba Tratamentos, ao lado da ANOVA, quando ≥ 3 tratamentos têm número no rótulo (leitura conservadora: dois números = sem nível). 6 testes.
- `features/ajuda/tarefas.ts` + aba "Tarefas" no `HelpTip` — dez tarefas (calibrar, contar, ver a semente, medir, relógio, exportar, relatar, comparar tratamentos, curva de germinação, o que vai no artigo); conteúdo genérico por teste.
- `scripts/gerar-catalogo-de-datasets.py` → `public/exemplos/catalogo-de-datasets.json` (23 pastas, 8 referenciáveis); `lib/datasets/catalogo.ts`; chip no explorador; `escalaDe` nos exemplos; 54 → 92 exemplos.
- `AGENTS.md` (doze leis, como se trabalha, mapa) e `CLAUDE.md`.
- `scripts/verificar-dist.mjs` — depois do build (em `npm run build` e no CI): todo arquivo que o `index.html` pede existe, toda importação estática entre pedaços existe, e não há ciclo entre pedaços (a causa da tela branca de 2026-09-06, que passava com o build verde).
- `src/theme/__tests__/divida-de-tokens.test.ts` + `.json` — a catraca da Lei 5: mede cores literais (424) e raios fora do sistema (374) e reprova se subir; se descer, pede para baixar o teto. `App.tsx` entra na conta, para extração não parecer dívida nova.
- `docs/PRIVADO.md` — o que vive no repositório privado, e por quê.

### Alterado
- `App.tsx` 4 190 → 3 841 → 3 699 → 3 646 → 3 504: exportações em `features/exportar/` (`useExportacoes`, `contexto.ts`; 14 testes); importação em `features/importar/` (`classificarJSON`/`interpretarJSON` conferem o que leem — campo com tipo errado vira frase com índice e nome; 25 testes) e sessão em `features/sessao/` (`montarSessao`, `useSessao`; formato gravado provado idêntico; 9 testes). Sidebar e HistoryModal usam o mesmo `handleImportHistoryJSON`; `reader.onerror` deixa de ser silêncio. Exemplos em `features/demo/` (`metadadosDaCena`, `metadadosDoExemploReal`, `useExemplos`; 9 testes) e explorador em `features/datasets/` (`referencia.ts`: `objetosDaReferencia`, `podeCarregarReferencia`; `useExplorador`; 19 testes). A onda em `features/segmentacao/` (`contorno-do-clique.ts`: o objeto, os recados, a área; `useOnda`: clique, uma, lote; 21 testes).
- `package.json`: saem `@google/genai`, `express`, `dotenv`, `@types/express`; `vite`, plugins e `@types/jszip` para dev. `GEMINI_API_KEY` sai de vite/Docker/compose/CI/.env.example/docs.
- `vite.config.ts`: `manualChunks` como função; `react-vendor` próprio; preload-helper do Vite fora do `pdf-export`; `lib/laudo` por `import()` no clique. HTML inicial pré-carrega só `react-vendor` e `db-lib` (antes: + `recharts-charts` 461 kB + `pdf-export` 593 kB).
- README para 3.7.0; arquitetura apontando para `AGENTS.md`.
- Testes: 1288 → 1548.

### Adicionado (classes dinâmicas, fatia 3)
- **Marcar direto na classe do protocolo.** Com protocolo declarado e diferente de `simples`, a barra de ferramentas ganha um botão por classe (plântula normal, anormal, dura, dormente, morta, vazia), com ícone próprio, a explicação da norma no `title` e tecla **1 a 6** — a tecla é a POSIÇÃO da classe na lista do protocolo. As teclas 1 e 2, que eram os modos de exibição, passaram para **N** (alterna pontos ↔ índices): número na mão de quem conta é classe. `V` e `I` não mudam de sentido: continuam marcando viável/inviável sem classe fina, e desarmam a classe. A onda por clique herda a classe armada. `features/classes/ferramentas-de-classe.ts`, 8 testes.
- O menu radial (botão direito arrastando sobre um contorno) entrou nas instruções do mouse, onde sempre devia ter estado.

### Corrigido
- **Separar um aglomerado avisa quando ainda sobra cintura.** 37% dos aglomerados medidos têm três ou mais sementes (um tinha 32) e um corte separa duas: a pessoa cortava, via duas metades e seguia, com um par inteiro escondido em uma delas. O recado agora distingue "separado em dois" de "uma das metades ainda tem cintura".
- Comentários do corte e do detector de aglomerado atualizados com a medição de 22/09 (**341 pares deduplicados**, não 240; separação maior — mediana 1,278 no par contra 0,160 na isolada) e com o preço do limiar de produção: 0,40 pega 58,4% dos pares com 0,3% de corte falso; o ótimo do erro de contagem seria 0,27.
- **Circularidade agora diz quando é estimativa.** Todo contorno é cortado em 48 vértices, e o corte suaviza reentrâncias: perímetro encurta, circularidade sobe (mediana +9,9%, pior caso +191%). A coluna `circularidade_estimada` marca `sim` quando a solidez fica abaixo de 0,975 — a solidez já era calculada na mesma passagem. O `Math.min(1, …)` que havia na conta saiu: pela desigualdade isoperimétrica ele era código morto, e sugeria que o valor podia estourar.
- **O CSV declara a convenção do comprimento** (`convencao_comprimento = eixo-principal-pca`). O app mede sobre os eixos principais do contorno; boa parte da literatura publica o eixo maior da elipse ajustada — 1 a 2% de diferença, e ninguém dizia qual das duas tinha lido.
- **O lote lia só a primeira página de um TIFF, sem avisar.** Sete dos doze TIFF do laboratório guardam várias varreduras — o de dez espécies virava uma linha e nove sumiam em silêncio. Agora cada página vira uma linha (`arquivo.tif#2`), e o painel diz quantas apareceram. Arquivo de uma página passa inalterado, com o mesmo id. `features/lote/paginas-do-lote.ts`, 7 testes.
- **O denominador da porcentagem passa a excluir o material inerte.** Objeto declarado como `vazia` (unidade de dispersão sem semente dentro — material inerte pela RAS) sai de `viaveis`/`inviaveis` e do total, e aparece numa linha própria, "Inerte (fora da conta)". Antes ele contava como semente inviável, o que faz a germinação parecer menor do que é. Enquanto ninguém classificar nada como inerte, `sementes === total` e nenhum número muda. `contarObjetos` devolve `inertes` e `sementes`; os três grupos sempre somam o total.
- A classe fina (`Mark.subclasse`, gravada pela galeria e pelo menu radial) e a classe externa de datasets de terceiros eram calculadas e **não saíam no CSV** — a curadoria morria na exportação. Agora saem em `classe_norma`, `classe_rotulo`, `conta_como_semente` e `classe_externa`; vazias quando ninguém declarou. Spec: `docs/superpowers/specs/2026-09-23-classes-dinamicas-design.md`.
- **Exportação YOLO escrevia as classes invertidas em relação ao treino** (`CLASS_VIABLE = 0`, tabela própria): coerente consigo mesma, mas um dataset exportado somado ao conjunto de treino trocaria a classe de toda semente. Agora usa `indiceDaCategoria` (`classe-do-modelo.ts`): 0 inviável, 1 viável; o `dataset.yaml` traz sempre as duas classes (`nc: 2`), mesmo exportando só viáveis. 5 testes.
- Lint: 72 → 27 avisos (só código morto — inclusive ~90 linhas de régua/região/anotações no `MarkingCanvas` que já viviam nos overlays); o CI bloqueia acima de 27 (`--max-warnings`).
- A sugestão "Salvar sessão" do painel de sugestões não gravava nada: `handleAcaoDeSugestao` capturava o `saveCurrentSession` do primeiro render (`filename` vazio). Entra nas deps.
- JSON importado com campo de tipo errado (`polygon_points: "abc"`) virava contorno inválido no estado; agora é recusado com frase.
- Três sugestões sem `case` ("Mostrar eixos", "Carregar referência", "Abrir funcionalidades") não faziam nada ao clicar; "Abrir calibração" rolava para um id inexistente. `acoes-prometidas.test.ts` vigia (ids das regras × cases × ids renderizados).
- "Processar fila com IA" deixava o cabeçalho preso em "Parar": o `false` do estado só existia no `finally` do exemplo simulado. A fila desliga o que liga.

### Removido do público
- `docs/backend/`, `docs/roteiros/`, `docs/mercado/`, `docs/visao/`, sete specs de posicionamento/backend/scale-up/ToupView, dois planos de negócio → `seedcounter-docs` (privado). Quatro menções à instituição corrigidas nas specs restantes.

## [3.7.0] — 2026-09-22

O trabalho "Enterprise" da sessão paralela (19–21/09), verificado e elevado, e
a segunda rodada. Detalhe em linguagem de quem usa: `src/lib/novidades.ts`.

### Corrigido (o que muda número)
- **Fila com IA e Lote: `classId === 1` marcava inviável** — em `YOLO_CLASSES = ['inviavel','viavel']` 1 é viável; toda semente saía inviável. E **`withMasks` não era pedido**: nenhum polígono chegava. Nenhum dos dois chegou a produção.
- **Uma fonte por verdade** (`lib/classe-do-modelo.ts`, `lib/objetos.ts`): exportação de imagem contava a mesma semente duas vezes e renumerava ao filtrar classe; `totalDeObjetos` e `measurementCount` somavam listas; `AiPointerPanel` traduzia classe em 5 lugares; `regras.ts` usava `objectId − 1` como posição; o importador de JSON antigo tinha a tabela invertida no fallback por índice. `src/__tests__/fonte-unica.test.ts` impede a próxima.
- Laudo: `b*` era o B do RGB; a* por classe; `px² (não calibrado)` vs `mm²`; sem NaN sem imagem.
- Ensaio ao carregar rodava a receita "IA" com o detector clássico, rotulada como IA (`RECEITAS_DO_ENSAIO`).
- `text-white` sobre `bg-accent` → `text-accent-on` (5 lugares).

### Adicionado
- `lib/germinacao/` (otimizador Nelder-Mead, Hill, parâmetros; 84 testes; oráculo `germinator-llanero.json` com 24 amostras).
- `features/carregar/` (decisão substituir/fila, continuidade de experimento, diálogo; 30 testes); `adicionarAFila` em `useImageQueue`.
- `features/visualizacao/` (4 modos, 16 partes, `MenuExibir`, Provider em `main.tsx`; `?mode=enterprise` idêntico, fixado por teste; parte `ensaioAoCarregar`).
- `features/lote/fila-ia.ts` (laço puro, cancelável, relato), `abrir-imagem.ts` (decodificador único), botão "Parar fila".
- `features/analytics/` (4 cases, recharts em chunk separado — `lib/sob-demanda.tsx`), `ImageExportModal`, `lib/render-marks.ts`, `lib/export-image.ts` (37 testes).
- `lib/laudo/montagem.ts::montarMetricasAvancadas`.
- `src/__tests__/atalhos-prometidos.test.ts`, `fonte-unica.test.ts`.
- `docs/superpowers/plans/2026-09-21-plano-de-acao-fases.md`, `docs/visao/demonstracoes-ideias-e-expansao.md`.
- SEO: título, canonical, Open Graph, `robots.txt`, `sitemap.xml`.

### Alterado
- `renderMarksToContext` saiu de `App.tsx` para `lib/render-marks.ts`.
- `YOLO_CLASSES` mora em `lib/classe-do-modelo.ts` (`yolo-onnx.ts` reexporta).
- Testes: 1059 → 1288.

### Fora do repositório, para o dono
- `python/orchid_seed_analyzer.py:165-166` e `hf_space/app/schemas/batch.py:60` mapeiam `0 → viável`; o treino (`data_sementes.yaml`) diz `0 → inviável`. Se rodam o mesmo modelo, rotulam invertido na origem.

## [3.6.0] — 2026-09-21

O que a primeira usuária real precisa na bancada. Detalhe em linguagem de quem
usa: `src/lib/novidades.ts`. Roteiro para ela: `docs/roteiros/`.

### Adicionado
- `lib/calibracao-multiponto.ts` + painel: N leituras do alvo → µm/px médio, CV, divergência do DPI declarado, correlação da escala com a posição; a média é aplicada, e a conferência vai para o CSV.
- `lib/tiff.ts`: `decodificarTiff(buffer, pagina)` e DPI declarado (tags 282/296); seletor de página no cabeçalho; a fila guarda o `File`, não o `ArrayBuffer`.
- `lib/cronometro-de-analise.ts` + `hooks/useCronometro.ts`: tempo ativo por cena (ouvintes passivos em captura, estado em ref, apara no ocioso de 60 s), modo declarado, no rodapé.
- `theme/specimen.ts`: `EstiloDaMarca` (disco/anel/ponto/cruz) e opacidade com piso de 25%; forma redundante preservada em todos.
- `lib/morfometria-volumetrica.ts` + `CardVolumes`: Eq. 1 (esferoide prolato), Eq. 2 (cone × 2) e ar; convenção da altura explícita.
- `lib/sugestoes-do-arquivo.ts`: espécie/repetição/data do nome do arquivo e da pasta; pares deslizantes; epíteto maiúsculo aceito como "deduzido".
- `Metadata.procedencia` e colunas novas no CSV de medidas (espécie, página, modo, tempos, DPI declarado/medido, calibração, versão, commit).
- `lib/diagnostico/` (trilha, relatório, captura global), `ErrorBoundary` por fora do provedor, `PainelDeRelato` em Configurações.
- `CITATION.cff`; `docs/referencias/seedcounter.bib`; `docs/mercado/`; `docs/backend/revisao-2026-09-18.md`; `docs/roteiros/`.
- Lattes da orientação no rodapé.

### Alterado
- `index.css`: `tabular-nums` na família mono, `::selection`, `scrollbar-color`, `:focus-visible`, `prefers-reduced-motion`.
- Citação com quatro autores na ordem oficial; menções à instituição removidas de `docs/index.html`.
- Testes: 987 → 1059.

## [3.5.0] — 2026-09-16

Datasets dentro do app, medida conferida, e o lote. Detalhe em linguagem de
quem usa: `src/lib/novidades.ts`.

### Corrigido (o que muda número)
- **`DEFAULT_LAB_DPI` 3600 → 4800.** A régua da própria digitalização mede 4735 e 4771 DPI efetivos em duas imagens independentes (`scripts/auditar-regua.py`, `docs/datasets/auditoria-de-medida.md`). Medidas em mm feitas com 3600 estavam +32%.
- **Uma enumeração para tudo** (`src/lib/objetos.ts`): contagem, `buildMeasurements`, índices do canvas (tecla 2), lista do inspetor, fantasmas das regras e CSV. Contorno de modelo sem marca passou a ter linha, índice e medida; `origem` no CSV distingue manual/ia/modelo/referência.
- Canal/gama/cor exigem pixels — o canvas recebe `applyAdjustments` e o filtro CSS sai (não existe filtro CSS de canal).
- `DetectionPanel` não roda ao montar nem ao trocar de imagem; botão Prévia explícito.
- Regra semi-automática começa sem critério; `animate-pulse` removido dos fantasmas.
- `fitToScreen` com piso (container estreito durante layout dava zoom ≤ 0).
- `await` ausente em `importSessions` (exposto por `strictNullChecks`).
- Vínculo `Metadata.dataset` zerado a cada imagem nova.

### Adicionado
- Explorador de datasets: `lib/datasets/` (formato, YOLO, data.yaml, multiclasse, pasta-por-classe), `features/datasets/` (pasta local com handle no Dexie v7, painel, anotação como referência).
- Exemplos reais (54, `scripts/gerar-exemplos-reais.py`) e cenas compostas (6, `scripts/gerar-cenas-compostas.py`) com verdade por objeto.
- Ensaio ao carregar (`features/ensaio/`), receita por espécie, receitas salvas (Dexie v8).
- Perfil medido por classe (`lib/perfil-medido.ts`, `features/datasets/medir-pasta.ts`, Dexie v9).
- Lote (`features/lote/`): fontes, miniaturas com contornos, resumo com dispersão, duplicata, repetir, retomada (Dexie v10).
- `lib/eixos.ts` + `EixosOverlay`; `lib/escala-grafica.ts` + barra arrastável; `lib/fonte-da-automacao.ts` + indicador no rodapé; `lib/normas/especies.ts` + chip de espécie.
- `useBancada()` (`src/hooks/useBancada.ts`): a cena como unidade — primeiro passo das bancadas, sem mudança de comportamento.
- Easter eggs: `fucik`/`montanha` (passo da montanha e a primeira curva de Fučik), `germinar` (sol e flores), nome do autor → dissertação.
- Fixtures reais em `src/lib/__tests__/fixtures/` como regressão, com asserções em "medido − margem".

### Alterado
- `tsconfig`: `strictNullChecks` e `noImplicitAny` ligados (34 erros corrigidos com guardas reais).
- `jszip` sob demanda; `jstat` reimplementado e removido do `package.json`. Chunk principal 1.272 → 1.124 kB.
- Marca: semente com contorno tracejado (`docs/marca/`), favicon e cabeçalho; "Edição Acadêmica" removido.
- Lateral esquerda recolhível; instruções com aba Fluxo (diagrama + lista); barra inferior em grupos rotulados.
- Sem menções à instituição em nenhum lugar do app.
- Testes: 766 → 952.

## [3.4.0] — 2026-09-15

Prancheta, painel com abas e a medida que vem da própria imagem. Detalhe em
linguagem de quem usa: `src/lib/novidades.ts` (tela Novidades do aplicativo).

### Adicionado
- Painel direito com abas **Resultados / Inspetor / Galeria**; selecionar contorno abre o inspetor na aba.
- Prancheta metrológica: cota (`R`), seta (`A`), área de interesse (`B`), texto (`T`) — arrastar e soltar; overlays isolados em `components/canvas/overlays/`.
- Leitor de **TIFF** (8/16 bits, LZW, multipágina) via `utif`.
- **Feret** máx/mín por calibradores rotativos (`lib/feret.ts`); colunas no CSV.
- **Limiar de aglomerado relativo à população** da cena (`limiaresDaPopulacao`), medido: orquídea 78% → 13% de falso alarme; soja 0%.
- Critério de treino do modelo YOLO visível no painel de IA (`lib/criterio-do-modelo.ts`).
- Taxonomia de classes como caminho (`lib/normas/taxonomia.ts`); Dexie v6.
- Inferência ONNX em **Web Worker** com fallback e cancelamento.
- Spike do menu radial atrás da flag `menuRadial` (para medir contra a tecla `X`).
- Cena sintética com rótulos por pixel e `comporCena`; regras semi-automáticas com fantasmas; histogramas.
- Consentimento de cookies (Consent Mode v2) antes do GA4.

### Alterado
- `priors-morfometricos` vira referência (`compararComPerfil`), nunca veredito.
- Modais: Esc e clique fora fecham; atalhos suspensos com modal aberto.
- Mouse: direito inverte classe; meio arrasta; roda dá zoom no cursor.

### Corrigido
- Ocultar marcações não escondia os pontos pintados no bitmap.
- Propor corte no inspetor aplicava no segundo clique (teste estático `corte-nunca-automatico`).
- Ferramentas novas sem entrada na ajuda de atalhos.

## [3.0.0-beta] — 2026-08

Rodada de aquisição, calibração e análise automática.

### Adicionado
- **Captura por câmera** — lupa/estereomicroscópio no desktop (com seleção de dispositivo)
  e câmera traseira em celular/tablet, com prévia, recaptura e liberação do dispositivo.
- **Calibração espacial multi-método** — DPI de scanner (padrão do laboratório:
  HP Scanjet G2710 a 3600 DPI), objeto de referência medido na imagem, micrômetro
  de platina e µm/px manual; com predefinições de laboratório e verificação de sanidade.
- **Régua interativa** — dois cliques sobre um objeto de dimensão conhecida definem a escala.
- **Réguas nas bordas do canvas** — unidades reais (mm/µm) quando calibrado, adaptadas ao zoom.
- **Detecção por IA (experimental)** — YOLOv8m-seg treinado no dataset do laboratório,
  executado no navegador via ONNX Runtime Web (WebGPU com queda para WASM), com recorte
  em janelas e supressão de não-máximos entre janelas.
- **Morfometria** — reconstrução das máscaras de segmentação, extração de contorno e
  cálculo de comprimento, largura e área por PCA, convertidos pela calibração.
- **Detecção assistida (experimental)** — limiar de Otsu com polaridade automática,
  componentes conexos e separação de objetos encostados por transformada de distância.
- **Ferramentas de edição** — barra flutuante com marcar viável/inviável, borracha com
  raio ajustável, mover imagem; arrastar para reposicionar e clicar para inverter a classe.
- **Atalhos** — `V`, `I`, `X` (inverter), `E`, `H`, `Alt` (borracha temporária), `[` `]`.
- **Painel de Funcionalidades** — feature flags com interface visível no cabeçalho,
  separando recursos estáveis de experimentais.
- **Zoom com a roda do mouse**, ancorado na posição do cursor.

### Alterado
- Créditos e identidade visual: logos GPEOrq e GPSEM, autoria e contato.
- README, site do projeto (GitHub Pages) e documentação reescritos.
- Logos otimizados de 2000×2000 (2,8 MB) para 256×256 (88 KB), reduzindo o cache do PWA.

### Corrigido
- Conflito entre dois estados de "modo mão" que travava as ferramentas de marcação.
- Polaridade invertida na detecção assistida, que marcava o fundo como objeto.
- Travamento na separação de aglomerados (custo quadrático) em regiões muito grandes.
- Carregamento do ONNX Runtime Web sob Vite (import dinâmico por variável não resolvia).
- Normalização de quebras de linha (CRLF/LF) em todo o repositório.

### Infraestrutura
- Docker para desenvolvimento e produção, com healthchecks.
- Integração contínua no GitHub Actions: checagem de tipos bloqueante, lint informativo,
  build e validação das imagens Docker.
- ESLint e Prettier configurados.

## [2.0.0] — 2026

- Refatoração em módulos (`features/`), modo longitudinal, painel estatístico,
  exportação de dataset YOLO e integração PWA.
