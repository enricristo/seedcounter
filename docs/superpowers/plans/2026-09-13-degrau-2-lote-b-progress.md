# Degrau 2 — Lote B (explorador de datasets) — progresso

Plano: `2026-09-13-degrau-2-lote-b-explorador-de-datasets.md`. Cada agente acrescenta a sua linha ao terminar (commit com pathspec).

| task | commit | status | nota |
|---|---|---|---|
| B1 leitores puros | (ver commit) | feito | 5 módulos, 16 testes; mascara-binaria implementada por convenção images/+masks/, "a conferir" (nomes reais de lucasiturriago-seeds não confirmados) |
| B2 fonte local + Dexie v7 | (ver commit) | feito | handle + Dexie v7 (`pastasDeDatasets`), `agruparPorConjunto` puro com 5 testes; `entries()`/`PermissionState` redeclarados em `src/types/file-system-access.d.ts` porque `tsconfig.json` não podia mudar; B2 — verificação no navegador fica para a B3 (não há botão ainda) |
| B3 painel + referência | (ver commits) | feito | `anotacao.ts` (puro, 6 testes: yolo-caixa, yolo-polígono, yolo sem .txt, multiclasse, pasta-por-classe, solto) + `DatasetsPanel.tsx` como 4ª aba do painel direito (RightSidebar) + `handleCarregarDoDataset`/`handleCarregarReferencia` no App; filtro por classe só em multiclasse e pasta-por-classe (yolo tem classe por POLÍGONO, não por imagem — filtrar exigiria ler todo `.txt` do conjunto antes de mostrar a lista) |
| B4 medir por classe | — | pendente | espera B3 |

## B3 — roteiro para o Enrico

1. Com uma imagem qualquer aberta (ou não — o botão aparece de qualquer forma), clique **"Abrir pasta de datasets…"** na barra esquerda, abaixo dos exemplos reais — ou o ícone de pasta (📁) na faixa de abas da barra direita. Escolha `seedcounter_git/datasets/` (ou onde a pasta estiver).
2. No Chrome/Edge, da próxima vez o app lembra: **"Reabrir última pasta"** dispensa escolher de novo (Firefox/Safari não guardam — o painel avisa isso na hora).
3. Você vê os conjuntos com o formato certo: `Sementes de Orquideas` como **YOLO — caixa ou polígono**, `peanuts.v2-release.multiclass` como **Multiclasse (CSV)**, `maize-seed-dataset` como **Pasta por classe**, etc.
4. Abra `Sementes de Orquideas`, clique numa miniatura — a imagem carrega no canvas (a contagem NÃO muda ainda). Um aviso aparece no topo do canvas: **"Carregar referência"**. Clique nele — os polígonos do dataset entram como contornos tracejados de referência (classe viável/inviável do `data.yaml`), e SÓ AGORA a contagem muda.
5. Volte, abra `peanuts.v2-release.multiclass` (ou outro conjunto multiclasse), filtre por classe no seletor, clique numa miniatura — a imagem carrega e um chip no topo do canvas mostra **"Classe do dataset: with mold"** (ou o que a foto declarar). Não há contorno nem marca para esse formato — só o metadado.
6. Exportando o CSV depois do passo 4, a coluna `origem` das linhas trazidas da orquídea sai como `referencia`, distinta de `modelo`/`manual`/`ia`.

**O que ficou de fora, por decisão de escopo (não bug):** `mascara-de-instancia` e `mascara-binaria` (Indonesian Soybean, lucasiturriago-seeds) reconhecem o formato e listam a imagem, mas "Carregar referência" não existe para eles ainda — não fazem parte desta tarefa. Filtro por classe em conjunto YOLO também não existe (motivo na tabela acima).
