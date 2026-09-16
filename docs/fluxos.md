# Fluxos e dinâmicas do SeedCounter

Diagramas do que o app faz e de como as partes se ligam. A versão curta, em sete passos, está dentro do app (Instruções de uso → Fluxo, em diagrama ou lista). Aqui estão as dinâmicas que não cabem na lateral: como os dados se alinham, como o ensaio vira receita e lote, como o explorador de datasets entra, e o que ainda é plano.

Fonte de verdade dos passos: `src/features/ajuda/atalhos.ts` (`FLUXO_DE_TRABALHO`).

---

## 1. O caminho de uma amostra

```mermaid
flowchart TD
  A[Abrir<br/>digitalização · câmera · exemplo real · pasta de datasets] --> B[Calibrar<br/>DPI declarado → conferir com régua na imagem]
  B --> C{Encontrar}
  C -->|marcar V/I| D[marcações]
  C -->|onda S| E[contornos por clique]
  C -->|ensaio ao carregar| F[3 receitas + “pela espécie”<br/>fantasma tracejado · Usar / Nenhuma]
  D --> G[Curar<br/>galeria · inspetor · corte por concavidade · regras em lote]
  E --> G
  F --> G
  G --> H[Medir<br/>área · C×L · Feret · solidez · eixos ≠]
  H --> I[Identificar<br/>espécie · lote · protocolo · referência de literatura]
  I --> J[Exportar<br/>CSV com origem por objeto · laudo PDF · sessão JSON]
```

## 2. Uma lista, um número — a governança dos dados

Antes, a contagem incluía contornos do modelo mas a tabela de medidas só percorria marcações: semente detectada sem marca era contada e não medida. Hoje tudo lê a mesma enumeração.

```mermaid
flowchart LR
  M[marcações] --> E[enumerarObjetos<br/>lib/objetos.ts]
  S[contornos<br/>clique · modelo · referência] --> E
  E -->|pareia marcaId → contém → mais próximo| O[objetos 1..N<br/>marca · marca+contorno · contorno]
  O --> C[contagem]
  O --> T[tabela de medidas → CSV<br/>objeto_id = índice]
  O --> K[índices no canvas — tecla 2]
  O --> L[lista do inspetor]
  O --> G[fantasmas das regras]
```

Regras que não caem: contorno de clique é a forma da marcação (não conta duas vezes); contorno oculto não conta (esconder = rejeitar); contorno de referência conta e vai marcado no CSV.

## 3. Receita: do ensaio ao lote

```mermaid
flowchart TD
  I[imagem aberta] --> EN[ensaio ao carregar<br/>Padrão · Sensível · Conservador · Pela espécie · salvas]
  EN -->|hover| F1[fantasma tracejado no canvas]
  EN -->|Usar esta| R[receita ativa nos controles de Encontrar]
  R -->|mexer num controle| F2[re-executa · fantasma até Aplicar]
  F2 -->|Aplicar| O[objetos entram no estado]
  R -->|Salvar como receita| DB[(Dexie: receitas por espécie)]
  DB --> EN
  O --> RG[regras semi-automáticas<br/>filtro depois da medida · fantasma antes de aplicar]
  R -. C1, planejado .-> LOTE[lote: a mesma receita em N imagens<br/>fila · regiões · pasta]
```

Limites de tamanho: `× mediana` (transfere entre imagens), `mm²` (com calibração) ou `px²` (referência) — tudo vira px² antes de rodar.

## 4. A escala: o que é declaração e o que é medida

```mermaid
flowchart LR
  D[DPI do driver<br/>declaração] -->|método dpi| U[µm/px]
  R[régua na imagem<br/>medida] -->|método referência| U
  P[micrômetro de platina] -->|método micrômetro| U
  U --> B[barra de escala no canvas<br/>mm · px]
  U --> T[medidas em mm no CSV e no laudo]
  R -. auditoria 16/09 .-> A[4735–4771 DPI medidos<br/>onde o driver dizia 3600]
```

Consequência registrada: o padrão do laboratório passou a 4800 DPI; toda medida em mm feita antes com 3600 estava 32% maior que o real. O DPI do driver é promessa; a régua é a conferência.

## 5. Datasets: abrir a pasta e trabalhar

```mermaid
flowchart TD
  P[apontar a pasta datasets/<br/>File System Access · handle lembrado] --> F[reconhecerFormato por conjunto<br/>yolo · multiclass · máscara de instância · máscara binária · pasta por classe · solto]
  F --> G[miniaturas por conjunto · filtro por classe]
  G -->|clique| I[imagem carregada + Metadata.dataset]
  I -->|segundo gesto| REF[Carregar referência<br/>polígonos → contornos 'referencia' · caixas → marcas]
  REF --> CMP[comparar com o que o app encontrou]
  F -. B4, planejado .-> PM[perfil medido por classe<br/>substitui a literatura no inspetor]
```

## 6. O que ainda é plano (fila em `docs/superpowers/specs/2026-09-15-fila-bancadas-lote-eixos.md`)

```mermaid
flowchart LR
  C7[C7 chip de espécie<br/>no cabeçalho] --> C8[C8 marca e canto superior]
  C8 --> B4[B4 perfil medido por classe]
  B4 --> C1[C1 lote em N imagens]
  C1 --> C41[C4.1 sessões na conta]
  C41 --> C6[C6 saúde do código]
  C6 --> C2[C2 bancadas 1–4<br/>aguarda o sim ao desenho]
```

## 7. Bancadas (C2), o desenho que espera aprovação

```mermaid
flowchart TD
  APP[App: tema · flags · sessões · experimentos · painéis · modais] --> B1[Bancada 1<br/>imagem · marcas · contornos · histórico · metadados · calibração]
  APP --> B2[Bancada 2]
  APP --> B3[Bancada 3]
  APP --> B4[Bancada 4]
  B1 & B2 & B3 & B4 --> AT[ativa: barra de ferramentas e painel direito falam com ela]
  EXP[Experiment → PlateRun por data] -->|abrir a placa X em 4 datas| B1 & B2 & B3 & B4
  AT --> CMP[modo comparação<br/>contagens e medidas lado a lado · série no tempo]
```
