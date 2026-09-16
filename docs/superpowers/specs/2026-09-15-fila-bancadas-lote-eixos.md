# Fila de 15/09 — lote em imagens, bancadas, eixos e auditoria de medida

**Estatuto:** fila e proposta de desenho. O que aqui é pequeno vira tarefa direto; o que é grande (bancadas) precisa do "sim" do Enrico ao desenho antes de virar plano com código.

Contexto que muda o desenho: o laboratório é de **sementes ao longo do tempo** (Profa. Ceci, Prof. Nelson) — a mesma placa/meio de cultura contada várias vezes em vários dias, no scanner ou em foto. Já existe o modelo `Experiment → PlateRun(dayIndex, sessionId)` em `features/longitudinal`; tudo abaixo se apoia nele em vez de inventar outro.

---

## C1 — Lote: a mesma configuração de detecção em várias imagens

**Pedido:** selecionar quais imagens carregadas (ou uma pasta inteira, ou cada região de uma digitalização) e rodar nelas a mesma detecção/segmentação.

**Desenho (pequeno, apoia-se no que existe):**
- Uma **receita** é o que a A3 já define (`features/ensaio/receitas.ts`): localização + onda + limiar da população. O lote é *uma receita × N imagens*.
- Fontes de imagens, em ordem de entrega: (a) a **fila** já carregada (`useImageQueue.imageQueue`); (b) as **regiões** de uma digitalização (o `split` já corta em grade/círculo — `features/split`, `image-crop.ts`); (c) uma **pasta** (Lote B, B2).
- Execução: sequencial, uma imagem por vez, cede a tela por lotes (padrão de `handleSegmentarPendentes`); cada imagem vira **uma sessão** salva com a receita registrada nos metadados (`metadata.receita = {id, parametros}`) — é isso que torna o lote auditável e repetível.
- Resultado: tabela (imagem · contagem · viáveis · inviáveis · suspeitos · duração) com **exportar CSV**; nada é aplicado sem a pessoa aceitar por imagem OU marcar "aceitar todas" explicitamente.
- Onde: `features/lote/` (novo). Depende de A3 (receitas). Tarefa própria depois da A3.

---

## C2 — Bancadas: até 4 cenas abertas ao mesmo tempo

**Pedido:** abrir 1 a 4 "bancadas" — 4 imagens para comparar, ou a mesma placa em datas diferentes — cada uma com suas marcas, medidas e resultados, e ver os resultados da que está selecionada.

**O que impede hoje:** `App.tsx` guarda TODO o estado de uma cena (imagem, marcas, contornos, histórico, metadados, calibração, ferramentas) em hooks de topo. Não dá para instanciar duas sem duplicar o App.

**Desenho proposto (para o Enrico aprovar antes de planejar):**

1. **`Bancada` como unidade de estado.** Extrair de `App.tsx` um hook composto `useBancada()` que reúne o que hoje é por-cena: `useImageQueue` (imagem), `useMarks` (marcas/contornos/histórico), `useMetadata`, calibração, `imagemDeTrabalho`, ferramentas ativas. O que é global fica no App: tema, flags, sessões, experimentos, painel direito, modais. Isso é refatoração pura, sem mudar comportamento — **é o passo caro e o único arriscado**; com 804 testes e uma bancada só, vale um teste de fumaça por gesto.
2. **`bancadas: Bancada[]` (1–4) + `ativa`.** Cada bancada renderiza um `MarkingCanvas` próprio; a barra de ferramentas e o painel direito falam sempre com a **ativa** (clicar num canvas a ativa; borda de destaque). Atalhos vão para a ativa. Layout: 1 (como hoje), 2 (lado a lado), 3–4 (grade 2×2), com o divisor arrastável.
3. **Bancadas ligadas ao longitudinal.** "Abrir a placa X em 4 datas" = 4 bancadas, cada uma carregando a sessão de um `PlateRun`; a aba Resultados ganha um modo **comparação** (contagens/medidas por bancada, lado a lado, e a série no tempo quando as bancadas são a mesma placa). Sincronizar zoom/pan entre bancadas é opcional (toggle), útil para "mesma região em datas diferentes".
4. **Memória:** 4 digitalizações de 6800×9359 = ~1 GB de bitmap descomprimido. Regra: bancadas inativas mantêm só uma versão reduzida (≤ 2000 px) e recarregam a cheia ao ativar — a sessão salva garante que nada se perde. Sem isso, 4 bancadas derrubam um tablet.
5. **Persistência:** o "espaço de trabalho" (quais sessões abertas, layout, ativa) salvo no Dexie, para reabrir onde parou.

**Ordem:** (1) refatoração `useBancada` com uma bancada só → (2) duas bancadas lado a lado com ativa → (3) 4 + grade + memória reduzida → (4) modo comparação + série no tempo → (5) sincronizar zoom. Cada passo é entregável sozinho.

**Complementos que valem a pena (para escolher):** *diff entre datas* (a mesma região em D0 e D7: o que apareceu/sumiu, por posição); *linha de contagem no tempo* já sai de `PlateRun`; *bancada de referência travada* (uma imagem fixa para comparar as outras contra ela); *exportar as 4 lado a lado* como uma figura para artigo, com escala e legenda.

---

## C3 — Eixos visíveis e auditoria de medição/calibração (fila)

**Pedido:** ver de onde saem comprimento e largura em cada máscara; revisar medição e calibração procurando furos; validar contra os datasets — as digitalizações `digitalizarXXXX` de orquídea têm **régua no scanner** e o DPI é conhecido (3600).

**Tarefas concretas, em ordem:**
1. **Overlay de eixos** — em `MarkingCanvas` (overlay novo em `components/canvas/overlays/EixosOverlay.tsx`): para o contorno selecionado (e, com um toggle, para todos), desenhar os dois eixos que `calculateSeedDimensions` (`lib/pca-utils.ts`) usa — centro, direção principal, comprimento e largura como segmentos — e, ao lado, os **Feret** máx/mín (`lib/feret.ts`) para ver quando os dois discordam. Discordância grande = a forma não é elíptica (encostadas, quebrada) e a medida PCA é palpite.
2. **Auditoria de escala com a régua** — script Python + teste de fixture: numa `digitalizarXXXX` com régua, medir a distância entre duas marcas de 10 mm em px; comparar com `dpiToUmPerPixel(3600)` = 7,06 µm/px → 10 mm deve dar 1417 px. Registrar o desvio (%) em `docs/datasets/`; se > 1%, o DPI declarado não é o DPI efetivo (scanners às vezes interpolam) e o app precisa avisar.
3. **Auditoria de medida com a máscara** — na soja (máscara de instância): comprimento/largura por PCA e por Feret contra a máscara de referência (o mesmo Feret sobre a máscara verdadeira); erro mediano e p95 por método. É o que decide **qual medida vai para o CSV como principal**.
4. **Furos a procurar na leitura de código** (`lib/measurements.ts`, `lib/calibration.ts`, `pca-utils.ts`): unidade misturada (µm/px × mm); área em px² convertida com `umPerPixel` sem elevar ao quadrado; contorno em coordenadas da imagem reduzida (`maxProcessingSize` da detecção) medido como se fosse da imagem cheia; `width/height` gravados no momento do contorno e não recalculados após edição de vértice; TIFF com DPI no cabeçalho ignorado (o leitor novo poderia ler `XResolution` e propor a calibração sozinho).

---

## Sobre "sugestões de segmentação e pontos — alguma novidade?"

Honesto: **nada novo no código desde 10/09**. O que existe: cartões de sugestão (`features/sugestoes`), regras semi-automáticas com fantasmas (Fase 4), limiar da população. O que está planejado e é exatamente isso: **A3 — ensaio ao carregar** (três receitas lado a lado, a pessoa escolhe) e, atrás dela, **C1** (a receita escolhida em lote). A3 foi interrompida por crédito antes de escrever uma linha; é a primeira da fila.

---

## Fila resultante (ordem)

1. **A3** ensaio ao carregar (plano pronto, Lote A).
2. **A4** fixtures reais (plano pronto).
3. **C3.1** overlay de eixos (pequeno) e **C3.2** auditoria da régua (script) — podem ir em paralelo com A3/A4.
4. **B1/B2** explorador (planos prontos) → **B3/B4**.
5. **C1** lote (depois de A3 e B2).
6. **C2** bancadas — **só depois do "sim" ao desenho acima**; começa pela refatoração `useBancada`.

---

## C4 — Conta: o que o login deve dar (pedido do Enrico, 15/09)

Hoje a conta (`features/conta`) lembra a bancada (metadados) e nada mais; sessões, experimentos e placas vivem só no Dexie do navegador. O que a conta passa a oferecer, em ordem de utilidade:

1. **Lista de sessões da pessoa** — com miniatura, data, contagem, projeto/placa; **continuar** de onde parou (abre a sessão na bancada). Espelha `db.sessions` no servidor (o backend já tem `require_user_for_heavy` e limites de taxa — ver memória `backend-auth-nao-verifica`).
2. **Fotos e digitalizações** — upload das imagens originais junto da sessão (hoje a sessão guarda só as anotações; sem a imagem, "continuar" noutra máquina é impossível). Regra: original em PNG/TIFF, nunca JPEG re-comprimido.
3. **Experimentos e placas** (`Experiment`, `PlateRun`) — sincronizados, com a série no tempo por placa. É a base do C2 (bancadas por data).
4. **Receitas e regras** (A3, 2.2) — as receitas escolhidas e as regras em mm por espécie viajam com a conta, para a mesma bancada em dois computadores dar o mesmo resultado.
5. **Perfis medidos por classe** (B4) — idem.
6. **Lista de datasets abertos** (Lote B) — o app lembra quais pastas a pessoa já apontou (handles não viajam; o *nome* e o formato reconhecido sim).

**Pré-condição que só o Enrico resolve:** hospedagem com **disco persistente** (o HF Space é efêmero); sem isso, 2 e 3 não podem existir. 1, 4, 5 e 6 são pequenos e cabem no que já há.

**Onde entra na fila:** C4.1 (lista de sessões + continuar) logo depois do B2 — usa a mesma tela de "abrir" (pasta local · conta · exemplos).

---

## Estado em 16/09 (fim da sessão)

**Fechado:** A3 (ensaio ao carregar, flag `ensaioAoCarregar`), A4 (fixtures reais), C3.1 (eixos PCA/Feret, botão nos controles de zoom), C3.2 (auditoria da régua: **DPI efetivo ≈ 4735, não 3600** — `docs/datasets/auditoria-de-medida.md`), C3.4 (leitura de código: sem furo provado), B1 (leitores de datasets), B2 (pasta local + Dexie v7), A5 (54 exemplos reais com metadados, seletor por cultura), escala gráfica, barra inferior. **Governança de dados:** `lib/objetos.ts` — uma enumeração para contagem, medidas, índices (tecla 2), lista do inspetor, fantasmas das regras e CSV; contorno do modelo sem marca agora tem linha, índice e medida.

**Consequência da auditoria para o app (pendente):** `DEFAULT_LAB_DPI = 3600` está errado para as digitalizações do grupo — o scanner entrega ~4735–4814 DPI. Antes de trocar a constante, medir a régua em mais 3 digitalizações (`scripts/auditar-regua.py`); se confirmar, o padrão vira o medido e a calibração por DPI ganha aviso "conferir com régua".

**Próximos, na ordem:** B3 (painel do explorador + carregar referência), B4 (perfil medido por classe), C1 (lote), C4.1 (sessões na conta), C2 (bancadas — aguarda o sim ao desenho). Barras superiores: pedido registrado, sem desenho ainda — dizer o que incomoda nelas.

---

## C5 — Detecção assistida, ensaio e regras: um fluxo só (pedido do Enrico, 16/09)

**O que incomoda hoje:** na lateral esquerda, "Detecção por IA" e "Detecção assistida" aparecem em ordem confusa e como coisas separadas do ensaio ao carregar e das regras semi-automáticas — quando são o mesmo pipeline em três momentos. E os controles da assistida são em px absolutos ("tamanho mínimo 200 px"), que significam coisas diferentes numa foto de 640 px e numa digitalização de 6800 px.

**Desenho:**

1. **Ordem e nomes na lateral:** primeiro **Encontrar** (o que hoje é "detecção assistida" — localizar objetos por limiar; funciona em qualquer cultura, sem modelo), depois **Modelo (IA)** (só orquídea, e diz isso: "treinado em orquídea, viável/inviável por tetrazólio"). O painel de IA fica recolhido quando a espécie declarada não é orquídea.
2. **Uma receita, três momentos:** o ensaio ao carregar propõe 3 receitas; **Usar esta** carrega a receita no painel Encontrar (os controles mostram os valores da receita escolhida); mexer num controle re-executa e o resultado aparece como **fantasma tracejado** (mesmo overlay do hover do ensaio) até a pessoa aceitar; as **regras semi-automáticas** continuam sendo o filtro depois da medida. Salvar a receita ajustada com nome → vira a 4ª opção do ensaio nas próximas imagens (Dexie, por espécie).
3. **Limites adaptáveis, não px absolutos:** cada limite de tamanho tem três formas equivalentes e a pessoa escolhe a que faz sentido — **mm²** quando há calibração, **fração da mediana** dos objetos já encontrados ("descartar < 0,3× a mediana": transfere entre imagens e culturas), ou px² (mostrado sempre como referência). Internamente tudo vira px² na hora de rodar. O `sensitivity` ganha rótulo humano ("mais objetos ↔ menos falsos") e o `backgroundRadius` deixa de ser px: vira "maior objeto esperado × 2", derivado da mediana. Sem objetos ainda (primeira rodada), os padrões vêm da receita e do tamanho da imagem (fração da área).
4. **Fundo:** o "fundo escuro/claro" continua automático, mas o painel mostra o que decidiu e deixa inverter em um clique.

**Onde:** `features/detection/DetectionPanel.tsx` (reescrita), `features/ensaio/receitas.ts` (receita salva + conversão de limites), `lib/detect.ts` sem mudança de assinatura (a conversão para px² acontece antes). Depende de A3 (feito). Não toca C1 (lote) — o lote roda a receita que sair daqui.

**Fila atualizada:** B3 (em curso) → recolher barra esquerda → **C5** → B4 → C1 → C4.1 → C2.

---

## C6 — Saúde do código (varredura com as skills react-best-practices e typescript-advanced-types, 16/09)

- **Bundle:** chunk principal 1,15 MB. `jszip` (exportação YOLO), `jstat` (estatísticas) e `@google/genai` (AI Pointer) carregam para todo mundo; virar `import()` no clique. `pdf-export` e `recharts` já estão separados; ONNX vem de CDN.
- **`App.tsx`** ~3.000 linhas, todo o estado num componente: é a refatoração `useBancada` do C2 — não fazer duas vezes.
- **`tsconfig` sem `strict`** (`noImplicitAny` desligado): `tsc` limpo prova menos do que parece. Ligar por flag — `strictNullChecks`, depois `noImplicitAny` — um commit cada, com a contagem de erros como métrica.
- **Uniões exaustivas:** `origem`, `natureza` (`ObjetoDaCena`), `FormatoDeDataset` viram `switch` com `never` no default, para o próximo caso esquecido falhar em compilação.

Ordem: depois de C5; a parte de `App.tsx` junto com C2.
