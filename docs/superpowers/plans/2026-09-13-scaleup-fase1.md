# Plano de Implementação: Scale-Up Fase 1 - Oráculo Visual e Taxonomia
**Data:** 2026-09-13
**Documento de Origem:** `specs/2026-09-13-escala-industrial-arquitetura.md`

Este plano detalha as etapas atômicas de engenharia para implementar a primeira fase do Lab Copilot.

---

## Fase 1.1: Refatoração de Estado e Arquitetura de Workers

**Objetivo:** Isolar a inferência da thread de UI para habilitar execução paralela (Oráculo Visual).

1. **`src/workers/orchestrator.ts` (NOVO)**
   - Criar um dispatcher de Web Workers.
   - Implementar transferência de buffers `ImageBitmap` via `postMessage(..., [bitmap])` (ou SharedArrayBuffer se headers isolados permitirem) para evitar clones pesados.

2. **`src/workers/pipelines/` (NOVO)**
   - `yolo-strict.worker.ts`: Carrega a sessão ONNX do YOLO com IOU 0.8.
   - `watershed.worker.ts`: Algoritmo H-minima / OpenCV.js lite para física pura.

3. **`src/store/hypothesisStore.ts` (NOVO)**
   - Criar store Zustand dedicada para `state.hypotheses`.
   - Actions: `addHypothesis(id, masks)`, `selectHypothesis(id)`, `clear()`.

## Fase 1.2: UX das Janelas de Hipóteses (Thumbnails)

**Objetivo:** Renderizar os resultados paralelos de forma não obstrutiva.

1. **`src/components/canvas/HypothesisGallery.tsx` (NOVO)**
   - Painel lateral minimizável.
   - Assina `hypothesisStore`. Renderiza um pequeno `<canvas>` de thumbnail por hipótese.
   - Evento `onMouseEnter`: Dispara um preview *ghost* (alpha 50%) sobre o `MarkingCanvas.tsx`.

2. **`src/components/canvas/MarkingCanvas.tsx` (MODIFICADO)**
   - Adicionar layer de preview condicional que consome `state.previewHypothesisMask`.

## Fase 1.3: Componente Taxonômico (Pie Menu / Radial Menu)

**Objetivo:** Implementar a UX super-rápida para taxonomia de subclasses.

1. **`src/lib/math/radial.ts` (NOVO)**
   - Função utilitária `calculateQuadrant(startX, startY, endX, endY): string`.
   - Retorna as direções ('UP', 'RIGHT', 'DOWN', 'LEFT') baseadas no ângulo $\theta$.

2. **`src/components/ui/RadialMenu.tsx` (NOVO)**
   - Componente React invisível até `onContextMenu` (botão direito) disparar no canvas.
   - Renderiza 4 fatias em SVG ao redor do cursor.
   - Trata o evento `onMouseUp` global para registrar a seleção taxonômica na `sessionStore`.

3. **`src/db/schema.ts` (MODIFICADO)**
   - Alterar a modelagem de anotações para aceitar arrays/JSONB de categorias.
   - Migration de IndexedDB (Dexie) de schema v5 para v6.

## Fase 1.4: Integração de DuckDB-Wasm (Analytics)

**Objetivo:** Fazer consultas instantâneas sobre a nova taxonomia.

1. **`src/lib/db/duckdb-client.ts` (NOVO)**
   - Inicializar `@duckdb/duckdb-wasm` no carregamento (Splash screen).
   - Função `syncDexieToDuckDB(sessionId)` para copiar arrays taxonômicos para tabelas em memória.

2. **`src/features/stats/PainelTaxonomia.tsx` (NOVO)**
   - Executar SQL analítico em tempo real para agrupar defeitos mecânicos vs. defeitos fisiológicos baseados no L-Tree.
   - Exibir gráficos Recharts (Pie, Bar).

---

## Validação da Fase 1

- **Teste 1 (Performance):** A UI deve responder a *drag* e *pan* perfeitamente (60 FPS) enquanto 3 pipelines estão calculando hipóteses ao fundo.
- **Teste 2 (Taxonomia):** O usuário deve conseguir alterar a classe de uma semente para "Fungo" em menos de 1 segundo sem usar teclado, usando o Radial Menu.
- **Teste 3 (DuckDB):** Adicionar 2.000 sementes com subclasses complexas e gerar o relatório no dashboard em menos de 500ms.
