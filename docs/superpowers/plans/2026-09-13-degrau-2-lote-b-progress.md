# Degrau 2 — Lote B (explorador de datasets) — progresso

Plano: `2026-09-13-degrau-2-lote-b-explorador-de-datasets.md`. Cada agente acrescenta a sua linha ao terminar (commit com pathspec).

| task | commit | status | nota |
|---|---|---|---|
| B1 leitores puros | (ver commit) | feito | 5 módulos, 16 testes; mascara-binaria implementada por convenção images/+masks/, "a conferir" (nomes reais de lucasiturriago-seeds não confirmados) |
| B2 fonte local + Dexie v7 | (ver commit) | feito | handle + Dexie v7 (`pastasDeDatasets`), `agruparPorConjunto` puro com 5 testes; `entries()`/`PermissionState` redeclarados em `src/types/file-system-access.d.ts` porque `tsconfig.json` não podia mudar; B2 — verificação no navegador fica para a B3 (não há botão ainda) |
| B3 painel + referência | (ver commits) | feito | `anotacao.ts` (puro, 6 testes: yolo-caixa, yolo-polígono, yolo sem .txt, multiclasse, pasta-por-classe, solto) + `DatasetsPanel.tsx` como 4ª aba do painel direito (RightSidebar) + `handleCarregarDoDataset`/`handleCarregarReferencia` no App; filtro por classe só em multiclasse e pasta-por-classe (yolo tem classe por POLÍGONO, não por imagem — filtrar exigiria ler todo `.txt` do conjunto antes de mostrar a lista) |
| B4 medir por classe | (ver commits) | feito | `perfil-medido.ts` (puro, 8 testes) + `medir-pasta.ts` (laço injetável, 6 testes; DOM fica em `medirUmaFoto`, não testado em node) + Dexie v9 (`perfisMedidos`) + `usePerfisMedidos` + botão "Medir esta pasta"/tabela/CSV no `DatasetsPanel` + bloco "Referência (medida)" no `SeedInspector`, acima da literatura + `compararComPerfil` aceita perfil medido opcional (3 testes novos) |

## B3 — roteiro para o Enrico

1. Com uma imagem qualquer aberta (ou não — o botão aparece de qualquer forma), clique **"Abrir pasta de datasets…"** na barra esquerda, abaixo dos exemplos reais — ou o ícone de pasta (📁) na faixa de abas da barra direita. Escolha `seedcounter_git/datasets/` (ou onde a pasta estiver).
2. No Chrome/Edge, da próxima vez o app lembra: **"Reabrir última pasta"** dispensa escolher de novo (Firefox/Safari não guardam — o painel avisa isso na hora).
3. Você vê os conjuntos com o formato certo: `Sementes de Orquideas` como **YOLO — caixa ou polígono**, `peanuts.v2-release.multiclass` como **Multiclasse (CSV)**, `maize-seed-dataset` como **Pasta por classe**, etc.
4. Abra `Sementes de Orquideas`, clique numa miniatura — a imagem carrega no canvas (a contagem NÃO muda ainda). Um aviso aparece no topo do canvas: **"Carregar referência"**. Clique nele — os polígonos do dataset entram como contornos tracejados de referência (classe viável/inviável do `data.yaml`), e SÓ AGORA a contagem muda.
5. Volte, abra `peanuts.v2-release.multiclass` (ou outro conjunto multiclasse), filtre por classe no seletor, clique numa miniatura — a imagem carrega e um chip no topo do canvas mostra **"Classe do dataset: with mold"** (ou o que a foto declarar). Não há contorno nem marca para esse formato — só o metadado.
6. Exportando o CSV depois do passo 4, a coluna `origem` das linhas trazidas da orquídea sai como `referencia`, distinta de `modelo`/`manual`/`ia`.

**O que ficou de fora, por decisão de escopo (não bug):** `mascara-de-instancia` e `mascara-binaria` (Indonesian Soybean, lucasiturriago-seeds) reconhecem o formato e listam a imagem, mas "Carregar referência" não existe para eles ainda — não fazem parte desta tarefa. Filtro por classe em conjunto YOLO também não existe (motivo na tabela acima).

## B4 — roteiro para o Enrico

1. Abra `datasets/peanuts.v2-release.multiclass` (ou outro conjunto **Multiclasse (CSV)** ou **Pasta por classe** — `maize-seed-dataset`, `wheat quality detection.v2i.multiclass`). Formatos sem classe por imagem (YOLO, solto, máscara) não mostram o botão — é por decisão de escopo, não bug: sem classe por foto não há o que agregar.
2. Dentro do conjunto, acima da grade de miniaturas, aparece a caixa **"Perfil morfométrico medido"** com o botão **Medir esta pasta**. Clique — uma barra de progresso mostra `feito / total` fotos, e **Parar** cancela a qualquer momento: o laço para no ponto em que estava e o que já foi medido até ali é agregado e gravado normalmente — parar não perde o trabalho feito, só corta o resto.
3. Ao terminar, uma tabela aparece: uma linha por classe, com `n`, mediana de área (px²), Feret máximo (mediana) e solidez (mediana). Classe com menos de 20 fotos ganha um `*` e a nota "amostra pequena" — não escondida, só marcada.
4. Clique **Exportar CSV** — baixa um arquivo com `;` como separador (mesmo padrão do CSV de medidas por semente), uma linha por classe: `n`, `insuficiente`, `descartadas`, mediana/p5/p95 de área, Feret máx./mín. (mediana), solidez (mediana), razão de aspecto (mediana), quando foi medido.
5. Abra uma foto qualquer desse conjunto (clique numa miniatura). No inspetor de semente (clique num contorno depois de segmentar, ou "Carregar referência" se o formato tiver), aparece **"Referência (medida, n=…)"** ACIMA de "Referência (literatura)" — mesma frase de nota, nunca um veredito diferente. Sem medição feita para aquele conjunto/classe, o bloco de medida simplesmente não aparece; a literatura continua exatamente como sempre esteve.
6. Feche a imagem e volte a abrir a mesma pasta depois de recarregar a página: a tabela e o CSV continuam lá (Dexie v9, `perfisMedidos`) — "Medir esta pasta" só precisa rodar de novo se a pessoa quiser atualizar o número.

**O que ficou de fora, por decisão de escopo:** a medição roda sobre TODAS as imagens do conjunto (não só a página visível) — em `wheat quality detection.v2i.multiclass` (7.217 fotos) isso é um lote longo; **Parar** existe exatamente por isso. Classe com mais de uma marcação no CSV multiclasse (rótulo multi-label) vira uma classe composta (`"a + b"`) em vez de contar para as duas — decisão simples para não inflar `n` de nenhuma classe sozinha; se isso incomodar na prática, é ajuste de uma linha em `DatasetsPanel.handleMedirPasta`.
